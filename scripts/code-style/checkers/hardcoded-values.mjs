/**
 * 硬编码值检查器
 * 检查文件中的硬编码敏感信息和配置
 */

import { MAX_ISSUES_TO_SHOW } from '../config.mjs';

/**
 * 检查硬编码值
 */
export function checkHardcodedValues(filePath, content) {
  const issues = [];
  
  // 检查硬编码的密码、token等敏感信息
  const sensitivePatterns = [
    /password\s*[:=]\s*['"]\w+['"]/gi,
    /secret\s*[:=]\s*['"]\w+['"]/gi,
    /token\s*[:=]\s*['"]\w+['"]/gi,
    /api_key\s*[:=]\s*['"]\w+['"]/gi,
    /private_key\s*[:=]\s*['"]\w+['"]/gi
  ];
  
  for (const pattern of sensitivePatterns) {
    const matches = content.match(pattern);
    if (matches) {
      issues.push(`发现可能的硬编码敏感信息: ${matches[0]}`);
    }
  }
  
  // 检查硬编码的URL
  const urlPattern = /https?:\/\/[^\s'"]+/gi;
  const urls = content.match(urlPattern);
  if (urls && urls.length > 0) {
    // 排除一些常见的开发URL和文档URL
    const allowedUrls = [
      'localhost', 
      '127.0.0.1', 
      'example.com', 
      'http://',
      'https://',
      'github.com',
      'npmjs.com',
      'vercel.com'
    ];
    
    const suspiciousUrls = urls.filter(url => {
      // 检查是否包含允许的URL模式
      const isAllowed = allowedUrls.some(allowed => url.includes(allowed));
      // 排除注释中的URL
      const isInComment = content.includes(`// ${url}`) || content.includes(`/* ${url}`);
      return !isAllowed && !isInComment;
    });
    
    if (suspiciousUrls.length > 0) {
      issues.push(`发现硬编码URL，建议使用环境变量: ${suspiciousUrls.slice(0, MAX_ISSUES_TO_SHOW).join(', ')}`);
    }
  }
  
  // 检查硬编码的端口号
  const portPattern = /:\s*(3000|8080|5000|4000|9000)/g;
  const ports = content.match(portPattern);
  if (ports && ports.length > 0) {
    issues.push(`发现硬编码端口号，建议使用环境变量: ${ports.slice(0, MAX_ISSUES_TO_SHOW).join(', ')}`);
  }
  
  // 检查硬编码的数据库连接字符串模式
  const dbPattern = /mongodb:\/\/|postgresql:\/\/|mysql:\/\//gi;
  const dbMatches = content.match(dbPattern);
  if (dbMatches) {
    issues.push(`发现硬编码数据库连接字符串，请使用环境变量`);
  }
  
  return {
    passed: issues.length === 0,
    message: issues.length === 0 ? '未发现硬编码敏感值' : issues.join('; ')
  };
}
