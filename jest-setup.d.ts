/// <reference types="@testing-library/jest-dom" />

/**
 * 全局Jest类型声明
 * 修复toBeInTheDocument等自定义匹配器的类型问题
 */

declare global {
  namespace jest {
    interface Matchers<R = void> {
      toBeInTheDocument(): R;
      toHaveTextContent(content: string | RegExp): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toHaveClass(...classNames: string[]): R;
      toHaveAttribute(attr: string, value?: string): R;
      toContainElement(element: HTMLElement | null): R;
      toHaveStyle(style: Record<string, unknown>): R;
      toBeChecked(): R;
      toBeEmpty(): R;
      toBeEnabled(): R;
      toBeEmptyDOMElement(): R;
      toContainHTML(html: string): R;
      toHaveFocus(): R;
      toHaveFormValue(values: Record<string, unknown>): R;
      toHaveProperty(path: string | string[], value?: unknown): R;
    }

    /**
     * Mock Prisma client 的类型声明
     * 支持所有 Prisma 模型
     */
    interface PrismaMock {
      user?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      case?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      debate?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      debateRound?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      argument?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      document?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      legalReference?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      lawArticle?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      aiInteraction?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      agentMemory?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      verificationResult?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      errorLog?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      agentAction?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      actionLog?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      role?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      permission?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      rolePermission?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      systemConfig?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      report?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      lawyerQualification?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      verificationCode?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      enterpriseAccount?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      enterpriseReview?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      session?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      account?: {
        create: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
      };
      $connect: jest.Mock;
      $disconnect: jest.Mock;
      $transaction: jest.Mock;
      $queryRaw: jest.Mock;
      $executeRaw: jest.Mock;
      $on: jest.Mock;
      $use: jest.Mock;
      $extends: jest.Mock;
    }
  }
}

export {};
