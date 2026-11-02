import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import {
  CreateCustomOrderRequest,
  CustomOrderData,
  ProposeQuoteRequest,
  UpdateCustomOrderStatusRequest,
} from '../interfaces/custom-order.interface.js';
import { AppError } from '../utils/appError.js';
import { sendCustomOrderEmail } from '../utils/email.js';
import { NotificationService } from './notification.service.js';


const prisma = new PrismaClient();
const notificationService = new NotificationService();

export class CustomOrderService {
  private formatCustomOrder(
    order: NonNullable<Awaited<ReturnType<typeof prisma.customOrder.findUnique>>>
  ): CustomOrderData {
    const {
      quoteAccessTokenHash: _tokenHash,
      quoteAccessTokenExpiresAt: _tokenExpiry,
      ...safeOrder
    } = order;

    return {
      ...safeOrder,
      quoteTotal: order.quoteTotal === null ? null : Number(order.quoteTotal),
      advanceAmount: order.advanceAmount === null ? null : Number(order.advanceAmount),
      deliveryFee: order.deliveryFee === null ? null : Number(order.deliveryFee),
      additionalCharges: order.additionalCharges === null ? null : Number(order.additionalCharges),
      advancePaidAmount: Number(order.advancePaidAmount),
      balanceAmount: order.balanceAmount === null ? null : Number(order.balanceAmount),
    };
  }
  async createCustomOrder(
    userId: string | null,
    body: CreateCustomOrderRequest
  ): Promise<CustomOrderData> {
    if (!body.name?.trim()) {
      throw new AppError('Name is required', 400);
    }

    if (!body.email?.trim()) {
      throw new AppError('Email is required', 400);
    }

    if (!body.phone?.trim()) {
      throw new AppError('Phone number is required', 400);
    }

    if (!body.garmentType?.trim()) {
      throw new AppError('Garment type is required', 400);
    }

    if (!body.quantity || body.quantity < 1) {
      throw new AppError('Quantity must be at least 1', 400);
    }

    if (!body.description?.trim()) {
      throw new AppError('Description is required', 400);
    }

    if (body.productId) {
      const product = await prisma.product.findUnique({ where: { id: body.productId } });
      if (!product) throw new AppError('Product not found', 404);
      if (product.productType !== 'MADE_TO_ORDER') throw new AppError('Product is not available for made-to-order requests', 400);
    }

    const customOrder = await prisma.customOrder.create({
      data: {
        userId,
        productId: body.productId ?? null,
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        phone: body.phone.trim(),
        garmentType: body.garmentType.trim(),
        quantity: body.quantity,
        measurements: body.measurements?.trim() || null,
        description: body.description.trim(),
        additionalReqs: body.additionalReqs?.trim() || null,
        referenceImageUrls: body.referenceImageUrls ?? [],
      },
    });

    try {
      await sendCustomOrderEmail(
        customOrder.name,
        customOrder.email,
        customOrder.phone,
        customOrder.garmentType,
        customOrder.quantity,
        customOrder.measurements ?? undefined,
        customOrder.description,
        customOrder.additionalReqs ?? undefined,
        customOrder.referenceImageUrls
      );
    } catch (error) {
      console.error(
        'Custom order saved, but email notification failed:',
        error
      );
    }

    try {
      await notificationService.createNotification({
        type: 'CUSTOM_ORDER_RECEIVED',
        title: 'Custom request received',
        message: `${customOrder.name} submitted a new custom order request for ${customOrder.garmentType}.`,
        resourceType: 'CUSTOM_ORDER',
        resourceId: customOrder.id,
        actorName: customOrder.name,
        actorEmail: customOrder.email,
      });
    } catch (error) {
      console.error('Failed to create admin notification for custom order:', error);
    }

    return this.formatCustomOrder(customOrder);
  }

