import { z } from "zod";

export const addStockSchema = z.object({
  productId: z.string({
    error: (issue) => issue.input === undefined ? "Product ID is required" : undefined,
  }).min(1, "Product ID cannot be empty"),
  
  quantity: z
    .number({
      error: (issue) => issue.input === undefined ? "Quantity is required" : "Quantity must be a number",
    })
    .int("Quantity must be a whole integer")
    .positive("Quantity must be greater than 0"),
    
  unitCost: z
    .number({
      error: (issue) => issue.input === undefined ? "Unit cost is required" : "Unit cost must be a number",
    })
    .positive("Unit cost must be greater than 0"),
    
  supplierNote: z.string().max(500, "Supplier note is too long").optional(),
});

export const editStockSchema = z.object({
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int("Quantity must be a whole integer")
    .positive("Quantity must be greater than 0")
    .optional(),
    
  unitCost: z
    .number({ error: "Unit cost must be a number" })
    .positive("Unit cost must be greater than 0")
    .optional(),
    
  supplierNote: z.string().max(500, "Supplier note is too long").optional(),
});