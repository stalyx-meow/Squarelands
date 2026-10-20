# 开发、部署与发布

日常游玩和图形控制台操作见 [README](readme.md)，经济参数与公式见 [GAMEPLAY](GAMEPLAY.md)。本文件面向开发者与命令行服主。

## 技术结构

| 模块 | 职责 |
| --- | --- |
| `electron/main.cjs` | 玩家客户端、服务器地址校验、健康检查、最近连接、隔离的远程游戏窗口 |
| `electron/server-main.cjs` | 本地图形服务端控制台、配置、存档位置、备份、退出管理 |
| `electron/server-controller.cjs` | 后台服务进程、IPC 初始密码、状态、日志、安全停止 |
| `electron/ui/` | 两种桌面应用的本地页面；不依赖外部网络资源 |
| `server/index.js` | HTTP、scrypt 登录、Cookie 会话、SQLite、root 管理、健康检查 |
| `server/game.js` | 权威模拟、建设、生产、人口、合约、运输、寻路与领地 |
| `server/features.js` | 自动补给、阈值出售、转让、渗透与消息 |
| `server/settings.js` | 421 项数值的默认值、范围与关联校验 |
| `server/state.js` | 存档版本、迁移与库存校验 |
| `server/routing.js` | 最小堆寻路与玩家通行覆盖 |
| `shared/money.js` | 整数分计价与锁定结算金额 |
| `shared/i18n.js` | 游戏和桌面页面共用中英文目录 |
| `server/world.js` | 带种子的世界生成 |
| `shared/config.js` | 地形、建筑、价格与数值 |
| `build/electron-builder.cjs` | 两种角色的打包白名单、图标、产物格式与命名 |
| `scripts/` | 全文件语法检查、图标生成、跨平台构建、SHA-256 清单 |
| `test/` | 规则与真实 HTTP / 子进程测试 |

发布包没有生产 npm 依赖。Electron 内置 Node.js 和 SQLite，游戏图形由 Canvas 程序绘制。服务端是权威状态源，客户端每 2 秒轮询同步。数据库默认每 2 秒落盘。账号/会话管理与世界保存使用同一个 SQLite 事务；保存失败时同时回滚 SQL 与内存。结算保存失败也恢复内存快照。

## 源码运行

需要 Node.js 24+。

```sh
npm ci
npm run server:app
```

另一个终端：

```sh
npm run desktop
```

首次 Electron 安装失败时，先确认网络及代理，再运行 `npx install-electron --no`。`GAME_SERVER_URL` 可预填客户端地址；已成功保存过的最近地址优先，不会自动连接。

## 无图形界面的服务端

直接运行 Node.js 服务，不依赖 Electron 或图形桌面：

```sh
HOST=0.0.0.0 PORT=3210 ROOT_PASSWORD='请替换为自己的强密码' npm run server
```

PowerShell：

```powershell
$env:HOST="0.0.0.0"
$env:PORT="3210"
$env:ROOT_PASSWORD="请替换为自己的强密码"
npm run server
```

| 环境变量 | 命令行服务端默认 | 含义 |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | 监听地址；外部连接可用 `0.0.0.0` |
| `PORT` | `3210` | HTTP 端口 |
| `DATA_DIR` | 项目 `data/` | SQLite 所在目录，建议绝对路径 |
| `ROOT_PASSWORD` | 首次随机生成 | 仅首次创建 root 生效，随机密码打印在终端 |
| `TRUSTED_PROXIES` | 空 | 逗号分隔的可信代理 IP/CIDR；仅信任这些来源转发的客户端 IP |
| `COOKIE_SECURE` | 未开启 | 设置 `1` 后 Cookie 标为 Secure，供 HTTPS 反代使用 |

图形服务端自己管理 `HOST`、`PORT` 和 Cookie 配置，固定使用随机 root 初始密码；不会继承 shell 中的 `ROOT_PASSWORD`。GUI 通过受限的本机 IPC 显示初始密码，而不是写入日志。

图形应用使用独立的用户数据目录。开发/测试可通过 `SQUARELANDS_USER_DATA` 指定用户数据位置，或通过 `DATA_DIR` 指定图形服务端的世界目录。发布包无需设置环境变量。

使用 systemd、容器或其他进程管理器部署时，应给服务独立的可写数据目录，并正常发送 SIGTERM 停止。不要同时对同一份世界数据库运行多个实例。

## HTTPS 反向代理示例

服务端监听 `127.0.0.1:3210`，HTTPS 由 Nginx 终止。已有 TLS 配置的 `server` 块内：

```nginx
location / {
    proxy_pass http://127.0.0.1:3210;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

仅代理在本机时可设置 `TRUSTED_PROXIES=127.0.0.1,::1`。有多级代理时列出实际受控的代理地址/CIDR，不要把任意公网地址设为可信。从右向左剥离可信代理链，遇到非可信地址停止。无此配置时不采信 X-Forwarded-For。

客户端填 `https://game.example.com`。打开 GUI 的 Secure Cookie，或命令行设置 `COOKIE_SECURE=1`。必须保留 Host，才能通过同源写请求检查。当前不支持部署在 URL 子路径下；为游戏分配独立域名或根路径。代理、防火墙、证书与公网路由需由服主配置。

不要在客户端输入框中附加路径、查询参数、账号密码，也不要为连接而关闭证书校验。客户端和浏览器在同一地址使用一致的 Cookie 登录体系。

## 构建便携发行包

