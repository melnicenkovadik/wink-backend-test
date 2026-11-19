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

const orNotFound = (post: PostDocument | null) => {
  if (!post) throw notFound('Post not found');
  return post;
};

const findPage = async (
  filter: PostFilter,
  sort: Record<string, SortOrder>,
  { page, limit }: { page: number; limit: number },
) => {
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
  // _id as a tie-breaker, otherwise pages can overlap
  return findPage(filter, { publishedAt: -1, _id: -1 }, page);
};

// tags of published posts only, most used first
export const listPublishedHashtags = () =>
  Post.aggregate<{ hashtag: string; posts: number }>([
    { $match: { status: 'published' } },
    { $unwind: '$hashtags' },
    { $group: { _id: '$hashtags', posts: { $sum: 1 } } },
    { $sort: { posts: -1, _id: 1 } },
    { $limit: 100 },
    { $project: { _id: 0, hashtag: '$_id', posts: 1 } },
  ]);

export const listPosts = ({ status, ...page }: CmsListQuery) =>
  findPage(status ? { status } : {}, { createdAt: -1, _id: -1 }, page);

export const getPost = async (id: string) => orNotFound(await Post.findById(id));

export const getPublishedPost = async (id: string) =>
  orNotFound(await Post.findOne({ _id: id, status: 'published' }));

export const updatePost = async (id: string, input: UpdatePostInput) =>
  orNotFound(await Post.findByIdAndUpdate(id, { $set: input }, { returnDocument: 'after' }));

export const publishPost = async (id: string) => {
  // only one of two parallel requests can match status: 'draft'
  const published = await Post.findOneAndUpdate(
    { _id: id, status: 'draft' },
    { $set: { status: 'published', publishedAt: new Date() } },
    { returnDocument: 'after' },
  );
  // already published or missing
  return published ?? getPost(id);
};

export const deletePost = async (id: string) => {
  orNotFound(await Post.findByIdAndDelete(id));
};