  async getMyCustomOrders(userId: string): Promise<CustomOrderData[]> {
    const orders = await prisma.customOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => this.formatCustomOrder(order));
  }

  async getCustomOrderById(
    id: string,
    userId: string,
    isAdmin: boolean
  ): Promise<CustomOrderData> {
    const order = await prisma.customOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new AppError('Custom order not found', 404);
    }

    if (!isAdmin && order.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    return this.formatCustomOrder(order);
  }

  async getAllCustomOrders(): Promise<CustomOrderData[]> {
    const orders = await prisma.customOrder.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => this.formatCustomOrder(order));
  }

  async proposeQuote(
    id: string,
    body: ProposeQuoteRequest
  ): Promise<CustomOrderData> {
    const existing = await prisma.customOrder.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError('Custom order not found.', 404);
    }

    if (existing.quoteStatus === 'ACCEPTED' || existing.quoteStatus === 'DECLINED') {
      throw new AppError('A decided quote cannot be replaced.', 409);
    }

    const amounts = [
      body.quoteTotal,
      body.advanceAmount,
      body.deliveryFee,
      body.additionalCharges ?? 0,
    ];

    if (amounts.some((amount) => !Number.isFinite(amount) || amount < 0)) {
      throw new AppError('Quote amounts must be valid, non-negative numbers.', 400);
    }

    if (body.quoteTotal <= 0 || body.advanceAmount > body.quoteTotal) {
      throw new AppError('The total must be positive and the advance cannot exceed it.', 400);
    }

    if (!body.estimatedCompletionAt ||
        !Number.isFinite(Date.parse(body.estimatedCompletionAt))) {
      throw new AppError('A valid estimated completion date is required.', 400);
    }

    if (!body.paymentTerms?.trim()) {
      throw new AppError('Payment terms are required.', 400);
    }

    const quoteReference =
      `NAG-Q-${new Date().getFullYear()}-${randomBytes(6).toString('hex').toUpperCase()}`;
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const completionDate = new Date(body.estimatedCompletionAt);

    const updated = await prisma.customOrder.update({
      where: { id },
      data: {
        quoteReference,
        quoteTotal: body.quoteTotal,
        advanceAmount: body.advanceAmount,
        deliveryFee: body.deliveryFee,
        additionalCharges: body.additionalCharges ?? 0,
        balanceAmount: body.quoteTotal - body.advanceAmount,
        estimatedCompletionAt: completionDate,
        paymentTerms: body.paymentTerms.trim(),
        quoteStatus: 'PROPOSED',
        quoteProposedAt: new Date(),
        acceptedAt: null,
        declinedAt: null,
        quoteAccessTokenHash: tokenHash,
        quoteAccessTokenExpiresAt: expiresAt,
        ...(body.adminNotes !== undefined && {
          adminNotes: body.adminNotes.trim() || null,
        }),
      },
    });

    const frontendUrl = (
      process.env.FRONTEND_URL || 'https://nagarments.com'
    ).replace(/\/+$/, '');

    try {
      const { sendCustomOrderQuoteEmail } = await import('../utils/email.js');

      await sendCustomOrderQuoteEmail({
        name: updated.name,
        email: updated.email,
        quoteReference,
        garmentType: updated.garmentType,
        quantity: updated.quantity,
        quoteTotal: Number(updated.quoteTotal),
        advanceAmount: Number(updated.advanceAmount),
        deliveryFee: Number(updated.deliveryFee),
        additionalCharges: Number(updated.additionalCharges),
        estimatedCompletionAt: completionDate,
        paymentTerms: updated.paymentTerms ?? '',
        quoteUrl: `${frontendUrl}/custom-quote/${rawToken}`,
      });
    } catch (error) {
      console.error('Quote saved but customer email could not be sent:', error);
      throw new AppError(
        'The quote was saved, but the email could not be sent. Review the quote before retrying.',
        502
      );
    }

    return this.formatCustomOrder(updated);
  }

  async getQuoteByToken(token: string): Promise<CustomOrderData> {
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      throw new AppError('Quote link is invalid or expired.', 404);
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const order = await prisma.customOrder.findFirst({
      where: {
        quoteAccessTokenHash: tokenHash,
        quoteAccessTokenExpiresAt: { gt: new Date() },
        quoteStatus: 'PROPOSED',
      },
    });

    if (!order) {
      throw new AppError('Quote link is invalid or expired.', 404);
    }

    return this.formatCustomOrder(order);
  }

  async decideQuoteByToken(
    token: string,
    accepted: boolean
  ): Promise<CustomOrderData> {
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      throw new AppError('Quote link is invalid or expired.', 404);
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();

    // Find the exact order belonging to this unexpired, one-time token.
    const existing = await prisma.customOrder.findFirst({
      where: {
        quoteAccessTokenHash: tokenHash,
        quoteAccessTokenExpiresAt: { gt: now },
        quoteStatus: 'PROPOSED',
      },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('This quote is no longer available.', 410);
    }

    // Atomically accept or decline only that exact order.
    const result = await prisma.customOrder.updateMany({
      where: {
        id: existing.id,
        quoteAccessTokenHash: tokenHash,
        quoteAccessTokenExpiresAt: { gt: now },
        quoteStatus: 'PROPOSED',
      },
      data: {
        quoteStatus: accepted ? 'ACCEPTED' : 'DECLINED',
        acceptedAt: accepted ? now : null,
        declinedAt: accepted ? null : now,
        quoteAccessTokenHash: null,
        quoteAccessTokenExpiresAt: null,
      },
    });

    if (result.count !== 1) {
      throw new AppError('This quote is no longer available.', 410);
    }

    const updated = await prisma.customOrder.findUnique({
      where: { id: existing.id },
    });

    if (!updated) {
      throw new AppError('The decided quote could not be retrieved.', 500);
    }

    // A quote decision is not payment confirmation.
    // Do not change paymentStatus in this custom-order flow.
    try {
      const { sendCustomOrderQuoteDecisionEmail } = await import('../utils/email.js');
      const decisionAt = accepted ? updated.acceptedAt : updated.declinedAt;

      if (decisionAt && updated.quoteReference) {
        await sendCustomOrderQuoteDecisionEmail({
          name: updated.name,
          email: updated.email,
          quoteReference: updated.quoteReference,
          garmentType: updated.garmentType,
          quoteStatus: accepted ? 'ACCEPTED' : 'DECLINED',
          decisionAt,
        });
      }
    } catch (error) {
      console.error('Quote decision saved, but admin email notification failed:', error);
    }
    return this.formatCustomOrder(updated);
  }
  async updateCustomOrderStatus(
    id: string,
    body: UpdateCustomOrderStatusRequest
  ): Promise<CustomOrderData> {
    const existingOrder = await prisma.customOrder.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      throw new AppError('Custom order not found', 404);
    }

    const updatedOrder = await prisma.customOrder.update({
      where: { id },
      data: {
        status: body.status,
        ...(body.adminNotes !== undefined && {
          adminNotes: body.adminNotes.trim() || null,
        }),
      },
    });

    return this.formatCustomOrder(updatedOrder);
  }
}

