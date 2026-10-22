import net from 'node:net';
import tls from 'node:tls';
import {readFileSync} from 'node:fs';
import {Readable} from 'node:stream';
export const MAX_REQUEST=32768,MAX_RESPONSE=64*1024*1024;
export function encodeFrame(value){const body=Buffer.from(JSON.stringify(value));if(body.length>MAX_RESPONSE)throw new Error('响应过大');const head=Buffer.alloc(4);head.writeUInt32BE(body.length);return Buffer.concat([head,body]);}
// Both transports invoke the same authenticated transaction dispatcher in memory.
// No HTTP connection, loopback proxy, forwarded IP or client-supplied session is used.
export function createGameTcpServer({dispatch,version}){
 const sockets=new Set(),ips=new Map();let closing=false;
 const accept=socket=>{
  const ip=socket.remoteAddress;if(closing||sockets.size>=128||(ips.get(ip)||0)>=12){socket.destroy();return;}
  sockets.add(socket);ips.set(ip,(ips.get(ip)||0)+1);socket.setNoDelay(true);socket.setTimeout(90000,()=>socket.destroy());
  let buffer=Buffer.alloc(0),queue=[],processing=false,token=null,subscribed=false,world=null,active=true;
  const send=value=>{if(!active||socket.destroyed)return;if(socket.writableLength>MAX_RESPONSE){socket.destroy();return;}try{socket.write(encodeFrame(value));}catch{socket.destroy();}};
  async function invoke(op,data={},worldToken=null){
   const routes={hello:['GET','/api/health'],login:['POST','/api/login'],register:['POST','/api/register'],state:['GET','/api/state'],action:['POST','/api/action'],admin:['POST','/api/admin'],adminState:['GET','/api/admin'],logout:['POST','/api/logout']};
   if(!Object.hasOwn(routes,op))throw new Error('未知消息类型');
   const [method,path]=routes[op];const req=Readable.from(method==='POST'?[Buffer.from(JSON.stringify(data))]:[]);req.method=method;req.url=path+(op==='state'&&worldToken?'?world='+encodeURIComponent(worldToken):'');req.headers={host:'tcp.internal',...(token?{cookie:`session=${token}`}:{})};req.socket={remoteAddress:ip};
   return await new Promise((resolve,reject)=>{const headers={};let status=200;const res={setHeader:(k,v)=>{headers[k.toLowerCase()]=v;},writeHead:(code,h={})=>{status=code;for(const [k,v]of Object.entries(h))headers[k.toLowerCase()]=v;},end:body=>{try{const result=JSON.parse(body||'{}');if(headers['set-cookie'])token=/session=([^;]*)/.exec(headers['set-cookie'])?.[1]||null;resolve({status,result});}catch(e){reject(e);}}};Promise.resolve(dispatch(req,res)).catch(reject);});
  }
  async function push(){if(!subscribed||!active||processing||socket.writableLength>1024*1024)return;processing=true;try{const {status,result}=await invoke('state',{},world);if(status===200){world=`${result.world.seed}:${result.world.revision}`;send({event:'state',data:result});}else{subscribed=false;send({event:'sessionExpired',error:result.error});}}finally{processing=false;drain();}}
  async function drain(){if(processing||!active)return;processing=true;try{while(queue.length&&active){const m=queue.shift();try{
    if(!m||!Number.isSafeInteger(m.id)||m.id<1||typeof m.op!=='string'||(m.data!==undefined&&(!m.data||typeof m.data!=='object'||Array.isArray(m.data))))throw new Error('消息格式无效');
    if(m.op==='subscribe'){const check=await invoke('state',{},m.world);if(check.status!==200){send({id:m.id,ok:false,status:check.status,...check.result});continue;}subscribed=true;world=`${check.result.world.seed}:${check.result.world.revision}`;send({id:m.id,ok:true,data:check.result});continue;}
    if(m.op==='unsubscribe'){subscribed=false;send({id:m.id,ok:true,data:{}});continue;}
    const {status,result}=await invoke(m.op,m.data,m.world);if(m.op==='logout')subscribed=false;
    send(status<400?{id:m.id,ok:true,data:result}:{id:m.id,ok:false,status,...result});
   }catch(error){send({id:m?.id??0,ok:false,status:400,error:error.message});}}}finally{processing=false;}}
  socket.on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);while(buffer.length>=4){const size=buffer.readUInt32BE();if(!size||size>MAX_REQUEST){socket.destroy();return;}if(buffer.length<size+4)break;let m;try{m=JSON.parse(buffer.subarray(4,4+size).toString('utf8'));}catch{socket.destroy();return;}buffer=buffer.subarray(size+4);if(queue.length>=32){socket.destroy();return;}queue.push(m);}void drain();});
  socket.on('error',()=>{});socket.on('close',()=>{active=false;sockets.delete(socket);ips.set(ip,Math.max(0,(ips.get(ip)||1)-1));if(!ips.get(ip))ips.delete(ip);clearInterval(timer);queue=[];buffer=Buffer.alloc(0);});
  const timer=setInterval(()=>void push(),2000);timer.unref();
  send({event:'hello',data:{service:'squarelands',transport:'tcp',protocol:1,version,tls:!!process.env.TCP_TLS_CERT}});
 };
 const server=process.env.TCP_TLS_CERT?tls.createServer({cert:readFileSync(process.env.TCP_TLS_CERT),key:readFileSync(process.env.TCP_TLS_KEY)},accept):net.createServer(accept);
 server.shutdown=()=>{closing=true;for(const s of sockets)s.destroy();server.close();};return server;
}
