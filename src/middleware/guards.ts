import type { RequestHandler } from 'express';
import { isDbUp } from '../db.js';
import { methodNotAllowed, serviceUnavailable, unsupportedMediaType } from '../errors.js';

// without this mongoose queues the query for 10s and the client gets a 500
export const requireDb: RequestHandler = (_req, _res, next) => {
  if (!isDbUp()) throw serviceUnavailable();
  next();
};

export const requireJsonBody: RequestHandler = (req, _res, next) => {
  // empty body is fine here, zod will answer 400
  const hasBody = Number(req.get('content-length')) > 0 || req.get('transfer-encoding');
  if (hasBody && !req.is('application/json')) throw unsupportedMediaType();
  next();
};

// drafts should not end up in a browser or proxy cache
export const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

// goes after the real routes of a path
export const allowOnly =
  (methods: string): RequestHandler =>
  () => {
    throw methodNotAllowed(methods);
  };
