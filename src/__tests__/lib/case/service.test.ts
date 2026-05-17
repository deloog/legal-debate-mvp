import { addTimelineEvent, createCase } from '@/lib/case/service';
import { generateCaseNumber } from '@/lib/case/case-number-service';
import { prisma } from '@/lib/db/prisma';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    caseTimeline: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/case/case-number-service', () => ({
  generateCaseNumber: jest.fn(),
}));

describe('case service', () => {
  const mockedPrisma = prisma as unknown as {
    case: { findFirst: jest.Mock; create: jest.Mock };
    caseTimeline: { findFirst: jest.Mock; create: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (generateCaseNumber as jest.Mock).mockResolvedValue('2026M民初0001号');
  });

  describe('createCase', () => {
    it('creates a case while preserving legacy defaults', async () => {
      const created = {
        id: 'case-1',
        title: '测试案件',
        type: 'CIVIL',
        status: 'DRAFT',
        metadata: { source: 'manual' },
      };
      mockedPrisma.case.create.mockResolvedValue(created);

      const result = await createCase({
        userId: 'user-1',
        title: '测试案件',
        type: 'civil',
        metadata: { source: 'manual' },
      });

      expect(result).toBe(created);
      expect(mockedPrisma.case.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          title: '测试案件',
          description: '',
          type: 'CIVIL',
          status: 'DRAFT',
          caseNumber: '2026M民初0001号',
          ownerType: 'USER',
          sharedWithTeam: false,
          metadata: { source: 'manual' },
        }),
      });
    });

    it('returns an existing case for the same idempotencyKey', async () => {
      const existing = { id: 'case-existing' };
      mockedPrisma.case.findFirst.mockResolvedValue(existing);

      const result = await createCase(
        { userId: 'user-1', title: '测试案件' },
        'proposal-1-CREATE_CASE-1'
      );

      expect(result).toBe(existing);
      expect(mockedPrisma.case.create).not.toHaveBeenCalled();
    });

    it('stores idempotencyKey in metadata when provided', async () => {
      mockedPrisma.case.findFirst.mockResolvedValue(null);
      mockedPrisma.case.create.mockResolvedValue({ id: 'case-1' });

      await createCase(
        {
          userId: 'user-1',
          title: '测试案件',
          metadata: { source: 'proposal' },
        },
        'proposal-1-CREATE_CASE-1'
      );

      expect(mockedPrisma.case.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: {
            source: 'proposal',
            idempotencyKey: 'proposal-1-CREATE_CASE-1',
          },
        }),
      });
    });
  });

  describe('addTimelineEvent', () => {
    it('creates a timeline event', async () => {
      const eventDate = new Date('2026-05-17T00:00:00.000Z');
      const created = { id: 'timeline-1' };
      mockedPrisma.caseTimeline.create.mockResolvedValue(created);

      const result = await addTimelineEvent({
        caseId: 'case-1',
        eventType: 'TRIAL',
        title: '开庭',
        eventDate,
      });

      expect(result).toBe(created);
      expect(mockedPrisma.caseTimeline.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          caseId: 'case-1',
          eventType: 'TRIAL',
          title: '开庭',
          eventDate,
          metadata: {},
        }),
      });
    });

    it('is idempotent by metadata idempotencyKey', async () => {
      const existing = { id: 'timeline-existing' };
      mockedPrisma.caseTimeline.findFirst.mockResolvedValue(existing);

      const result = await addTimelineEvent(
        {
          caseId: 'case-1',
          eventType: 'TRIAL',
          title: '开庭',
          eventDate: new Date(),
        },
        'proposal-1-ADD_TIMELINE-2'
      );

      expect(result).toBe(existing);
      expect(mockedPrisma.caseTimeline.create).not.toHaveBeenCalled();
    });
  });
});
