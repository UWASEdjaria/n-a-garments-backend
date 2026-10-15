import { Controller, Get, Route, Tags, SuccessResponse } from 'tsoa';
import {
  getExchangeRates,
  getSupportedCountries,
  type CountryCurrency,
} from '../services/currency.service';

interface ExchangeRatesResponse {
  baseCurrency: string;
  rates: Record<string, number>;
  source: 'live' | 'fallback';
}

@Route('currency')
@Tags('Currency')
export class CurrencyController extends Controller {
  @Get('countries')
  @SuccessResponse('200', 'Supported countries retrieved')
  public getCountries(): CountryCurrency[] {
    return getSupportedCountries();
  }

  @Get('rates')
  @SuccessResponse('200', 'Exchange rates retrieved')
  public async getRates(): Promise<ExchangeRatesResponse> {
    return getExchangeRates();
  }
}
