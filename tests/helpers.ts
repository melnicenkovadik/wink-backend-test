import request from 'supertest';
import { createApp } from '../src/app.js';

export const app = createApp();

export const AUTH = { Authorization: 'Bearer wink-cms-hardcoded-token' };

export const UNKNOWN_ID = '507f1f77bcf86cd799439011';

export type PostBody = {
  id: string;
  title: string;
  body: string;
  hashtags: string[];
  status: 'draft' | 'published';
  author: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export const createPost = async (overrides: Record<string, unknown> = {}) => {
  const res = await request(app)
    .post('/api/v1/cms/posts')
    .set(AUTH)
    .send({ title: 'Hello', body: 'First post', ...overrides })
    .expect(201);
  return res.body.data as PostBody;
};
