export type AnnotationType =
  | 'CONFIRM'
  | 'QUESTION'
  | 'REJECT'
  | 'IMPORTANT'
  | 'USE_IN_DOC';

export interface AnnotationItem {
  id: string;
  messageId: string;
  userId: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  type: AnnotationType;
  note: string | null;
  createdAt: string;
}

export interface AttachmentItem {
  id: string;
  messageId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  extractedText: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  isDeleted: boolean;
  createdAt: string;
  attachments: AttachmentItem[];
  annotations: AnnotationItem[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  parentConversationId: string | null;
  branchFromMessageId: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  branches: ConversationSummary[];
  _count: { messages: number };
}

export const ANNOTATION_META: Record<
  AnnotationType,
  { label: string; color: string; bg: string }
> = {
  CONFIRM: { label: '认可', color: 'text-green-700', bg: 'bg-green-100' },
  QUESTION: { label: '存疑', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  REJECT: { label: '有误', color: 'text-red-700', bg: 'bg-red-100' },
  IMPORTANT: { label: '重点', color: 'text-purple-700', bg: 'bg-purple-100' },
  USE_IN_DOC: { label: '入文书', color: 'text-blue-700', bg: 'bg-blue-100' },
};
