import { Router, type RequestHandler } from 'express';
import { AppError } from '../errors.js';
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

export const publicPostsRouter = Router();

publicPostsRouter.get('/', async (req, res) => {
  const query = publicListQuerySchema.parse(req.query);
  res.json(postListResponse(await listPublishedPosts(query), query));
});

publicPostsRouter.get('/:id', async (req, res) => {
  const { id } = postParamsSchema.parse(req.params);
  res.json({ data: toPostResponse(await getPublishedPost(id)) });
});

const requireJsonBody: RequestHandler = (req, _res, next) => {
  // an empty request is left to validation, which answers 400 with the missing fields
  const hasBody = Number(req.get('content-length')) > 0 || req.get('transfer-encoding');
  if (hasBody && !req.is('application/json')) {
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Request body must be application/json');
  }
  next();
};

export const cmsPostsRouter = Router();

cmsPostsRouter.use(requireCmsToken);

cmsPostsRouter.post('/', requireJsonBody, async (req, res) => {
  const post = await createPost(createPostSchema.parse(req.body));
  res
    .status(201)
    .location(`${req.baseUrl}/${post.id}`)
    .json({ data: toPostResponse(post) });
});

cmsPostsRouter.get('/', async (req, res) => {
  const query = cmsListQuerySchema.parse(req.query);
  res.json(postListResponse(await listPosts(query), query));
});

cmsPostsRouter.get('/:id', async (req, res) => {
  const { id } = postParamsSchema.parse(req.params);
  res.json({ data: toPostResponse(await getPost(id)) });
});

cmsPostsRouter.patch('/:id', requireJsonBody, async (req, res) => {
  const { id } = postParamsSchema.parse(req.params);
  const post = await updatePost(id, updatePostSchema.parse(req.body));
  res.json({ data: toPostResponse(post) });
});

cmsPostsRouter.post('/:id/publish', async (req, res) => {
  const { id } = postParamsSchema.parse(req.params);
  res.json({ data: toPostResponse(await publishPost(id)) });
});

cmsPostsRouter.delete('/:id', async (req, res) => {
  const { id } = postParamsSchema.parse(req.params);
  await deletePost(id);
  res.status(204).end();
});
