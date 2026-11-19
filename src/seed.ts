import mongoose from 'mongoose';
import { config } from './config.js';
import { Post } from './posts/post.model.js';

const day = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * day);

await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

await Post.deleteMany({});
await Post.insertMany([
  {
    title: 'Getting started with Express 5',
    body: 'Async handlers finally work without a wrapper.',
    hashtags: ['nodejs', 'express'],
    status: 'published',
    publishedAt: daysAgo(3),
  },
  {
    title: 'Compound indexes in MongoDB',
    body: 'Equality first, then sort, then range.',
    hashtags: ['mongodb', 'performance'],
    status: 'published',
    publishedAt: daysAgo(2),
  },
  {
    title: 'Why we moved to TypeScript',
    body: 'Mostly because of refactoring.',
    hashtags: ['typescript', 'nodejs'],
    status: 'published',
    publishedAt: daysAgo(1),
  },
  { title: 'Notes on testing', body: 'Work in progress.', hashtags: ['testing'] },
  { title: 'Untitled idea', body: 'To be written.' },
]);

console.log('Seeded 3 published posts and 2 drafts');
await mongoose.disconnect();
