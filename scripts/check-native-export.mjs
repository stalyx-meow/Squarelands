import {spawnSync} from 'node:child_process';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
const version=JSON.parse(fs.readFileSync("package.json","utf8")).version;
let temporary;let executable;
try{
 if(process.platform==='darwin'){temporary=fs.mkdtempSync(path.join(os.tmpdir(),'squarelands-export-check-'));const unzip=spawnSync('unzip',['-q',path.resolve(`dist/native/Squarelands-Client-${version}-macos-universal.zip`),'-d',temporary]);if(unzip.status)throw new Error('Cannot unpack native app');executable=path.join(temporary,'Squarelands.app/Contents/MacOS/Squarelands');}
 else executable=path.resolve(process.platform==='win32'?'dist/native/windows/Squarelands.exe':'dist/native/linux/Squarelands.x86_64');
 const r=spawnSync(executable,['--headless','--quit-after','12'],{encoding:'utf8',timeout:30000});const output=(r.stdout||'')+(r.stderr||'');process.stdout.write(output);if(r.error||r.status!==0||/SCRIPT ERROR|ERROR:/.test(output))throw r.error||new Error('Exported client startup failed');console.log('Exported native client startup: passed');
}finally{if(temporary)fs.rmSync(temporary,{recursive:true,force:true});}
