/**
 * 合同PDF生成模块
 * 使用 pdfkit 生成委托合同PDF文件
 * 支持PDF缓存机制，提升生成速度
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

/**
 * 合同数据接口
 */
interface ContractData {
  id: string;
  contractNumber: string;
  clientType: string;
  clientName: string;
  clientIdNumber?: string;
  clientAddress?: string;
  clientContact?: string;
  lawFirmName: string;
  lawyerName: string;
  caseType: string;
  caseSummary: string;
  scope: string;
  feeType: string;
  totalFee: number;
  specialTerms?: string;
  signedAt?: Date;
  createdAt: Date;
  // 电子签名
  clientSignature?: string;
  clientSignedAt?: Date;
  lawyerSignature?: string;
  lawyerSignedAt?: Date;
}

/**
 * PDF缓存记录接口
 */

/**
 * 生成合同PDF文件路径
 * @param contractId 合同ID
 * @returns PDF文件路径
 */
function generateContractFilePath(contractId: string): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `/uploads/contracts/${year}/${month}/${day}/${contractId}.pdf`;
}

/**
 * 将数字金额转换为中文大写
 * @param amount 金额
 * @returns 中文大写金额
 */
function formatAmountToChinese(amount: number): string {
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟'];
  const bigUnits = ['', '万', '亿'];

  if (amount === 0) return '零元整';

  const [integerPart, decimalPart] = amount.toFixed(2).split('.');
  let result = '';

  // 处理整数部分
  const integerStr = integerPart.padStart(
    Math.ceil(integerPart.length / 4) * 4,
    '0'
  );
  const groups: string[] = [];
  for (let i = 0; i < integerStr.length; i += 4) {
    groups.push(integerStr.slice(i, i + 4));
  }

  groups.forEach((group, groupIndex) => {
    let groupResult = '';
    let hasNonZero = false;

    for (let i = 0; i < group.length; i++) {
      const digit = parseInt(group[i]);
      if (digit !== 0) {
        groupResult += digits[digit] + units[group.length - 1 - i];
        hasNonZero = true;
      } else if (hasNonZero && i < group.length - 1) {
        groupResult += '零';
      }
    }

    if (hasNonZero) {
      result += groupResult + bigUnits[groups.length - 1 - groupIndex];
    }
  });

  result += '元';

  // 处理小数部分
  if (decimalPart && parseInt(decimalPart) > 0) {
    const jiao = parseInt(decimalPart[0]);
    const fen = parseInt(decimalPart[1]);
    if (jiao > 0) result += digits[jiao] + '角';
    if (fen > 0) result += digits[fen] + '分';
  } else {
    result += '整';
  }

  return result;
}

/**
 * 获取收费方式中文名称
 * @param feeType 收费方式
 * @returns 中文名称
 */
function getFeeTypeName(feeType: string): string {
  const feeTypeMap: Record<string, string> = {
    FIXED: '固定收费',
    RISK: '风险代理',
    HOURLY: '计时收费',
    MIXED: '混合收费',
  };
  return feeTypeMap[feeType] || feeType;
}

/**
 * 生成合同内容哈希值
 * 用于判断合同内容是否发生变化
 * @param contract 合同数据
 * @returns 内容哈希值
 */
type ContractWithPayments = Prisma.ContractGetPayload<{
  include: { payments: true };
}>;

function generateContentHash(contract: ContractWithPayments): string {
  const content = JSON.stringify({
    contractNumber: contract.contractNumber,
    clientType: contract.clientType,
    clientName: contract.clientName,
    clientIdNumber: contract.clientIdNumber,
    clientAddress: contract.clientAddress,
    clientContact: contract.clientContact,
    lawFirmName: contract.lawFirmName,
    lawyerName: contract.lawyerName,
    caseType: contract.caseType,
    caseSummary: contract.caseSummary,
    scope: contract.scope,
    feeType: contract.feeType,
    totalFee: contract.totalFee,
    specialTerms: contract.specialTerms,
    signedAt: contract.signedAt,
    updatedAt: contract.updatedAt,
  });
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * 检查PDF缓存是否有效
 * @param contractId 合同ID
 * @param currentHash 当前内容哈希
 * @returns 缓存的PDF路径，如果缓存无效则返回null
 */
async function checkPDFCache(
  contractId: string,
  _currentHash: string
): Promise<string | null> {
  try {
    // 从数据库获取合同的filePath和updatedAt
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { filePath: true, updatedAt: true },
    });

    if (!contract || !contract.filePath) {
      return null;
    }

    // 检查文件是否存在
    const absolutePath = path.join(process.cwd(), 'public', contract.filePath);
    const fileExists = await contractFileExists(contract.filePath);

    if (!fileExists) {
      logger.info(`[PDFCache] 缓存文件不存在: ${contract.filePath}`);
      return null;
    }

    // 检查文件修改时间
    const stats = await fs.promises.stat(absolutePath);
    const fileModifiedTime = stats.mtime;
    const contractUpdatedTime = new Date(contract.updatedAt);

    // 如果合同更新时间晚于文件修改时间，说明缓存已过期
    if (contractUpdatedTime > fileModifiedTime) {
      logger.info('[PDFCache] 缓存已过期，合同已更新');
      return null;
    }

    logger.info(`[PDFCache] 使用缓存的PDF: ${contract.filePath}`);
    return contract.filePath;
  } catch (error) {
    logger.error('[PDFCache] 检查缓存失败', { error });
    return null;
  }
}

