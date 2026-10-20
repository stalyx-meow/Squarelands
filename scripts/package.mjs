import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
// Electron downloads do not automatically inherit macOS's system proxy.
// Honor an explicit build proxy, or use the configured macOS HTTPS proxy without changing OS settings.
let proxy = process.env.SQUARELANDS_BUILD_PROXY;
if (!proxy && process.platform === 'darwin' && !process.env.HTTPS_PROXY && !process.env.https_proxy) {
  const output = spawnSync('scutil', ['--proxy'], { encoding: 'utf8' }).stdout || '';
  const host = output.match(/HTTPSProxy\s*:\s*(\S+)/)?.[1], port = output.match(/HTTPSPort\s*:\s*(\d+)/)?.[1];
  if (/HTTPSEnable\s*:\s*1/.test(output) && host && port) proxy = `http://${host}:${port}`;
}
if (proxy) {
  const parsed = new URL(proxy); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('构建代理须为 HTTP / HTTPS 代理');
  process.env.HTTP_PROXY = proxy; process.env.HTTPS_PROXY = proxy;
  process.env.NO_PROXY ||= 'localhost,127.0.0.1,::1';
  console.log(`使用下载代理 ${parsed.hostname}:${parsed.port || (parsed.protocol === 'https:' ? 443 : 80)}`);
}
if (process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY) process.env.ELECTRON_GET_USE_PROXY = '1';
const role = process.argv[2] || 'all', target = process.argv[3] || process.platform;
const requestedArch = process.argv[4];
const platforms = { mac: 'mac', darwin: 'mac', win: 'win', win32: 'win', windows: 'win', linux: 'linux' };
if (!['client', 'server', 'all'].includes(role) || target !== 'all' && !platforms[target]) throw new Error('用法：node scripts/package.mjs [client|server|all] [mac|win|linux|all] [x64|arm64]');
if (requestedArch && !['x64', 'arm64'].includes(requestedArch)) throw new Error('架构必须为 x64 或 arm64');
await import('./icons.mjs');
const builder = path.join(path.dirname(require.resolve('electron-builder/package.json')), 'out/cli/cli.js');
async function run(args, env) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [builder, ...args], { stdio: 'inherit', env });
    child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`打包失败：退出码 ${code}`)));
  });
}
for (const platform of target === 'all' ? ['mac', 'win', 'linux'] : [platforms[target]]) {
  if (platform === 'mac' && process.platform !== 'darwin') throw new Error('macOS 应用需在 macOS 主机上构建；请使用仓库的 Release 工作流。');
  const architectures = requestedArch ? [requestedArch] : platform === 'mac' ? ['arm64', 'x64'] : ['x64'];
  for (const appRole of role === 'all' ? ['client', 'server'] : [role]) {
    for (const arch of architectures) await run(['--config', 'build/electron-builder.cjs', `--${platform}`, `--${arch}`, '--publish', 'never'], { ...process.env, SQUARELANDS_BUILD_ROLE: appRole, CSC_IDENTITY_AUTO_DISCOVERY: 'false' });
  }
}
await import('./checksums.mjs');
