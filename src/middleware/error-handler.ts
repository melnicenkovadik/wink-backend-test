import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, notFound, type ErrorDetail } from '../errors.js';

const sendError = (
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: ErrorDetail[],
) => {
  res.status(status).json({ error: { code, message, details } });
};

// express.json() reports its failures through a `type` field on the error
const bodyParserErrorType = (err: unknown) =>
  typeof err === 'object' && err !== null && 'type' in err ? err.type : undefined;

export const notFoundHandler: RequestHandler = (req) => {
  throw notFound(`Route ${req.method} ${req.path} not found`);
};

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return sendError(res, 400, 'VALIDATION_ERROR', 'Request validation failed', details);
  }

  if (err instanceof AppError) {
    if (err.status === 401) res.set('WWW-Authenticate', 'Bearer');
    return sendError(res, err.status, err.code, err.message, err.details);
  }

  const parserError = bodyParserErrorType(err);
  if (parserError === 'entity.parse.failed') {
    return sendError(res, 400, 'INVALID_JSON', 'Request body is not valid JSON');
  }
  if (parserError === 'entity.too.large') {
    return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }

  console.error(err);
  sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
};
