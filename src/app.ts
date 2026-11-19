import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { cmsPostsRouter, publicPostsRouter } from './posts/post.routes.js';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json({ limit: '256kb' }));

  app.get('/health', (_req, res) => {
    const dbUp = mongoose.connection.readyState === mongoose.ConnectionStates.connected;
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'unavailable' });
  });

  app.use('/api/v1/posts', publicPostsRouter);
  app.use('/api/v1/cms/posts', cmsPostsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
