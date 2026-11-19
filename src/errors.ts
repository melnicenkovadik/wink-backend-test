type Headers = Record<string, string>;

export class AppError extends Error {
  status: number;
  code: string;
  headers: Headers;

  constructor(status: number, code: string, message: string, headers: Headers = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export const notFound = (message: string) => new AppError(404, 'NOT_FOUND', message);

export const unauthorized = () =>
  new AppError(401, 'UNAUTHORIZED', 'Missing or invalid bearer token', {
    'WWW-Authenticate': 'Bearer',
  });

export const methodNotAllowed = (allow: string) =>
  new AppError(405, 'METHOD_NOT_ALLOWED', `Allowed methods: ${allow}`, { Allow: allow });

export const unsupportedMediaType = () =>
  new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Request body must be application/json');

export const serviceUnavailable = () =>
  new AppError(503, 'SERVICE_UNAVAILABLE', 'Database is not available', { 'Retry-After': '5' });
