import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { config } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { Post } from '../src/posts/post.model.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  config.MONGODB_URI = mongod.getUri('wink_blog_test');
  config.DB_TIMEOUT_MS = 500;
  await connectDb();
});

afterEach(async () => {
  await Post.deleteMany({});
});

afterAll(async () => {
  await disconnectDb();
  await mongod.stop();
});
