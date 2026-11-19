import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, AUTH, createPost, UNKNOWN_ID } from './helpers.js';

const CMS = '/api/v1/cms/posts';

describe('CMS auth', () => {
  it('rejects calls without a token', async () => {
    const res = await request(app).get(CMS).expect(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('accepts the Bearer scheme in any case', async () => {
    const token = AUTH.Authorization.replace('Bearer ', '');
    await request(app).get(CMS).set('Authorization', `Bearer ${token}`).expect(200);
    await request(app).get(CMS).set('Authorization', `bearer ${token}`).expect(200);
  });

  it('reads the whole header: extra spaces are fine, extra words are not', async () => {
    const token = AUTH.Authorization.replace('Bearer ', '');
    await request(app).get(CMS).set('Authorization', `Bearer   ${token}`).expect(200);
    await request(app).get(CMS).set('Authorization', `Bearer ${token} extra`).expect(401);
    await request(app).get(CMS).set('Authorization', `Basic ${token}`).expect(401);
  });

  it('compares the token itself exactly', async () => {
    const token = AUTH.Authorization.replace('Bearer ', '');
    const changedCase = token.replace('wink', 'Wink');
    await request(app).get(CMS).set('Authorization', `Bearer ${changedCase}`).expect(401);
    await request(app).get(CMS).set('Authorization', token).expect(401);
  });

  it('rejects a wrong token', async () => {
    await request(app).post(CMS).set('Authorization', 'Bearer nope').send({}).expect(401);
    await request(app).delete(`${CMS}/${UNKNOWN_ID}`).set('Authorization', 'nope').expect(401);
  });
});

describe('create a post', () => {
  it('creates a draft by Brian Fox with no hashtags by default', async () => {
    const res = await request(app)
      .post(CMS)
      .set(AUTH)
      .send({ title: '  Hello  ', body: 'First post' })
      .expect(201);

    expect(res.body.data).toMatchObject({
      title: 'Hello',
      body: 'First post',
      hashtags: [],
      status: 'draft',
      author: 'Brian Fox',
      publishedAt: null,
    });
    expect(res.body.data.id).toMatch(/^[0-9a-f]{24}$/);
  });

  it('returns a Location that opens the new draft in the CMS', async () => {
    const created = await request(app)
      .post(CMS)
      .set(AUTH)
      .send({ title: 'Hello', body: 'First post' })
      .expect(201);
    const location = created.headers.location as string;

    expect(location).toBe(`${CMS}/${created.body.data.id}`);
    const res = await request(app).get(location).set(AUTH).expect(200);
    expect(res.body.data.status).toBe('draft');
  });

  it('can create a post that is published right away', async () => {
    const post = await createPost({ status: 'published' });
    expect(post.status).toBe('published');
    expect(post.publishedAt).not.toBeNull();
  });

  it('normalizes hashtags and removes duplicates', async () => {
    const post = await createPost({ hashtags: ['#NodeJS', ' nodejs ', 'Express'] });
    expect(post.hashtags).toEqual(['nodejs', 'express']);
  });

  it.each([
    ['missing title', { body: 'text' }],
    ['empty body', { title: 'Hello', body: '   ' }],
    ['unknown status', { title: 'Hello', body: 'text', status: 'archived' }],
    ['client-provided author', { title: 'Hello', body: 'text', author: 'Someone Else' }],
    ['hashtags as a string', { title: 'Hello', body: 'text', hashtags: 'node' }],
    ['hashtags as null', { title: 'Hello', body: 'text', hashtags: null }],
    ['non-string hashtag', { title: 'Hello', body: 'text', hashtags: [1] }],
    ['hashtag with a space', { title: 'Hello', body: 'text', hashtags: ['two words'] }],
  ])('rejects %s with 400', async (_name, payload) => {
    const res = await request(app).post(CMS).set(AUTH).send(payload).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('keeps the body exactly as sent, indentation included', async () => {
    const body = '    const indented = true;\n';
    const post = await createPost({ title: '  Hello  ', body });
    expect(post.body).toBe(body);
    expect(post.title).toBe('Hello');
  });

  it.each(['"a string"', '42', 'null', '[]'])('rejects the JSON body %s with 400', async (raw) => {
    await request(app)
      .post(CMS)
      .set(AUTH)
      .set('Content-Type', 'application/json')
      .send(raw)
      .expect(400);
  });

  it('counts the length limit before trimming, as the OpenAPI schema does', async () => {
    const padded = ` ${'a'.repeat(200)} `;
    await request(app).post(CMS).set(AUTH).send({ title: padded, body: 'text' }).expect(400);
    const post = await createPost({ title: 'a'.repeat(200) });
    expect(post.title).toHaveLength(200);
  });

  it('rejects a body that is not JSON with 415', async () => {
    const post = await createPost();
    const json = '{"title":"Hello","body":"First post"}';

    const created = await request(app)
      .post(CMS)
      .set(AUTH)
      .set('Content-Type', 'text/plain')
      .send(json)
      .expect(415);
    await request(app)
      .patch(`${CMS}/${post.id}`)
      .set(AUTH)
      .set('Content-Type', 'text/plain')
      .send(json)
      .expect(415);

    expect(created.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects a request without a body', async () => {
    const res = await request(app).post(CMS).set(AUTH).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('edit a post', () => {
  it('changes only the fields that were sent', async () => {
    const post = await createPost({ title: 'Old title', hashtags: ['node'] });

    const res = await request(app)
      .patch(`${CMS}/${post.id}`)
      .set(AUTH)
      .send({ title: 'New title', hashtags: ['#Express', 'express'] })
      .expect(200);

    expect(res.body.data).toMatchObject({
      id: post.id,
      title: 'New title',
      body: post.body,
      hashtags: ['express'],
      status: 'draft',
      author: 'Brian Fox',
    });
  });

  it('keeps a published post published with the same publish date', async () => {
    const post = await createPost({ status: 'published' });

    const res = await request(app)
      .patch(`${CMS}/${post.id}`)
      .set(AUTH)
      .send({ body: 'Fixed a typo' })
      .expect(200);

    expect(res.body.data.status).toBe('published');
    expect(res.body.data.publishedAt).toBe(post.publishedAt);
    const blog = await request(app).get(`/api/v1/posts/${post.id}`).expect(200);
    expect(blog.body.data.body).toBe('Fixed a typo');
  });

  it.each([
    ['an empty object', {}],
    ['status', { status: 'published' }],
    ['author', { author: 'Someone Else' }],
    ['an empty title', { title: ' ' }],
    ['hashtags as a string', { hashtags: 'node' }],
  ])('rejects %s with 400', async (_name, payload) => {
    const post = await createPost();
    const res = await request(app).patch(`${CMS}/${post.id}`).set(AUTH).send(payload).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('answers 404 for an unknown id and 401 without a token', async () => {
    await request(app).patch(`${CMS}/${UNKNOWN_ID}`).set(AUTH).send({ title: 'x' }).expect(404);
    await request(app).patch(`${CMS}/${UNKNOWN_ID}`).send({ title: 'x' }).expect(401);
  });
});

describe('publish a post', () => {
  it('turns a draft into a published post in the first response', async () => {
    const draft = await createPost();
    const res = await request(app).post(`${CMS}/${draft.id}/publish`).set(AUTH).expect(200);

    expect(res.body.data.status).toBe('published');
    expect(res.body.data.publishedAt).not.toBeNull();
  });

  it('keeps the original publish date when published again', async () => {
    const draft = await createPost();
    const first = await request(app).post(`${CMS}/${draft.id}/publish`).set(AUTH).expect(200);
    const second = await request(app).post(`${CMS}/${draft.id}/publish`).set(AUTH).expect(200);

    expect(second.body.data.status).toBe('published');
    expect(second.body.data.publishedAt).toBe(first.body.data.publishedAt);
  });

  it('gives two concurrent requests the same publish date', async () => {
    const draft = await createPost();
    const publish = () => request(app).post(`${CMS}/${draft.id}/publish`).set(AUTH).expect(200);

    const [a, b] = await Promise.all([publish(), publish()]);
    const stored = await request(app).get(`${CMS}/${draft.id}`).set(AUTH).expect(200);

    expect(a.body.data.status).toBe('published');
    expect(b.body.data.status).toBe('published');
    expect(a.body.data.publishedAt).not.toBeNull();
    expect(b.body.data.publishedAt).toBe(a.body.data.publishedAt);
    expect(stored.body.data.publishedAt).toBe(a.body.data.publishedAt);
  });

  it('answers 404 for an unknown id and 400 for a malformed one', async () => {
    await request(app).post(`${CMS}/${UNKNOWN_ID}/publish`).set(AUTH).expect(404);
    await request(app).post(`${CMS}/not-an-id/publish`).set(AUTH).expect(400);
  });
});

describe('delete a post', () => {
  it('deletes with 204 and an empty body, then the post is gone everywhere', async () => {
    const post = await createPost({ status: 'published' });

    const res = await request(app).delete(`${CMS}/${post.id}`).set(AUTH).expect(204);
    expect(res.text).toBe('');

    await request(app).get(`${CMS}/${post.id}`).set(AUTH).expect(404);
    await request(app).get(`/api/v1/posts/${post.id}`).expect(404);
    await request(app).delete(`${CMS}/${post.id}`).set(AUTH).expect(404);
  });

  it('answers 400 for a malformed id', async () => {
    await request(app).delete(`${CMS}/123`).set(AUTH).expect(400);
  });
});

describe('CMS list', () => {
  it('shows drafts and published posts, newest first', async () => {
    const draft = await createPost({ title: 'Draft' });
    const published = await createPost({ title: 'Published', status: 'published' });

    const res = await request(app).get(CMS).set(AUTH).expect(200);

    expect(res.body.data.map((post: { id: string }) => post.id)).toEqual([published.id, draft.id]);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('filters by status', async () => {
    const draft = await createPost();
    await createPost({ status: 'published' });

    const res = await request(app).get(`${CMS}?status=draft`).set(AUTH).expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(draft.id);
    expect(res.body.meta.total).toBe(1);
  });

  it('filters by hashtags, drafts included', async () => {
    const draft = await createPost({ hashtags: ['node'] });
    const published = await createPost({ hashtags: ['express'], status: 'published' });
    await createPost({ hashtags: ['other'] });

    const res = await request(app).get(`${CMS}?hashtags=node,express`).set(AUTH).expect(200);
    const drafts = await request(app)
      .get(`${CMS}?hashtags=node,express&status=draft`)
      .set(AUTH)
      .expect(200);

    expect(res.body.data.map((post: { id: string }) => post.id)).toEqual([published.id, draft.id]);
    expect(drafts.body.data.map((post: { id: string }) => post.id)).toEqual([draft.id]);
  });

  it('rejects an unknown query parameter', async () => {
    await request(app).get(`${CMS}?state=draft`).set(AUTH).expect(400);
  });
});
