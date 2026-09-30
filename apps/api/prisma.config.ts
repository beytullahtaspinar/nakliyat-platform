import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // generate komutu veritabanı olmadan da çalışabilsin diye zorunlu tutulmuyor
    url: process.env.DATABASE_URL ?? '',
  },
});
