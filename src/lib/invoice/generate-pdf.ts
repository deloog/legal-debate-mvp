/**
 * 发票PDF生成模块
 * 使用 pdfkit 生成符合中国税务标准的发票PDF文件
 */

import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@/lib/db/prisma';
import { InvoiceType, OrderStatus, InvoiceStatus } from '@/types/payment';
import { formatAmountToChinese } from './invoice-utils';

/**
 * 发票信息接口
 */
interface InvoiceData {
  invoiceNo: string;
  type: InvoiceType;
  title?: string;
  taxNumber?: string;
  email?: string;
  amount: number;
  currency: string;
  createdAt: Date;
  issuedAt?: Date;
  orderNo: string;
  membershipTierName: string;
  membershipTierDisplayName: string;
  userName: string;
  userEmail: string;
}

/**
 * 生成发票PDF文件路径
 * @param invoiceId 发票ID
 * @returns PDF文件路径
 */
function generateInvoiceFilePath(invoiceId: string): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `/uploads/invoices/${year}/${month}/${day}/${invoiceId}.pdf`;
}

/**
 * 生成发票PDF
 * @param invoiceId 发票ID
 * @returns PDF文件路径
 * @throws Error 如果发票不存在或生成失败
 */
export async function generateInvoicePDF(invoiceId: string): Promise<string> {
  // 查询发票信息
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      order: {
        include: {
          membershipTier: true,
        },
      },
      user: true,
    },
  });

  if (!invoice) {
    throw new Error('发票不存在');
  }

  // 检查发票状态
  if (
    invoice.status !== InvoiceStatus.PENDING &&
    invoice.status !== InvoiceStatus.COMPLETED
  ) {
    throw new Error('发票状态不允许重新生成');
  }

  // 检查订单状态
  if (invoice.order.status !== OrderStatus.PAID) {
    throw new Error('订单未支付，无法开具发票');
  }

  // 准备发票数据
  const data: InvoiceData = {
    invoiceNo: invoice.order.orderNo,
    type: invoice.type as InvoiceType,
    title: invoice.title || undefined,
    taxNumber: invoice.taxNumber || undefined,
    email: invoice.email || undefined,
    amount: Number(invoice.amount),
    currency: invoice.currency,
    createdAt: invoice.createdAt,
    issuedAt: invoice.issuedAt || undefined,
    orderNo: invoice.order.orderNo,
    membershipTierName: invoice.order.membershipTier.name,
    membershipTierDisplayName: invoice.order.membershipTier.displayName,
    userName: invoice.user.name || invoice.user.email,
    userEmail: invoice.user.email,
  };

  // 生成PDF文件路径
  const filePath = generateInvoiceFilePath(invoiceId);
  const absolutePath = path.join(process.cwd(), 'public', filePath);

  // 确保目录存在
  const dir = path.dirname(absolutePath);
  await fs.promises.mkdir(dir, { recursive: true });

  // 使用 pdfkit 生成 PDF
  await generatePDFWithPdfkit(data, absolutePath);

  // 更新发票状态
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'COMPLETED',
      filePath,
      issuedAt: new Date(),
    },
  });

  return filePath;
}

/**
 * 使用 pdfkit 生成 PDF 文件
 * @param data 发票数据
 * @param outputPath 输出文件路径
 */
