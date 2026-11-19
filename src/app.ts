import cors from 'cors';
import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { readFileSync } from 'node:fs';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';
import { config } from './config.js';
import { AppError } from './errors.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { cmsPostsRouter, hashtagsRouter, publicPostsRouter } from './posts/post.routes.js';

const openApiSpec = parse(
  readFileSync(new URL('../docs/openapi.yaml', import.meta.url), 'utf8'),
) as swaggerUi.JsonObject;

const dbUp = () => mongoose.connection.readyState === mongoose.ConnectionStates.connected;

// without this mongoose queues the query for 10s and the client gets a 500
const requireDb: RequestHandler = (_req, _res, next) => {
  if (!dbUp()) throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Database is not available');
  next();
};

export const createApp = () => {
  const app = express();

  app.use(helmet());
  // Location is not readable from browser code unless it is exposed
  app.use(cors({ origin: config.CORS_ORIGIN, exposedHeaders: ['Location'] }));
  app.use(express.json({ limit: '256kb' }));

  app.get('/health', (_req, res) => {
    const up = dbUp();
    res.status(up ? 200 : 503).json({ status: up ? 'ok' : 'unavailable' });
  });

  app.get('/', (_req, res) => {
    res.redirect('/docs');
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use('/api/v1', requireDb);
  app.use('/api/v1/posts', publicPostsRouter);
  app.use('/api/v1/hashtags', hashtagsRouter);
  app.use('/api/v1/cms/posts', cmsPostsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
