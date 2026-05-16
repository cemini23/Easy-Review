// scripts/add-schema-profiles.mjs
// One-shot migration: creates the `schema_profiles` collection used by the
// Schema Markup Generator tab to persist an operator's JSON-LD profile.
// Idempotent — safe to re-run.
//
// Usage:  node scripts/add-schema-profiles.mjs
// Reads:  POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD
// from .env.local (same as the dev server).

import { config as loadEnv } from 'dotenv';
import PocketBase from 'pocketbase';

loadEnv({ path: '.env.local' });

const url = process.env.POCKETBASE_URL;
const email = process.env.POCKETBASE_ADMIN_EMAIL;
const password = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!url || !email || !password) {
  console.error('Missing POCKETBASE_URL / POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD in .env.local');
  process.exit(1);
}

const pb = new PocketBase(url);
await pb.collection('_superusers').authWithPassword(email, password);

const UNIQUE_INDEX_NAME = 'idx_schema_profiles_operator_id_unique';
const UNIQUE_INDEX_SQL = `CREATE UNIQUE INDEX \`${UNIQUE_INDEX_NAME}\` ON \`schema_profiles\` (\`operator_id\`)`;

let collection = null;
try {
  collection = await pb.collections.getFirstListItem('name="schema_profiles"');
} catch (e) {
  if (e?.status !== 404) throw e;
}

if (!collection) {
  collection = await pb.collections.create({
    name: 'schema_profiles',
    type: 'base',
    fields: [
      { name: 'operator_id', type: 'text', required: true },
      { name: 'profile_data', type: 'json', required: true },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ],
    indexes: [UNIQUE_INDEX_SQL],
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
  });
  console.log('schema_profiles: created (with unique index on operator_id)');
} else {
  console.log('schema_profiles: already exists, checking indexes');
}

const existingIndexes = collection.indexes ?? [];
const hasUniqueIndex = existingIndexes.some((idx) =>
  idx.includes(UNIQUE_INDEX_NAME) ||
  /UNIQUE\s+INDEX[^(]+\(\s*`?operator_id`?\s*\)/i.test(idx),
);

if (!hasUniqueIndex) {
  await pb.collections.update(collection.id, {
    indexes: [...existingIndexes, UNIQUE_INDEX_SQL],
  });
  console.log('schema_profiles: added unique index on operator_id');
} else {
  console.log('schema_profiles: unique index on operator_id already present, skipping');
}

console.log('Done.');
