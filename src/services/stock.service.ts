import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { AddStockDTO, DeleteStockResponse, EditStockDTO, StockEntry, StockSummary } from "../interfaces/stock.interface.js";
import { StockStatus } from "../interfaces/product.interface.js";
import { AppError } from "../utils/appError.js";

const prisma = new PrismaClient();

export class StockService {
  private getStockStatus(quantity: number, minimumStockLevel: number, maximumStockLevel: number): StockStatus {
    if (quantity === 0) return "out_of_stock";
    if (quantity <= minimumStockLevel) return "low";
    if (quantity > maximumStockLevel) return "overstock";
    return "normal";
  }

  public async getAllStock(params: {
    page: number;
    limit: number;
    search?: string;
    status?: StockStatus;
  }): Promise<{ data: StockEntry[]; totalPages: number; totalCount: number; summary: StockSummary }> {
    const { page, limit, search, status } = params;
    const skip = (page - 1) * limit;

    const products = await prisma.product.findMany({
      select: { id: true, stockQuantity: true, minimumStockLevel: true, maximumStockLevel: true },
    });
    const summary: StockSummary = { totalProducts: products.length, lowStock: 0, outOfStock: 0, overstock: 0 };
    for (const product of products) {
      const productStatus = this.getStockStatus(product.stockQuantity, product.minimumStockLevel, product.maximumStockLevel);
      if (productStatus === "low") summary.lowStock += 1;
      if (productStatus === "out_of_stock") summary.outOfStock += 1;
      if (productStatus === "overstock") summary.overstock += 1;
    }

    const productIds = status
      ? products
          .filter((product) => this.getStockStatus(product.stockQuantity, product.minimumStockLevel, product.maximumStockLevel) === status)
          .map((product) => product.id)
      : undefined;
    const where: Prisma.StockEntryWhereInput = {
      ...(productIds && { productId: { in: productIds } }),
      ...(search && {
        product: {
          is: {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      }),
    };

    const [entries, total] = await Promise.all([
      prisma.stockEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { product: { include: { images: true } } },
      }),
      prisma.stockEntry.count({ where }),
    ]);

    return {
      data: entries.map((entry) => ({
        ...entry,
        unitCost: Number(entry.unitCost),
        product: {
          ...entry.product,
          stockStatus: this.getStockStatus(entry.product.stockQuantity, entry.product.minimumStockLevel, entry.product.maximumStockLevel),
        },
      })),
      totalPages: Math.ceil(total / limit),
      totalCount: total,
      summary,
    };
  }

  public async addStock(data: AddStockDTO): Promise<StockEntry> {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: data.productId } });
      if (!product) throw new AppError("Product not found", 404);

      const entry = await tx.stockEntry.create({
        data: {
          productId: data.productId,
          batchCode: data.batchCode?.trim() || `STK-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`,
          quantity: data.quantity,
          unitCost: data.unitCost,
          supplierNote: data.supplierNote || null,
        },
      });

      const updatedProduct = await tx.product.update({
        where: { id: data.productId },
        data: { stockQuantity: { increment: data.quantity } },
        include: { images: true },
      });

      return {
        ...entry,
        unitCost: Number(entry.unitCost),
        product: {
          ...updatedProduct,
          stockStatus: this.getStockStatus(updatedProduct.stockQuantity, updatedProduct.minimumStockLevel, updatedProduct.maximumStockLevel),
        },
      };
    });
  }

  public async editStock(id: string, data: EditStockDTO): Promise<StockEntry> {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.stockEntry.findUnique({ where: { id } });
      if (!existing) throw new AppError("Stock entry not found", 404);
      const quantityDiff = data.quantity !== undefined ? data.quantity - existing.quantity : 0;

      const updated = await tx.stockEntry.update({
        where: { id },
        data: {
          ...(data.batchCode !== undefined && { batchCode: data.batchCode.trim() }),
          ...(data.quantity !== undefined && { quantity: data.quantity }),
          ...(data.unitCost !== undefined && { unitCost: data.unitCost }),
          ...(data.supplierNote !== undefined && { supplierNote: data.supplierNote }),
        },
      });

      if (quantityDiff !== 0) {
        const adjusted = await tx.product.updateMany({
          where: { id: existing.productId, ...(quantityDiff < 0 && { stockQuantity: { gte: -quantityDiff } }) },
          data: { stockQuantity: { increment: quantityDiff } },
        });
        if (adjusted.count === 0) throw new AppError("Batch quantity cannot reduce stock below zero", 400);
      }

      const product = await tx.product.findUniqueOrThrow({ where: { id: existing.productId }, include: { images: true } });
      return {
        ...updated,
        unitCost: Number(updated.unitCost),
        product: {
          ...product,
          stockStatus: this.getStockStatus(product.stockQuantity, product.minimumStockLevel, product.maximumStockLevel),
        },
      };
    });
  }

  public async deleteStock(id: string): Promise<DeleteStockResponse> {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.stockEntry.findUnique({ where: { id } });
      if (!existing) throw new AppError("Stock entry not found", 404);

      const quantityDiff = -existing.quantity;

      const adjusted = await tx.product.updateMany({
        where: { id: existing.productId, stockQuantity: { gte: -quantityDiff } },
        data: { stockQuantity: { increment: quantityDiff } },
      });
      if (adjusted.count === 0) throw new AppError("Cannot delete stock entry: would reduce stock below zero", 400);

      await tx.stockEntry.delete({ where: { id } });

      return { success: true, message: "Stock entry deleted successfully" };
    });
  }
}