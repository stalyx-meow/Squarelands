# Squarelands TCP 协议 / TCP protocol v1

Godot 4.7 原生客户端使用直接 TCP 长连接，默认 `tcp://服务器:3211`。服务器仍保留 3210 网页入口，供旧客户端兼容；新客户端不加载网页，也不发送 HTTP 请求。

## 启动 / Configuration

```sh
HOST=0.0.0.0 PORT=3210 TCP_PORT=3211 npm start
```

开放防火墙与路由器的 **TCP 3211**；域名的 HTTP 反向代理不能转发原始 TCP，需使用四层 TCP 转发。老版 1.2.1 服务端应用安装 2.0.0 通用更新包后，默认监听其网页端口 + 1；新服务端应用控制台支持单独设置 TCP 端口。`PORT=0` 的隔离测试自动使用临时 TCP 端口，生产环境建议显式设置。

公网可使用 TLS：

```sh
TCP_TLS_CERT=/absolute/fullchain.pem TCP_TLS_KEY=/absolute/privkey.pem TCP_PORT=3211 npm start
```

客户端填写 `tls://game.example.com:3211`。客户端验证证书及域名，不会忽略证书错误。普通 `tcp://` 不加密，适用于可信局域网；公网部署使用 TLS。TCP TLS 与旧网页 HTTPS 反代配置独立。

## 分帧 / Framing

每条消息为 **4 字节无符号大端长度 + 对应字节数的 UTF-8 JSON**。长度不包括消息头。服务端请求上限 32768 字节，客户端响应上限 64 MiB。必须处理分包、粘包及部分写入，不能把一次 socket read 当作完整消息。

连接后服务端发送：

```json
{"event":"hello","data":{"service":"squarelands","transport":"tcp","protocol":1,"version":"2.0.0","tls":false}}
```

客户端消息示例（展示 JSON，不含二进制长度头）：

```json
{"id":1,"op":"login","data":{"username":"player","password":"your-password"}}
{"id":2,"op":"subscribe","data":{}}
{"id":3,"op":"action","data":{"action":"build","cityId":"city-id","type":"station","x":8,"y":5}}
{"id":4,"op":"state","world":"seed:revision","data":{}}
```

响应与请求 id 对应：

```json
{"id":1,"ok":true,"data":{"user":{"id":"user-id","username":"player","role":"player"}}}
{"id":3,"ok":false,"status":400,"error":"资源不足","shortage":{"cityId":"city-id","cost":{"money":400}}}
```

`id` 是正的安全整数，`data` 必须是对象。客户端不能指定身份或有效会话。认证令牌只绑定当前服务端连接，不发给 Godot 客户端，不将密码保存到磁盘。断线后需重新登录。

| op | 用途 |
| --- | --- |
| hello | 健康检查/心跳，无需登录 |
| login / register | 登录 / 注册，凭据校验和速率限制与旧接口一致 |
| subscribe | 登录后订阅，每 2 秒推送状态；响应先返回完整视图 |
| unsubscribe | 停止推送，不注销 |
| state | 立即读取当前用户视图，可带地图缓存标识 world |
| action | 执行现有游戏 action，参数/权限/事务与原服务端一致 |
| adminState | 读取 root 管理参数、用户和统计信息 |
| admin | root 管理操作 |
| logout | 注销当前会话并停止推送 |

推送格式为 `{"event":"state","data":{...}}`。地图在首次订阅或 seed/revision 改变时带 tiles，否则客户端保留上次 tiles；其他字段为完整用户视图。`sessionExpired` 事件表示会话已失效，客户端应回到登录界面。封禁、密码重置及账号变更会使 TCP 会话同步失效。

运输、私信、联盟频道和联盟邀请/申请沿用服务端用户视图过滤，root 不会因此看到无关货运。TCP 和网页入口共享 SQLite、世界模拟、身份校验与事务处理，无第二套世界，无跨协议身份绕过。服务端限制连接数、每 IP 连接、消息队列和慢接收端积压；异常长度或 JSON 会关闭连接。每 25 秒心跳，90 秒无数据断开。

## Verification

`npm test` includes a real TCP integration test covering fragmented requests, authentication, access control, actions, pushed state, world cache, logout and invalid frames. `npm run test:godot` starts a disposable server and runs the actual Godot native client against it, including bilingual screens, founding, alliance membership UI and root editing. Existing saves remain schema 2; no account/save conversion is required.

## 2.0.1 连接诊断

域名加端口是合法格式。若客户端收到 HTTP 响应，会明确提示转发目标是网页端口；请将 frp 的内网目标设为游戏 TCP 监听端口（默认 3211），外网端口可保持自定义值。DNS 解析或 TCP 建连失败与地址格式错误分别提示。2.0.1 的本地客户端更新入口在登录前可用，不依赖服务器连接。