```sh
npm run pack              # 当前平台，两种应用；macOS 默认 arm64 与 x64
npm run pack:client       # 当前平台，只有客户端
npm run pack:server       # 当前平台，只有服务端
npm run pack:all           # macOS 主机构建默认全部 8 个发行包
```

也可以明确指定角色、系统和架构：

```sh
node scripts/package.mjs client win x64
node scripts/package.mjs server linux x64
node scripts/package.mjs all mac arm64
```

参数为 `[client|server|all] [mac|win|linux|all] [x64|arm64]`。没有指定架构时，macOS 为 arm64/x64，Windows/Linux 为 x64。Windows 与 Linux arm64 可以显式构建，但不属于本次默认发行矩阵。

- macOS 必须在 macOS 构建。Windows ZIP 与 Linux tar.gz 不需要安装器工具链，可在本次 macOS 环境交叉生成。
- 本次产物是便携应用，不包含 NSIS、DMG 或 DEB 安装向导。
- 构建不自动签名、不公证、不自动发布到外部服务。
- 客户端包仅带连接页及桌面逻辑，游戏 UI 由目标服务端提供。服务端包带控制台、后端、共享规则和游戏网页。
- 文件白名单排除开发依赖、测试、构建缓存、世界数据库、账号与本机配置。
- 每个包内附 `QUICKSTART.txt`（macOS 位于 `.app/Contents` 内）。
- `dist/client`、`dist/server` 分开输出。`npm run checksums` 可重新生成各目录的 SHA-256 清单。
- `build/icons` 图标由 `npm run icons` 以程序生成，无远程贴图依赖。

### 下载代理

构建脚本在 macOS 上只读读取已启用的系统 HTTPS 代理，传给 Electron 下载进程；不修改系统设置。显式配置优先：

```sh
SQUARELANDS_BUILD_PROXY=http://127.0.0.1:7892 npm run pack:all
```

也支持已设置的 `HTTP_PROXY`、`HTTPS_PROXY`。`NO_PROXY` 应包含 localhost 与本机回环地址。

如果使用 Electron 下载镜像，仍会用固定 Electron npm 包中附带的官方 SHA-256 校验值验证文件；构建没有关闭 TLS 或校验和检查。

## GitHub Actions

`.github/workflows/release.yml` 配置 8 个任务：两种角色 × Windows x64、Linux x64、macOS arm64/x64。每个任务运行语法检查、测试及对应构建，将压缩包与校验和上传为 Actions Artifacts，保留 30 天。

触发条件为 `v*` 标签或 `workflow_dispatch`。此工作流只构建、不创建 GitHub Release。正式发布可将本地已验证产物上传，或从工作流下载后再发布。

```sh
gh release create v1.1.0 --title 'Squarelands v1.1.0' --notes-file docs/RELEASE_NOTES_v1.1.0.md
gh release upload v1.1.0 dist/client/*.zip dist/client/*.tar.gz dist/server/*.zip dist/server/*.tar.gz
```

上传时客户端与服务端的 `SHA256SUMS.txt` 同名，需分别改名为 `SHA256SUMS-client.txt` 与 `SHA256SUMS-server.txt` 再作为附件上传。世界数据不提交 Git，也不包含在发行包中。

## 验证

```sh
npm run check
npm test
```

测试创建临时存档与随机本地监听端口，结束后清理。范围包括：确定性地图、地形与矿藏约束、领地先占、建设/升级、人口与住房、生产投入、库存、现货托管与交付、合约退款赔付、关税/禁运、暂停计时、登录与角色权限、存档恢复、失败回滚、地址规范化，以及 GUI 后台进程启停与端口冲突。

发行前还应启动**真正打包后的应用**验证，而不仅是 `electron .`。本次已在 macOS Apple 芯片上执行：

1. Client 包进入连接页，填写地址并打开远程登录页。
2. 关闭游戏返回连接页，并保存最近地址。
3. Server 包从 asar 内启动 HTTP 与 SQLite，返回 `/api/health`。
4. 控制台安全停止、重新启动，并恢复已有世界。

其他系统的交互行为仍需在目标系统上验证；交叉打包成功不等于已经完成目标平台实机验证。

## v1.2 开发说明

- `/api/state?world=种子:修订号` 在地图未变化时省略 tiles，客户端复用已有地图，扩图时重新获取。坐标通过 minX/minY 支持负数。
- root 参数通过 `/api/admin` 的 `settings` 操作原子保存，只接受登记的数值字段，禁止新增键及原型链键。
- 存档 schemaVersion=2；旧合约保留旧每期金额、托管和赔付，不按新规则重算。迁移前自动备份原始 JSON。
- 中英文目录为 `shared/i18n.js`，用户生成内容原文保留；中英文内置手册分别在 `client/guide.js`、`client/guide-en.js`，读取实时参数。
- 回归测试覆盖审查报告 B01–B10。Windows 路径使用 path.win32 做逻辑验证，不等于在 Windows 实机运行。
- 性能仍受单进程与 SQLite 同步存档限制，大地图和大量玩家需按实际负载测试。

## 轻量代码包

`npm run pack:update` 生成 `dist/update/*.squarelands-update.gz` 与 SHA256SUMS。包包含 server/client/shared，使用 gzip 压缩的 JSON 清单、逐文件 SHA-256，最多 32 MiB 解压数据；不包含存档、依赖和 Electron。服务端安装到 userData/code-updates，原子切换 active.json；停止服务端后安装/回退。修改原生控制台或运行时仍须构建完整服务端。标签工作流仅发布小包；完整桌面工作流手动运行。
