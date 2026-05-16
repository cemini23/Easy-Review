'use server';

import { authAsAdmin } from '@/lib/pocketbase';
import type { SchemaProfile } from '@/lib/types';

/**
 * Load an operator's saved schema profile, or `null` if none.
 *
 * Degrades gracefully: a 404 (no row) returns null, and so does any other
 * failure — including the `schema_profiles` collection not existing yet
 * (operator hasn't run `scripts/add-schema-profiles.mjs`). The /schema page
 * stays usable either way; only persistence is unavailable.
 */
export async function getSchemaProfile(operatorId: string): Promise<SchemaProfile | null> {
  try {
    const pb = await authAsAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: any = await pb
      .collection('schema_profiles')
      .getFirstListItem(`operator_id="${operatorId}"`);
    return (row.profile_data ?? null) as SchemaProfile | null;
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status !== 404) {
      console.warn(
        '[schema] getSchemaProfile failed:',
        e instanceof Error ? e.message : e,
      );
    }
    return null;
  }
}

/** Upsert an operator's schema profile. Never throws — returns a result. */
export async function saveSchemaProfile(
  operatorId: string,
  profile: SchemaProfile,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const pb = await authAsAdmin();
    const collection = pb.collection('schema_profiles');
    try {
      const row = await collection.getFirstListItem(`operator_id="${operatorId}"`);
      await collection.update(row.id, { profile_data: profile });
    } catch (e) {
      if ((e as { status?: number })?.status !== 404) throw e;
      await collection.create({ operator_id: operatorId, profile_data: profile });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save failed.' };
  }
}
