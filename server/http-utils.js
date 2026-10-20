import { relative, isAbsolute, sep } from 'node:path';
import { BlockList, isIP } from 'node:net';
export function inside(file,directory,pathApi={relative,isAbsolute,sep}){const rel=pathApi.relative(directory,file);return !!rel&&rel!=='..'&&!rel.startsWith(`..${pathApi.sep}`)&&!pathApi.isAbsolute(rel);}
export async function readBody(req){const chunks=[];let size=0;for await(const chunk of req){const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=bytes.length;if(size>32768)throw new Error('请求过大');chunks.push(bytes);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw new Error('请求格式无效');}}
export function proxyResolver(spec=''){
  const block=new BlockList();for(const entry of spec.split(',').map(v=>v.trim()).filter(Boolean)){const [address,bits]=entry.split('/'),family=isIP(address);if(!family)throw new Error('TRUSTED_PROXIES 包含无效地址');if(bits!==undefined)block.addSubnet(address,Number(bits),family===6?'ipv6':'ipv4');else block.addAddress(address,family===6?'ipv6':'ipv4');}
  const normalized=ip=>ip?.startsWith('::ffff:')?ip.slice(7):ip;
  const trusted=ip=>{const family=isIP(ip);return !!family&&block.check(ip,family===6?'ipv6':'ipv4');};
  return req=>{const remote=normalized(req.socket.remoteAddress);if(!trusted(remote))return remote;const chain=String(req.headers['x-forwarded-for']||'').split(',').map(v=>normalized(v.trim()));let current=remote;for(let i=chain.length-1;i>=0&&trusted(current);i--){if(!isIP(chain[i]))break;current=chain[i];}return current;};
}
