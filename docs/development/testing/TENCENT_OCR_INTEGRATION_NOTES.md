# 腾讯 OCR 接入说明

当前状态：

1. 文本型 PDF / Word / TXT 已作为正式文档分析主路径支持。
2. 扫描版 PDF 已有检测逻辑，但 OCR provider 仍为占位实现。
3. OCR 配置与 provider 抽象已预留完成。

## 相关文件

1. OCR provider 抽象：
   - `src/lib/ocr/provider.ts`
   - `src/lib/ocr/types.ts`
2. 扫描版 PDF 检测：
   - `src/lib/ocr/pdf.ts`
   - `src/lib/chat/file-extractor.ts`
3. 文档主流程：
   - `src/app/api/v1/documents/upload/route.ts`
   - `src/app/api/v1/documents/analyze/route.ts`
4. 聊天补传路径：
   - `src/app/api/v1/chat/conversations/[conversationId]/messages/route.ts`

## 环境变量

在服务器环境中补充：

```env
OCR_PROVIDER=tencent
TENCENT_OCR_SECRET_ID=your-tencent-ocr-secret-id
TENCENT_OCR_SECRET_KEY=your-tencent-ocr-secret-key
TENCENT_OCR_REGION=ap-beijing
TENCENT_OCR_ENDPOINT=ocr.tencentcloudapi.com
```

## 技术接入建议

推荐先只接入“图片 OCR provider”，不要一次性处理 PDF 页面渲染。

建议拆成两步：

1. 先完成腾讯 OCR provider：
   - 在 `src/lib/ocr/provider.ts` 中实现 `provider === 'tencent'` 的真实调用
   - 返回统一的 `OcrDocumentResult`

2. 当前 provider 已优先按“腾讯 OCR 直接识别 PDF 单页”方式设计：
   - 通过 `IsPdf=true` + `PdfPageNumber` 按页调用
   - 这样可以避免先落地 Ghostscript 之类的系统级 PDF 转图工具
   - 若实际联调发现腾讯接口对当前 PDF 类型支持不足，再退回 PDF -> 图片方案

## 当前限制

1. 当前版本不会默认依赖 Ghostscript 做 PDF 转图片。
2. 因此：
   - 文本型 PDF：可直接分析
   - 扫描版 PDF：在配置腾讯 OCR 后，将优先尝试走腾讯 OCR 单页识别

## 推荐验证

接入完成后，至少验证：

1. 一份文本型 PDF：仍走原有文本提取链，不受影响
2. 一份扫描版 PDF：能够进入 OCR provider
3. 上传后状态：
   - `PENDING`
   - `PROCESSING`
   - `COMPLETED` / `FAILED`
4. 失败提示是否仍然是用户可理解的语言
