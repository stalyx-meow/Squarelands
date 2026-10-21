import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {once} from 'node:events';import {DatabaseSync} from 'node:sqlite';
test('root account/tile edits require root, persist atomically, revoke target sessions and preserve authentication',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'squarelands-admin-edit-'));const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:'0',DATA_DIR:dir,ROOT_PASSWORD:'admin-edit-password'},stdio:['ignore','pipe','pipe']});let output='';const base=await new Promise((resolve,reject)=>{child.stdout.on('data',b=>{output+=b;const m=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0]);});child.once('exit',()=>reject(new Error(output)));});
 t.after(async()=>{if(child.exitCode===null){const ended=once(child,'exit');child.kill('SIGTERM');await ended;}await rm(dir,{recursive:true,force:true});});
 async function request(path,body,cookie){const res=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
 const root=(await request('/api/login',{username:'root',password:'admin-edit-password'})).cookie,target=await request('/api/register',{username:'target',password:'old-password-123'}),uid=target.body.user.id;
 assert.equal((await request('/api/admin',{op:'account',userId:uid,password:'hacked-password'},target.cookie)).status,400);
 assert.equal((await request('/api/admin',{op:'tile',x:2,y:2,terrain:'hill'},target.cookie)).status,400);
 const sql=new DatabaseSync(join(dir,'game.sqlite'));try{
  sql.exec("CREATE TRIGGER reject_admin_save BEFORE UPDATE ON saves BEGIN SELECT RAISE(FAIL,'injected'); END;");
  assert.equal((await request('/api/admin',{op:'account',userId:uid,username:'renamed',password:'new-password-123'},root)).status,500);
  assert.equal((await request('/api/state',null,target.cookie)).status,200);assert.equal(sql.prepare('SELECT username FROM users WHERE id=?').get(uid).username,'target');
  sql.exec('DROP TRIGGER reject_admin_save');
  assert.equal((await request('/api/admin',{op:'account',userId:uid,username:'renamed',password:'new-password-123'},root)).status,200);
  assert.equal((await request('/api/state',null,target.cookie)).status,401);assert.equal((await request('/api/login',{username:'renamed',password:'old-password-123'})).status,401);assert.equal((await request('/api/login',{username:'renamed',password:'new-password-123'})).status,200);
  assert.equal((await request('/api/admin',{op:'tile',x:2,y:2,terrain:'hill',deposit:'iron'},root)).status,200);const state=(await request('/api/state',null,root)).body;assert.equal(state.world.tiles.find(t=>t.x===2&&t.y===2).terrain,'hill');
  assert.equal((await request('/api/admin',{op:'tile',x:2,y:2,terrain:'constructor'},root)).status,400);
 }finally{sql.close();}
});
test('upgrading a legacy SQLite world creates a complete pre-migration database backup',async t=>{
 const {Game,createState}=await import('../server/game.js'),{readdir}=await import('node:fs/promises');const dir=await mkdtemp(join(tmpdir(),'squarelands-migration-backup-'));
 const legacy=new Game(createState(99)).state;delete legacy.featureVersion;legacy.settings.infiltration={minChance:.1};
 const db=new DatabaseSync(join(dir,'game.sqlite'));db.exec('CREATE TABLE saves(id INTEGER PRIMARY KEY,state TEXT)');db.prepare('INSERT INTO saves VALUES(1,?)').run(JSON.stringify(legacy));db.close();
 const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:'0',DATA_DIR:dir,ROOT_PASSWORD:'migration-password'},stdio:['ignore','pipe','pipe']});let output='';
 t.after(async()=>{if(child.exitCode===null){const ended=once(child,'exit');child.kill('SIGTERM');await ended;}await rm(dir,{recursive:true,force:true});});
 await new Promise((resolve,reject)=>{child.stdout.on('data',b=>{output+=b;if(output.includes('方域服务端已启动'))resolve();});child.once('exit',()=>reject(Error(output)));});
 const backups=(await readdir(dir)).filter(n=>/^backup-before-v130-.*\.sqlite$/.test(n));assert.equal(backups.length,1);const backup=new DatabaseSync(join(dir,backups[0]));try{const state=JSON.parse(backup.prepare('SELECT state FROM saves WHERE id=1').get().state);assert.equal(state.featureVersion,undefined);assert.ok(state.settings.infiltration);assert.equal(backup.prepare('SELECT count(*) AS n FROM users').get().n,1);}finally{backup.close();}
 const current=new DatabaseSync(join(dir,'game.sqlite'));try{const state=JSON.parse(current.prepare('SELECT state FROM saves WHERE id=1').get().state);assert.equal(state.featureVersion,3);assert.equal(state.settings.infiltration,undefined);}finally{current.close();}
});
