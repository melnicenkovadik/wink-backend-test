import mongoose from 'mongoose';
import { config } from './config.js';
import { Post } from './posts/post.model.js';

export const connectDb = async () => {
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await Post.init();
};

export const disconnectDb = () => mongoose.disconnect();

export const isDbUp = () => mongoose.connection.readyState === mongoose.ConnectionStates.connected;
