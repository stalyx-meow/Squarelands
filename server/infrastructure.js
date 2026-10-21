import {playerPolicy} from '../shared/politics.js';
const key=(x,y)=>`${x},${y}`;
const neighbors=(x,y)=>[[x+1,y],[x-1,y],[x,y+1],[x,y-1]];
export function railAction(g,user,action,p){
 if(!['rail','removeRail'].includes(action))return false;
 const c=g.city(user,p.cityId);g.ready(c);
 if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||g.state.claims[key(p.x,p.y)]!==c.id)throw new Error('铁路必须在本城领地铺设');
 const k=key(p.x,p.y);
 if(action==='removeRail'){delete g.state.rails[k];return true;}
 if(g.state.rails[k])throw new Error('该格已有铁路');
 if(['ocean','lake','river'].includes(g.tile(p.x,p.y).terrain))throw new Error('铁路不能铺设于水域');
 g.pay(c,g.config.transport.railCost);g.state.rails[k]={owner:user.id};return true;
}
function hubs(g,c,type){return c.buildings.filter(b=>b.type===type&&!b.readyAt).filter(b=>{const d=g.definition(b);return c.efficiency>0&&(c.stock.power||0)>=((d.power||0)+(d.input?.power||0))*b.level&&(type!=='airport'||(c.stock.fuel||0)>=g.config.transport.airFuel);});}
export function fastRoutes(g,from,to){
 const out=[],config=g.config.transport;
 const allowed=(x,y)=>{const c=g.state.cities.find(c=>c.id===g.state.claims[key(x,y)]);return !c||![from.owner,to.owner].some(owner=>playerPolicy(g.state,c,owner).embargo);};
 const tolls=path=>{const r={};for(const p of path){const c=g.state.cities.find(c=>c.id===g.state.claims[key(p.x,p.y)]);if(c&&c.owner!==from.owner&&c.owner!==to.owner)r[c.id]=Math.max(...[from.owner,to.owner].map(id=>playerPolicy(g.state,c,id).tariff));}return r;};
 const starts=hubs(g,from,'station').filter(b=>g.state.rails[key(b.x,b.y)]),ends=new Set(hubs(g,to,'station').filter(b=>g.state.rails[key(b.x,b.y)]).map(b=>key(b.x,b.y)));
 if(starts.length&&ends.size){const queue=starts.map(b=>[b.x,b.y]),prev=new Map(queue.map(([x,y])=>[key(x,y),null]));let end;
  for(let i=0;i<queue.length;i++){const [x,y]=queue[i],k=key(x,y);if(ends.has(k)){end=k;break;}for(const [xx,yy] of neighbors(x,y)){const n=key(xx,yy);if(g.state.rails[n]&&!prev.has(n)&&allowed(xx,yy)){prev.set(n,k);queue.push([xx,yy]);}}}
  if(end){const path=[];for(let k=end;k;k=prev.get(k)){const [x,y]=k.split(',').map(Number);path.push({x,y});}path.reverse();out.push({mode:'rail',path,distance:path.length-1,tolls:tolls(path),seconds:config.railBaseSeconds+(path.length-1)*config.railSeconds,feeMultiplier:config.railFeeMultiplier});}
 }
 if(hubs(g,from,'airport').length&&hubs(g,to,'airport').length&&allowed(to.x,to.y)&&allowed(from.x,from.y)){
  const distance=Math.hypot(from.x-to.x,from.y-to.y);out.push({mode:'air',path:[{x:from.x,y:from.y},{x:to.x,y:to.y}],distance,tolls:{},seconds:config.airBaseSeconds+distance*config.airSeconds,feeMultiplier:config.airFeeMultiplier,fuel:config.airFuel});
 }
 return out;
}
