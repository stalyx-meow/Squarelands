import { randomUUID, randomInt } from 'node:crypto';
import { expandWorld } from './world.js';
const fail=message=>{throw new Error(message);};
const neighbors=(x,y)=>[[x+1,y],[x-1,y],[x,y+1],[x,y-1]];
export function territoryCapacity(c){return (2*c.level+1)**2;}
export function borderStats(game,target,attacker){
  const boundary=new Set(),counts=new Set(),walls=new Set(target.buildings.filter(b=>b.type==='wall'&&!b.readyAt).map(b=>`${b.x},${b.y}`));
  for(const [key,cityId] of Object.entries(game.state.claims))if(cityId===target.id){const [x,y]=key.split(',').map(Number);for(const [xx,yy]of neighbors(x,y)){const k=`${xx},${yy}`;if(game.state.claims[k]===target.id||!game.inBounds(xx,yy))continue;
    // A wall blocks the entire adjacent exterior cell, including corner exposure.
    if(neighbors(xx,yy).some(([wx,wy])=>walls.has(`${wx},${wy}`)))continue;
    boundary.add(k);const other=game.state.cities.find(c=>c.id===game.state.claims[k]);if(other?.owner===attacker.owner)counts.add(k);
  }}
  const config=game.config.infiltration;
  const contact=counts.size,total=boundary.size,ratio=total?contact/total:0;
  const strength=Math.max(-1,Math.min(1,(attacker.population-target.population)/Math.max(target.population,1)));
  const chance=Math.max(config.minChance,Math.min(config.maxChance,config.baseChance+config.borderWeight*ratio+config.populationWeight*strength+config.unrestWeight*(1-(target.comfort??64)/100)-config.levelDefense*target.level));
  return {contact,total,ratio,chance:Math.round(chance*10000)/10000,eligible:contact>=config.minContact&&ratio>=config.minRatio};
}
function settleOwnership(game,c,owner){
  for(const o of game.state.offers.filter(o=>o.cityId===c.id&&o.status==='open')){game.credit(c,o.kind==='spot'?o.resource:'money',o.kind==='spot'?o.amount:o.collateral);o.status='cancelled';}
  for(const ct of game.state.contracts.filter(ct=>ct.status==='active'&&(ct.seller===c.id||ct.buyer===c.id))){const seller=game.state.cities.find(c=>c.id===ct.seller),buyer=game.state.cities.find(c=>c.id===ct.buyer);if(buyer)game.credit(buyer,'money',ct.escrow);if(seller)game.credit(seller,'money',ct.collateral);ct.escrow=ct.collateral=0;ct.remaining=0;ct.status='cancelled';}
  game.state.pendingActions=game.state.pendingActions.filter(a=>a.cityId!==c.id);
  c.owner=owner.id;c.ownerName=owner.username;c.salePrice=null;c.policy={embargo:false,tariff:0,players:{}};c.thresholds={};c.autoSupply=true;
}
export function featureAction(game,user,action,p){
  if(action==='message'){
    const text=typeof p.text==='string'?p.text.trim():'';if(!text||[...text].length>500)fail('消息长度须为 1–500 字');if(p.toUser&&(!p.recipient||p.recipient.id===user.id))fail('请选择其他玩家');
    if(game.state.messages.some(m=>m.from===user.id&&Date.now()-m.time<2000))fail('发送消息需间隔 2 秒');
    game.state.messages.push({id:randomUUID(),from:user.id,name:user.username,to:p.recipient?.id??null,toName:p.recipient?.username??null,text,time:Date.now()});game.state.messages=game.state.messages.slice(-500);return true;
  }
  const actions=['unlock','threshold','autoSupply','convertFarm','sellCity','buyCity','infiltrate','cancelPending'];if(!actions.includes(action))return false;
  if(action==='buyCity'){
    const target=game.state.cities.find(c=>c.id===p.targetId),buyer=game.city(user,p.cityId);game.ready(buyer);
    if(!target||target.owner===user.id||!target.salePrice)fail('城池不在出售中');if(p.expectedPrice!==undefined&&p.expectedPrice!==target.salePrice)fail('售价已变更，请重新确认');if(game.state.cities.filter(c=>c.owner===user.id).length>=game.config.rules.maxCities)fail('城池数量已达到服务器上限');
    if(target.readyAt||target.upgradeAt||target.buildings.some(b=>b.readyAt))fail('施工中的城池暂不能收购');
    if(game.state.pendingActions.some(p=>p.cityId===target.id)||game.state.shipments.some(s=>s.status==='transit'&&(s.to===target.id||s.from===target.id||s.payer===target.id))||game.state.contracts.some(ct=>ct.status==='active'&&(ct.seller===target.id||ct.buyer===target.id))||game.state.offers.some(o=>o.cityId===target.id&&o.status==='open')||game.state.infiltrations.some(i=>i.status==='active'&&(i.source===target.id||i.target===target.id)))fail('城池有未结运输、订单或渗透，请结清后再收购');
    game.pay(buyer,{money:target.salePrice});const seller=game.state.cities.find(c=>c.owner===target.owner&&c.id!==target.id&&!c.readyAt);if(!seller)fail('卖家需保留另一座已建成城池收款');game.credit(seller,'money',target.salePrice);settleOwnership(game,target,user);game.log(`${user.username} 收购了「${target.name}」`);return true;
  }
  const c=game.city(user,p.cityId);game.ready(c);
  if(action==='unlock'){
    const {x,y}=p;if(!Number.isInteger(x)||!Number.isInteger(y)||!game.inBounds(x,y))fail('请选择有效地块');
    if(game.state.claims[`${x},${y}`])fail('地块已有归属');if(Object.values(game.state.claims).filter(v=>v===c.id).length>=territoryCapacity(c))fail('领地数量达到上限，请升级城池');
    if(!neighbors(x,y).some(([xx,yy])=>game.state.claims[`${xx},${yy}`]===c.id))fail('只能解锁紧邻本城领地的地块');
    game.pay(c,{money:game.config.territory.unlockMoney,wood:game.config.territory.unlockWood,stone:game.config.territory.unlockStone});game.state.claims[`${x},${y}`]=c.id;expandWorld(game.state.world,[{x,y}],game.config.territory);
  }
  if(action==='threshold'){if(typeof p.resource!=='string'||!Object.hasOwn(game.config.prices,p.resource))fail('未知物资');if(p.value!==null&&(!Number.isFinite(p.value)||p.value<0||p.value>1000000))fail('阈值须为 0–1000000，留空关闭');if(p.value===null)delete c.thresholds[p.resource];else c.thresholds[p.resource]=p.value;}
  if(action==='autoSupply')c.autoSupply=!!p.value;
  if(action==='cancelPending')game.state.pendingActions=game.state.pendingActions.filter(a=>a.cityId!==c.id);
  if(action==='convertFarm'){const b=c.buildings.find(b=>b.id===p.buildingId);if(!b||b.readyAt||!['farm','vegetableFarm'].includes(b.type))fail('只能转换已完工的粮田或蔬菜田');b.type=b.type==='farm'?'vegetableFarm':'farm';}
  if(action==='sellCity'){if(p.price!==null&&(!Number.isSafeInteger(p.price)||p.price<1||p.price>100000000))fail('售价须为 1–100000000 的整数');if(c.readyAt||c.upgradeAt||c.buildings.some(b=>b.readyAt))fail('施工中的城池暂不能出售');if(p.price!==null&&!game.state.cities.some(v=>v.id!==c.id&&v.owner===user.id&&!v.readyAt))fail('需要保留另一座已建成城池收取售款');c.salePrice=p.price;}
  if(action==='infiltrate'){
    const target=game.state.cities.find(t=>t.id===p.targetId);if(!target||target.owner===user.id||target.readyAt)fail('请选择其他玩家已建成的城池');
    if(game.state.cities.filter(c=>c.owner===user.id).length>=game.config.rules.maxCities)fail('城池数量已达上限');if(game.state.infiltrations.some(i=>i.target===target.id&&i.owner===user.id&&i.status==='active'))fail('已有渗透行动');
    if(game.state.infiltrations.some(i=>i.target===target.id&&i.owner===user.id&&Date.now()-(i.finishedAt||i.startedAt)<game.config.infiltration.cooldownSeconds*1000))fail('同一目标的渗透冷却尚未结束');
    const stats=borderStats(game,target,c);if(!stats.eligible)fail('有效接壤格或边界比例未达到服务器要求');if(game.available(c)<game.config.infiltration.workers)fail('渗透所需空闲工人不足');game.pay(c,{money:game.config.infiltration.costMoney,goods:game.config.infiltration.costGoods});c.transportWorkers=(c.transportWorkers||0)+game.config.infiltration.workers;
    game.state.infiltrations.push({id:randomUUID(),source:c.id,target:target.id,owner:user.id,ownerName:user.username,targetOwner:target.owner,workers:game.config.infiltration.workers,progress:0,status:'active',startedAt:Date.now(),chance:stats.chance});game.log(`${c.name} 正在渗透「${target.name}」`);
  }
  return true;
}
export function requestSupply(game,c,cost,now=Date.now()){
  if(c.autoSupply===false)return false;let sent=false;
  for(const [resource,need] of Object.entries(cost)){
    const inbound=game.state.shipments.filter(s=>s.status==='transit'&&s.to===c.id&&s.resource===resource).reduce((n,s)=>n+s.amount,0);
    let shortage=Math.max(0,Math.ceil(need-(c.stock[resource]||0)-inbound));
    for(const from of game.state.cities.filter(v=>v.owner===c.owner&&v.id!==c.id&&!v.readyAt).sort((a,b)=>Math.abs(a.x-c.x)+Math.abs(a.y-c.y)-Math.abs(b.x-c.x)-Math.abs(b.y-c.y))){
      if(!shortage)break;const reserve=resource==='money'?100:Math.ceil(from.population*(game.config.needs[resource]||0)*2),amount=Math.min(shortage,game.config.trade.maxAmount,Math.floor((from.stock[resource]||0)-reserve),resource==='money'?game.config.trade.maxAmount:Math.floor(game.capacity(c)-(c.stock[resource]||0)-inbound));if(amount<1)continue;
      try{
        const route=game.route(from,c),fee=Math.ceil(route.distance*game.config.economy.freightDistance+amount*game.config.economy.freightAmount)+Object.values(route.tolls).reduce((n,rate)=>n+Math.ceil(amount*(game.config.prices[resource]??1)*rate/100),0);
        if(from.stock.money<fee+(resource==='money'?amount:0))continue;
        game.transport(from,c,resource,amount,from,now);game.pay(from,{[resource]:amount});shortage-=amount;sent=true;
      }catch{/* All transport validation happens before mutation. Try another source. */}
    }
  }return sent;
}
export function tickFeatures(game,now,dt){
  for(const c of game.state.cities.filter(c=>!c.readyAt)){
    for(const [k,limit] of Object.entries(c.thresholds)){const amount=Math.max(0,Math.floor(c.stock[k]-limit));if(amount){game.pay(c,{[k]:amount});game.credit(c,'money',Math.floor(amount*Math.round(game.config.prices[k]*game.config.economy.sellMultiplier*100)/100));game.state.shop.stock[k]=(game.state.shop.stock[k]||0)+amount;}}
  }
  for(const pending of [...game.state.pendingActions]){
    const c=game.state.cities.find(c=>c.id===pending.cityId);if(!c||c.owner!==pending.user.id){game.state.pendingActions=game.state.pendingActions.filter(p=>p.id!==pending.id);continue;}
    if(game.state.shipments.some(s=>s.to===c.id&&s.status==='transit'))continue;
    game.state.pendingActions=game.state.pendingActions.filter(p=>p.id!==pending.id);
    const snapshot=structuredClone(game.state);try{game.coreAction(pending.user,pending.action,pending.params);game.log(`${c.name}：调配完成，已执行等待中的操作`,c.owner);}catch(error){game.state=snapshot;game.log(`${c.name}：等待操作已取消：${error.message}`,c.owner);}
  }
  for(const i of game.state.infiltrations.filter(i=>i.status==='active')){
    const source=game.state.cities.find(c=>c.id===i.source),target=game.state.cities.find(c=>c.id===i.target);
    const stats=source&&target?borderStats(game,target,source):null;
    const valid=source?.owner===i.owner&&target?.owner===i.targetOwner&&stats?.eligible;
    if(!valid){i.status='cancelled';}else{i.chance=stats.chance;i.progress=Math.min(100,i.progress+dt*game.config.infiltration.progressPerCycle);if(i.progress>=100){i.status=game.state.cities.filter(c=>c.owner===i.owner).length<game.config.rules.maxCities&&randomInt(1000000)<stats.chance*1000000?'success':'failed';if(i.status==='success')settleOwnership(game,target,{id:i.owner,username:i.ownerName});}}
    if(i.status!=='active'){i.finishedAt=now;if(source)source.transportWorkers=Math.max(0,(source.transportWorkers||0)-(i.workers??4));game.log(`对「${target?.name||'城池'}」的渗透${i.status==='success'?'成功，城池已易主':i.status==='failed'?'失败':'因边界或归属变化取消'}`);}
  }
  game.state.infiltrations=game.state.infiltrations.filter((i,n,a)=>i.status==='active'||now-(i.finishedAt||i.startedAt)<game.config.infiltration.cooldownSeconds*1000||n>=a.length-100);
}
