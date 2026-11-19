import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, AUTH } from './helpers.js';

describe('app', () => {
  it('reports health', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('serves the API docs', async () => {
    const res = await request(app).get('/docs/').expect(200);
    expect(res.text).toContain('swagger-ui');
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

  it('rejects a body over the size limit with 413', async () => {
    const res = await request(app)
      .post('/api/v1/cms/posts')
      .set(AUTH)
      .send({ title: 'Big', body: 'x'.repeat(300 * 1024) })
      .expect(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
