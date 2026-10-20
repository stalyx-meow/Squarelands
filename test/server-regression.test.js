import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
test('admin persistence failure rolls back SQL, sessions, settings and world; shared proxy accounts stay usable',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'squarelands-regression-'));let child,base;
 async function stop(){if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited;}}
 async function start(){child=spawn(process.execPath,['server/index.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',HOST:'127.0.0.1',DATA_DIR:directory,ROOT_PASSWORD:'regression-password',TRUSTED_PROXIES:'127.0.0.1'},stdio:['ignore','pipe','pipe']});let output='';base=await new Promise((resolve,reject)=>{child.stdout.on('data',data=>{output+=data;const m=output.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(m)resolve(`http://127.0.0.1:${m[1]}`);});child.once('exit',code=>reject(new Error(`exit ${code}: ${output}`)));});}
 t.after(async()=>{await stop();await rm(directory,{recursive:true,force:true});});await start();
 async function req(path,data,cookie,headers={}){const response=await fetch(base+path,{method:data?'POST':'GET',headers:{...(cookie?{cookie}:{}),'Content-Type':'application/json',...headers},body:data?JSON.stringify(data):undefined});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],retry:response.headers.get('retry-after')};}
 for(const file of ['/','/client/app.js','/client/features.js','/shared/config.js','/shared/money.js'])assert.equal((await fetch(base+file)).status,200);
 for(const file of ['/client','/server/index.js','/client/../server/index.js','/client/%2e%2e%2fserver/index.js','/.git/config'])assert.equal((await fetch(base+file)).status,404);
 const root=(await req('/api/login',{username:'root',password:'regression-password'})).cookie;
 let player;for(let i=0;i<16;i++){const response=await req('/api/register',{username:`user${i}`,password:'password-123'},null,{'X-Forwarded-For':'192.0.2.1'});assert.equal(response.status,200);if(i===0)player=response;}
 const user=player.body.user;const sql=new DatabaseSync(join(directory,'game.sqlite'));t.after(()=>sql.close());
 sql.exec("CREATE TRIGGER reject_save BEFORE UPDATE ON saves BEGIN SELECT RAISE(FAIL,'injected'); END;");
 const settingsBefore=(await req('/api/admin',undefined,root)).body.settings;
 for(const operation of [{op:'ban',userId:user.id,value:true},{op:'password',password:'new-password-123'},{op:'settings',values:{'prices.wood':10}}]){assert.equal((await req('/api/admin',operation,root)).status,500);assert.equal((await req('/api/state',undefined,player.cookie)).status,200);assert.equal((await req('/api/admin',undefined,root)).status,200);}
 assert.equal(sql.prepare('SELECT banned FROM users WHERE id=?').get(user.id).banned,0);sql.prepare('UPDATE users SET banned=1 WHERE id=?').run(user.id);assert.equal((await req('/api/admin',{op:'ban',userId:user.id,value:false},root)).status,500);assert.equal(sql.prepare('SELECT banned FROM users WHERE id=?').get(user.id).banned,1);sql.prepare('UPDATE users SET banned=0 WHERE id=?').run(user.id);assert.deepEqual((await req('/api/admin',undefined,root)).body.settings,settingsBefore);
 sql.exec('DROP TRIGGER reject_save;');
 assert.equal((await req('/api/admin',{op:'settings',values:{'prices.wood':9,'buildings.lumber.output.wood':33}},root)).status,200);
 assert.equal((await req('/api/admin',{op:'settings',values:{'__proto__.polluted':1}},root)).status,400);
 assert.equal((await req('/api/admin',{op:'settings',values:{'prices.wood':11}},player.cookie)).status,400);
 for(let i=0;i<15;i++)await req('/api/login',{username:'user0',password:'wrong-password'},null,{'X-Forwarded-For':'198.51.100.1'});
 const limited=await req('/api/login',{username:'user0',password:'wrong-password'},null,{'X-Forwarded-For':'198.51.100.1'});assert.equal(limited.status,429);assert.ok(Number(limited.retry)>0);
 assert.equal((await req('/api/login',{username:'user1',password:'password-123'},null,{'X-Forwarded-For':'198.51.100.1'})).status,200);
 await stop();await start();const restored=(await req('/api/admin',undefined,root)).body.settings;assert.equal(restored.prices.wood,9);assert.equal(restored.buildings.lumber.output.wood,33);
});
