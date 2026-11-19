import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config.js';
import { Post } from './posts/post.model.js';

await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
await Post.init();

const server = createApp().listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`);
});

const shutdown = () => {
  server.close(() => {
    void mongoose.disconnect().then(() => process.exit(0));
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
