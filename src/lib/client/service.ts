import { prisma } from '@/lib/db/prisma';
import type { CreateClientInput } from '@/types/client';
import { Prisma } from '@prisma/client';

type DbClient = typeof prisma | Prisma.TransactionClient;

function resolveDb(tx?: Prisma.TransactionClient): DbClient {
  return tx ?? prisma;
}

function mergeIdempotencyMetadata(
  metadata: Record<string, unknown> | null | undefined,
  idempotencyKey?: string
): Prisma.InputJsonValue {
  if (!idempotencyKey) {
    return (metadata ?? {}) as Prisma.InputJsonValue;
  }

  const base = metadata ? { ...metadata } : {};
  base.idempotencyKey = idempotencyKey;
  return base as Prisma.InputJsonValue;
}

export async function createClient(
  input: CreateClientInput,
  idempotencyKey?: string,
  tx?: Prisma.TransactionClient
) {
  const db = resolveDb(tx);

  if (idempotencyKey) {
    const existing = await db.client.findFirst({
      where: { metadata: { path: ['idempotencyKey'], equals: idempotencyKey } },
    });
    if (existing) return existing;
  }

  return db.client.create({
    data: {
      userId: input.userId,
      clientType: input.clientType,
      name: input.name,
      gender: input.gender,
      age: input.age,
      profession: input.profession,
      phone: input.phone,
      email: input.email,
      address: input.address,
      idCardNumber: input.idCardNumber,
      company: input.company,
      creditCode: input.creditCode,
      legalRep: input.legalRep,
      source: input.source,
      tags: input.tags || [],
      notes: input.notes,
      metadata: mergeIdempotencyMetadata(input.metadata, idempotencyKey),
    },
  });
}
