import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import crypto from 'node:crypto';
const godot=process.env.GODOT||(fs.existsSync('/Applications/Godot.app/Contents/MacOS/Godot')?'/Applications/Godot.app/Contents/MacOS/Godot':'godot');const version=JSON.parse(fs.readFileSync('package.json')).version;
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8'});const output=(r.stdout||'')+(r.stderr||'');process.stdout.write(output);if(r.error||r.status!==0||/SCRIPT ERROR|ERROR:/.test(output))throw r.error||new Error('Build failed: '+cmd);}
const targets={windows:['Windows','Squarelands.exe'],linux:['Linux','Squarelands.x86_64'],macos:['macOS','Squarelands.zip']};
const selected=process.argv[2]||'all';fs.mkdirSync('dist/native',{recursive:true});
for(const [platform,[preset,name]]of Object.entries(targets)){
 if(selected!=='all'&&selected!==platform)continue;const dir=path.resolve('dist/native',platform);fs.mkdirSync(dir,{recursive:true});run(godot,['--headless','--path','godot','--export-release',preset,path.join(dir,name)]);
 const archive=path.resolve('dist/native',`Squarelands-Client-${version}-${platform}${platform==='macos'?'-universal':''}.zip`);
 if(platform==='macos')fs.copyFileSync(path.join(dir,name),archive);
 else if(process.platform==='win32')run('powershell',['-NoProfile','-Command',`Compress-Archive -Path '${dir}/*' -DestinationPath '${archive}' -Force`]);
 else {if(platform==='linux')fs.chmodSync(path.join(dir,name),0o755);run('zip',['-j','-9',archive,...fs.readdirSync(dir).filter(n=>!n.endsWith('.console.exe')).map(n=>path.join(dir,n))]);}
}
// A shared resource-only update avoids re-downloading native runtimes.
run(godot,['--headless','--path','godot','--export-pack','Linux',path.resolve(`dist/native/Squarelands-Client-${version}.pck`)]);
const checks=fs.readdirSync('dist/native').filter(n=>n.endsWith('.zip')||n.endsWith('.pck')).map(n=>crypto.createHash('sha256').update(fs.readFileSync('dist/native/'+n)).digest('hex')+'  '+n).join('\n');fs.writeFileSync('dist/native/SHA256SUMS.txt',checks+'\n');
