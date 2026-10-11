# XT Trade Journal AI · Windows 启动

1. 下载项目 ZIP，并点击「全部解压」。已有 GitHub Desktop 副本也可以先 Pull 最新代码。
2. 打开解压后的项目文件夹，双击 **Start-XT.cmd**。
3. 等待首次依赖安装和页面编译，浏览器准备好后会自动打开。

无需安装 GitHub Desktop，也无需手动安装 pnpm。启动入口会检查 Node.js 22+；缺少时尝试通过 Windows 自带的 winget 安装 LTS。Windows 可能会显示安装授权窗口，需要你在电脑上操作。如果没有 winget，请先从 https://nodejs.org/en/download 安装 Node.js LTS，再双击启动。

第一次运行需要联网下载依赖，后续运行会复用已安装的依赖。网页地址是 **http://127.0.0.1:3000**。使用期间保留命令窗口；按 Ctrl+C 停止。这个启动入口只监听本机，手机暂时不能通过这个地址访问，也没有发布到互联网。

数据保存在项目里的 **apps/web/data/**。以后使用同一个文件夹启动；重新下载的另一个文件夹不会自动拥有原来的交易数据。完整备份时先停止应用，再复制整个 data 文件夹。

遇到错误时保留启动窗口，查看最后几行提示：

- **Port 3000 is busy**：关闭正在运行的另一份网站，再启动。
- **Node.js installation did not complete**：手动安装官方 Node.js LTS，再启动。
- **依赖下载失败**：检查网络，确认可访问 npm 和 GitHub，再双击重试。
- **SQLite component could not load**：原生数据库组件未正确安装，保留安装错误信息以便排查。

启动后可以使用手动交易记录、日历和统计。AI 复盘需在 **Settings → AI** 配置自己的服务商 API Key；启动入口不会生成密钥或启用付费服务。

XT 基于 LuxAlgo 的 MIT 开源项目进行独立品牌修改，保留原作者版权及许可证。当前改动是品牌和启动流程，尚未新增 Risk Guardian 或纪律评分功能。
