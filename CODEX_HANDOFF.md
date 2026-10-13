# Codex 接手 XT Trade Journal AI（2026-10-12）

## 目标
请自主完成并验证 XT AI 从 Windows 本地 SQLite 客户端到可安全部署、支持多用户的 Supabase 云端交易日志系统。尽量完成代码、测试和文档，不要要求用户反复下载 ZIP 或复制代码。只在需要用户授权访问外部账号、真实部署、付费或数据迁移时提问。**未测试的功能不要说已经完成**。

## 当前代码状态
- repo: kaixiang13140-pixel/xt-trade-journal-ai
- default: main；正在开发: feature/xt-supabase-connectivity-20261012；existing draft PR #1。
- Next.js 15、TypeScript、Drizzle + better-sqlite3，pnpm。请先读 README.md、docs/xt-customers.md，审查 PR #1。
- Windows: Start-XT-Customers.cmd，XT_MULTIUSER=1，XT 登录由 apps/web/src/server/customers.ts 和 middleware.ts 控制。每位 XT 用户独立本地 SQLite 数据（apps/web/src/server/tenant.ts / db/index.ts）。
- /api/export 当前提供无 broker credentials 的 JSON；交易导入和分析仍依赖 SQLite。
- Supabase: 用户已创建 xt-trade-journal 项目；已确认 /api/cloud/health 可连接，/cloud-test 测试登录成功，xt_profiles 存在，并成功执行 supabase/xt_cloud_backups.sql。
- 当前实验性的 /cloud-backup 页面与 /api/cloud/backup 接口刚提交，**未进行端到端运行测试**。它只做手动选定字段快照，不是同步、完整备份、跨设备读取或恢复。
- 用户原数据已手动备份，**禁止覆盖或删除任何用户 SQLite 文件/加密密钥**。
- Supabase URL/key 存在用户本机 apps/web/.env.local，不在 GitHub。绝不提交真实密码、Key、token 或顾客交易记录。

## 按优先级工作
1. 审计并修复 PR #1 的接口、RLS、Auth、cookie/CSRF、跨租户隔离、泄密及数据一致性风险；先在隔离测试环境运行 typecheck/tests/build。
2. 设计旧 XT 本地用户 ID 与 Supabase auth.users UUID 的账户关联和迁移流程；两套 ID 不相同，不能单凭相同 email 偷偷合并身份。必要时明确授权、验证旧密码和 Supabase 登录。
3. 设计并实现安全 Postgres schema + 全面 RLS（账户、executions、trades、annotations、notes、journal），导入去重、事务与审计、备份恢复。保留既有交易计算和 MT5 导入行为。
4. 云端登录、注册、退出、邮件确认/找回密码与响应式移动浏览器；确保两个用户数据完全隔离。
5. 添加真实读写和双向/单向迁移机制、明确冲突策略、完整性测试、故障回滚。别把 manual snapshot 冒充自动同步。
6. 安全的部署方案和中文一步部署指南；优先考量 RM0、无需银行卡，但如存在现实限制要明确说明；真实公网发布、顾客数据迁移和收费需要先获用户批准。

## 完成验收
- 可重复的自动化测试（至少：两用户跨用户访问拒绝、交易 CRUD、RLS、导入幂等、敏感字段不泄露、备份恢复一致）。
- pnpm typecheck/test/build；失败则注明准确原因，不能虚报通过。
- 功能 PR、部署与回滚文档、完成与未完成 checklist。
- 不要直接 merge 主分支；请先提交 PR 供检查。
- 尽量独立完成工程工作，最后再一次性向用户汇报必要操作。

用户当前很累，不适合手动逐步复制代码；请最大限度自动执行可在代码仓库内完成的工作。