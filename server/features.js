import { randomUUID } from 'node:crypto';
import {allianceOf} from '../shared/politics.js';
import { expandWorld } from './world.js';
const fail=message=>{throw new Error(message);};
const neighbors=(x,y)=>[[x+1,y],[x-1,y],[x,y+1],[x,y-1]];
export function territoryCapacity(c){return (2*c.level+1)**2;}
function settleOwnership(game,c,owner){
  for(const o of game.state.offers.filter(o=>o.cityId===c.id&&o.status==='open')){game.credit(c,o.kind==='spot'?o.resource:'money',o.kind==='spot'?o.amount:o.collateral);o.status='cancelled';}
  for(const ct of game.state.contracts.filter(ct=>ct.status==='active'&&(ct.seller===c.id||ct.buyer===c.id))){const seller=game.state.cities.find(c=>c.id===ct.seller),buyer=game.state.cities.find(c=>c.id===ct.buyer);if(buyer)game.credit(buyer,'money',ct.escrow);if(seller)game.credit(seller,'money',ct.collateral);ct.escrow=ct.collateral=0;ct.remaining=0;ct.status='cancelled';}
  game.state.pendingActions=game.state.pendingActions.filter(a=>a.cityId!==c.id);
  c.owner=owner.id;c.ownerName=owner.username;c.salePrice=null;c.policy={embargo:false,tariff:0,players:{}};c.thresholds={};c.supplyThresholds={};c.transferRules=[];c.constructionReserve=game.config.rules.defaultConstructionReserve;c.transportReserve=game.config.rules.defaultTransportReserve;c.autoSupply=true;
  for(const other of game.state.cities)other.transferRules=(other.transferRules||[]).filter(r=>r.to!==c.id);
}
export function featureAction(game,user,action,p){
  if(action==='message'){
    const alliance=p.channel==='alliance'?allianceOf(game.state,user.id):null;if(p.channel==='alliance'&&!alliance)fail('请先加入联盟');if(alliance&&p.toUser)fail('联盟消息不能同时是私信');
    const text=typeof p.text==='string'?p.text.trim():'';if(!text||[...text].length>500)fail('消息长度须为 1–500 字');if(p.toUser&&(!p.recipient||p.recipient.id===user.id))fail('请选择其他玩家');
    if(game.state.messages.some(m=>m.from===user.id&&Date.now()-m.time<2000))fail('发送消息需间隔 2 秒');
    game.state.messages.push({id:randomUUID(),from:user.id,name:user.username,allianceId:alliance?.id??null,to:p.recipient?.id??null,toName:p.recipient?.username??null,text,time:Date.now()});game.state.messages=game.state.messages.slice(-500);return true;
  }
  const actions=['unlock','threshold','autoSupply','convertFarm','sellCity','buyCity','cancelPending','constructionReserve','transportReserve','supplyThreshold','transferRule','removeTransferRule'];if(!actions.includes(action))return false;
  if(action==='buyCity'){
    const target=game.state.cities.find(c=>c.id===p.targetId),buyer=game.city(user,p.cityId);game.ready(buyer);
    if(!target||target.owner===user.id||!target.salePrice)fail('城池不在出售中');if(p.expectedPrice!==undefined&&p.expectedPrice!==target.salePrice)fail('售价已变更，请重新确认');if(game.state.cities.filter(c=>c.owner===user.id).length>=game.config.rules.maxCities)fail('城池数量已达到服务器上限');
    if(target.readyAt||target.upgradeAt||target.buildings.some(b=>b.readyAt))fail('施工中的城池暂不能收购');
    if(game.state.pendingActions.some(p=>p.cityId===target.id)||game.state.shipments.some(s=>s.status==='transit'&&(s.to===target.id||s.from===target.id||s.payer===target.id))||game.state.contracts.some(ct=>ct.status==='active'&&(ct.seller===target.id||ct.buyer===target.id))||game.state.offers.some(o=>o.cityId===target.id&&o.status==='open'))fail('城池有未结运输或订单，请结清后再收购');
    game.pay(buyer,{money:target.salePrice});const seller=game.state.cities.find(c=>c.owner===target.owner&&c.id!==target.id&&!c.readyAt);if(!seller)fail('卖家需保留另一座已建成城池收款');game.credit(seller,'money',target.salePrice);settleOwnership(game,target,user);game.log(`${user.username} 收购了「${target.name}」`);return true;
  }
  const c=game.city(user,p.cityId);game.ready(c);
  if(action==='unlock'){
    const {x,y}=p;if(!Number.isInteger(x)||!Number.isInteger(y)||!game.inBounds(x,y))fail('请选择有效地块');
    if(game.state.claims[`${x},${y}`])fail('地块已有归属');if(Object.values(game.state.claims).filter(v=>v===c.id).length>=territoryCapacity(c))fail('领地数量达到上限，请升级城池');
    if(!neighbors(x,y).some(([xx,yy])=>game.state.claims[`${xx},${yy}`]===c.id))fail('只能解锁紧邻本城领地的地块');
    game.pay(c,{money:game.config.territory.unlockMoney,wood:game.config.territory.unlockWood,stone:game.config.territory.unlockStone});game.state.claims[`${x},${y}`]=c.id;expandWorld(game.state.world,[{x,y}],game.config.territory);
  }
  if(action==='threshold'||action==='supplyThreshold'){if(p.mode==='default')p.value=game.capacity(c)*(action==='threshold'?game.config.automation.saleRatio:game.config.automation.supplyRatio);else if(p.mode==='disabled')p.value=null;}
  if(action==='threshold'){if(typeof p.resource!=='string'||!Object.hasOwn(game.config.prices,p.resource))fail('未知物资');if(p.value!==null&&(!Number.isFinite(p.value)||p.value<0||p.value>1000000))fail('阈值须为 0–1000000，留空关闭');if(p.value!==null&&(supplyLimit(game,c,p.resource)??0)>p.value)fail('自动出售阈值不能低于补货下限');if(p.mode==='default')delete c.thresholds[p.resource];else c.thresholds[p.resource]=p.value;}
  if(action==='constructionReserve'||action==='transportReserve'){
    if(!Number.isSafeInteger(p.value)||p.value<0||p.value>100000)fail('预留建筑工人数须为 0–100000 的整数');
    c[action]=p.value;
  }
  if(action==='supplyThreshold'){
    if(typeof p.resource!=='string'||!Object.hasOwn(c.stock,p.resource))fail('未知物资');
    if(p.value!==null&&(!Number.isFinite(p.value)||p.value<0||p.value>1000000))fail('补货下限须为 0–1000000，留空关闭');
    if(p.value!==null&&saleLimit(game,c,p.resource)!==null&&p.value>saleLimit(game,c,p.resource))fail('补货下限不能高于自动出售阈值');
    if(p.mode==='default')delete c.supplyThresholds[p.resource];else c.supplyThresholds[p.resource]=p.value;
  }
  if(action==='transferRule'){
    const to=game.city(user,p.to);game.ready(to);if(to.id===c.id)fail('请选择另一座城池');
    if(typeof p.resource!=='string'||!Object.hasOwn(c.stock,p.resource))fail('未知物资');game.amount(p.amount);
    const old=c.transferRules.find(r=>r.to===to.id&&r.resource===p.resource);
    if(old){old.amount=p.amount;}else{if(c.transferRules.length>=game.config.trade.maxTransferRules)fail('周期调配规则数量已达服务器上限');c.transferRules.push({id:randomUUID(),to:to.id,resource:p.resource,amount:p.amount,nextAt:Date.now()+game.config.rules.cycleSeconds*1000,status:'waiting'});}
  }
  if(action==='removeTransferRule'){
    if(!c.transferRules.some(r=>r.id===p.ruleId))fail('周期调配规则不存在');c.transferRules=c.transferRules.filter(r=>r.id!==p.ruleId);
  }
  if(action==='autoSupply')c.autoSupply=!!p.value;
  if(action==='cancelPending')game.state.pendingActions=game.state.pendingActions.filter(a=>a.cityId!==c.id);
  if(action==='convertFarm'){const b=c.buildings.find(b=>b.id===p.buildingId);if(!b||b.readyAt||!['farm','vegetableFarm'].includes(b.type))fail('只能转换已完工的粮田或蔬菜田');b.type=b.type==='farm'?'vegetableFarm':'farm';}
  if(action==='sellCity'){if(p.price!==null&&(!Number.isSafeInteger(p.price)||p.price<1||p.price>100000000))fail('售价须为 1–100000000 的整数');if(c.readyAt||c.upgradeAt||c.buildings.some(b=>b.readyAt))fail('施工中的城池暂不能出售');if(p.price!==null&&!game.state.cities.some(v=>v.id!==c.id&&v.owner===user.id&&!v.readyAt))fail('需要保留另一座已建成城池收取售款');c.salePrice=p.price;}

  return true;
}
export const supplyLimit=(g,c,k)=>{const value=Object.hasOwn(c.supplyThresholds,k)?c.supplyThresholds[k]:g.capacity(c)*g.config.automation.supplyRatio;if(value===null)return null;const sale=k==='money'?null:saleLimit(g,c,k);return Math.min(value,sale===null?Infinity:sale);};
export const saleLimit=(g,c,k)=>Object.hasOwn(c.thresholds,k)?c.thresholds[k]:g.capacity(c)*g.config.automation.saleRatio;
const inboundAmount=(game,c,resource)=>game.state.shipments.filter(s=>s.status==='transit'&&s.to===c.id&&s.resource===resource).reduce((n,s)=>n+s.amount,0);
function donorReserve(game,c,resource){return Math.max(supplyLimit(game,c,resource)||0,resource==='money'?100:Math.ceil(c.population*(game.config.needs[resource]||0)*2));}
export function sendSupply(game,from,to,resource,requested,now=Date.now()){
  const inbound=inboundAmount(game,to,resource);
  const room=resource==='money'?Infinity:Math.max(0,game.capacity(to)-(to.stock[resource]||0)-inbound);
  const amount=Math.min(requested,game.config.trade.maxAmount,Math.floor((from.stock[resource]||0)-donorReserve(game,from,resource)),Math.floor(room),Math.max(0,game.transportAvailable(from))*game.config.economy.unitsPerWorker*Math.max(1,game.config.transport.railLoadMultiplier,game.config.transport.airLoadMultiplier));
  let whole=Math.floor(amount);if(whole<1)return {sent:0,reason:'stock-workers-capacity'};
  try{
    const budget=()=>from.stock.money-(resource==='money'?whole:0)-(supplyLimit(game,from,'money')||0),workers=game.transportAvailable(from);
    let quote=game.transportQuote(from,to,resource,whole,budget(),workers);
    if(quote.workers>workers){whole=Math.min(whole,Math.floor(workers*quote.unitsPerWorker));if(whole<1)return {sent:0,reason:'workers'};quote=game.transportQuote(from,to,resource,whole,budget(),workers);}
    const fee=quote.fee;
    if(from.stock.money<fee+(resource==='money'?whole:0)+(supplyLimit(game,from,'money')||0))return {sent:0,reason:'funds'};
    const shipment=game.transport(from,to,resource,whole,from,now,quote);game.pay(from,{[resource]:whole});return {sent:whole,shipment:shipment.id};
  }catch{return {sent:0,reason:'route-workers'};}
}
export function requestSupply(game,c,cost,now=Date.now(),manual=false){
  if(!manual&&c.autoSupply===false)return false;let sent=false;
  for(const [resource,need] of Object.entries(cost)){
    let shortage=Math.max(0,Math.ceil(need-(c.stock[resource]||0)-inboundAmount(game,c,resource)));
    for(const from of game.state.cities.filter(v=>v.owner===c.owner&&v.id!==c.id&&!v.readyAt).sort((a,b)=>Math.abs(a.x-c.x)+Math.abs(a.y-c.y)-Math.abs(b.x-c.x)-Math.abs(b.y-c.y))){
      if(!shortage)break;const result=sendSupply(game,from,c,resource,shortage,now);shortage-=result.sent;sent ||= result.sent>0;
    }
  }return sent;
}
export function tickFeatures(game,now,dt){
  for(const c of game.state.cities.filter(c=>!c.readyAt)){
    c.transferRules=c.transferRules.filter(r=>game.state.cities.some(to=>to.id===r.to&&to.owner===c.owner));
    for(const rule of c.transferRules){
      if(now<rule.nextAt)continue;
      // Skip missed periods: never emit an offline/backlogged burst of shipments.
      rule.nextAt=now+game.config.rules.cycleSeconds*1000;
      const to=game.state.cities.find(to=>to.id===rule.to);
      if(to.readyAt){rule.status='target-building';rule.lastAmount=0;continue;}
      const result=sendSupply(game,c,to,rule.resource,rule.amount,now);
      rule.lastAt=now;rule.lastAmount=result.sent;rule.status=result.sent===rule.amount?'sent':result.sent?'partial':result.reason;
    }
  }
  for(const c of game.state.cities.filter(c=>!c.readyAt)){
    const targets=Object.fromEntries(Object.keys(c.stock).map(k=>[k,supplyLimit(game,c,k)]).filter(([k,value])=>value!==null&&c.stock[k]<value));
    requestSupply(game,c,targets,now);
    for(const k of Object.keys(game.config.prices)){const limit=saleLimit(game,c,k);if(limit===null)continue;const amount=Math.max(0,Math.floor(c.stock[k]-limit));if(amount){game.pay(c,{[k]:amount});game.credit(c,'money',Math.floor(amount*Math.round(game.config.prices[k]*game.config.economy.sellMultiplier*100)/100));game.state.shop.stock[k]=(game.state.shop.stock[k]||0)+amount;}}
  }
  for(const pending of [...game.state.pendingActions]){
    const c=game.state.cities.find(c=>c.id===pending.cityId);if(!c||c.owner!==pending.user.id){game.state.pendingActions=game.state.pendingActions.filter(p=>p.id!==pending.id);continue;}
    if(pending.cost&&Object.entries(pending.cost).some(([k,v])=>c.stock[k]<v)){requestSupply(game,c,pending.cost,now,true);continue;}
    if(!pending.cost&&game.state.shipments.some(s=>s.to===c.id&&s.status==='transit'))continue;
    game.state.pendingActions=game.state.pendingActions.filter(p=>p.id!==pending.id);
    const snapshot=structuredClone(game.state);try{game.coreAction(pending.user,pending.action,pending.params);game.log(`${c.name}：调配完成，已执行等待中的操作`,c.owner);}catch(error){game.state=snapshot;game.log(`${c.name}：等待操作已取消：${error.message}`,c.owner);}
  }
}