async function generatePDFWithPdfkit(
  data: InvoiceData,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `发票 - ${data.invoiceNo}`,
          Author: '律伴助手',
          Subject: '电子发票',
        },
      });

      // 创建写入流
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // 设置中文字体（使用内置字体，中文可能显示为方块）
      // 生产环境中应该使用中文字体文件
      const fontPath = path.join(
        process.cwd(),
        'fonts',
        'NotoSansSC-Regular.ttf'
      );
      if (fs.existsSync(fontPath)) {
        doc.font(fontPath);
      }

      const isEnterprise = data.type === InvoiceType.ENTERPRISE;
      const issuedAt = data.issuedAt
        ? new Date(data.issuedAt).toLocaleDateString('zh-CN')
        : new Date().toLocaleDateString('zh-CN');
      const createdAt = new Date(data.createdAt).toLocaleDateString('zh-CN');
      const amountChinese = formatAmountToChinese(data.amount);

      // 标题
      doc.fontSize(24).text('电 子 发 票', { align: 'center' });
      doc.moveDown(0.5);

      // 分隔线
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      // 发票编号和日期
      doc.fontSize(12);
      doc.text(`发票编号：${data.invoiceNo}`, 50);
      doc.text(`开具日期：${issuedAt}`, 50, doc.y - 14, { align: 'right' });
      doc.moveDown();

      // 购买方信息
      doc.fontSize(14).text('购买方信息', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`名称：${isEnterprise ? data.title : data.userName}`);
      if (isEnterprise && data.taxNumber) {
        doc.text(`税号：${data.taxNumber}`);
      }
      doc.text(`邮箱：${data.email || data.userEmail}`);
      doc.moveDown();

      // 服务内容
      doc.fontSize(14).text('服务内容', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`服务名称：${data.membershipTierDisplayName}会员服务`);
      doc.text(`订单号：${data.orderNo}`);
      doc.text(`服务时间：${createdAt}`);
      doc.moveDown();

      // 分隔线
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      // 金额信息
      doc.fontSize(14).text('金额信息', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`金额（大写）：${amountChinese}`);
      doc
        .fontSize(18)
        .fillColor('red')
        .text(`合计金额：¥${data.amount.toFixed(2)}`, { align: 'right' });
      doc.fillColor('black');
      doc.moveDown(2);

      // 销售方信息
      doc.fontSize(14).text('销售方信息', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text('名称：律伴助手');
      doc.text('地址：北京市朝阳区');
      doc.text('电话：400-123-4567');
      doc.text('邮箱：support@lvban.com');
      doc.moveDown(2);

      // 页脚
      doc.fontSize(10).fillColor('gray');
      doc.text('本发票为电子发票，具有法律效力', { align: 'center' });
      doc.text(`发票生成时间：${new Date().toLocaleString('zh-CN')}`, {
        align: 'center',
      });

      // 完成文档
      doc.end();

      stream.on('finish', () => {
        console.log(`[InvoicePDF] PDF 生成成功: ${outputPath}`);
        resolve();
      });

      stream.on('error', error => {
        console.error(`[InvoicePDF] PDF 写入失败:`, error);
        reject(error);
      });
    } catch (error) {
      console.error(`[InvoicePDF] PDF 生成失败:`, error);
      reject(error);
    }
  });
}

/**
 * 批量生成发票PDF
 * @param invoiceIds 发票ID数组
 * @returns 生成失败的发票ID数组
 */
export async function batchGenerateInvoicePDF(
  invoiceIds: string[]
): Promise<string[]> {
  const failedInvoices: string[] = [];

  for (const invoiceId of invoiceIds) {
    try {
      await generateInvoicePDF(invoiceId);
    } catch (error) {
      console.error(`生成发票PDF失败: ${invoiceId}`, error);
      failedInvoices.push(invoiceId);
    }
  }

  return failedInvoices;
}

/**
 * 检查发票PDF文件是否存在
 * @param filePath PDF文件路径
 * @returns 文件是否存在
 */
export async function invoiceFileExists(filePath: string): Promise<boolean> {
  try {
    const absolutePath = path.join(process.cwd(), 'public', filePath);
    await fs.promises.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 删除发票PDF文件
 * @param filePath PDF文件路径
 */
export async function deleteInvoiceFile(filePath: string): Promise<void> {
  try {
    const absolutePath = path.join(process.cwd(), 'public', filePath);
    await fs.promises.unlink(absolutePath);
  } catch (error) {
    console.error(`删除发票文件失败: ${filePath}`, error);
  }
}
