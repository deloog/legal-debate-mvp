import type { PrismaClient } from '@prisma/client';

type CaseNumberClient = Pick<PrismaClient, 'case'>;

const caseTypeConfig: Record<string, { code: string; name: string }> = {
  CIVIL: { code: 'M', name: '民' },
  CRIMINAL: { code: 'X', name: '刑' },
  ADMINISTRATIVE: { code: 'G', name: '行' },
  COMMERCIAL: { code: 'S', name: '商' },
  LABOR: { code: 'L', name: '劳' },
  INTELLECTUAL: { code: 'Z', name: '知' },
  INTELLECTUAL_PROPERTY: { code: 'Z', name: '知' },
};

const statusConfig: Record<string, string> = {
  DRAFT: '初',
  ACTIVE: '初',
  COMPLETED: '终',
  ARCHIVED: '决',
};

export async function generateCaseNumber(
  prismaClient: CaseNumberClient,
  type: string = 'CIVIL',
  status: string = 'DRAFT',
  date: Date = new Date()
): Promise<string> {
  const year = date.getFullYear();
  const typeInfo = caseTypeConfig[type] || caseTypeConfig.CIVIL;
  const statusCode = statusConfig[status] || '初';
  const prefix = `${year}${typeInfo.code}${typeInfo.name}${statusCode}`;

  const latestCase = await prismaClient.case.findFirst({
    where: {
      caseNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      caseNumber: 'desc',
    },
    select: {
      caseNumber: true,
    },
  });

  let sequence = 1;
  if (latestCase?.caseNumber) {
    const match = latestCase.caseNumber.match(/(\d+)号?$/);
    if (match) {
      sequence = Number.parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${sequence.toString().padStart(4, '0')}号`;
}
