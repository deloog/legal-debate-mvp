import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export async function loadRuntimePolicy<T>(key: string): Promise<T | null> {
  try {
    const record = await prisma.systemConfig.findUnique({
      where: { key },
      select: { value: true },
    });

    return (record?.value as T | undefined) ?? null;
  } catch (error) {
    logger.warn(`加载运行时策略失败 [${key}]`, error);
    return null;
  }
}

export async function saveRuntimePolicy(
  key: string,
  value: unknown,
  description: string
): Promise<void> {
  try {
    await prisma.systemConfig.upsert({
      where: { key },
      update: {
        value: value as never,
        description,
        type: Array.isArray(value)
          ? 'ARRAY'
          : typeof value === 'boolean'
            ? 'BOOLEAN'
            : typeof value === 'number'
              ? 'NUMBER'
              : typeof value === 'object' && value !== null
                ? 'OBJECT'
                : 'STRING',
        category: 'security',
        isPublic: false,
      },
      create: {
        key,
        value: value as never,
        description,
        type: Array.isArray(value)
          ? 'ARRAY'
          : typeof value === 'boolean'
            ? 'BOOLEAN'
            : typeof value === 'number'
              ? 'NUMBER'
              : typeof value === 'object' && value !== null
                ? 'OBJECT'
                : 'STRING',
        category: 'security',
        isPublic: false,
        isRequired: false,
      },
    });
  } catch (error) {
    logger.warn(`保存运行时策略失败 [${key}]`, error);
  }
}
