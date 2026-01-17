/**
 * 发票PDF生成模块
 * 生成符合中国税务标准的发票PDF文件
 */

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
 * 生成发票HTML模板
 * @param data 发票数据
 * @returns HTML字符串
 */
function generateInvoiceHTML(data: InvoiceData): string {
  const isEnterprise = data.type === InvoiceType.ENTERPRISE;
  const issuedAt = data.issuedAt
    ? new Date(data.issuedAt).toLocaleDateString('zh-CN')
    : '待开具';
  const createdAt = new Date(data.createdAt).toLocaleDateString('zh-CN');
  const amountChinese = formatAmountToChinese(data.amount);

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>发票 - ${data.invoiceNo}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Microsoft YaHei', 'SimHei', Arial, sans-serif;
      font-size: 14px;
      color: #333;
      line-height: 1.6;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      border: 1px solid #ddd;
    }
    .invoice-header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
    }
    .invoice-title {
      font-size: 32px;
      font-weight: bold;
      color: #333;
    }
    .invoice-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .invoice-no {
      font-size: 18px;
      font-weight: bold;
    }
    .invoice-date {
      color: #666;
    }
    .invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .invoice-table th,
    .invoice-table td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    .invoice-table th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    .invoice-table .amount {
      text-align: right;
      font-weight: bold;
    }
    .invoice-total {
      text-align: right;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 20px;
    }
    .invoice-amount-chinese {
      font-size: 16px;
      color: #666;
      margin-bottom: 10px;
    }
    .invoice-amount-numeric {
      font-size: 24px;
      color: #e53935;
    }
    .invoice-footer {
      text-align: center;
      color: #999;
      font-size: 12px;
      margin-top: 40px;
    }
    .company-info {
      margin-bottom: 20px;
    }
    .company-info h3 {
      font-size: 16px;
      margin-bottom: 10px;
    }
    .company-info p {
      color: #666;
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="invoice-header">
      <div class="invoice-title">电 子 发 票</div>
    </div>

    <div class="invoice-info">
      <div class="invoice-no">发票编号：${data.invoiceNo}</div>
      <div class="invoice-date">开具日期：${issuedAt}</div>
    </div>

    <table class="invoice-table">
      <thead>
        <tr>
          <th>购买方信息</th>
          <th>服务内容</th>
          <th class="amount">金额</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <p><strong>${isEnterprise ? data.title : data.userName}</strong></p>
            ${isEnterprise && data.taxNumber ? `<p>税号：${data.taxNumber}</p>` : ''}
            <p>邮箱：${data.email || data.userEmail}</p>
          </td>
          <td>
            <p><strong>${data.membershipTierDisplayName}会员服务</strong></p>
            <p>订单号：${data.orderNo}</p>
            <p>服务时间：${createdAt}</p>
          </td>
          <td class="amount">
            ¥${data.amount.toFixed(2)}
          </td>
        </tr>
      </tbody>
    </table>

    <div class="invoice-total">
      <div class="invoice-amount-chinese">
        （大写：${amountChinese}）
      </div>
      <div class="invoice-amount-numeric">
        合计：¥${data.amount.toFixed(2)}
      </div>
    </div>

    <div class="company-info">
      <h3>律伴助手</h3>
      <p>地址：北京市朝阳区</p>
      <p>电话：400-123-4567</p>
      <p>邮箱：support@lvban.com</p>
    </div>

    <div class="invoice-footer">
      <p>本发票为电子发票，具有法律效力</p>
      <p>发票生成时间：${new Date().toLocaleString('zh-CN')}</p>
    </div>
  </div>
</body>
</html>
  `;
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

  // 生成HTML
  const html = generateInvoiceHTML(data);

  // 在实际生产环境中，这里应该使用专业的PDF生成库（如puppeteer、playwright、jsPDF等）
  // 生成PDF文件并保存到指定路径
  const filePath = generateInvoiceFilePath(invoiceId);

  // 临时返回HTML，实际应该生成PDF
  // TODO: 集成PDF生成库
  const fs = await import('fs');
  const path = await import('path');

  // 确保目录存在
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });

  // 暂时保存HTML文件（实际应该生成PDF）
  const htmlPath = filePath.replace('.pdf', '.html');
  await fs.promises.writeFile(htmlPath, html, 'utf-8');

  // 更新发票状态
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'COMPLETED',
      filePath,
      issuedAt: new Date(),
    },
  });

  // TODO: 实际应该返回PDF文件路径
  return htmlPath;
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
    const fs = await import('fs');
    await fs.promises.access(filePath);
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
    const fs = await import('fs');
    await fs.promises.unlink(filePath);
  } catch (error) {
    console.error(`删除发票文件失败: ${filePath}`, error);
  }
}
