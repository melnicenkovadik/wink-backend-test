import mongoose from 'mongoose';
import { config } from './config.js';
import { Post } from './posts/post.model.js';

const open = async () => {
  // how long a query waits for a connection that is still being (re)opened
  mongoose.set('bufferTimeoutMS', config.DB_TIMEOUT_MS);
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: config.DB_TIMEOUT_MS });
  await Post.init();
};

let connection: Promise<void> | undefined;

// safe to call on every request: one shared attempt, and a failed one is retried next time.
// after the first success the driver reconnects on its own
export const connectDb = () =>
  (connection ??= open().catch((err: unknown) => {
    connection = undefined;
    throw err;
  }));

export const disconnectDb = async () => {
  connection = undefined;
  await mongoose.disconnect();
};

export const pingDb = async () => {
  await connectDb();
  await mongoose.connection.db?.admin().ping();
};

const DB_DOWN_ERRORS = [
  'MongooseServerSelectionError',
  'MongoServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoNotConnectedError',
];

export const isDbDownError = (err: unknown) =>
  err instanceof Error &&
  (DB_DOWN_ERRORS.includes(err.name) || err.message.includes('buffering timed out'));
