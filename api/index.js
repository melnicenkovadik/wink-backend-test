// entry for the Vercel demo deployment, everywhere else the app starts from src/server.ts
/* global console */
import { createApp } from '../dist/app.js';
import { connectDb } from '../dist/db.js';

// if the database is down the app still starts and answers 503
await connectDb().catch(console.error);

export default createApp();
