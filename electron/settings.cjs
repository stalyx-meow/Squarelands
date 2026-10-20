const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
function normalizeAddress(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) throw new Error('请填写服务端 IP 或域名');
  const input = value.trim(), explicit = /^[a-z][a-z\d+.-]*:\/\//i.test(input);
  let url;
  try { url = new URL(explicit ? input : `http://${net.isIP(input) === 6 ? `[${input}]` : input}`); }
  catch { throw new Error('地址无效，例如 192.168.1.10:3210 或 https://game.example.com'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('仅支持不包含账号密码的 HTTP / HTTPS 地址');
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('地址不要包含页面路径、查询参数或锚点');
  const hasExplicitPort = net.isIP(input) !== 6 && /(?:\]|[^:]):\d+$/.test(input);
  if (!explicit && !hasExplicitPort && !url.port) url.port = '3210';
  return url.origin;
}
function validateServerConfig(value) {
  const host = typeof value.host === 'string' ? value.host.trim() : '';
  if (!['0.0.0.0', '127.0.0.1', '::', '::1'].includes(host)) throw new Error('请选择有效的监听地址');
  const port = Number(value.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('端口必须是 1024–65535 的整数');
  return { host, port, autoStart: !!value.autoStart, secureCookie: !!value.secureCookie };
}
function readSettings(file, fallback) {
  try { return { ...fallback, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; }
  catch (error) { if (error.code !== 'ENOENT') console.warn(`配置无效，使用默认值：${error.message}`); return { ...fallback }; }
}
function writeSettings(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);
}
module.exports = { normalizeAddress, validateServerConfig, readSettings, writeSettings };
