import { PrismaClient } from "@prisma/client";
import { AddStockDTO, EditStockDTO, StockEntry } from "../interfaces/stock.interface";
import { AppError } from "../utils/appError";

const prisma = new PrismaClient();

export class StockService {
  public async getAllStock(params: { page: number; limit: number }): Promise<{ data: StockEntry[]; totalPages: number }> {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      prisma.stockEntry.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.stockEntry.count(),
    ]);

    return {
      data: entries.map((e) => ({ ...e, unitCost: Number(e.unitCost) })),
      totalPages: Math.ceil(total / limit),
    };
  }

  public async addStock(data: AddStockDTO): Promise<StockEntry> {
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new AppError("Product not found", 404);

    return await prisma.$transaction(async (tx) => {
      const entry = await tx.stockEntry.create({
        data: {
          productId: data.productId,
          quantity: data.quantity,
          unitCost: data.unitCost,
          supplierNote: data.supplierNote || null,
        },
      });

      await tx.product.update({
        where: { id: data.productId },
        data: { stockQuantity: { increment: data.quantity } },
      });

      return { ...entry, unitCost: Number(entry.unitCost) };
    });
  }

  public async editStock(id: string, data: EditStockDTO): Promise<StockEntry> {
    const existing = await prisma.stockEntry.findUnique({ where: { id } });
    if (!existing) throw new AppError("Stock entry not found", 404);

    return await prisma.$transaction(async (tx) => {
      const quantityDiff = data.quantity !== undefined ? data.quantity - existing.quantity : 0;

      const updated = await tx.stockEntry.update({
        where: { id },
        data: {
          ...(data.quantity !== undefined && { quantity: data.quantity }),
          ...(data.unitCost !== undefined && { unitCost: data.unitCost }),
          ...(data.supplierNote !== undefined && { supplierNote: data.supplierNote }),
        },
      });

      if (quantityDiff !== 0) {
        await tx.product.update({
          where: { id: existing.productId },
          data: { stockQuantity: { increment: quantityDiff } },
        });
      }

      return { ...updated, unitCost: Number(updated.unitCost) };
    });
  }
}