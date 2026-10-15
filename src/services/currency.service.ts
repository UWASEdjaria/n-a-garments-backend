import countryToCurrency from 'country-to-currency';
import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');

const BASE_CURRENCY = 'RWF';
const CACHE_TTL_MS = 60 * 60 * 1000;

const FALLBACK_RATES: Record<string, number> = {
  RWF: 1,
  USD: 0.00073,
  NGN: 1.18,
};

interface ExchangeRateResponse {
  result: string;
  base_code: string;
  rates: Record<string, number>;
}

interface CachedRates {
  rates: Record<string, number>;
  fetchedAt: number;
}

let cachedRates: CachedRates | null = null;

export interface CountryCurrency {
  countryCode: string;
  countryName: string;
  flag: string;
  currencyCode: string;
}

function createFlag(countryCode: string): string {
  return String.fromCodePoint(
    ...countryCode
      .toUpperCase()
      .split('')
      .map((letter) => 127397 + letter.charCodeAt(0)),
  );
}

function getCountryName(countryCode: string): string {
  return (
    new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) ??
    countryCode
  );
}

export function getSupportedCountries(): CountryCurrency[] {
  return Object.entries(countryToCurrency)
    .map(([countryCode, currencyCode]) => ({
      countryCode,
      countryName: getCountryName(countryCode),
      flag: createFlag(countryCode),
      currencyCode,
    }))
    .sort((a, b) => a.countryName.localeCompare(b.countryName));
}

export async function getExchangeRates(): Promise<{
  baseCurrency: string;
  rates: Record<string, number>;
  source: 'live' | 'fallback';
}> {
  const now = Date.now();

  if (cachedRates && now - cachedRates.fetchedAt < CACHE_TTL_MS) {
    return {
      baseCurrency: BASE_CURRENCY,
      rates: cachedRates.rates,
      source: 'live',
    };
  }

  try {
    const response = await fetch(
      `https://open.er-api.com/v6/latest/${BASE_CURRENCY}`,
      { signal: AbortSignal.timeout(5000) },
    );

    if (!response.ok) {
      throw new Error(`Exchange-rate request failed: ${response.status}`);
    }

    const data = (await response.json()) as ExchangeRateResponse;

    if (
      data.result !== 'success' ||
      data.base_code !== BASE_CURRENCY ||
      !data.rates ||
      typeof data.rates.RWF !== 'number'
    ) {
      throw new Error('Invalid exchange-rate response');
    }

    const rates = Object.fromEntries(
      Object.entries(data.rates).filter(
        ([, rate]) => Number.isFinite(rate) && rate > 0,
      ),
    );

    rates.RWF = 1;

    cachedRates = { rates, fetchedAt: now };

    return {
      baseCurrency: BASE_CURRENCY,
      rates,
      source: 'live',
    };
  } catch {
    return {
      baseCurrency: BASE_CURRENCY,
      rates: { ...FALLBACK_RATES },
      source: 'fallback',
    };
  }
}
