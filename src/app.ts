import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { readFileSync } from 'node:fs';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';
import { config } from './config.js';
import { pingDb } from './db.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requireDb } from './middleware/guards.js';
import { cmsPostsRouter, hashtagsRouter, publicPostsRouter } from './posts/post.routes.js';

const openApiSpec = parse(
  readFileSync(new URL('../docs/openapi.yaml', import.meta.url), 'utf8'),
) as swaggerUi.JsonObject;

export const createApp = () => {
  const app = express();

  // helmet tells browsers to load everything over https by default,
  // which leaves /docs blank on a plain http host other than localhost
  app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
  // Location is not readable from browser code unless it is exposed
  app.use(cors({ origin: config.CORS_ORIGIN, exposedHeaders: ['Location'] }));
  app.use(express.json({ limit: '256kb' }));

  app.get('/health', async (_req, res) => {
    const up = await pingDb().then(
      () => true,
      () => false,
    );
    res.status(up ? 200 : 503).json({ status: up ? 'ok' : 'unavailable' });
  });

  app.get('/', (_req, res) => {
    res.redirect('/docs');
  });
  app.get('/openapi.json', (_req, res) => {
    res.json(openApiSpec);
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
