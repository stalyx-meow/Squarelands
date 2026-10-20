import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
test('HTTP authentication, access control, persistence and transactional rollback',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'squarelands-test-'));let child;
  async function stop(){if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited;}}
  t.after(async()=>{await stop();await rm(directory,{recursive:true,force:true});});
  async function start(){child=spawn(process.execPath,['server/index.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',HOST:'127.0.0.1',DATA_DIR:directory,ROOT_PASSWORD:'test-only-root-password'},stdio:['ignore','pipe','pipe']});return await new Promise((resolve,reject)=>{let output='';const timeout=setTimeout(()=>reject(new Error('Server did not start')),10000);child.stdout.on('data',data=>{output+=data;const match=output.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timeout);resolve(`http://127.0.0.1:${match[1]}`);}});child.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Server exited: ${code}`));});});}
  let base=await start();
  async function request(path,data,cookie,headers={}){const r=await fetch(base+path,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(cookie?{cookie}:{}),...headers},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
  assert.equal((await request('/api/state')).status,401);
  assert.equal((await request('/api/register',{username:'tester',password:'password-123'},{},{origin:'https://other.example'})).status,403);
  const player=await request('/api/register',{username:'tester',password:'password-123'});assert.equal(player.status,200);assert.ok(player.cookie.includes('session='));
  assert.equal((await request('/api/login',{username:'tester',password:'incorrect-password'})).status,401);
  assert.equal((await request('/api/admin',undefined,player.cookie)).status,403);
  assert.equal((await request('/api/admin',{op:'pause',value:true},player.cookie)).status,400);
  const root=await request('/api/login',{username:'root',password:'test-only-root-password'});assert.equal(root.status,200);
  const view=(await request('/api/state',undefined,player.cookie)).body;
  const tile=view.world.tiles.find(t=>t.terrain==='plain'&&t.x>3&&t.y>3);
  const founded=await request('/api/action',{action:'found',x:tile.x,y:tile.y,name:'持久城'},player.cookie);assert.equal(founded.status,200);
  await stop();
  const db=new DatabaseSync(join(directory,'game.sqlite'));const saved=JSON.parse(db.prepare('SELECT state FROM saves WHERE id=1').get().state);saved.cities[0].readyAt=null;saved.cities[0].stock.money=0;db.prepare('UPDATE saves SET state=? WHERE id=1').run(JSON.stringify(saved));db.close();
  base=await start();let fresh=(await request('/api/state',undefined,player.cookie)).body;assert.equal(fresh.cities[0].name,'持久城');
  const before=fresh.cities[0].stock.wood;
  const rejected=await request('/api/action',{action:'build',cityId:founded.body.result,type:'lumber',x:tile.x-1,y:tile.y},player.cookie);assert.equal(rejected.status,400);
  fresh=(await request('/api/state',undefined,player.cookie)).body;assert.equal(fresh.cities[0].stock.wood,before);assert.equal(fresh.cities[0].buildings.length,0);
  assert.equal((await request('/api/admin',{op:'pause',value:true},root.cookie)).status,200);
  assert.equal((await request('/api/action',{action:'shop',cityId:founded.body.result,resource:'food',amount:1,side:'sell'},player.cookie)).status,400);
  assert.equal((await request('/api/admin',{op:'grant',cityId:founded.body.result,resource:'money',amount:1000},root.cookie)).status,200);
  assert.equal((await request('/api/admin',{op:'pause',value:false},root.cookie)).status,200);
  assert.equal((await request('/api/action',{action:'shop',cityId:founded.body.result,resource:'food',amount:1,side:'buy'},player.cookie)).status,200);
  const users=(await request('/api/admin',undefined,root.cookie)).body.users;assert.equal(users.length,2);assert.equal(users[0].hash,undefined);
  const playerId=users.find(u=>u.username==='tester').id;
  await request('/api/admin',{op:'ban',userId:playerId,value:true},root.cookie);assert.equal((await request('/api/state',undefined,player.cookie)).status,401);
  await request('/api/admin',{op:'ban',userId:playerId,value:false},root.cookie);
  await request('/api/logout',{},root.cookie);assert.equal((await request('/api/admin',undefined,root.cookie)).status,401);
  assert.equal((await fetch(base+'/server/index.js')).status,404);
});
