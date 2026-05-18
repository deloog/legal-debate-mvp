// ── 提案系统共享类型 ──────────────────────────────────────────────────────────

export type ProposalStatus =
  | 'PENDING'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'FAILED'
  | 'REJECTED'
  | 'REVERTED';

export type ProposalActionStatus =
  | 'PENDING'
  | 'SKIPPED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED';

export type RevertStatus =
  | 'NOT_APPLICABLE'
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED';

export type ActionType =
  | 'CREATE_CLIENT'
  | 'CREATE_CASE'
  | 'ADD_TIMELINE_EVENT'
  | 'CREATE_REMINDER';

// ── extractedData 结构（AI 原始输出，不可变） ─────────────────────────────────

export interface FieldMeta {
  confidence: number;
  needsConfirmation: boolean;
  sourceMessageId?: string;
  sourceAttachmentId?: string;
  sourceQuote?: string;
}

export interface PartyEntity {
  name: string;
  role: 'CLIENT' | 'OPPONENT' | 'WITNESS' | 'OTHER';
  meta: FieldMeta;
  candidates?: Array<{
    id: string;
    label: string;
    entityType: 'Client' | 'User' | 'Contact';
  }>;
}

export interface KeyDate {
  date: string;
  description: string;
  type: 'CONSULT' | 'INCIDENT' | 'DEADLINE' | 'HEARING' | 'OTHER';
  meta: FieldMeta;
}

export interface SuggestedAction {
  actionType: ActionType;
  label: string;
  params: Record<string, unknown>;
  sequence: number;
  dependsOnSequence?: number;
  required: boolean;
  revertStatus: 'PENDING' | 'NOT_APPLICABLE';
}

export interface CaseProposalExtractedData {
  parties: PartyEntity[];
  caseType: string;
  caseTypeMeta: FieldMeta;
  claims: Array<{ text: string; meta: FieldMeta }>;
  keyDates: KeyDate[];
  disputeFocuses?: Array<{ text: string; meta: FieldMeta }>;
  claimAmount?: number;
  suggestedActions: SuggestedAction[];
}

// ── confirmedData 结构（律师修改后，字段级确认状态） ─────────────────────────

export interface ConfirmedField<T> {
  value: T;
  confirmedAsIs: boolean;
}

export interface CaseProposalConfirmedData {
  parties?: Array<{
    name: ConfirmedField<string>;
    role: ConfirmedField<string>;
    resolvedEntityId?: string;
  }>;
  caseType?: ConfirmedField<string>;
  claims?: Array<ConfirmedField<string>>;
  keyDates?: Array<
    ConfirmedField<{ date: string; description: string; type: string }>
  >;
}

// ── API 响应类型 ──────────────────────────────────────────────────────────────

export interface ProposalActionItem {
  id: string;
  sequence: number;
  actionType: ActionType;
  label: string;
  params: Record<string, unknown>;
  selected: boolean;
  status: ProposalActionStatus;
  resourceType: string | null;
  resourceId: string | null;
  error: string | null;
  retryCount: number;
  revertStatus: RevertStatus;
  executedAt: string | null;
}

export interface ProposalDetail {
  id: string;
  conversationId: string;
  userId: string;
  caseId: string | null;
  extractedData: CaseProposalExtractedData;
  confirmedData: CaseProposalConfirmedData | null;
  status: ProposalStatus;
  confirmedAt: string | null;
  completedAt: string | null;
  revertedAt: string | null;
  revertReason: string | null;
  createdAt: string;
  actions: ProposalActionItem[];
}

// ── confirm API 请求体 ────────────────────────────────────────────────────────

export interface ConfirmProposalBody {
  confirmedData?: CaseProposalConfirmedData;
  selectedActionIds: string[];
}

// ── revert API 请求体 ─────────────────────────────────────────────────────────

export interface RevertProposalBody {
  reason: string;
}
