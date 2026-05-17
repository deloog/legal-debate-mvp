import { prisma } from '@/lib/db/prisma';
import { generateCaseNumber } from '@/lib/case/case-number-service';
import { CaseStatus, CaseType, OwnerType, Prisma } from '@prisma/client';

type DbClient = typeof prisma | Prisma.TransactionClient;

const CASE_TYPE_MAP: Record<string, CaseType> = {
  civil: 'CIVIL',
  criminal: 'CRIMINAL',
  administrative: 'ADMINISTRATIVE',
  commercial: 'COMMERCIAL',
  labor: 'LABOR',
  intellectual: 'INTELLECTUAL',
  other: 'OTHER',
};

const CASE_STATUS_MAP: Record<string, CaseStatus> = {
  draft: 'DRAFT',
  active: 'ACTIVE',
  completed: 'COMPLETED',
  archived: 'ARCHIVED',
};

const OWNER_TYPE_MAP: Record<string, OwnerType> = {
  user: 'USER',
  team: 'TEAM',
};

export interface CreateCaseServiceInput {
  userId: string;
  title: string;
  description?: string;
  type?: string;
  status?: string;
  amount?: number | string | Prisma.Decimal | null;
  caseNumber?: string | null;
  cause?: string | null;
  court?: string | null;
  plaintiffName?: string | null;
  defendantName?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ownerType?: string | OwnerType | null;
  sharedWithTeam?: boolean;
}

export interface AddTimelineEventInput {
  caseId: string;
  eventType: string;
  title: string;
  description?: string | null;
  eventDate: Date;
  metadata?: Prisma.InputJsonValue | null;
}

function resolveDb(tx?: Prisma.TransactionClient): DbClient {
  return tx ?? prisma;
}

function mergeIdempotencyMetadata(
  metadata: Prisma.InputJsonValue | null | undefined,
  idempotencyKey?: string
): Prisma.InputJsonValue {
  if (!idempotencyKey) {
    return metadata ?? {};
  }

  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};

  base.idempotencyKey = idempotencyKey;

  return base as Prisma.InputJsonValue;
}

function normalizeCaseType(type?: string): CaseType {
  return CASE_TYPE_MAP[type?.toLowerCase() ?? ''] ?? 'CIVIL';
}

function normalizeCaseStatus(status?: string): CaseStatus {
  return CASE_STATUS_MAP[status?.toLowerCase() ?? ''] ?? 'DRAFT';
}

function normalizeOwnerType(ownerType?: string | OwnerType | null): OwnerType {
  return ownerType
    ? (OWNER_TYPE_MAP[String(ownerType).toLowerCase()] ?? 'USER')
    : 'USER';
}

export async function createCase(
  input: CreateCaseServiceInput,
  idempotencyKey?: string,
  tx?: Prisma.TransactionClient
) {
  const db = resolveDb(tx);

  if (idempotencyKey) {
    const existing = await db.case.findFirst({
      where: { metadata: { path: ['idempotencyKey'], equals: idempotencyKey } },
    });
    if (existing) return existing;
  }

  const type = normalizeCaseType(input.type);
  const status = normalizeCaseStatus(input.status);
  const caseNumber =
    input.caseNumber || (await generateCaseNumber(db, type, status));

  return db.case.create({
    data: {
      userId: input.userId,
      title: input.title,
      description: input.description || '',
      type,
      status,
      amount: input.amount ? new Prisma.Decimal(input.amount) : null,
      caseNumber,
      cause: input.cause,
      court: input.court,
      plaintiffName: input.plaintiffName,
      defendantName: input.defendantName,
      metadata: mergeIdempotencyMetadata(input.metadata, idempotencyKey),
      ownerType: normalizeOwnerType(input.ownerType),
      sharedWithTeam: input.sharedWithTeam === true,
    },
  });
}

export async function addTimelineEvent(
  input: AddTimelineEventInput,
  idempotencyKey?: string,
  tx?: Prisma.TransactionClient
) {
  const db = resolveDb(tx);

  if (idempotencyKey) {
    const existing = await db.caseTimeline.findFirst({
      where: { metadata: { path: ['idempotencyKey'], equals: idempotencyKey } },
    });
    if (existing) return existing;
  }

  return db.caseTimeline.create({
    data: {
      caseId: input.caseId,
      eventType: input.eventType as never,
      title: input.title,
      description: input.description || null,
      eventDate: input.eventDate,
      metadata: mergeIdempotencyMetadata(input.metadata, idempotencyKey),
    },
  });
}
