/**
 * mammoth 类型声明
 */

declare module 'mammoth' {
  interface ExtractRawOptions {
    buffer?: Buffer;
    path?: string;
  }

  interface ExtractRawResult {
    value: string;
    messages: Array<{
      type: string;
      message: string;
    }>;
  }

  export function extractRawText(
    options: ExtractRawOptions
  ): Promise<ExtractRawResult>;

  export function extractHtml(options: ExtractRawOptions): Promise<{
    value: string;
    messages: Array<{
      type: string;
      message: string;
    }>;
  }>;
}