/**
 * 生成合同PDF（带缓存）
 * @param contractId 合同ID
 * @param forceRegenerate 是否强制重新生成（忽略缓存）
 * @returns PDF文件路径
 * @throws Error 如果合同不存在或生成失败
 */
export async function generateContractPDF(
  contractId: string,
  forceRegenerate: boolean = false
): Promise<string> {
  // 查询合同信息
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      payments: true,
    },
  });

  if (!contract) {
    throw new Error('合同不存在');
  }

  // 生成内容哈希
  const contentHash = generateContentHash(contract);

  // 如果不强制重新生成，检查缓存
  if (!forceRegenerate) {
    const cachedPath = await checkPDFCache(contractId, contentHash);
    if (cachedPath) {
      logger.info('[ContractPDF] 使用缓存，跳过生成');
      return cachedPath;
    }
  }

  logger.info('[ContractPDF] 开始生成新PDF...');

  // 准备合同数据
  const data: ContractData = {
    id: contract.id,
    contractNumber: contract.contractNumber,
    clientType: contract.clientType,
    clientName: contract.clientName,
    clientIdNumber: contract.clientIdNumber || undefined,
    clientAddress: contract.clientAddress || undefined,
    clientContact: contract.clientContact || undefined,
    lawFirmName: contract.lawFirmName,
    lawyerName: contract.lawyerName,
    caseType: contract.caseType,
    caseSummary: contract.caseSummary,
    scope: contract.scope,
    feeType: contract.feeType,
    totalFee: Number(contract.totalFee),
    specialTerms: contract.specialTerms || undefined,
    signedAt: contract.signedAt || undefined,
    createdAt: contract.createdAt,
    // 电子签名数据
    clientSignature: contract.clientSignature || undefined,
    clientSignedAt: contract.clientSignedAt || undefined,
    lawyerSignature: contract.lawyerSignature || undefined,
    lawyerSignedAt: contract.lawyerSignedAt || undefined,
  };

  // 生成PDF文件路径
  const filePath = generateContractFilePath(contractId);
  const absolutePath = path.join(process.cwd(), 'public', filePath);

  // 确保目录存在
  const dir = path.dirname(absolutePath);
  await fs.promises.mkdir(dir, { recursive: true });

  // 使用 pdfkit 生成 PDF
  await generatePDFWithPdfkit(data, absolutePath);

  // 更新合同记录
  await prisma.contract.update({
    where: { id: contractId },
    data: {
      filePath,
    },
  });

  logger.info(`[ContractPDF] PDF生成完成: ${filePath}`);
  return filePath;
}

/**
 * 使用 pdfkit 生成 PDF 文件
 * @param data 合同数据
 * @param outputPath 输出文件路径
 */
