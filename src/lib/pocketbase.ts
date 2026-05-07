import PocketBase from 'pocketbase';

let _pb: PocketBase | null = null;

export function getPb(): PocketBase {
  if (!_pb) {
    const url = process.env.POCKETBASE_URL;
    if (!url) throw new Error('POCKETBASE_URL not set');
    _pb = new PocketBase(url);
  }
  return _pb;
}

export async function authAsAdmin(): Promise<PocketBase> {
  const pb = getPb();
  const email = process.env.POCKETBASE_ADMIN_EMAIL;
  const password = process.env.POCKETBASE_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD not set');
  }
  if (!pb.authStore.isValid) {
    await pb.admins.authWithPassword(email, password);
  }
  return pb;
}
