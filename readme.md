# 方域 · Squarelands

**像素风多人城市经营与贸易游戏。Godot 原生客户端 + Node.js 权威服务端。**

建城、解锁领地、开采并精炼矿产，建立农业和工业体系，通过铁路、航空与其他城池交换资源。所有玩家共享一个持续运行的世界；服务器维护账号、模拟和存档。

[English](README.en.md) · [玩法手册](GAMEPLAY.md) · [原生客户端开发](godot/README.md) · [TCP 协议与部署](docs/TCP_PROTOCOL.md) · [下载发行版](https://github.com/stalyx-meow/Squarelands/releases)

![Godot 像素风客户端](docs/native-preview.png)

## 2.0 的变化

- **Godot 4.7 原生 2D 客户端**：像素地形和建筑、地图拖动与缩放、连续建造、快捷键、领土边界及运输路线动画，不使用 WebView。
- **直接 TCP 长连接**：客户端填写 IP / 域名，默认端口 **3211**。登录后服务端每 2 秒推送状态，支持可选 TLS。地图未变化时使用缓存。
- 原生界面包含库存、市场、物流、联盟管理、广播/私信、城池自动化和 root 管理。中英双语，打包中文字体。
- 既有账号、存档和游戏规则继续使用。旧网页入口保留在 **3210**，用于兼容；Godot 客户端必须连接已更新的 TCP 服务端。

## 下载安装

在 [Releases](https://github.com/stalyx-meow/Squarelands/releases) 下载对应平台的 **Godot Client**：

| 平台 | 客户端 |
| --- | --- |
| Windows x86_64 | windows 压缩包，解压运行 `Squarelands.exe` |
| Linux x86_64 | linux 压缩包，解压运行 `Squarelands.x86_64` |
| macOS Intel / Apple Silicon | macos-universal 压缩包，解压打开 `Squarelands.app` |

Windows/Linux 的程序与 `Squarelands.pck` 必须放在同一目录；macOS 资源包位于应用内部。应用未做商业代码签名，系统首次打开可能需要在安全设置中允许。

### 服务端

现有 **1.2.1 服务端基础应用**可以继续使用：停止世界、备份存档，在服务端应用中安装本次 `.squarelands-update.gz`，再启动。默认新增 TCP 监听地址为 **网页端口 + 1**，即 `3211`。老版控制台仍可能只展示网页地址，Godot 请手动填写 IP / 域名和 TCP 端口。新源码构建的控制台支持单独配置 TCP 端口。

玩家连接示例：

```text
192.168.1.10:3211
game.example.com:3211
tls://game.example.com:3211
```

两端设备不在同一局域网时，需要开放/转发服务端 TCP 端口。普通 HTTP 反向代理不支持这种连接，请使用四层 TCP 转发或直接开放端口。公网部署可配置 TLS 证书，详见 [协议与部署说明](docs/TCP_PROTOCOL.md)。

### 更新流量

服务端只需 `.squarelands-update.gz`，不用每次重下完整应用。Godot 客户端首次下载完整程序，以后同引擎版本的脚本/资源更新可只替换 `.pck`；服务端和客户端更新包不能互用。[详细更新步骤](godot/README.md#后续客户端小更新)。所有发布文件提供 SHA-256。

## 操作

| 操作 | 输入 |
| --- | --- |
| 平移地图 | 鼠标拖动 / WASD |
| 缩放地图 | 鼠标滚轮 |
| 选中地块 | 单击 |
| 打开建造目录 | B |
| 建造 / 铺轨 | 选工具后在地图连续单击 |
| 打开库存 | Tab |
| 关闭窗口 / 取消工具 | Esc |
| 全屏 | F11 |

左侧选择城池，右侧查看地块、建筑和城市信息，底部打开建造、物流、贸易和外交功能。设施按格放置，服务器校验归属、地形、材料和工人。

## 主要规则

- 城市默认最高 5 级。升级只增加可解锁领地数量，仍需自行解锁相邻地块；临近地图边缘自动扩图。同一玩家两城边界可转让地块，空地可以放弃，须维持领地连通。
- 每城默认各预留 4 名建筑工人和运输工人。缺工、缺电或原料不足影响生产；建筑升级提升对应产量与加成。
- 矿石需要精炼成锭，原油需要炼成燃油。粮田/蔬菜田可转换，居民需要主食、衣物、蔬菜、肉制品、水和电力。
- 每种物资分别计算仓储容量；资金不限容量。默认库存低于容量 5% 自动调入，超过 95% 自动出售，可逐项调整或关闭；支持固定每周期城际调拨。
- 铁路每人运 250 单位，航空 500，普通 50。默认优先可用铁路/航空，约 50 格为同距离交叉点：短途铁路、长途航空占优。铁路允许自有水域铺设，为独立图层。车站/机场直连本城统一库存；两端需运营设施，铁路须连续、航空需燃油。普通运输可显示回退原因。
- 玩家交易分现货与未来产能合约，允许出售/收购城池。联盟支持邀请、申请审批、移出成员、主动退出、管理员、内部优惠及对外关税/禁运。
- 广播全服可见，私信仅双方可见，联盟频道仅当前成员可见；货运记录仅参与者可见，包括 root。玩家可自选领土颜色。
- root 可以管理账号密码、封禁、发放资源、编辑地块/建筑及单体属性，并调整 439 个世界参数。重置世界保留账号，但清空游戏世界。

完整规则及公式见 [GAMEPLAY.md](GAMEPLAY.md)。

## 从源码运行

需要 Node.js **24+**；客户端需要 Godot **4.7 stable**，或下载已导出的便携客户端。

```sh
npm ci
HOST=0.0.0.0 PORT=3210 TCP_PORT=3211 npm start
# 另开终端运行原生客户端
npm run desktop
```

Windows PowerShell 可分别设置 `$env:HOST`、`$env:PORT`、`$env:TCP_PORT` 后执行 `npm start`。Godot 不在 PATH 时设置 `GODOT` 为其程序路径；macOS 自动识别 `/Applications/Godot.app`。首次启动会创建 root，初始密码只在本机控制台显示，请保存并及时修改。

- `npm run check`：JavaScript 语法检查。
- `npm test`：游戏规则、HTTP 兼容入口、TCP 通信与持久化测试。
- `npm run check:godot`：Godot 导入与脚本编译检查。
- `npm run test:godot`：真实 Godot + 隔离 TCP 世界联机测试。
- `npm run pack:update`：跨平台服务端通用小更新。
- `npm run pack:godot`：Windows / Linux / macOS 客户端及资源包，需要匹配的官方导出模板。
- `npm run server:app`：运行服务端桌面控制台。
- `npm run desktop:web`：旧 Electron 网页客户端兼容入口。

## 存档与兼容

世界和账号保存在服务端数据目录的 `game.sqlite` 中。备份前安全停止服务端，完整复制世界目录；不要复制运行中的单个 SQLite 文件而漏掉 WAL。Godot 客户端不持有世界存档，换客户端无需迁移账号和城市。

2.0 延续存档 schema 2，不重置世界。1.3 升级时的 `backup-before-v130-*.sqlite` 请保留。降级需使用对应代码和更新前数据库；不要把较新存档直接交给旧规则运行。服务端停机时世界冻结，恢复后不补发离线生产收益。

## 许可证

源码采用 [MIT](LICENSE)。中文字体 Noto Sans SC 使用 [SIL Open Font License](godot/assets/OFL.txt)。Godot 引擎采用 MIT；导出客户端应保留其版权与许可证说明。
