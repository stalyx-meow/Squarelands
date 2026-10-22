# Squarelands Native · Godot 4.7

像素风原生 2D 策略客户端，使用 TCP，不包含 WebView。服务器与存档仍由现有 Node.js 服务端维护。

## 开发

```sh
npm run server
npm run desktop
```

需要 Godot **4.7 stable**。macOS 自动使用 `/Applications/Godot.app/Contents/MacOS/Godot`，其他系统安装 `godot` 到 PATH 或设置 `GODOT` 为可执行文件路径。也可直接用 Godot 编辑器导入本目录 `project.godot` 并运行。默认连接地址 `127.0.0.1:3211`，也接受域名、IPv6 和 `tls://`。

- 地图拖动/滚轮缩放，WASD 平移，B 建造，Tab 库存，Esc 关闭/取消，F11 全屏。
- 选择建造工具后可在地图连续放置。铁路使用独立图层，允许自有水域。
- 城池侧栏、地块档案、库存、贸易、物流、联盟管理、广播/私信、自动化、root 参数/账号/地块编辑均为原生控件。
- English / 简体中文可切换。只保存地址、用户名、语言与更新提示状态，不保存密码。
- `scripts/pixel_art.gd` 用整数像素绘制地形与建筑，无图片生成依赖；字体采用 Noto Sans SC（SIL OFL，见 assets/OFL.txt）。

## 检查与导出

```sh
npm run check:godot
npm run test:godot
npm run pack:godot
# 或只导出一个平台
node scripts/package-godot.mjs windows
node scripts/package-godot.mjs linux
node scripts/package-godot.mjs macos
```

先在 Godot 编辑器安装匹配 4.7.stable 的官方导出模板。导出目标为 Windows x86_64、Linux x86_64、macOS universal（Intel + Apple Silicon）。产物在 `dist/native/`，包括完整便携客户端、跨平台资源更新包 `.pck` 和 SHA-256。测试仅使用临时账号和临时世界，不触碰实际存档。

## 后续客户端小更新

完整 Godot 客户端需首次下载一次。以后同 Godot 版本的脚本/资源更新，只需下载发行版 `.pck`，在客户端“手册”中选择“安装客户端资源更新包”，退出并重开生效。更新保存在用户数据目录，不修改应用包，适用于 Windows/Linux/macOS；“回退到内置客户端资源”可删除更新，重启后恢复。不要手动修改 macOS 应用内资源，以免破坏临时签名。服务器 `.squarelands-update.gz` 与客户端 `.pck` 不能互用；引擎升级或新增原生扩展时需要完整客户端。

详细协议见 [TCP_PROTOCOL.md](../docs/TCP_PROTOCOL.md)。
