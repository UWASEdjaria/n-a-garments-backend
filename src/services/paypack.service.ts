import { createRequire } from 'node:module';
import { AppError } from '../utils/appError';

interface PaypackConfigOptions {
  client_id: string;
  client_secret: string;
}

interface PaypackCashInParams {
  amount: number;
  number: string;
  environment: 'development' | 'production';
}

interface PaypackCashInResponse {
  data: {
    ref: string;
    status: string;
  };
}

interface PaypackSDKInstance {
  config(options: PaypackConfigOptions): PaypackSDKInstance;
  cashin(params: PaypackCashInParams): Promise<PaypackCashInResponse>;
}

interface PaypackSDKConstructor {
  config(options: PaypackConfigOptions): PaypackSDKInstance;
}

interface PaypackErrorLike {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
}

const require = createRequire(process.cwd() + '/package.json');
const PaypackModule = require('paypack-js') as {
  default?: PaypackSDKConstructor;
  config?: PaypackSDKConstructor['config'];
};
const Paypack = (PaypackModule.default ?? PaypackModule) as PaypackSDKConstructor;

const normalizePaypackError = (
  error: object | null | string | number | boolean | symbol | bigint | undefined
): PaypackErrorLike | undefined => {
  if (!error) {
    return undefined;
  }

  const candidate = error as Partial<PaypackErrorLike>;

  if ('message' in candidate || 'response' in candidate) {
    return {
      message: typeof candidate.message === 'string' ? candidate.message : undefined,
      response: typeof candidate.response === 'object' && candidate.response !== null
        ? candidate.response as PaypackErrorLike['response']
        : undefined,
    };
  }

  return undefined;
};

export class PaypackService {
  private paypack: PaypackSDKInstance;

  constructor() {
    const clientId = process.env.PAYPACK_CLIENT_ID;
    const clientSecret = process.env.PAYPACK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn('Paypack API credentials missing in environment variables.');
    }

    this.paypack = Paypack.config({
      client_id: clientId || '',
      client_secret: clientSecret || '',
    });
  }

  public async cashIn(phoneNumber: string, amount: number): Promise<{ ref: string; status: string }> {
    try {
      let formattedPhone = phoneNumber.replace(/\s+/g, '');
      if (formattedPhone.startsWith('+250')) {
        formattedPhone = '0' + formattedPhone.slice(4);
      } else if (formattedPhone.startsWith('250')) {
        formattedPhone = '0' + formattedPhone.slice(3);
      }

      const params: PaypackCashInParams = {
        number: formattedPhone,
        amount,
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      };

      const response: PaypackCashInResponse = await this.paypack.cashin(params);

      return {
        ref: response.data.ref,
        status: response.data.status,
      };
    } catch (error) {
      const paypackError = normalizePaypackError(
        error as object | null | string | number | boolean | symbol | bigint | undefined
      );

      console.error('Paypack Cash-In Error:', paypackError?.response?.data || paypackError?.message);

      throw new AppError(
        paypackError?.response?.data?.message || paypackError?.message || 'Failed to initiate Mobile Money payment prompt via Paypack.',
        400
      );
    }
  }
}