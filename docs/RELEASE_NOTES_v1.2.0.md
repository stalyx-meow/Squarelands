# Squarelands v1.2.0

## 新玩法 / Gameplay

自动跨城补给（含资金、工人、运费），完整库存与精炼生产链，细分民生物资，农田切换，手动解锁地块与自动扩图，逐玩家通行政策，库存自动出售，城池交易，城墙与渗透，广播和私信。

Automatic intercity supply, complete inventories, ore/fuel refining, expanded essentials, field conversion, manual claims and expanding maps, per-player transit policies, automatic surplus sales, city trading, walls and infiltration, broadcasts and private messages.

## 管理与语言 / Administration and languages

root 分组参数编辑、范围与关联校验、持久化和恢复默认。游戏、桌面启动窗口、中英文内置手册支持语言切换；手册使用当前服务器参数。

Root can edit grouped numeric settings with validation, persistence and default reset. Chinese/English UI and an in-game handbook use current server settings.

## 审查修复 / Review fixes

修复 Windows 静态资源路径、原型链资源键、浮点价格误差、UTF-8 分块解码、管理 SQL 与存档事务、登录轮询竞态、显式 80 端口、空城建城按钮、合约历史无界增长与代理限流问题。

Fixes Windows static paths, inherited resource keys, floating-point pricing, UTF-8 chunk decoding, atomic admin persistence, login/poll races, explicit port 80, the empty-city CTA, unbounded contract history and proxy rate limits.

## 升级 / Upgrade

先停服并完整备份。旧存档迁移为 schema v2，保留地形、库存和合约账本；迁移前备份原始 JSON。新参数不重新定价旧合约。运行时仍内置于便携包，无需另装 Node.js。

Stop and back up first. Legacy saves migrate to schema v2 with original JSON backup. Existing terrain, stock and financial ledgers are retained. Existing contracts are not repriced. Portable apps include their runtimes.
