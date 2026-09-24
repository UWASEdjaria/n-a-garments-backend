export interface ErrorDetail {
  field?: string;
  message: string;
}

export interface ErrorResponseBody {
  success: boolean;
  message: string;
  data: ErrorDetail[] | null;
}