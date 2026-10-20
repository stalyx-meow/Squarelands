import { readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
for (const role of ['client', 'server']) {
  const dir = path.resolve('dist', role);
  let files; try { files = (await readdir(dir)).filter(name => /\.(zip|tar\.gz|exe|dmg|AppImage|deb)$/.test(name)).sort(); } catch { continue; }
  const lines = [];
  for (const file of files) {
    const hash = createHash('sha256'); for await (const chunk of createReadStream(path.join(dir, file))) hash.update(chunk);
    lines.push(`${hash.digest('hex')}  ${file}`);
  }
  if (lines.length) await writeFile(path.join(dir, 'SHA256SUMS.txt'), lines.join('\n') + '\n');
}
