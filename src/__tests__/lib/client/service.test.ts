import { createClient } from '@/lib/client/service';
import { prisma } from '@/lib/db/prisma';
import { ClientType } from '@/types/client';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    client: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('client service', () => {
  const mockedPrisma = prisma as unknown as {
    client: { findFirst: jest.Mock; create: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a client with legacy metadata behavior', async () => {
    const created = { id: 'client-1', name: '张伟' };
    mockedPrisma.client.create.mockResolvedValue(created);

    const result = await createClient({
      userId: 'user-1',
      clientType: ClientType.INDIVIDUAL,
      name: '张伟',
      tags: ['VIP'],
      metadata: { source: 'manual' },
    });

    expect(result).toBe(created);
    expect(mockedPrisma.client.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        clientType: 'INDIVIDUAL',
        name: '张伟',
        tags: ['VIP'],
        metadata: { source: 'manual' },
      }),
    });
  });

  it('returns an existing client for the same idempotencyKey', async () => {
    const existing = { id: 'client-existing' };
    mockedPrisma.client.findFirst.mockResolvedValue(existing);

    const result = await createClient(
      {
        userId: 'user-1',
        clientType: ClientType.INDIVIDUAL,
        name: '张伟',
      },
      'proposal-1-CREATE_CLIENT-0'
    );

    expect(result).toBe(existing);
    expect(mockedPrisma.client.create).not.toHaveBeenCalled();
  });

  it('stores idempotencyKey in metadata when provided', async () => {
    mockedPrisma.client.findFirst.mockResolvedValue(null);
    mockedPrisma.client.create.mockResolvedValue({ id: 'client-1' });

    await createClient(
      {
        userId: 'user-1',
        clientType: ClientType.INDIVIDUAL,
        name: '张伟',
        metadata: { source: 'proposal' },
      },
      'proposal-1-CREATE_CLIENT-0'
    );

    expect(mockedPrisma.client.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: {
          source: 'proposal',
          idempotencyKey: 'proposal-1-CREATE_CLIENT-0',
        },
      }),
    });
  });
});
