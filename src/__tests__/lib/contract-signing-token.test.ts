import {
  generateContractSigningToken,
  verifyContractSigningToken,
} from '@/lib/contract/contract-signing-token';

describe('contract-signing-token', () => {
  it('should generate and verify client signing token', () => {
    const token = generateContractSigningToken({
      contractId: 'contract-123',
      role: 'client',
      recipientEmail: 'client@example.com',
    });

    const payload = verifyContractSigningToken(token);

    expect(payload).toEqual({
      contractId: 'contract-123',
      role: 'client',
      recipientEmail: 'client@example.com',
    });
  });

  it('should reject invalid token', () => {
    expect(verifyContractSigningToken('invalid-token')).toBeNull();
  });
});
