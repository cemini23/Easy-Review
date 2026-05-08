import { describe, it, expect, vi, beforeEach } from 'vitest';

const collectionMock = {
  create: vi.fn(),
};
vi.mock('@/lib/pocketbase', () => ({
  authAsAdmin: vi.fn(async () => ({
    collection: vi.fn(() => collectionMock),
  })),
}));

import { createOperator } from '@/app/actions/operators';

describe('createOperator', () => {
  beforeEach(() => {
    collectionMock.create.mockReset();
    collectionMock.create.mockImplementation(async (data: Record<string, unknown>) => ({
      id: 'op1', ...data,
    }));
  });

  it('passes website_url and gbp_place_id through to PocketBase', async () => {
    await createOperator({
      email: 'a@b.com',
      business_name: 'X',
      vertical: 'barbershop',
      website_url: 'https://example.com',
      gbp_place_id: 'ChIJabc',
    });
    expect(collectionMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        website_url: 'https://example.com',
        gbp_place_id: 'ChIJabc',
      }),
    );
  });

  it('omits new fields when not provided (backward compat)', async () => {
    await createOperator({
      email: 'a@b.com',
      business_name: 'X',
      vertical: 'barbershop',
    });
    const call = collectionMock.create.mock.calls[0][0] as Record<string, unknown>;
    expect(call.website_url).toBe('');
    expect(call.gbp_place_id).toBe('');
  });

  it('returned Operator includes the new fields when set', async () => {
    const result = await createOperator({
      email: 'a@b.com',
      business_name: 'X',
      vertical: 'barbershop',
      website_url: 'https://example.com',
      gbp_place_id: 'ChIJabc',
    });
    expect(result.website_url).toBe('https://example.com');
    expect(result.gbp_place_id).toBe('ChIJabc');
  });
});
