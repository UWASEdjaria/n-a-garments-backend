import { Body, Controller, Get, Path, Post, Put, Query, Route, Security, SuccessResponse, Tags } from "tsoa";
import { AddStockDTO, EditStockDTO, StockEntry } from "../interfaces/stock.interface";
import { StockService } from "../services/stock.service";
import { addStockSchema, editStockSchema } from "../validators/stock.validator";

@Route("stock")
@Tags("Stock")
@Security("jwt", ["ADMIN"])
export class StockController extends Controller {
  private stockService = new StockService();

  @Get("/")
  public async listStockEntries(
    @Query() page: number = 1,
    @Query() limit: number = 10
  ): Promise<{ data: StockEntry[]; totalPages: number }> {
    return await this.stockService.getAllStock({ 
      page: Number(page), 
      limit: Number(limit) 
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
}