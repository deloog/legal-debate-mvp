import { POST } from '@/app/api/invoices/apply/route';
import { getAuthUser } from '@/lib/middleware/auth';
import { applyInvoice } from '@/lib/invoice/invoice-service';

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/invoice/invoice-service', () => ({
  applyInvoice: jest.fn(),
}));

describe('POST /api/invoices/apply', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应在未授权时返回 401', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue(null);
    const request = new Request('http://localhost/api/invoices/apply', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(401);
  });

  it('应将未支付订单映射为 400', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user-123' });
    (applyInvoice as jest.Mock).mockRejectedValue(
      new Error('订单未支付，无法开具发票')
    );

    const request = new Request('http://localhost/api/invoices/apply', {
      method: 'POST',
      body: JSON.stringify({
        orderId: 'order-1',
        type: 'PERSONAL',
        email: 'test@example.com',
      }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('INVALID_REQUEST');
    expect(data.message).toContain('未支付');
  });

  it('应将重复申请映射为 409', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user-123' });
    (applyInvoice as jest.Mock).mockRejectedValue(
      new Error('该订单已申请过发票')
    );

    const request = new Request('http://localhost/api/invoices/apply', {
      method: 'POST',
      body: JSON.stringify({
        orderId: 'order-1',
        type: 'PERSONAL',
        email: 'test@example.com',
      }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('ALREADY_APPLIED');
  });
});
