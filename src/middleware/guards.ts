import type { RequestHandler } from 'express';
import { connectDb } from '../db.js';
import { methodNotAllowed, unsupportedMediaType } from '../errors.js';

// does nothing once connected. matters when the first connection failed (a serverless
// cold start while MongoDB was down): the next request tries again
export const requireDb: RequestHandler = async (_req, _res, next) => {
  await connectDb();
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
