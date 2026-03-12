/**
 * 导入现有法规数据到数据库
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, LawType, LawCategory, LawStatus } from '@prisma/client';

const prisma = new PrismaClient();

// 法律类型映射
function mapLawType(type: string): LawType {
  const map: Record<string, LawType> = {
    CONSTITUTION: LawType.CONSTITUTION,
    LAW: LawType.LAW,
    ADMINISTRATIVE_REGULATION: LawType.ADMINISTRATIVE_REGULATION,
    LOCAL_REGULATION: LawType.LOCAL_REGULATION,
    JUDICIAL_INTERPRETATION: LawType.JUDICIAL_INTERPRETATION,
    DEPARTMENTAL_RULE: LawType.DEPARTMENTAL_RULE,
  };
  return map[type] || LawType.OTHER;
}

// 类别映射
function mapCategory(cat: string): LawCategory {
  const map: Record<string, LawCategory> = {
    CIVIL: LawCategory.CIVIL,
    CRIMINAL: LawCategory.CRIMINAL,
    ADMINISTRATIVE: LawCategory.ADMINISTRATIVE,
    COMMERCIAL: LawCategory.COMMERCIAL,
    ECONOMIC: LawCategory.ECONOMIC,
    LABOR: LawCategory.LABOR,
    INTELLECTUAL_PROPERTY: LawCategory.INTELLECTUAL_PROPERTY,
    PROCEDURE: LawCategory.PROCEDURE,
  };
  return map[cat] || LawCategory.OTHER;
}

// 状态映射
function mapStatus(status: string): LawStatus {
  const map: Record<string, LawStatus> = {
    VALID: LawStatus.VALID,
    AMENDED: LawStatus.AMENDED,
    REPEALED: LawStatus.REPEALED,
    DRAFT: LawStatus.DRAFT,
    EXPIRED: LawStatus.EXPIRED,
  };
  return map[status] || LawStatus.VALID;
}

async function importFile(
  filePath: string
): Promise<{ created: number; updated: number; errors: number }> {
  const fileName = path.basename(filePath);
  console.log('Importing: ' + fileName);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    const laws = data.data || data;
    if (!Array.isArray(laws)) {
      console.log('  Invalid format');
      return { created: 0, updated: 0, errors: 0 };
    }

    console.log('  Total: ' + laws.length);

    let created = 0;
    const __updated = 0;
    let errors = 0;

    for (const law of laws) {
      try {
        const lawData = {
          lawName: law.lawName,
          articleNumber: law.articleNumber,
          fullText: law.fullText || '',
          lawType: mapLawType(law.lawType),
          category: mapCategory(law.category),
          subCategory: law.subCategory,
          tags: law.tags || [],
          keywords: law.keywords || [],
          version: law.version || '1.0',
          effectiveDate: new Date(law.effectiveDate),
          status: mapStatus(law.status),
          issuingAuthority: law.issuingAuthority || 'Unknown',
          jurisdiction: law.jurisdiction,
          searchableText:
            law.searchableText ||
            (law.lawName + ' ' + (law.fullText || '')).substring(0, 50000),
          dataSource: 'local' as const,
          sourceId: law.sourceId || law.lawName + '_' + law.articleNumber,
        };

        await prisma.lawArticle.upsert({
          where: {
            lawName_articleNumber: {
              lawName: law.lawName,
              articleNumber: law.articleNumber,
            },
          },
          update: lawData,
          create: lawData,
        });

        created++;
      } catch {
        errors++;
      }
    }

    console.log('  Done: ' + created + ' created, ' + errors + ' errors');
    return { created, updated: 0, errors };
  } catch (err) {
    console.log('  Error: ' + err);
    return { created: 0, updated: 0, errors: 1 };
  }
}

async function main() {
  console.log('==========================================');
  console.log('Importing existing law data');
  console.log('==========================================');

  const dataDir = path.resolve('data');
  const allFiles = fs
    .readdirSync(dataDir)
    .filter(f => f.startsWith('law-articles') && f.endsWith('.json'));

  console.log('Found ' + allFiles.length + ' data files');

  let totalCreated = 0;
  let totalErrors = 0;

  for (const file of allFiles) {
    const result = await importFile(path.join(dataDir, file));
    totalCreated += result.created;
    totalErrors += result.errors;
  }

  const totalInDb = await prisma.lawArticle.count();

  console.log('==========================================');
  console.log('Import completed!');
  console.log('==========================================');
  console.log('Created: ' + totalCreated);
  console.log('Errors: ' + totalErrors);
  console.log('Total in DB: ' + totalInDb);
  console.log('==========================================');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
