import { RESOURCES } from '../shared/config.js';
import { priceCents } from '../shared/money.js';
export const SCHEMA_VERSION=2;
export function migrateState(state) {
  if((state.schemaVersion??1)>SCHEMA_VERSION)throw new Error('存档版本高于服务端版本，请升级服务端');
  const legacy=!state.schemaVersion||state.schemaVersion<2;
  state.world.minX??=0;state.world.minY??=0;state.world.revision??=1;
  state.messages??=[];state.pendingActions??=[];state.infiltrations??=[];state.rails??={};state.alliances??=[];state.profiles??={};
  if(!state.transportRulesVersion){const t=state.settings?.transport;if(t){for(const [key,old,value] of [['railBaseSeconds',3,2],['railSeconds',.25,.12],['railFeeMultiplier',.8,.2],['airBaseSeconds',2,7],['airSeconds',.1,.02],['airFeeMultiplier',2,.04]])if(t[key]===old)t[key]=value;}state.transportRulesVersion=1;}
  // Removed feature: release assigned workers exactly once, preserve paid historical costs.
  for(const i of state.infiltrations)if(i.status==='active'){const c=state.cities.find(c=>c.id===i.source);if(c)c.transportWorkers=Math.max(0,(c.transportWorkers||0)-(i.workers??4));}
  delete state.infiltrations;if(state.settings)delete state.settings.infiltration;
  for(const c of state.cities){
    for(const [k,v] of Object.entries(c.stock))if(!Object.hasOwn(RESOURCES,k)||!Number.isFinite(v)||v<0)throw new Error(`存档损坏：${c.name} 的 ${k} 库存无效；请从备份恢复`);
    for(const k of Object.keys(RESOURCES))c.stock[k]??=0;
    if(legacy){c.stock.clothing=c.stock.goods;c.stock.vegetables=c.stock.food*.3;c.stock.meatProducts=c.stock.meat*.3;}
    c.transportReserve??=state.settings?.rules?.defaultTransportReserve??4;
    c.constructionReserve??=state.settings?.rules?.defaultConstructionReserve??4;c.supplyThresholds??={};c.transferRules??=[];
    c.thresholds??={};c.policy.players??={};c.autoSupply??=true;
  }
  // Preserve exactly the currency locked under the old per-cycle rounding rule.
  for(const ct of state.contracts){ct.sellerOwner??=state.cities.find(c=>c.id===ct.seller)?.owner;ct.buyerOwner??=state.cities.find(c=>c.id===ct.buyer)?.owner;}
  for(const o of [...state.offers,...state.contracts]){o.priceCents??=priceCents(o.price);if(legacy){o.paymentPerCycle??=Math.ceil(o.amount*o.price);o.penaltyPerCycle??=Math.round(o.paymentPerCycle*.2*100)/100;}}
  state.featureVersion=3;state.schemaVersion=SCHEMA_VERSION;return state;
}
// Restore in place so simulation references remain valid after a rejected action.
export function restoreState(target,snapshot){
  if(Array.isArray(snapshot)){const byId=new Map(target.filter(v=>v&&typeof v==='object'&&v.id).map(v=>[v.id,v]));const values=snapshot.map((value,index)=>{const old=value?.id?byId.get(value.id):target[index];return value&&typeof value==='object'&&old&&typeof old==='object'?restoreState(old,value):structuredClone(value);});target.splice(0,target.length,...values);return target;}
  for(const key of Object.keys(target))if(!Object.hasOwn(snapshot,key))delete target[key];
  for(const [key,value]of Object.entries(snapshot))target[key]=value&&typeof value==='object'&&target[key]&&typeof target[key]==='object'&&Array.isArray(value)===Array.isArray(target[key])?restoreState(target[key],value):structuredClone(value);
  return target;
}
