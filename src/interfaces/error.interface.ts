export interface ErrorDetail {
  field?: string;
  message: string;
}

export interface ErrorResponseBody {
  success: boolean;
  message: string;
  data: ErrorDetail[] | null;
}

export interface MiddlewareError extends Error {
  code?: string;
  errors?: object[];
  fields?: Record<string, object>;
  issues?: object[];
  status?: number;
  statusCode?: number;
}