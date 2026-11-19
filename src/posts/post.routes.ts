import { Router, type Request } from 'express';
import { allowOnly, noStore, requireJsonBody } from '../middleware/guards.js';
import { requireCmsToken } from '../middleware/require-cms-token.js';
import { toPostResponse, type PostDocument } from './post.model.js';
import {
  cmsListQuerySchema,
  createPostSchema,
  postParamsSchema,
  publicListQuerySchema,
  updatePostSchema,
} from './post.schemas.js';
import {
  createPost,
  deletePost,
  getPost,
  getPublishedPost,
  listPosts,
  listPublishedHashtags,
  listPublishedPosts,
  publishPost,
  updatePost,
} from './post.service.js';

const postListResponse = (
  { posts, total }: { posts: PostDocument[]; total: number },
  { page, limit }: { page: number; limit: number },
) => ({
  data: posts.map(toPostResponse),
  meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
});

const postResponse = (post: PostDocument) => ({ data: toPostResponse(post) });

const postId = (req: Request) => postParamsSchema.parse(req.params).id;

export const hashtagsRouter = Router();

hashtagsRouter.get('/', async (_req, res) => {
  res.json({ data: await listPublishedHashtags() });
});
hashtagsRouter.all('/', allowOnly('GET, HEAD'));

export const publicPostsRouter = Router();

publicPostsRouter.get('/', async (req, res) => {
  const query = publicListQuerySchema.parse(req.query);
  res.json(postListResponse(await listPublishedPosts(query), query));
});

publicPostsRouter.get('/:id', async (req, res) => {
  res.json(postResponse(await getPublishedPost(postId(req))));
});

publicPostsRouter.all('/', allowOnly('GET, HEAD'));
publicPostsRouter.all('/:id', allowOnly('GET, HEAD'));

export const cmsPostsRouter = Router();

cmsPostsRouter.use(requireCmsToken, noStore);

cmsPostsRouter.post('/', requireJsonBody, async (req, res) => {
  const post = await createPost(createPostSchema.parse(req.body));
  res.status(201).location(`${req.baseUrl}/${post.id}`).json(postResponse(post));
});

cmsPostsRouter.get('/', async (req, res) => {
  const query = cmsListQuerySchema.parse(req.query);
  res.json(postListResponse(await listPosts(query), query));
});

cmsPostsRouter.get('/:id', async (req, res) => {
  res.json(postResponse(await getPost(postId(req))));
});

cmsPostsRouter.patch('/:id', requireJsonBody, async (req, res) => {
  const post = await updatePost(postId(req), updatePostSchema.parse(req.body));
  res.json(postResponse(post));
});

cmsPostsRouter.post('/:id/publish', async (req, res) => {
  res.json(postResponse(await publishPost(postId(req))));
});

cmsPostsRouter.delete('/:id', async (req, res) => {
  await deletePost(postId(req));
  res.status(204).end();
});

cmsPostsRouter.all('/', allowOnly('GET, HEAD, POST'));
cmsPostsRouter.all('/:id', allowOnly('GET, HEAD, PATCH, DELETE'));
cmsPostsRouter.all('/:id/publish', allowOnly('POST'));
