'use server';

import { authAsAdmin } from '@/lib/pocketbase';
import type { Operator, Vertical } from '@/lib/types';

export interface CreateOperatorInput {
  email: string;
  business_name: string;
  vertical: Vertical;
  sign_off?: string;
  services?: string[];
  staff_names?: string[];
}

export async function createOperator(input: CreateOperatorInput): Promise<Operator> {
  const pb = await authAsAdmin();
  const created = await pb.collection('operators').create({
    email: input.email,
    business_name: input.business_name,
    vertical: input.vertical,
    sign_off: input.sign_off ?? '',
    services: input.services ?? [],
    staff_names: input.staff_names ?? [],
    active: true,
    password: cryptoRandomPassword(),
    passwordConfirm: '',
  });
  return mapOperator(created);
}

function cryptoRandomPassword(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getCurrentOperator(): Promise<Operator | null> {
  const pb = await authAsAdmin();
  const list = await pb.collection('operators').getList(1, 1, { sort: '+created' });
  if (list.items.length === 0) return null;
  return mapOperator(list.items[0]);
}

function mapOperator(row: any): Operator {
  return {
    id: row.id,
    email: row.email,
    business_name: row.business_name,
    vertical: row.vertical,
    sign_off: row.sign_off || undefined,
    services: row.services ?? [],
    staff_names: row.staff_names ?? [],
    active: row.active ?? true,
  };
}
