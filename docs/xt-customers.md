# XT 顾客版：电脑、手机和平板

顾客使用浏览器打开你的 HTTPS 网址，输入邀请码注册邮箱与密码（至少 12 个字符），之后登录使用。同一个顾客在电脑、手机、平板登录同一账户，可以访问服务器上的同一份记录。每台设备可独立退出，登录有效期为 7 天。

每个顾客有独立的数据库、交易账户、交易、笔记、附件、设置与加密密钥。个人版的原有数据库保留，顾客版不会自动复制旧数据；可以在目标账户重新导入交易报告。顾客自己在设置页配置 AI 和行情 API 密钥，顾客模式不继承服务器拥有者的这些环境密钥。

## 先在 Windows 本地试用

1. 下载最新项目 ZIP 并完整解压。
2. 双击 `Start-XT-Customers.cmd`，保持启动窗口打开。
3. 在浏览器注册测试账户。需要邀请码时，使用管理员配置的 `XT_REGISTRATION_CODE`。
4. 点击语言按钮，在中文与英文之间切换。主要导航、登录、交易操作与设置已提供中文；部分高级说明和图表标签仍为英文。语言选择保存在当前设备。
5. 要回到原来的个人版，关闭启动窗口，再运行 `Start-XT.cmd`。

本地地址 `127.0.0.1:3000` 只用于这台电脑，不是顾客网址。当前没有自动上线，也没有自动生成公网链接。

## 部署到顾客可以访问的服务器

需要一台支持 Docker Compose 的 Linux 服务器、持久磁盘及一个域名。将域名的 DNS 指向服务器，并开放 TCP 80、443（HTTP/3 可额外开放 UDP 443）。HTTPS 配置采用 [Caddy 官方自动证书与反向代理方式](https://caddyserver.com/docs/quick-starts/https)。

在服务器的项目目录中：

```bash
cp deploy/customers.env.example .env.customers
# 编辑 .env.customers：填入真实域名和长随机邀请码，不要使用示例值。
docker compose --env-file .env.customers -f docker-compose.customers.yml up -d --build
```

完成后访问 `https://你的域名`。Caddy 对外提供 HTTPS，应用容器仅在内部网络提供服务。不要另外暴露应用的 3000 端口。顾客注册页默认使用邀请码；请仅把邀请码给需要注册的顾客。

手机使用 Safari 或 Chrome，平板同样通过浏览器访问；这是响应式网页，未打包成原生 App。顾客无需安装 Node.js、下载源码或保持自己的电脑开机。服务器需要持续运行。

目前属于小规模试用版本：没有邮箱验证、忘记密码自助找回、管理员用户管理或收费系统；请先用测试账户验证你的完整使用流程，再邀请首批顾客。大量用户的容量需要单独验证。

MT5 仍通过 HTML / CSV 交易报告导入，未实现自动同步。中英文切换不会翻译顾客自己的交易笔记。

## 数据备份与升级

所有顾客数据存放在 Compose 的 `customer_data` 持久卷内，包括 `xt-users.sqlite`、顾客目录、数据库和 `.secret` 加密密钥。备份必须涵盖整个卷，并妥善限制访问权限；仅备份交易数据库会丢失登录账户或密钥。

最简单的一致性备份方法：先停止 journal 服务，通过服务器的 Docker 卷备份工具备份整个 `customer_data` 卷，再启动 journal 服务。恢复时同样先停止服务，将整个卷恢复后再启动。Caddy 的证书卷也应备份。部署前先验证一次备份和恢复。

```bash
docker compose --env-file .env.customers -f docker-compose.customers.yml stop journal
# 在服务器上备份完整 customer_data 卷。
docker compose --env-file .env.customers -f docker-compose.customers.yml start journal
```

更新代码后重新执行 `up -d --build`；持久卷中的数据会保留。不要执行 `down -v`，它会删除这些卷。禁止把数据、真实邀请码、密码或 API 密钥上传到 GitHub。
