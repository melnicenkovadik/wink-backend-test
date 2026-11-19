import { gzipSync } from 'node:zlib';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, AUTH } from './helpers.js';

// otherwise superagent stringifies the buffer
const sendAsIs = (body: Buffer) => body as unknown as string;

describe('app', () => {
  it('reports health', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('serves the API docs', async () => {
    const res = await request(app).get('/docs/').expect(200);
    expect(res.text).toContain('swagger-ui');
  });

  it('redirects the root to the docs', async () => {
    const res = await request(app).get('/').expect(302);
    expect(res.headers.location).toBe('/docs');
  });

  it('does not let CMS responses be cached and exposes Location to browsers', async () => {
    const res = await request(app).get('/api/v1/cms/posts').set(AUTH).expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['access-control-expose-headers']).toBe('Location');

    const blog = await request(app).get('/api/v1/posts').expect(200);
    expect(blog.headers['cache-control']).toBeUndefined();
  });

  it('answers unknown routes with a JSON 404', async () => {
    const res = await request(app).get('/api/v1/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/v1/cms/posts')
      .set(AUTH)
      .set('Content-Type', 'application/json')
      .send('{"title": ')
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it.each([
    ['charset', { 'Content-Type': 'application/json; charset=unknown-charset' }],
    ['content encoding', { 'Content-Type': 'application/json', 'Content-Encoding': 'unknown' }],
  ])('rejects an unsupported %s with 415', async (_name, headers) => {
    const res = await request(app)
      .post('/api/v1/cms/posts')
      .set(AUTH)
      .set(headers)
      .send('{"title":"Hello","body":"First post"}')
      .expect(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects a truncated gzip body with 400', async () => {
    const gzipped = gzipSync('{"title":"Hello","body":"First post"}');
    const res = await request(app)
      .post('/api/v1/cms/posts')
      .set(AUTH)
      .set({ 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' })
      .serialize(sendAsIs)
      .send(gzipped.subarray(0, gzipped.length - 6))
      .expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('accepts a valid gzip body', async () => {
    await request(app)
      .post('/api/v1/cms/posts')
      .set(AUTH)
      .set({ 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' })
      .serialize(sendAsIs)
      .send(gzipSync('{"title":"Hello","body":"First post"}'))
      .expect(201);
  });

  it('rejects a malformed URL with 400', async () => {
    const res = await request(app).get('/api/v1/posts/%E0%A4%A').expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects a body over the size limit with 413', async () => {
    const res = await request(app)
      .post('/api/v1/cms/posts')
      .set(AUTH)
      .send({ title: 'Big', body: 'x'.repeat(300 * 1024) })
      .expect(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
