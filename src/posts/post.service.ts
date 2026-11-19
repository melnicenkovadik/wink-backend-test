import type { QueryFilter, SortOrder } from 'mongoose';
import { notFound } from '../errors.js';
import { AUTHOR_NAME, Post, type PostDocument } from './post.model.js';
import type {
  CmsListQuery,
  CreatePostInput,
  PublicListQuery,
  UpdatePostInput,
} from './post.schemas.js';

type PostFilter = QueryFilter<PostDocument>;

const findPage = async (
  filter: PostFilter,
  sort: Record<string, SortOrder>,
  { page, limit }: { page: number; limit: number },
) => {
  // the same filter goes to both queries, so `total` can never count posts the list hides
  const [posts, total] = await Promise.all([
    Post.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Post.countDocuments(filter),
  ]);
  return { posts, total };
};

export const createPost = (input: CreatePostInput) =>
  Post.create({
    ...input,
    author: AUTHOR_NAME,
    publishedAt: input.status === 'published' ? new Date() : null,
  });

export const listPublishedPosts = ({ hashtags, ...page }: PublicListQuery) => {
  const filter: PostFilter = { status: 'published' };
  if (hashtags.length > 0) filter.hashtags = { $in: hashtags };
  // _id breaks ties between posts published at the same moment, so pages stay stable
  return findPage(filter, { publishedAt: -1, _id: -1 }, page);
};

export const listPosts = ({ status, ...page }: CmsListQuery) =>
  findPage(status ? { status } : {}, { createdAt: -1, _id: -1 }, page);

export const getPost = async (id: string) => {
  const post = await Post.findById(id);
  if (!post) throw notFound('Post not found');
  return post;
};

// a draft answers 404 here, the same as a post that does not exist
export const getPublishedPost = async (id: string) => {
  const post = await Post.findOne({ _id: id, status: 'published' });
  if (!post) throw notFound('Post not found');
  return post;
};

export const updatePost = async (id: string, input: UpdatePostInput) => {
  const post = await Post.findByIdAndUpdate(id, { $set: input }, { returnDocument: 'after' });
  if (!post) throw notFound('Post not found');
  return post;
};

export const publishPost = async (id: string) => {
  // One atomic update: of two concurrent requests only one matches `status: 'draft'`.
  // Without returnDocument: 'after' Mongoose would return the document as it was before.
  const published = await Post.findOneAndUpdate(
    { _id: id, status: 'draft' },
    { $set: { status: 'published', publishedAt: new Date() } },
    { returnDocument: 'after' },
  );
  // nothing matched: the post is already published (return it as is) or does not exist (404)
  return published ?? getPost(id);
};

export const deletePost = async (id: string) => {
  const deleted = await Post.findByIdAndDelete(id);
  if (!deleted) throw notFound('Post not found');
};
