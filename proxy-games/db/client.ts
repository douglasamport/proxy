// Neon, pooled connection. Serverless functions open a connection per
// invocation — use the POOLED string (the one with "-pooler" in the host),
// not the direct one, or you will exhaust connections under any real load.
//
// .env.local:
//   DATABASE_URL="postgres://user:pass@ep-xxxx-pooler.region.aws.neon.tech/db?sslmode=require"

import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

// `sql` is a tagged-template query function — sql`select * from players where id = ${id}`
// Neon's serverless driver parameterises automatically; never string-concat user input in.
export const sql = neon(process.env.DATABASE_URL);
