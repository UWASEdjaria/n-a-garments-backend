import { Body, Controller, Delete, Get, Path, Post, Put, Query, Route, Security, SuccessResponse, Tags } from "tsoa";
import { AddStockDTO, DeleteStockResponse, EditStockDTO, StockEntry, StockSummary } from "../interfaces/stock.interface.js";
import { StockStatus } from "../interfaces/product.interface.js";
import { StockService } from "../services/stock.service.js";
import { addStockSchema, editStockSchema } from "../validators/stock.validator.js";

@Route("stock")
@Tags("Stock")
@Security("jwt", ["ADMIN"])
export class StockController extends Controller {
  private stockService = new StockService();

  @Get("/")
  public async listStockEntries(
    @Query() page: number = 1,
    @Query() limit: number = 10,
    @Query() search?: string,
    @Query() status?: StockStatus
  ): Promise<{ data: StockEntry[]; totalPages: number; totalCount: number; summary: StockSummary }> {
    return await this.stockService.getAllStock({ 
      page: Number(page), 
      limit: Number(limit),
      search,
      status,
    });
  }

  @Post("/")
  @SuccessResponse(201, "Created")
  public async addStockEntry(
    @Body() requestBody: AddStockDTO
  ): Promise<StockEntry> {
    addStockSchema.parse(requestBody);
    return await this.stockService.addStock(requestBody);
  }

  @Put("/{id}")
  public async updateStockEntry(
    @Path() id: string,
    @Body() requestBody: EditStockDTO
  ): Promise<StockEntry> {
    editStockSchema.parse(requestBody);
    return await this.stockService.editStock(id, requestBody);
  }

  @Delete("/{id}")
  @SuccessResponse(200, "Deleted")
  public async deleteStockEntry(
    @Path() id: string
  ): Promise<DeleteStockResponse> {
    return await this.stockService.deleteStock(id);
  }
}