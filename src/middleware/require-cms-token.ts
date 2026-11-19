import type { RequestHandler } from 'express';
import { config } from '../config.js';
import { unauthorized } from '../errors.js';

export const requireCmsToken: RequestHandler = (req, _res, next) => {
  if (req.get('authorization') !== `Bearer ${config.CMS_API_TOKEN}`) {
    throw unauthorized();
  }
  next();
};
