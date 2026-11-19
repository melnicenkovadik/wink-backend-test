// entry for the Vercel demo deployment, everywhere else the app starts from src/server.ts
/* global console */
import mongoose from 'mongoose';
import { createApp } from '../dist/app.js';
import { config } from '../dist/config.js';
import { Post } from '../dist/posts/post.model.js';

try {
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await Post.init();
} catch (err) {
  console.error(err);
}

export default createApp();