async function generatePDFWithPdfkit(
  data: ContractData,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `委托合同 - ${data.contractNumber}`,
          Author: data.lawFirmName,
          Subject: '委托代理合同',
        },
      });

      // 创建写入流
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // 设置中文字体
      const fontPath = path.join(
        process.cwd(),
        'fonts',
        'NotoSansSC-Regular.ttf'
      );
      if (fs.existsSync(fontPath)) {
        doc.font(fontPath);
      }

      const isEnterprise = data.clientType === 'ENTERPRISE';
      const signDate = data.signedAt
        ? new Date(data.signedAt).toLocaleDateString('zh-CN')
        : new Date().toLocaleDateString('zh-CN');
      const amountChinese = formatAmountToChinese(data.totalFee);
      const feeTypeName = getFeeTypeName(data.feeType);

      // 标题
      doc.fontSize(24).text('委托代理合同', { align: 'center' });
      doc.moveDown(0.5);

      // 合同编号
      doc.fontSize(12).text(`合同编号：${data.contractNumber}`, {
        align: 'center',
      });
      doc.moveDown();

      // 分隔线
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      // 甲方信息（委托人）
      doc.fontSize(14).text('甲方（委托人）', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`${isEnterprise ? '企业名称' : '姓名'}：${data.clientName}`);
      if (data.clientIdNumber) {
        doc.text(
          `${isEnterprise ? '统一社会信用代码' : '身份证号'}：${data.clientIdNumber}`
        );
      }
      if (data.clientAddress) {
        doc.text(`联系地址：${data.clientAddress}`);
      }
      if (data.clientContact) {
        doc.text(`联系方式：${data.clientContact}`);
      }
      doc.moveDown();

      // 乙方信息（受托人）
      doc.fontSize(14).text('乙方（受托人）', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`律所名称：${data.lawFirmName}`);
      doc.text(`承办律师：${data.lawyerName}`);
      doc.moveDown();

      // 分隔线
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      // 前言
      doc.fontSize(11);
      doc.text(
        '根据《中华人民共和国民法典》《中华人民共和国律师法》及相关法律法规的规定，甲乙双方在平等自愿的基础上，就甲方委托乙方代理法律事务达成如下协议：',
        { align: 'justify' }
      );
      doc.moveDown();

      // 一、委托事项
      doc.fontSize(13).text('一、委托事项', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      doc.text(`1.1 案件类型：${data.caseType}`);
      doc.moveDown(0.3);
      doc.text('1.2 案情简述：');
      doc.text(data.caseSummary, { indent: 20, align: 'justify' });
      doc.moveDown(0.3);
      doc.text('1.3 委托范围：');
      doc.text(data.scope, { indent: 20, align: 'justify' });
      doc.moveDown();

      // 二、律师费用及支付方式
      doc.fontSize(13).text('二、律师费用及支付方式', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      doc.text(`2.1 收费方式：${feeTypeName}`);
      doc.moveDown(0.3);
      doc.text(
        `2.2 律师费总额：人民币 ${data.totalFee.toFixed(2)} 元（大写：${amountChinese}）`
      );
      doc.moveDown(0.3);
      doc.text(
        '2.3 除律师费外，办理本案所需的诉讼费、鉴定费、公证费、差旅费等实际支出费用由甲方承担。'
      );
      doc.moveDown();

      // 三、甲方的权利和义务
      doc.fontSize(13).text('三、甲方的权利和义务', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      doc.text('3.1 甲方有权了解委托事项的进展情况，乙方应及时向甲方通报。');
      doc.moveDown(0.3);
      doc.text('3.2 甲方应如实陈述案件事实，提供真实、完整的证据材料。');
      doc.moveDown(0.3);
      doc.text('3.3 甲方应按约定支付律师费及其他费用。');
      doc.moveDown(0.3);
      doc.text('3.4 甲方有权随时解除合同，但应支付已完成工作的律师费。');
      doc.moveDown();

      // 四、乙方的权利和义务
      doc.fontSize(13).text('四、乙方的权利和义务', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      doc.text('4.1 乙方应按照法律规定和职业道德，认真履行代理职责。');
      doc.moveDown(0.3);
      doc.text('4.2 乙方应及时向甲方通报案件进展情况。');
      doc.moveDown(0.3);
      doc.text('4.3 乙方应对甲方的商业秘密和个人隐私保密。');
      doc.moveDown(0.3);
      doc.text('4.4 乙方有权拒绝甲方提出的违法要求。');
      doc.moveDown();

      // 特别约定（如果有）
      if (data.specialTerms) {
        doc.fontSize(13).text('五、特别约定', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11);
        doc.text(data.specialTerms, { align: 'justify' });
        doc.moveDown();
      }

      // 添加新页面用于签名
      doc.addPage();

      // 签名区域
      doc.fontSize(13).text('签署信息', { underline: true });
      doc.moveDown();

      doc.fontSize(11);
      doc.text('本合同一式两份，甲乙双方各执一份，具有同等法律效力。');
      doc.text('本合同自双方签字（盖章）之日起生效。');
      doc.moveDown(2);

      // 甲方签名
      doc.text('甲方（签字/盖章）：');
      const clientSignY = doc.y;

      if (data.clientSignature) {
        // 嵌入委托人签名图片
        try {
          // 将Base64转换为Buffer
          const base64Data = data.clientSignature.replace(
            /^data:image\/\w+;base64,/,
            ''
          );
          const imageBuffer = Buffer.from(base64Data, 'base64');
          doc.image(imageBuffer, 200, clientSignY - 10, {
            width: 120,
            height: 40,
          });
        } catch (error) {
          logger.error('嵌入委托人签名失败', { error });
          doc.text('________________', 200, clientSignY);
        }
      } else {
        doc.text('________________', 200, clientSignY);
      }

      doc.moveDown(3);
      doc.text(
        `日期：${data.clientSignedAt ? new Date(data.clientSignedAt).toLocaleDateString('zh-CN') : signDate}`
      );
      doc.moveDown(2);

      // 乙方签名
      doc.text('乙方（盖章）：');
      doc.moveDown(0.5);
      doc.text(`日期：${signDate}`);
      doc.moveDown(1);

      doc.text('承办律师（签字）：');
      const lawyerSignY = doc.y;

      if (data.lawyerSignature) {
        // 嵌入律师签名图片
        try {
          const base64Data = data.lawyerSignature.replace(
            /^data:image\/\w+;base64,/,
            ''
          );
          const imageBuffer = Buffer.from(base64Data, 'base64');
          doc.image(imageBuffer, 200, lawyerSignY - 10, {
            width: 120,
            height: 40,
          });
        } catch (error) {
          logger.error('嵌入律师签名失败', { error });
          doc.text('________________', 200, lawyerSignY);
        }
      } else {
        doc.text('________________', 200, lawyerSignY);
      }

      doc.moveDown(3);
      doc.text(
        `日期：${data.lawyerSignedAt ? new Date(data.lawyerSignedAt).toLocaleDateString('zh-CN') : signDate}`
      );
      doc.moveDown(2);

      // 页脚
      doc.fontSize(9).fillColor('gray');
      doc.text('本合同为电子合同，具有法律效力', { align: 'center' });
      doc.text(`合同生成时间：${new Date().toLocaleString('zh-CN')}`, {
        align: 'center',
      });

      // 完成文档
      doc.end();

      stream.on('finish', () => {
        logger.info(`[ContractPDF] PDF 生成成功: ${outputPath}`);
        resolve();
      });

      stream.on('error', (error: Error) => {
        logger.error('[ContractPDF] PDF 写入失败', error);
        reject(error);
      });
    } catch (error) {
      logger.error('[ContractPDF] PDF 生成失败', { error });
      reject(error);
    }
  });
}

