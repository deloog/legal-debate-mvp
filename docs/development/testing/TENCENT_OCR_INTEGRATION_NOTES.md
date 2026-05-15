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

2. 再补 PDF -> 图片 渲染层：
   - 当前仓库没有稳定的 PDF 页面转图片实现
   - 不建议在临近部署时仓促加入重依赖

## 当前限制

1. 当前版本不会自动把扫描版 PDF 转成图片再 OCR。
2. 因此：
   - 文本型 PDF：可直接分析
   - 扫描版 PDF：会提示当前主流程优先支持文本型 PDF

## 推荐验证

接入完成后，至少验证：

1. 一份文本型 PDF：仍走原有文本提取链，不受影响
2. 一份扫描版 PDF：能够进入 OCR provider
3. 上传后状态：
   - `PENDING`
   - `PROCESSING`
   - `COMPLETED` / `FAILED`
4. 失败提示是否仍然是用户可理解的语言
