import type { RequestHandler } from 'express';
import { config } from '../config.js';
import { unauthorized } from '../errors.js';

export const requireCmsToken: RequestHandler = (req, _res, next) => {
  // the scheme name is case-insensitive (RFC 9110), the token is compared exactly
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || token !== config.CMS_API_TOKEN) {
    throw unauthorized();
  }
  next();
};
