const role = process.env.SQUARELANDS_BUILD_ROLE || 'client';
if (!['client', 'server'].includes(role)) throw new Error('构建角色必须为 client 或 server');
const server = role === 'server';
module.exports = {
  appId: `games.squarelands.${role}`,
  productName: server ? 'Squarelands Server' : 'Squarelands Client',
  copyright: 'Squarelands contributors',
  directories: { output: `dist/${role}`, buildResources: 'build/icons' },
  artifactName: `Squarelands-${server ? 'Server' : 'Client'}-\${version}-\${os}-\${arch}.\${ext}`,
  extraMetadata: { main: server ? 'electron/server-main.cjs' : 'electron/main.cjs', squarelandsRole: role },
  files: [
    'package.json', 'LICENSE',
    'electron/settings.cjs', 'electron/ui/desktop.css',
    ...(server ? ['electron/server-main.cjs', 'electron/server-controller.cjs', 'electron/server-preload.cjs', 'electron/ui/server.html', 'electron/ui/server.js', 'server/**', 'shared/**', 'client/**'] : ['electron/main.cjs', 'electron/client-preload.cjs', 'electron/ui/client.html', 'electron/ui/client.js']),
    '!**/*.map', '!**/node_modules/**'
  ],
  extraFiles: [{ from: 'docs/QUICKSTART.txt', to: 'QUICKSTART.txt' }, { from: 'LICENSE', to: 'SQUARELANDS-LICENSE.txt' }],
  asar: true,
  npmRebuild: false,
  // Use the hashes shipped in the pinned official electron npm package, including when a download mirror is used.
  electronDownload: { checksums: require('electron/checksums.json'), mirrorOptions: {} },
  nodeGypRebuild: false,
  compression: 'normal',
  publish: null,
  mac: { target: ['zip'], category: server ? 'public.app-category.utilities' : 'public.app-category.games', icon: 'build/icons/icon.icns', identity: null, hardenedRuntime: false, minimumSystemVersion: '12.0' },
  win: { target: ['zip'], icon: 'build/icons/icon.ico', signAndEditExecutable: false },
  linux: { target: ['tar.gz'], icon: 'build/icons/icon.png', category: server ? 'Utility' : 'Game', executableName: `squarelands-${role}` }
};
