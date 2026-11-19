import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const POST_STATUSES = ['draft', 'published'] as const;
export const AUTHOR_NAME = 'Brian Fox';

const postSchema = new Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    hashtags: { type: [String], default: [] },
    status: { type: String, enum: POST_STATUSES, default: 'draft', required: true },
    author: { type: String, default: AUTHOR_NAME, immutable: true, required: true },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

postSchema.index({ status: 1, publishedAt: -1, _id: -1 });
postSchema.index({ hashtags: 1, status: 1, publishedAt: -1, _id: -1 });
postSchema.index({ createdAt: -1, _id: -1 });

export type PostDocument = HydratedDocument<InferSchemaType<typeof postSchema>>;

export const Post = model('Post', postSchema);

export const toPostResponse = (post: PostDocument) => ({
  id: post.id as string,
  title: post.title,
  body: post.body,
  hashtags: post.hashtags,
  status: post.status,
  author: post.author,
  createdAt: post.createdAt,
  updatedAt: post.updatedAt,
  publishedAt: post.publishedAt,
});
