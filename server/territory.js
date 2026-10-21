const neighbors=(x,y)=>[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].map(([a,b])=>`${a},${b}`);
export function territoryAction(g,user,action,p){
 if(!['transferTile','abandonTile'].includes(action))return false;
 const c=g.city(user,p.cityId);g.ready(c);const k=`${p.x},${p.y}`;
 if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||g.state.claims[k]!==c.id)throw new Error('只能操作本城领地');
 if(c.x===p.x&&c.y===p.y)throw new Error('不能转让或放弃城池中心');
 const tiles=new Set(Object.keys(g.state.claims).filter(key=>g.state.claims[key]===c.id&&key!==k)),seen=new Set([`${c.x},${c.y}`]),queue=[`${c.x},${c.y}`];
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i].split(',').map(Number);for(const n of neighbors(x,y))if(tiles.has(n)&&!seen.has(n)){seen.add(n);queue.push(n);}}
 if(seen.size!==tiles.size)throw new Error('操作会使原城领地断开');
 const b=c.buildings.find(b=>b.x===p.x&&b.y===p.y);
 if(action==='abandonTile'){if(b||g.state.rails[k])throw new Error('请先拆除建筑和铁路，再放弃地块');delete g.state.claims[k];}
 else {
  const to=g.city(user,p.to);g.ready(to);if(to.id===c.id||!neighbors(p.x,p.y).some(n=>g.state.claims[n]===to.id))throw new Error('只能转给交界处的另一座自有城池');
  if(Object.values(g.state.claims).filter(id=>id===to.id).length>=(2*to.level+1)**2)throw new Error('接收城领地容量不足');
  if(b?.readyAt)throw new Error('施工中的建筑不能转让');
  if(b){c.buildings=c.buildings.filter(v=>v.id!==b.id);to.buildings.push(b);}g.state.claims[k]=to.id;
 }
 g.log(`${c.name} ${action==='abandonTile'?'放弃':'转让'}地块 ${k}`,user.id);return true;
}
