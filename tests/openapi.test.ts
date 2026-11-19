import { readFileSync } from 'node:fs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { app, AUTH, UNKNOWN_ID } from './helpers.js';

type Operation = { responses: Record<string, unknown> };
type Spec = {
  paths: Record<string, Record<string, Operation>>;
  components: {
    schemas: { Error: { properties: { error: { properties: { code: { enum: string[] } } } } } };
  };
};

const spec = parse(readFileSync('docs/openapi.yaml', 'utf8')) as Spec;
const errorCodes = spec.components.schemas.Error.properties.error.properties.code.enum;

const METHODS = ['get', 'post', 'patch', 'delete'] as const;

const operations = Object.entries(spec.paths).flatMap(([path, item]) =>
  METHODS.filter((method) => item[method]).map(
    (method) => [method, path, Object.keys(item[method]?.responses ?? {})] as const,
  ),
);

// the spec is written by hand, this keeps it from drifting away from the app
describe('openapi.yaml', () => {
  it('is served as JSON', async () => {
    const res = await request(app).get('/openapi.json').expect(200);
    expect(Object.keys(res.body.paths)).toEqual(Object.keys(spec.paths));
  });

  it.each(operations)(
    '%s %s exists and answers a documented status',
    async (method, path, documented) => {
      const res = await request(app)[method](path.replace('{id}', UNKNOWN_ID)).set(AUTH);

      expect(documented).toContain(String(res.status));
      expect(res.status).not.toBe(405);
      if (res.status >= 400) expect(errorCodes).toContain(res.body.error.code);
    },
  );

  it.each(operations.filter(([, path]) => path.includes('/cms/')))(
    '%s %s is documented as protected',
    async (method, path, documented) => {
      await request(app)[method](path.replace('{id}', UNKNOWN_ID)).expect(401);
      expect(documented).toContain('401');
    },
  );
});
