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
 g.pay(c,g.config.transport.railCost);g.state.rails[k]={owner:user.id};return true;
}
function hubs(g,c,type,reasons,label){
 const built=c.buildings.filter(b=>b.type===type&&!b.readyAt),facility=type==='station'?['车站','station']:['机场','airport'];
 const reason=(zh,en)=>reasons.push({zh:`${label[0]}${facility[0]}：${zh}`,en:`${label[1]} ${facility[1]}: ${en}`});
 if(!built.length){reason('未建成','not completed');return [];}
 if(g.operatingWorkers(c)<=0){reason('缺少运营工人','no operating workers');return [];}
 const powered=b=>{const d=g.definition(b),power=((d.power||0)+(d.input?.power||0))*b.level;
  // Electricity is consumed per simulation tick, not held as a full-cycle reserve.
  const recentlyPowered=b.poweredAt&&Math.abs(Date.now()-b.poweredAt)<=g.config.rules.tickSeconds*2000&&b.poweredLevel===b.level&&b.poweredDemand===power;
  return power===0||recentlyPowered||(c.stock.power||0)>=power*g.config.rules.tickSeconds/g.config.rules.cycleSeconds;
 };
 const active=built.filter(powered);if(!active.length){reason('电力不足','insufficient power');return [];}
 if(type==='airport'&&(c.stock.fuel||0)<g.config.transport.airFuel){reason(`燃油不足（需要 ${g.config.transport.airFuel}）`,`needs ${g.config.transport.airFuel} fuel`);return [];}
 const connected=type==='station'?active.filter(b=>g.state.rails[key(b.x,b.y)]):active;
 if(!connected.length)reason('车站所在格未铺轨','station tile has no railway');return connected;
}
export function fastRoutes(g,from,to,diagnostics={rail:[],air:[]}){
 const out=[],config=g.config.transport;
 const railFrom=hubs(g,from,'station',diagnostics.rail,['发货城','Origin']),railTo=hubs(g,to,'station',diagnostics.rail,['收货城','Destination']);
 const airFrom=hubs(g,from,'airport',diagnostics.air,['发货城','Origin']),airTo=hubs(g,to,'airport',diagnostics.air,['收货城','Destination']);
 const allowed=(x,y)=>{const c=g.state.cities.find(c=>c.id===g.state.claims[key(x,y)]);return !c||![from.owner,to.owner].some(owner=>playerPolicy(g.state,c,owner).embargo);};
 const tolls=path=>{const r={};for(const p of path){const c=g.state.cities.find(c=>c.id===g.state.claims[key(p.x,p.y)]);if(c&&c.owner!==from.owner&&c.owner!==to.owner)r[c.id]=Math.max(...[from.owner,to.owner].map(id=>playerPolicy(g.state,c,id).tariff));}return r;};
 const starts=railFrom,ends=new Set(railTo.map(b=>key(b.x,b.y)));
 if(starts.length&&ends.size){const queue=starts.map(b=>[b.x,b.y]),prev=new Map(queue.map(([x,y])=>[key(x,y),null]));let end;
  for(let i=0;i<queue.length;i++){const [x,y]=queue[i],k=key(x,y);if(ends.has(k)){end=k;break;}for(const [xx,yy] of neighbors(x,y)){const n=key(xx,yy);if(g.state.rails[n]&&!prev.has(n)&&allowed(xx,yy)){prev.set(n,k);queue.push([xx,yy]);}}}
  if(end){const path=[];for(let k=end;k;k=prev.get(k)){const [x,y]=k.split(',').map(Number);path.push({x,y});}path.reverse();out.push({mode:'rail',path,distance:path.length-1,tolls:tolls(path),seconds:config.railBaseSeconds+(path.length-1)*config.railSeconds,feeMultiplier:config.railFeeMultiplier});}
 }
 if(starts.length&&ends.size&&!out.some(r=>r.mode==='rail'))diagnostics.rail.push({zh:'铁路线路不连通或沿线禁运',en:'Railway disconnected or transit embargoed'});
 if(airFrom.length&&airTo.length&&allowed(to.x,to.y)&&allowed(from.x,from.y)){
  const distance=Math.hypot(from.x-to.x,from.y-to.y);out.push({mode:'air',path:[{x:from.x,y:from.y},{x:to.x,y:to.y}],distance,tolls:{},seconds:config.airBaseSeconds+distance*config.airSeconds,feeMultiplier:config.airFeeMultiplier,fuel:config.airFuel});
 }
 if(airFrom.length&&airTo.length&&!out.some(r=>r.mode==='air'))diagnostics.air.push({zh:'航空被通行政策禁止',en:'Air freight blocked by policy'});
 return out;
}
