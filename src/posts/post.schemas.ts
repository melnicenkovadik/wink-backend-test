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

const title = z.string().trim().min(1).max(200);
const body = z.string().trim().min(1).max(50_000);

export const createPostSchema = z.strictObject({
  title,
  body,
  hashtags: hashtags.default([]),
  status: z.enum(POST_STATUSES).default('draft'),
});

// status is not editable here: publishing has its own endpoint
export const updatePostSchema = z
  .strictObject({
    title: title.optional(),
    body: body.optional(),
    hashtags: hashtags.optional(),
  })
  .refine((fields) => Object.keys(fields).length > 0, 'Send at least one field to update');

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
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type PublicListQuery = z.infer<typeof publicListQuerySchema>;
export type CmsListQuery = z.infer<typeof cmsListQuerySchema>;
