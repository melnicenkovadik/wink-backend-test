import type { RequestHandler } from 'express';
import { config } from '../config.js';
import { unauthorized } from '../errors.js';

export const requireCmsToken: RequestHandler = (req, _res, next) => {
  // the scheme name is case-insensitive (RFC 9110), the token is compared exactly
  const token = /^Bearer +(\S+)$/i.exec(req.get('authorization') ?? '')?.[1];
  if (token !== config.CMS_API_TOKEN) {
    throw unauthorized();
  }
  next();
};
