import { createApp } from './app.js';
import { config } from './config.js';
import { connectDb, disconnectDb } from './db.js';

await connectDb();

const server = createApp().listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`);
});

const shutdown = () => {
  // don't wait forever for a stuck connection
  setTimeout(() => process.exit(1), 10_000).unref();
  server.close(() => {
    void disconnectDb().then(() => process.exit(0));
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
