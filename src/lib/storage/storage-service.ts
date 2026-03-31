/**
 * 统一文件存储服务
 * 根据环境变量自动切换本地存储（开发/测试）或阿里云OSS（生产）
 *
 * 环境变量：
 *   OSS_ENABLED=true         启用OSS
 *   OSS_ACCESS_KEY           AccessKey ID
 *   OSS_SECRET_KEY           AccessKey Secret
 *   OSS_BUCKET               Bucket名称
 *   OSS_REGION               地域，如 oss-cn-hangzhou
 *   OSS_ENDPOINT             自定义域名（可选），如 https://cdn.example.com
 */

import { logger } from '@/lib/logger';
import { mkdir, writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';

// =============================================================================
// 类型定义
// =============================================================================

export interface UploadResult {
  /** 存储键（OSS object key 或本地相对路径） */
  key: string;
  /** 访问 URL。公开文件为直接 URL，私有文件为空字符串（需调用 getSignedUrl） */
  url: string;
}

export interface StorageOptions {
  /** 是否为私有文件（私有文件不能直接访问，需要签名URL） */
  isPrivate?: boolean;
  /** Content-Type */
  contentType?: string;
}

// =============================================================================
// OSS 客户端（懒加载，避免在本地环境引入未配置的模块）
// =============================================================================

let ossClient: unknown = null;

async function getOssClient(): Promise<unknown> {
  if (ossClient) return ossClient;

  // 动态导入，避免在不使用OSS时引入依赖
  const OSS = (await import('ali-oss')).default;
  ossClient = new OSS({
    region: process.env.OSS_REGION ?? '',
    accessKeyId: process.env.OSS_ACCESS_KEY ?? '',
    accessKeySecret: process.env.OSS_SECRET_KEY ?? '',
    bucket: process.env.OSS_BUCKET ?? '',
    ...(process.env.OSS_ENDPOINT ? { endpoint: process.env.OSS_ENDPOINT } : {}),
    secure: true,
  });
  return ossClient;
}

// =============================================================================
// 内部辅助函数
// =============================================================================

function isOssEnabled(): boolean {
  return process.env.OSS_ENABLED === 'true';
}

function getOssPublicUrl(key: string): string {
  if (process.env.OSS_ENDPOINT) {
    const base = process.env.OSS_ENDPOINT.replace(/\/$/, '');
    return `${base}/${key}`;
  }
  const bucket = process.env.OSS_BUCKET ?? '';
  const region = process.env.OSS_REGION ?? '';
  return `https://${bucket}.${region}.aliyuncs.com/${key}`;
}

// =============================================================================
// 核心接口
// =============================================================================

/**
 * 上传文件
 * @param buffer 文件内容
 * @param key 存储键（OSS object key 或本地路径）
 * @param options 存储选项
 * @returns 上传结果
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  options: StorageOptions = {}
): Promise<UploadResult> {
  if (isOssEnabled()) {
    return uploadToOss(buffer, key, options);
  }
  return uploadToLocal(buffer, key);
}

/**
 * 删除文件
 * @param key 存储键
 */
export async function deleteStoredFile(key: string): Promise<void> {
  if (isOssEnabled()) {
    await deleteFromOss(key);
  } else {
    await deleteFromLocal(key);
  }
}

/**
 * 获取私有文件的签名访问URL（有效期1小时）
 * 本地存储时返回 null（调用方应改为读取本地文件）
 * @param key 存储键
 * @param expiresSeconds 签名URL有效期（秒），默认3600
 */
export async function getSignedUrl(
  key: string,
  expiresSeconds = 3600
): Promise<string | null> {
  if (!isOssEnabled()) return null;

  try {
    const client = (await getOssClient()) as {
      signatureUrl: (key: string, options: { expires: number }) => string;
    };
    return client.signatureUrl(key, { expires: expiresSeconds });
  } catch (error) {
    logger.error('生成OSS签名URL失败:', { key, error });
    return null;
  }
}

/**
 * 读取本地私有文件（仅本地存储时使用）
 * @param localPath 绝对路径
 */
export async function readLocalFile(localPath: string): Promise<Buffer | null> {
  try {
    return await readFile(localPath);
  } catch {
    return null;
  }
}

/**
 * 检查OSS对象是否存在（HEAD请求）
 * 本地模式时始终返回 false
 * @param key OSS object key
 */
export async function ossObjectExists(key: string): Promise<boolean> {
  if (!isOssEnabled()) return false;
  try {
    const client = (await getOssClient()) as {
      head: (key: string) => Promise<unknown>;
    };
    await client.head(key);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// OSS 实现
// =============================================================================

async function uploadToOss(
  buffer: Buffer,
  key: string,
  options: StorageOptions
): Promise<UploadResult> {
  const client = (await getOssClient()) as {
    put: (
      key: string,
      buffer: Buffer,
      options: Record<string, unknown>
    ) => Promise<unknown>;
  };

  const putOptions: Record<string, unknown> = {};
  if (options.contentType) {
    putOptions.headers = { 'Content-Type': options.contentType };
  }
  // 私有文件使用 private ACL，公开文件使用 public-read
  if (!options.isPrivate) {
    putOptions.headers = {
      ...(putOptions.headers as Record<string, string> | undefined),
      'x-oss-object-acl': 'public-read',
    };
  }

  await client.put(key, buffer, putOptions);

  const url = options.isPrivate ? '' : getOssPublicUrl(key);
  logger.info('文件已上传至OSS:', { key, isPrivate: options.isPrivate });

  return { key, url };
}

async function deleteFromOss(key: string): Promise<void> {
  try {
    const client = (await getOssClient()) as {
      delete: (key: string) => Promise<unknown>;
    };
    await client.delete(key);
    logger.info('OSS文件已删除:', { key });
  } catch (error) {
    logger.warn('删除OSS文件失败:', { key, error });
  }
}

// =============================================================================
// 本地存储实现
// =============================================================================

async function uploadToLocal(
  buffer: Buffer,
  key: string
): Promise<UploadResult> {
  // key 形如 evidence/uuid.jpg 或 uploads/caseId/file.pdf
  const fullPath = join(process.cwd(), 'private_uploads', key);
  const dir = fullPath.substring(
    0,
    fullPath.lastIndexOf('/') !== -1
      ? fullPath.lastIndexOf('/')
      : fullPath.lastIndexOf('\\')
  );

  await mkdir(dir, { recursive: true });
  await writeFile(fullPath, buffer);

  return { key, url: '' };
}

async function deleteFromLocal(key: string): Promise<void> {
  const fullPath = join(process.cwd(), 'private_uploads', key);
  try {
    await unlink(fullPath);
  } catch (error) {
    logger.warn('删除本地文件失败:', { key, error });
  }
}
