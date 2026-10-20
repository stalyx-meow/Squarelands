import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configured, applySettings, settingFields } from './settings.js';
import { inside, readBody, proxyResolver } from './http-utils.js';
import { Game, createState } from './game.js';
import { PRICES, RESOURCES } from '../shared/config.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=resolve(process.env.DATA_DIR||resolve(root,'data')); mkdirSync(dataDir,{recursive:true,mode:0o700});
const db=new DatabaseSync(resolve(dataDir,'game.sqlite'));db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE COLLATE NOCASE, salt TEXT, hash TEXT, role TEXT, banned INTEGER DEFAULT 0); CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT, expires INTEGER); CREATE TABLE IF NOT EXISTS saves (id INTEGER PRIMARY KEY, state TEXT);');
const hash=(password,salt)=>scryptSync(password,salt,64).toString('hex');
const newUser=(username,password,role='player')=>{const id=randomBytes(16).toString('hex'),salt=randomBytes(16).toString('hex');db.prepare('INSERT INTO users (id,username,salt,hash,role) VALUES (?,?,?,?,?)').run(id,username,salt,hash(password,salt),role);return {id,username,role};};
if(!db.prepare('SELECT id FROM users WHERE role=?').get('root')){const password=process.env.ROOT_PASSWORD||randomBytes(12).toString('base64url');newUser('root',password,'root');if(process.send){process.send({type:'bootstrap',password});console.log('首次创建 root 账号，初始密码已发送至本机服务端控制台。');}else{process.stdout.write(`\n首次创建 root 账号，密码：${password}\n请保存此密码，并在管理界面修改。\n\n`);}}
const saved=db.prepare('SELECT state FROM saves WHERE id=1').get();
if(saved&&(JSON.parse(saved.state).schemaVersion??1)<2){writeFileSync(resolve(dataDir,`backup-before-v2-${Date.now()}.json`),saved.state,{mode:0o600});}
const game=new Game(saved?JSON.parse(saved.state):createState());
if(saved)game.shiftTime(Math.max(0,Date.now()-game.state.lastTick));
game.state.lastTick=Date.now();
const save=()=>db.prepare('INSERT INTO saves (id,state) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state').run(JSON.stringify(game.state));
game.tick();save();
const publicUser=u=>({id:u.id,username:u.username,role:u.role});
const sessions=db.prepare('SELECT users.*, sessions.expires FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=?');
const attempts=new Map();
const clientIP=proxyResolver(process.env.TRUSTED_PROXIES||'');
const limiter=(key,max=20)=>{const now=Date.now(),a=attempts.get(key)||{count:0,reset:now+60000};if(now>a.reset){a.count=0;a.reset=now+60000;}a.count++;attempts.set(key,a);if(a.count>max){const e=new Error('操作频繁，请稍后再试');e.status=429;e.retryAfter=Math.max(1,Math.ceil((a.reset-now)/1000));throw e;}};
const cleanUser=u=>({id:u.id,username:u.username,role:u.role,banned:!!u.banned});
const admin=(user,p)=>{
  if(user.role!=='root')throw new Error('需要 root 权限');
  if(p.op==='pause'){game.tick();game.state.paused=!!p.value;game.log(`管理员${p.value?'暂停':'恢复'}了世界`);}
  else if(p.op==='grant'){const c=game.state.cities.find(c=>c.id===p.cityId);if(!c||typeof p.resource!=='string'||!Object.hasOwn(RESOURCES,p.resource)||!Number.isFinite(p.amount)||p.amount<1||p.amount>1000000)throw new Error('城市、资源或数量无效');game.credit(c,p.resource,p.amount);game.log(`管理员向 ${c.name} 发放 ${p.amount} ${RESOURCES[p.resource][0]}`);}
  else if(p.op==='ban'){const target=db.prepare('SELECT * FROM users WHERE id=?').get(p.userId);if(!target||target.role==='root')throw new Error('无法操作此账号');db.prepare('UPDATE users SET banned=? WHERE id=?').run(p.value?1:0,p.userId);if(p.value){db.prepare('DELETE FROM sessions WHERE user_id=?').run(p.userId);game.state.pendingActions=game.state.pendingActions.filter(a=>a.user.id!==p.userId);}game.log(`管理员${p.value?'封禁':'解封'}了 ${target.username}`);}
  else if(p.op==='settings'){game.state.settings=p.reset?configured():applySettings(game.config,p.values);game.log('管理员更新了世界参数');}
  else if(p.op==='reset'){if(p.confirm!=='重置世界')throw new Error('请输入“重置世界”确认');const settings=game.config;game.state=new Game(createState(undefined,settings)).state;game.state.settings=settings;game.tick();game.log('管理员重新生成了世界');}
  else if(p.op==='refreshShop'){game.state.shop.refreshAt=0;game.tick();}
  else if(p.op==='password'){if(typeof p.password!=='string'||p.password.length<10||p.password.length>128)throw new Error('新密码长度为 10–128 位');const salt=randomBytes(16).toString('hex');db.prepare('UPDATE users SET salt=?,hash=? WHERE id=?').run(salt,hash(p.password,salt),user.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);}
  else throw new Error('未知管理操作');
};
const body=readBody;
const server=http.createServer(async(req,res)=>{
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')){
      if(req.method==='GET'&&url.pathname==='/api/health')return json(200,{service:'squarelands',protocol:1,version:'1.2.0'});
      if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return json(403,{error:'请求来源不受信任'});
      if(req.method==='POST')limiter(`overall:${clientIP(req)}`,600);
      if(url.pathname==='/api/login'||url.pathname==='/api/register'){
        if(req.method!=='POST')return json(405,{error:'需要 POST 请求'});
        const p=await body(req);if(typeof p.username!=='string'||!/^[\p{L}\p{N}_-]{2,20}$/u.test(p.username)||typeof p.password!=='string'||p.password.length<8||p.password.length>128)throw new Error('用户名需为 2–20 位文字、数字、下划线；密码需为 8–128 位');
        limiter(`auth:${clientIP(req)}:${p.username.toLowerCase()}`,15);limiter(`auth-account:${p.username.toLowerCase()}`,60);
        let user;if(url.pathname==='/api/register'){if(p.username.toLowerCase()==='root'||db.prepare('SELECT id FROM users WHERE username=?').get(p.username))throw new Error('用户名已存在');if(db.prepare('SELECT count(*) AS count FROM users').get().count>=5000)throw new Error('服务器注册人数已满');user=newUser(p.username,p.password);}
        else {user=db.prepare('SELECT * FROM users WHERE username=?').get(p.username);const salt=user?.salt||'invalid-user-salt';const candidate=Buffer.from(hash(p.password,salt),'hex');if(!user||!timingSafeEqual(candidate,Buffer.from(user.hash,'hex')))return json(401,{error:'用户名或密码不正确'});if(user.banned)return json(403,{error:'账号已被封禁'});}
        const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(token,user.id,Date.now()+7*86400000);res.setHeader('Set-Cookie',`session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.COOKIE_SECURE==='1'?'; Secure':''}`);return json(200,{user:publicUser(user)});
      }
      const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('session='))?.slice(8);
      const user=token?sessions.get(token):null;if(!user||user.banned||user.expires<Date.now())return json(401,{error:'请先登录'});
      if(req.method==='GET'&&url.pathname==='/api/state')return json(200,{user:publicUser(user),...game.view(user,url.searchParams.get('world')),players:db.prepare('SELECT id,username FROM users WHERE banned=0').all()});
      if(req.method==='GET'&&url.pathname==='/api/admin'){if(user.role!=='root')return json(403,{error:'需要 root 权限'});return json(200,{settings:game.config,settingFields:settingFields(game.config),users:db.prepare('SELECT id,username,role,banned FROM users').all().map(cleanUser),stats:{cities:game.state.cities.length,offers:game.state.offers.filter(o=>o.status==='open').length,contracts:game.state.contracts.filter(c=>c.status==='active').length,seed:game.state.world.seed}});}
      if(req.method!=='POST')return json(404,{error:'接口不存在'});
      limiter(`account:${user.id}`,180);
      if(url.pathname==='/api/logout'){db.prepare('DELETE FROM sessions WHERE token=?').run(token);res.setHeader('Set-Cookie','session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(200,{ok:true});}
      const p=await body(req),snapshot=structuredClone(game.state);
      if(p.action==='message'&&p.toUser){p.recipient=db.prepare('SELECT id,username FROM users WHERE id=? AND banned=0').get(p.toUser);if(!p.recipient)throw new Error('目标玩家不存在');}else delete p.recipient;
      if(p.action==='policy'&&p.playerId)p.policyPlayer=!!db.prepare('SELECT id FROM users WHERE id=? AND banned=0').get(p.playerId);
      if(!['/api/action','/api/admin'].includes(url.pathname))return json(404,{error:'接口不存在'});
      db.exec('BEGIN IMMEDIATE');
      try{let result;if(url.pathname==='/api/action')result=game.action(user,p.action,p);else admin(user,p);
        try{save();db.exec('COMMIT');}catch(error){error.status=500;error.message='保存失败，操作已回滚';throw error;}
        return json(200,{ok:true,result});
      }catch(error){db.exec('ROLLBACK');game.state=snapshot;throw error;}
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
    const file=url.pathname==='/'?resolve(root,'client/index.html'):resolve(root,`.${decodeURIComponent(url.pathname)}`);
    if(!inside(file,resolve(root,'client'))&&!inside(file,resolve(root,'shared'))){res.writeHead(404);return res.end('Not found');}
    if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);return res.end('Not found');}
    const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:readFileSync(file));
  }catch(error){if(error.retryAfter)res.setHeader('Retry-After',String(error.retryAfter));json(error.status||400,{error:error.message||'请求失败'});}
});
const port=Number(process.env.PORT||3210),host=process.env.HOST||'127.0.0.1';
server.on('error',error=>{clearInterval(timer);clearInterval(cleanup);db.close();process.stderr.write(`服务端启动失败：${error.message}\n`,()=>process.exit(1));});
server.listen(port,host,()=>{const url=`http://${host}:${server.address().port}`;console.log(`方域服务端已启动 ${url}`);process.send?.({type:'ready',url});});
const timer=setInterval(()=>{if(Date.now()-game.state.lastTick<game.config.rules.tickSeconds*1000)return;const snapshot=structuredClone(game.state);try{game.tick();save();}catch(e){game.state=snapshot;console.error('世界更新失败',e);}},1000);
const cleanup=setInterval(()=>{db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());for(const [key,value]of attempts)if(value.reset<Date.now())attempts.delete(key);},60000);
let shuttingDown=false;
function shutdown(){if(shuttingDown)return;shuttingDown=true;clearInterval(timer);clearInterval(cleanup);save();console.log('正在安全关闭世界并保存存档…');server.close(()=>{db.close();process.exit(0);});server.closeIdleConnections();setTimeout(()=>server.closeAllConnections(),3000).unref();}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,shutdown);
process.on('message',message=>{if(message?.type==='shutdown')shutdown();});
// If the GUI crashes, stop instead of leaving a hidden server behind.
if(process.send)process.on('disconnect',shutdown);
