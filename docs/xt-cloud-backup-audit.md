# Supabase 手动快照审计（2026-10-12）

范围：`feature/xt-supabase-connectivity-20261012` 上已有的 `/cloud-backup`、`/api/cloud/backup` 和 `supabase/xt_cloud_backups.sql`。没有开发其他云端功能、部署、恢复、用户迁移或真实数据操作。`CODEX_HANDOFF.md` 中更广的迁移目标不属于本次工作。

## 修复

- **一致性**：原来分别读取七张表，没有事务。现在在一个同步 SQLite 读事务内完成计数、限额检查和快照捕获；捕获结束后才发网络请求。另一连接中途写入时，快照仍读取同一时间点的数据。不会长时间持有数据库事务等待 Supabase。
- **字段边界**：所有七张表使用明确字段名单。排除券商凭据、账户连接快照、执行导入元数据、设置/API 密钥、登录账户、会话、加密密钥和附件。自由文本笔记保留原文，用户自己写进笔记的秘密不会自动识别或清除。
- **内存与大小**：保留 850,000 UTF-8 字节限制。先用 SQLite 字节长度下界拒绝巨大的源字段，再逐行迭代读取并计入实际 JSON 转义字节，不先把整个大库读入 JS 数组。最终请求再做精确校验；不会发送部分快照。
- **身份与网络**：本地会话/租户、明确确认、同邮箱目的地限制和限流保留；通过 Supabase `/auth/v1/user` 验证临时 token 的身份，并核对 UUID 与邮箱。两套 ID 不会合并或修改。仅接受标准 HTTPS Supabase 项目地址和 publishable key；所有请求禁止跟随重定向。
- **临时会话**：拿到临时 access token 后，所有退出路径都会尝试 `logout?scope=local`，不会退出其他 Supabase 设备。清理是 best effort，服务故障时不能保证撤销成功；不持久化或返回 token/refresh token。
- **结果确认**：只返回云端计数、版本、归属和时间元数据，不回传整份交易/笔记。成功响应必须只有一条记录，且 user_id、版本、捕获时间和三项计数全部匹配；上游 JSON 响应也有大小限制。超时、失败或不一致不会自动重试，也不会报成功。
- **界面**：上传期间锁定输入，结束后清空密码。允许有效的短 Supabase 既有密码；XT 本地密码规则没有改变。
- **SQL 权限**：脚本整体事务化，开启并强制 RLS，显式撤销默认权限，只允许 authenticated SELECT/INSERT/UPDATE。移除不需要的 DELETE 权限和策略；TRUNCATE 没有授权。两名用户的行策略独立，不能改归属或覆盖对方记录。

## 测试方式

仅使用临时 SQLite、模拟 HTTP 服务和独立本地 PostgreSQL（PGlite）。没有使用真实 Supabase URL/key，也没有向真实服务登录、上传、读写或运行 SQL。

```sh
pnpm exec vitest run apps/web/tests/cloud-backup.test.ts --maxWorkers=1
pnpm typecheck
pnpm exec vitest run --maxWorkers=4
pnpm build
```

本次结果：相关接口/表单测试 30 项通过；本地 PostgreSQL 权限测试通过；全量回归 615 项通过；`pnpm typecheck`、生产构建和修改文件格式检查通过。生产构建使用独立临时数据目录，没有读取用户原数据库。

SQL 行为测试可复现，不改变应用依赖：

```sh
npm install --prefix /tmp/xt-backup-postgres --no-audit --no-fund @electric-sql/pglite@0.5.9
XT_PGLITE_MODULE=/tmp/xt-backup-postgres/node_modules/@electric-sql/pglite/dist/index.js node --test supabase/tests/backup-rls.test.mjs
```

SQL 测试覆盖重复运行保留旧快照、同用户更新、跨用户 SELECT/INSERT/UPSERT/UPDATE 拒绝、匿名访问拒绝、DELETE/TRUNCATE 拒绝、负计数/错误版本/非对象 payload 拒绝。接口测试覆盖真实本地租户隔离、CSRF、仅开发模式、配置/输入校验、敏感字段排除、Auth 身份校验、限流、大小限制、并发读取一致性、失败/超时/错误确认及临时会话清理。

## 未执行与限制

- SQL 权限修改仅在测试数据库验证；没有应用到真实 Supabase 项目。PR 审核通过后，如需应用，须另行授权；脚本不会删除快照行。
- 没有真实 Supabase/PostgREST 端到端测试或浏览器视觉测试；模拟响应不等于已验证真实连接。
- 仍是开发环境内手动、单槽位、选定字段快照。再次上传会替换当前云端快照；并发上传最后写入者获胜，没有版本历史、跨设备读取、自动同步或恢复功能。
- 没有附件、导入批次/来源映射、行情、进度、prop firm、规则检查、设置和完整用户/加密密钥，不能用作完整可恢复备份。完整本地备份仍须妥善保留。
- 本地 hostname/NODE_ENV 检查是开发功能开关，不是网络访问边界。不要把开发服务器暴露到公网。
- 超时或确认失败可能发生在数据库已接受写入之后；先检查云端记录再手动重试，API 不执行盲目重试。
