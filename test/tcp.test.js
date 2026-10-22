import test from 'node:test';import assert from 'node:assert/strict';import net from 'node:net';import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {once} from 'node:events';import {encodeFrame} from '../server/tcp.js';
class Peer{constructor(port){this.socket=net.connect(port,'127.0.0.1');this.buffer=Buffer.alloc(0);this.seq=0;this.waiters=new Map();this.events=[];this.socket.on('data',chunk=>{this.buffer=Buffer.concat([this.buffer,chunk]);while(this.buffer.length>=4){const n=this.buffer.readUInt32BE();if(this.buffer.length<n+4)return;const m=JSON.parse(this.buffer.subarray(4,n+4));this.buffer=this.buffer.subarray(n+4);if(m.id&&this.waiters.has(m.id)){this.waiters.get(m.id)(m);this.waiters.delete(m.id);}else this.events.push(m);}});}
request(op,data={},fragmented=false){const id=++this.seq;const frame=encodeFrame({id,op,data});return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('TCP request timeout: '+op)),5000);this.waiters.set(id,m=>{clearTimeout(timer);resolve(m);});if(fragmented){this.socket.write(frame.subarray(0,2));setTimeout(()=>this.socket.write(frame.subarray(2)),5);}else this.socket.write(frame);});}}
test('native TCP framing, authentication, transactions, privacy, push and logout',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'squarelands-tcp-'));const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'0',TCP_PORT:'0',HOST:'127.0.0.1',DATA_DIR:dir,ROOT_PASSWORD:'tcp-root-password'},stdio:['ignore','pipe','pipe']});let log='';child.stderr.on('data',d=>{log+=d;});
 t.after(async()=>{if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}await rm(dir,{recursive:true,force:true});});
 const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(log)),8000);child.stdout.on('data',d=>{log+=d;const match=log.match(/Godot TCP tcp:\/\/127.0.0.1:(\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});child.once('exit',()=>{clearTimeout(timer);reject(new Error(log));});});
 const a=new Peer(port),b=new Peer(port);t.after(()=>{a.socket.destroy();b.socket.destroy();});
 assert.equal((await a.request('state')).status,401);assert.equal((await a.request('hello',{},true)).data.service,'squarelands');
 assert.equal((await a.request('register',{username:'native-user',password:'native-password'},true)).ok,true);
 assert.equal((await b.request('adminState')).status,401);assert.equal((await a.request('adminState')).status,403);
 const subscribed=await a.request('subscribe');assert.equal(subscribed.ok,true);assert.ok(subscribed.data.world.tiles.length);assert.ok(!JSON.stringify(subscribed).includes('session='));
 const tile=subscribed.data.world.tiles.find(t=>t.terrain==='plain'&&t.x>3&&t.y>3);
 const found=await a.request('action',{action:'found',x:tile.x,y:tile.y,name:'Native TCP city'});assert.equal(found.ok,true);
 let state=(await a.request('state')).data;assert.equal(state.cities[0].name,'Native TCP city');
 assert.equal((await a.request('action',{action:'shop',cityId:found.data.result,resource:'wood',amount:1,side:'buy'})).ok,false);
 state=(await a.request('state')).data;assert.equal(state.cities[0].stock.wood,subscribed.data.settings.startStock.wood);
 await new Promise(r=>setTimeout(r,4400));assert.ok(a.events.some(e=>e.event==='state'));const push=a.events.filter(e=>e.event==='state').at(-1);assert.equal(push.data.world.tiles,undefined);
 assert.equal((await a.request('logout')).ok,true);assert.equal((await a.request('state')).status,401);
 const malformed=net.connect(port,'127.0.0.1');malformed.resume();const closed=once(malformed,'close');await once(malformed,'connect');malformed.write(Buffer.from([127,255,255,255]));await closed;
});
