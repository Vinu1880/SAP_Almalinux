import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Strip sslmode=prefer from DATABASE_URL for Prisma compatibility
const rawUrl = process.env.DATABASE_URL ?? '';
const datasourceUrl = rawUrl.replace(/[?&]sslmode=prefer/g, '');

export default defineConfig({
  schema: './prisma/schema.prisma',
  ...(datasourceUrl && {
    datasource: {
      url: datasourceUrl,
    },
  }),
});
