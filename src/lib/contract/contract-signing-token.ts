import { generateAccessToken, verifyToken } from '@/lib/auth/jwt';

const SIGNING_TOKEN_PREFIX = 'contract-signing';

export interface ContractSigningTokenPayload {
  contractId: string;
  role: 'client';
  recipientEmail: string;
}

export function generateContractSigningToken(
  payload: ContractSigningTokenPayload,
  expiresIn: string = '7d'
): string {
  return generateAccessToken(
    {
      userId: `${SIGNING_TOKEN_PREFIX}:${payload.contractId}`,
      email: payload.recipientEmail,
      role: 'CONTRACT_SIGNER',
      jti: `${SIGNING_TOKEN_PREFIX}:${payload.contractId}:client`,
    },
    expiresIn
  );
}

export function verifyContractSigningToken(
  token: string
): ContractSigningTokenPayload | null {
  const result = verifyToken(token);
  if (!result.valid || !result.payload) return null;

  const { userId, email, role, jti } = result.payload;
  if (role !== 'CONTRACT_SIGNER') return null;
  if (!userId.startsWith(`${SIGNING_TOKEN_PREFIX}:`)) return null;
  if (!jti?.startsWith(`${SIGNING_TOKEN_PREFIX}:`)) return null;

  const contractId = userId.slice(`${SIGNING_TOKEN_PREFIX}:`.length);
  return {
    contractId,
    role: 'client',
    recipientEmail: email,
  };
}
