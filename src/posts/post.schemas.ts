import { z } from 'zod';
import { isValidHashtag, normalizeHashtag } from './hashtags.js';
import { POST_STATUSES } from './post.model.js';

const hashtags = z
  .array(
    z
      .string()
      .transform(normalizeHashtag)
      .refine(isValidHashtag, 'Hashtag must be 1-50 letters, digits or underscores'),
  )
  .max(20)
  .transform((tags) => [...new Set(tags)]);

// digits only: z.coerce would also take "1e2" or " 5"
const positiveInt = (max: number, fallback: number) =>
  z
    .string()
    .regex(/^\d+$/, 'Must be a whole number')
    .transform(Number)
    .pipe(z.number().int().min(1).max(max))
    .default(fallback);

// ?hashtags=a,b and ?hashtags=a&hashtags=b both work
const hashtagFilter = z
  .union([z.string(), z.array(z.string())])
  .default([])
  .transform((value) =>
    [value]
      .flat()
      .flatMap((part) => part.split(','))
      .filter((tag) => tag.trim() !== ''),
  )
  .pipe(hashtags);

const listQuery = {
  page: positiveInt(1000, 1),
  limit: positiveInt(100, 20),
  hashtags: hashtagFilter,
};

export const postParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid post id'),
});

// max is checked before trim, same as in openapi.yaml
const title = z.string().max(200).trim().min(1);
// not trimmed: leading spaces mean something in Markdown
const body = z
  .string()
  .max(50_000)
  .refine((text) => text.trim() !== '', 'Body must not be empty');

export const createPostSchema = z.strictObject({
  title,
  body,
  hashtags: hashtags.default([]),
  status: z.enum(POST_STATUSES).default('draft'),
});

export const updatePostSchema = z
  .strictObject({
    title: title.optional(),
    body: body.optional(),
    hashtags: hashtags.optional(),
  })
  .refine((fields) => Object.keys(fields).length > 0, 'Send at least one field to update');

// strict, so a typo like ?hashtag=node is a 400 and not a silently ignored filter
export const publicListQuerySchema = z.strictObject(listQuery);

export const cmsListQuerySchema = z.strictObject({
  ...listQuery,
  status: z.enum(POST_STATUSES).optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type PublicListQuery = z.infer<typeof publicListQuerySchema>;
export type CmsListQuery = z.infer<typeof cmsListQuerySchema>;
