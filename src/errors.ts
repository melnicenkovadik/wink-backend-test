export type ErrorDetail = { path: string; message: string };

export class AppError extends Error {
  status: number;
  code: string;
  details?: ErrorDetail[];

  constructor(status: number, code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (message: string) => new AppError(404, 'NOT_FOUND', message);

export const unauthorized = () =>
  new AppError(401, 'UNAUTHORIZED', 'Missing or invalid bearer token');
