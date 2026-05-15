# 生产发布执行手册

适用时间：`2026-05-15` 晚间生产部署  
适用范围：法律辩论 MVP 当前主干版本

## 1. 当前发布门禁结论

以下检查已在本地完成：

1. `npm run lint:check` 通过。
1. `npx prisma validate` 通过。
1. `npm run type-check` 通过。
1. `npm run test:legacy-auth` 通过。
   - `debates-list-auth-smoke`
   - `debates-id-auth-permission-smoke`
   - `admin/export/cases`
   - `document-templates.api`
   - `payment-api`
1. `npx jest --runInBand --config=jest.config.js --runTestsByPath src/__tests__/lib/ai/quota.test.ts src/__tests__/api/admin-step-up.test.ts src/__tests__/lib/monitoring/notification-channels.test.ts` 通过。
1. `npm run build` 通过。

本轮已修复的发布阻塞项：

1. `src/app/api/lib/responses/error.ts` 命中了 Next.js `error.ts` 保留文件约定，已改名为 `error-response.ts`，生产构建已恢复通过。

当前仍需知晓但不构成发布阻塞的事项：

1. 当前 Windows 本机执行 `npx prisma generate` 会因活跃 Node 进程占用 Prisma 引擎文件而报 `EPERM rename`。这属于本机文件锁问题，不代表代码生成本身有错误；在干净的 CI/Linux/服务器环境重新安装依赖时通常不会复现。
2. `.github/workflows/deploy.yml` 的实际发布步骤仍是占位符；如果明晚走 GitHub Actions 自动发布，必须先补全真实部署命令。否则请按手册执行人工发布。

## 2. 发布前必须确认

1. 确认发布方式：
   - 手工发布到服务器
   - 或补全 `.github/workflows/deploy.yml` 后走 Actions
2. 确认生产环境变量已经是**真实值**，不要保留占位符。
3. 确认数据库备份负责人、回滚负责人、应用发布负责人都已明确。
4. 确认生产数据库可以执行 `prisma migrate deploy`。
5. 如果本次需要让 AI 配额配置完全生效，确认部署后会执行 `npm run seed:configs`。

建议重点核对的环境变量：

1. `DATABASE_URL`
2. `REDIS_URL`
3. `NEXTAUTH_SECRET`
4. `JWT_SECRET`
5. `ZHIPU_API_KEY`
6. `DEEPSEEK_API_KEY`
7. `ALERT_EMAIL_TO`
8. `ALERT_WEBHOOK_URL`
9. `ALERT_SMS_RECIPIENTS`
10. 短信供应商相关凭据
11. 如接入扫描件 OCR，再核对 `OCR_PROVIDER` / `TENCENT_OCR_SECRET_ID` / `TENCENT_OCR_SECRET_KEY`

## 3. 发布当晚执行顺序

1. 先做数据库备份。

```bash
pg_dump -h <PG_HOST> -U <PG_USER> -d <PG_DATABASE> > backup_prod_$(date +%Y%m%d_%H%M%S).sql
```

2. 切到待发布版本并确认提交号。

```bash
git fetch --all --tags
git checkout <release-branch-or-tag>
git rev-parse HEAD
```

3. 安装依赖。

```bash
npm ci
```

4. 执行数据库迁移。

```bash
npx prisma migrate deploy
```

5. 如需同步系统配置种子，执行：

```bash
npm run seed:configs
```

6. 在目标环境重新构建。

```bash
npm run build
```

7. 执行真实发布命令。

说明：这一条因部署方式不同而不同，可能是 `pm2 reload`、`systemctl restart`、Docker、Kubernetes、面板发布或自建脚本。

8. 发布后立即做健康检查。

```bash
curl -I https://<prod-domain>/api/health
```

9. 发布后立即做核心 smoke。

## 4. 发布后 smoke 清单

1. 访问 `/api/health`，确认返回 `200`。
2. 管理员登录后台，打开 `/admin/system-monitoring`。
3. 进入 `/admin/system-monitoring/control`，确认二次认证流程可用。
4. 正常用户登录，确认登录链路无回归。
5. 支付查询接口验证：
   - `/api/payments/query`
   - 如有兼容调用，再验证 `/api/payments/alipay/query`
6. 打开聊天页，确认欢迎态问候、快捷入口、输入框和顶部按钮显示正常。
7. 至少抽查一条文档模板接口或后台导出接口，确认基础后台权限链正常。
8. 如测试扫描版 PDF，请确认当前版本仍以“文本型 PDF / Word / TXT”为主支持路径。

## 5. 发布后 30 分钟观察项

1. 应用日志是否持续出现 `500` 或认证错误。
2. `/admin/system-monitoring` 中的健康、告警、限流摘要是否正常刷新。
3. 支付回调或支付查询是否出现异常峰值。
4. Redis、数据库连接、AI 服务可用性是否异常。
5. 如启用短信告警，确认短信渠道显示为可发送状态。

## 6. 回滚触发条件

满足任一条件应暂停扩散并准备回滚：

1. `prisma migrate deploy` 失败。
2. `/api/health` 连续异常。
3. 登录、支付查询、后台监控任一主链路失败。
4. 生产错误日志快速放量。
5. 监控页核心摘要无法加载或连续返回 `5xx`。

## 7. 额外说明

1. 本地构建日志里出现的 `your_db_host:5432` 连接失败，是因为当前机器的 `.env.production` 仍是占位配置；这提醒我们生产环境必须提供真实数据库地址。
2. 由于系统配置会在部分服务初始化阶段被读取，生产环境数据库连通性应在发布前先确认。
3. 如果需要在 Windows 本机再次执行 `prisma generate`，请先关闭占用 Prisma 引擎文件的 `next dev` 或其他 Node 进程。
4. 当前正式文档分析主流程优先支持文本型 PDF、Word、TXT；扫描版 PDF 的 OCR provider 基础接口已预留，待腾讯 OCR 账号接入后启用。
