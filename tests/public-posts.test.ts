import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Post } from '../src/posts/post.model.js';
import { app, AUTH, createPost, UNKNOWN_ID } from './helpers.js';

const BLOG = '/api/v1/posts';

const ids = (res: request.Response) => (res.body.data as { id: string }[]).map((post) => post.id);

describe('public list', () => {
  it('needs no token and shows only published posts', async () => {
    await createPost({ title: 'Draft' });
    const published = await createPost({ title: 'Published', status: 'published' });

    const res = await request(app).get(BLOG).expect(200);

    expect(ids(res)).toEqual([published.id]);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it('hides a draft that shares a hashtag with a published post', async () => {
    const draft = await createPost({ hashtags: ['node'] });
    const published = await createPost({ hashtags: ['node'], status: 'published' });

    const res = await request(app).get(`${BLOG}?hashtags=node`).expect(200);

    expect(ids(res)).toEqual([published.id]);
    expect(res.body.meta.total).toBe(1);
    await request(app).get(`${BLOG}/${draft.id}`).expect(404);
  });

  it('puts the most recently published post first', async () => {
    const older = await createPost({ title: 'Written first' });
    const newer = await createPost({ title: 'Written second', status: 'published' });
    await request(app).post(`/api/v1/cms/posts/${older.id}/publish`).set(AUTH).expect(200);

    const res = await request(app).get(BLOG).expect(200);

    expect(ids(res)).toEqual([older.id, newer.id]);
  });

  it('keeps a stable order across pages when publish dates are equal', async () => {
    const publishedAt = new Date('2026-01-01T00:00:00.000Z');
    const posts = await Post.insertMany(
      ['A', 'B', 'C'].map((title) => ({ title, body: 'text', status: 'published', publishedAt })),
    );
    const newestFirst = posts.map((post) => post.id as string).reverse();

    const first = await request(app).get(`${BLOG}?limit=2&page=1`).expect(200);
    const second = await request(app).get(`${BLOG}?limit=2&page=2`).expect(200);

    expect([...ids(first), ...ids(second)]).toEqual(newestFirst);
    expect(first.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
  });

  it('returns an empty page past the end', async () => {
    await createPost({ status: 'published' });
    const res = await request(app).get(`${BLOG}?page=5`).expect(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(1);
  });

  it.each([
    'page=0',
    'limit=0',
    'limit=101',
    'limit=abc',
    'hashtags=a&hashtags=b',
    'hashtags=c%2B%2B',
  ])('rejects ?%s with 400', async (query) => {
    const res = await request(app).get(`${BLOG}?${query}`).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('filter by hashtags', () => {
  it('returns posts that have any of the given hashtags', async () => {
    const node = await createPost({ hashtags: ['node'], status: 'published' });
    const express = await createPost({ hashtags: ['express', 'api'], status: 'published' });
    await createPost({ hashtags: ['mongodb'], status: 'published' });

    const one = await request(app).get(`${BLOG}?hashtags=node`).expect(200);
    const two = await request(app).get(`${BLOG}?hashtags=node,express`).expect(200);

    expect(ids(one)).toEqual([node.id]);
    expect(ids(two)).toEqual([express.id, node.id]);
    expect(two.body.meta.total).toBe(2);
  });

  it('matches regardless of case and a leading #', async () => {
    const post = await createPost({ hashtags: ['NodeJS'], status: 'published' });

    const res = await request(app).get(`${BLOG}?hashtags=%23NodeJS,express`).expect(200);

    expect(ids(res)).toEqual([post.id]);
  });

  it('returns an empty list for a hashtag nobody uses', async () => {
    await createPost({ hashtags: ['node'], status: 'published' });
    const res = await request(app).get(`${BLOG}?hashtags=unknown`).expect(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it('treats an empty hashtags parameter as no filter', async () => {
    await createPost({ hashtags: ['node'], status: 'published' });
    const res = await request(app).get(`${BLOG}?hashtags=`).expect(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('public single post', () => {
  it('returns a published post', async () => {
    const post = await createPost({ status: 'published', hashtags: ['node'] });
    const res = await request(app).get(`${BLOG}/${post.id}`).expect(200);
    expect(res.body.data).toEqual(post);
  });

  it('answers 404 for a draft and for an unknown id, 400 for a malformed id', async () => {
    const draft = await createPost();
    await request(app).get(`${BLOG}/${draft.id}`).expect(404);
    await request(app).get(`${BLOG}/${UNKNOWN_ID}`).expect(404);
    await request(app).get(`${BLOG}/42`).expect(400);
  });
});
