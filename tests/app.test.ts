import { gzipSync } from 'node:zlib';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { config } from '../src/config.js';
import { disconnectDb } from '../src/db.js';
import { app, AUTH, UNKNOWN_ID } from './helpers.js';

// otherwise superagent stringifies the buffer
const sendAsIs = (body: Buffer) => body as unknown as string;

describe('app', () => {
  it('reports health', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('serves the API docs, also over plain http', async () => {
    const res = await request(app).get('/docs/').expect(200);
    expect(res.text).toContain('swagger-ui');
    expect(res.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
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

  it.each([
    ['delete', '/api/v1/posts', 'GET, HEAD'],
    ['post', `/api/v1/posts/${UNKNOWN_ID}`, 'GET, HEAD'],
    ['post', '/api/v1/hashtags', 'GET, HEAD'],
    ['put', '/api/v1/cms/posts', 'GET, HEAD, POST'],
    ['put', `/api/v1/cms/posts/${UNKNOWN_ID}`, 'GET, HEAD, PATCH, DELETE'],
    ['get', `/api/v1/cms/posts/${UNKNOWN_ID}/publish`, 'POST'],
  ] as const)('answers %s %s with 405 and Allow', async (method, path, allow) => {
    const res = await request(app)[method](path).set(AUTH).expect(405);
    expect(res.headers.allow).toBe(allow);
    expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('checks the token before the method on CMS paths', async () => {
    await request(app).put('/api/v1/cms/posts').expect(401);
  });

  it('answers 503 while the database is down and recovers on its own', async () => {
    const uri = config.MONGODB_URI;
    await disconnectDb();
    config.MONGODB_URI = 'mongodb://127.0.0.1:1/nothing_here';

    const res = await request(app).get('/api/v1/posts').expect(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(res.headers['retry-after']).toBe('5');
    await request(app).get('/health').expect(503);

    config.MONGODB_URI = uri;
    await request(app).get('/api/v1/posts').expect(200);
    await request(app).get('/health').expect(200);
  });

  it('does not answer 503 to requests that arrive while the connection is still opening', async () => {
    await disconnectDb();

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => request(app).get('/api/v1/posts')),
    );

    expect(responses.map((res) => res.status)).toEqual([200, 200, 200, 200, 200]);
  });

  it('answers a CORS preflight for a CMS call without asking for the token', async () => {
    const res = await request(app)
      .options('/api/v1/cms/posts')
      .set('Origin', 'http://cms.example')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-headers']).toBe('authorization,content-type');
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
