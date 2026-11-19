import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { isDbDownError } from '../db.js';
import { AppError, notFound, serviceUnavailable } from '../errors.js';

type ErrorDetail = { path: string; message: string };

const sendError = (
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: ErrorDetail[],
) => {
  res.status(status).json({ error: { code, message, details } });
};

// body-parser errors come with a `type`
const BODY_PARSER_ERRORS: Record<string, [status: number, code: string, message: string]> = {
  'entity.parse.failed': [400, 'INVALID_JSON', 'Request body is not valid JSON'],
  'request.aborted': [400, 'BAD_REQUEST', 'Request body was not received completely'],
  'request.size.invalid': [400, 'BAD_REQUEST', 'Request body does not match Content-Length'],
  'entity.too.large': [413, 'PAYLOAD_TOO_LARGE', 'Request body is too large'],
  'charset.unsupported': [415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported request charset'],
  'encoding.unsupported': [415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported content encoding'],
};

const bodyParserError = (err: unknown) =>
  typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string'
    ? BODY_PARSER_ERRORS[err.type]
    : undefined;

// broken gzip, bad url encoding etc.
const isClientError = (err: unknown) =>
  typeof err === 'object' &&
  err !== null &&
  'status' in err &&
  typeof err.status === 'number' &&
  err.status >= 400 &&
  err.status < 500;

export const notFoundHandler: RequestHandler = (req) => {
  throw notFound(`Route ${req.method} ${req.path} not found`);
};

export const errorHandler: ErrorRequestHandler = (thrown: unknown, _req, res, _next) => {
  const err = isDbDownError(thrown) ? serviceUnavailable() : thrown;

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return sendError(res, 400, 'VALIDATION_ERROR', 'Request validation failed', details);
  }

  if (err instanceof AppError) {
    res.set(err.headers);
    return sendError(res, err.status, err.code, err.message);
  }

  const parserError = bodyParserError(err);
  if (parserError) return sendError(res, ...parserError);

  if (isClientError(err)) {
    return sendError(res, 400, 'BAD_REQUEST', 'Request could not be read');
  }

  console.error(err);
  sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
};
