import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/wink_blog'),
  // hardcoded on purpose, see README
  CMS_API_TOKEN: z.string().min(1).default('wink-cms-hardcoded-token'),
  CORS_ORIGIN: z.string().default('*'),
});

export const config = envSchema.parse(process.env);
