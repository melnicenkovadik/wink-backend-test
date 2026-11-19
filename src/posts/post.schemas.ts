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

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const postParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid post id'),
});

export const createPostSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(50_000),
  hashtags: hashtags.default([]),
  status: z.enum(POST_STATUSES).default('draft'),
});

export const publicListQuerySchema = z.object({
  ...pagination,
  hashtags: z
    .string()
    .default('')
    .transform((value) => (value === '' ? [] : value.split(',')))
    .pipe(hashtags),
});

export const cmsListQuerySchema = z.object({
  ...pagination,
  status: z.enum(POST_STATUSES).optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type PublicListQuery = z.infer<typeof publicListQuerySchema>;
export type CmsListQuery = z.infer<typeof cmsListQuerySchema>;
