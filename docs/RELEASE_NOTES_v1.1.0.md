# Squarelands v1.1.0 · 开箱即用的双端应用

## 本次更新

- 新增独立图形服务端：自动启动、监听范围与端口设置、连接地址复制、初始 root 密码展示、日志、安全停服、打开存档目录及停服备份。
- 客户端新增 IP / 域名连接页，支持自定义端口、HTTPS、IPv6、健康检查及最近连接记录。
- 客户端与服务端分别打包，内置 Electron / Node.js / SQLite 运行时，无需安装开发环境。
- 完整更新 README、部署指南、原始需求存档与发行校验清单。

## 下载选择

| 平台 | 玩家客户端 | 服主服务端 |
| --- | --- | --- |
| Windows x64 | `Squarelands-Client-1.1.0-win-x64.zip` | `Squarelands-Server-1.1.0-win-x64.zip` |
| Linux x64 | `Squarelands-Client-1.1.0-linux-x64.tar.gz` | `Squarelands-Server-1.1.0-linux-x64.tar.gz` |
| macOS Apple 芯片 | `Squarelands-Client-1.1.0-mac-arm64.zip` | `Squarelands-Server-1.1.0-mac-arm64.zip` |
| macOS Intel | `Squarelands-Client-1.1.0-mac-x64.zip` | `Squarelands-Server-1.1.0-mac-x64.zip` |

解压后运行。Windows/Linux 须保留整个目录；macOS 将 `.app` 拖入“应用程序”。这些是便携包，不是安装向导。

服主先打开 Server，保存控制台显示的初始 root 密码，再将连接地址发给玩家。玩家打开 Client 输入地址，本机游玩可填 `127.0.0.1:3210`。

`SHA256SUMS-client.txt` 与 `SHA256SUMS-server.txt` 用于检查下载完整性。应用未做发行者代码签名或 Apple 公证。

## 验证范围

- 全部 JavaScript 语法检查、21 项规则/HTTP/连接地址/进程管理测试通过。
- 已在 macOS Apple 芯片上实测真正打包后的客户端连接、返回连接页，以及服务端 HTTP、SQLite、安全停止和重启。
- Windows、Linux、Intel Mac 包已交叉构建，未在对应实体系统做交互实测。

## 已知边界

Linux 图形服务端需要桌面环境；无桌面部署可从源码用 Node.js 24+ 运行命令行服务端。公网连接需自行配置防火墙、可达地址或 HTTPS 反代。客户端不再自动启动本地服务端。

1.0 存档不会自动迁入新的图形服务端目录。请先停服、备份，再按 README 说明复制世界文件。
