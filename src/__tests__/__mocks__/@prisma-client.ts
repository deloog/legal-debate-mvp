import { jest } from '@jest/globals';

const mockPrisma = {
  caseExample: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
};

export const prisma = mockPrisma;
export default mockPrisma;
