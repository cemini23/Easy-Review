// scripts/add-site-health-schema.mjs
// One-shot migration: adds website_url + gbp_place_id to operators,
// creates site_health_snapshots collection. Idempotent — safe to re-run.
//
// Usage:  node scripts/add-site-health-schema.mjs
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

// 1. Extend operators collection with the two new optional text fields.
const operators = await pb.collections.getFirstListItem('name="operators"');
const operatorFields = operators.fields ?? operators.schema ?? [];
const fieldNames = new Set(operatorFields.map((f) => f.name));

const newOperatorFields = [];
if (!fieldNames.has('website_url')) {
  newOperatorFields.push({ name: 'website_url', type: 'text', required: false });
}
if (!fieldNames.has('gbp_place_id')) {
  newOperatorFields.push({ name: 'gbp_place_id', type: 'text', required: false });
}

if (newOperatorFields.length > 0) {
  const merged = [...operatorFields, ...newOperatorFields];
  await pb.collections.update(operators.id, { fields: merged });
  console.log(`operators: added ${newOperatorFields.map((f) => f.name).join(', ')}`);
} else {
  console.log('operators: website_url and gbp_place_id already present, skipping');
}

// 2. Create site_health_snapshots if missing.
let exists = true;
try {
  await pb.collections.getFirstListItem('name="site_health_snapshots"');
} catch (e) {
  if (e?.status === 404) exists = false;
  else throw e;
}

if (exists) {
  console.log('site_health_snapshots: already exists, skipping');
} else {
  await pb.collections.create({
    name: 'site_health_snapshots',
    type: 'base',
    fields: [
      { name: 'operator_id', type: 'text', required: true },
      { name: 'snapshot_data', type: 'json', required: true },
      { name: 'fetched_at', type: 'date', required: true },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ],
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
  });
  console.log('site_health_snapshots: created');
}

console.log('Done.');