/**
 * 检查合同PDF文件是否存在
 * @param filePath PDF文件路径
 * @returns 文件是否存在
 */
export async function contractFileExists(filePath: string): Promise<boolean> {
  try {
    const absolutePath = path.join(process.cwd(), 'public', filePath);
    await fs.promises.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 删除合同PDF文件
 * @param filePath PDF文件路径
 */
export async function deleteContractFile(filePath: string): Promise<void> {
  try {
    const absolutePath = path.join(process.cwd(), 'public', filePath);
    await fs.promises.unlink(absolutePath);
    logger.info(`[ContractPDF] PDF文件已删除: ${filePath}`);
  } catch (error) {
    logger.error(`删除合同文件失败: ${filePath}`, { error });
  }
}

/**
 * 清除合同PDF缓存
 * 当合同更新时调用此函数清除缓存
 * @param contractId 合同ID
 */
export async function clearContractPDFCache(contractId: string): Promise<void> {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { filePath: true },
    });

    if (contract && contract.filePath) {
      await deleteContractFile(contract.filePath);

      // 清除数据库中的filePath记录
      await prisma.contract.update({
        where: { id: contractId },
        data: { filePath: null },
      });

      logger.info(`[PDFCache] 缓存已清除: ${contractId}`);
    }
  } catch (error) {
    logger.error('[PDFCache] 清除缓存失败', { error });
  }
}

/**
 * 批量清理过期的PDF缓存
 * 删除超过指定天数未访问的PDF文件
 * @param daysOld 文件天数阈值（默认30天）
 */
export async function cleanupOldPDFCache(
  daysOld: number = 30
): Promise<number> {
  try {
    const uploadsDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'contracts'
    );

    if (!fs.existsSync(uploadsDir)) {
      return 0;
    }

    let deletedCount = 0;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // 递归遍历目录
    async function processDirectory(dir: string) {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await processDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.pdf')) {
          const stats = await fs.promises.stat(fullPath);

          // 如果文件最后访问时间早于截止日期，删除它
          if (stats.atime < cutoffDate) {
            await fs.promises.unlink(fullPath);
            deletedCount++;
            logger.info(`[PDFCache] 删除过期文件: ${fullPath}`);
          }
        }
      }
    }

    await processDirectory(uploadsDir);
    logger.info(`[PDFCache] 清理完成，删除了 ${deletedCount} 个过期文件`);
    return deletedCount;
  } catch (error) {
    logger.error('[PDFCache] 清理过期缓存失败', { error });
    return 0;
  }
}
