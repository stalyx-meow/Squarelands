import { randomUUID } from 'node:crypto';
import { RESOURCES } from '../shared/config.js';
import { makeWorld, expandWorld } from './world.js';
import { migrateState, restoreState } from './state.js';
import { configured } from './settings.js';
import { payment, priceCents, orderPayment } from '../shared/money.js';
import { featureAction, requestSupply, tickFeatures, territoryCapacity, borderStats } from './features.js';
import { findRoute } from './routing.js';
const id = () => randomUUID();
const fail = message => { throw new Error(message); };
const round = n => Math.round(n * 100) / 100;
export function createState(seed,settings) { return { schemaVersion:2,world: makeWorld(seed,settings?.rules), cities: [], claims: {}, offers: [], contracts: [], shipments: [], events: [], shop: { refreshAt: 0, stock: {} }, paused: false, lastTick: Date.now() }; }
export class Game {
  constructor(state = createState()) { this.state = migrateState(state); this.state.settings=configured(state.settings); }
  get config(){return this.state.settings;}
  buildingCost(type,level=1){return Object.fromEntries(Object.entries(this.config.buildings[type].cost).map(([k,v])=>[k,Math.ceil(v*this.config.economy.buildingCostMultiplier**(level-1))]));}
  cityCost(level){return Object.fromEntries(Object.entries(this.config.rules.cityUpgradeCost??{money:450,wood:80,stone:90,iron:15}).map(([k,v])=>[k,v*level]));}
  inBounds(x,y){const {width,height,minX=0,minY=0}=this.state.world;return x>=minX&&y>=minY&&x<minX+width&&y<minY+height;}
  tile(x,y) { const {width,minX=0,minY=0}=this.state.world; return this.inBounds(x,y)?this.state.world.tiles[(y-minY)*width+x-minX]:undefined; }
  log(message, owner = null) { this.state.events.unshift({id:id(),time:Date.now(),message,owner}); this.state.events.length=Math.min(150,this.state.events.length); }
  city(user, cityId) { const c=this.state.cities.find(c=>c.id===cityId); if(!c || c.owner!==user.id) fail('找不到属于你的城市'); return c; }
  ready(c) { if(c.readyAt) fail('城市正在建设中'); }
  pay(c,cost){
    for(const [k,v] of Object.entries(cost))if(!Object.hasOwn(RESOURCES,k)||!Number.isFinite(v)||v<0||!Number.isFinite(c.stock[k]))fail('资源或金额无效');
    for(const [k,v] of Object.entries(cost))if(c.stock[k]<v){const error=new Error(`${RESOURCES[k][0]}不足（需要 ${v}）`);error.supply={cityId:c.id,cost};throw error;}
    for(const [k,v] of Object.entries(cost))c.stock[k]=round(c.stock[k]-v);
  }
  credit(c,resource,amount){if(!Object.hasOwn(RESOURCES,resource)||!Number.isFinite(amount)||amount<0||!Number.isFinite(c.stock[resource]))fail('资源或金额无效');const cap=resource==='money'?Infinity:this.capacity(c);const added=Math.max(0,Math.min(amount,cap-c.stock[resource]));c.stock[resource]=round(c.stock[resource]+added);return added;}
  capacity(c) { return this.config.rules.baseStorage+c.buildings.filter(b=>!b.readyAt&&b.type==='warehouse').reduce((s,b)=>s+this.config.buildings.warehouse.storage*b.level,0); }
  area(x,y,level) { const a=[]; for(let yy=y-level;yy<=y+level;yy++) for(let xx=x-level;xx<=x+level;xx++) if(this.inBounds(xx,yy)) a.push(`${xx},${yy}`); return a; }
  claim(c) { for(const key of this.area(c.x,c.y,c.level)) if(!this.state.claims[key]) this.state.claims[key]=c.id; }
  workers(c) { return Math.floor(c.population*this.config.rules.laborRatio); }
  demand(c) { return this.config.rules.civilWorkers*c.level + c.buildings.reduce((s,b)=>s+(b.readyAt?this.config.rules.constructionWorkers:this.config.buildings[b.type].workers*b.level),0); }
  available(c) { return this.workers(c)-this.demand(c)-(c.transportWorkers||0)-(c.upgradeAt?this.config.rules.constructionWorkers:0); }
  nearWater(x,y) { return [[x+1,y],[x-1,y],[x,y+1],[x,y-1]].some(([xx,yy])=>this.inBounds(xx,yy)&&['river','lake'].includes(this.tile(xx,yy)?.terrain)); }
  found(user, {x,y,name,sourceCityId}) {
    if(!Number.isInteger(x)||!Number.isInteger(y)||!this.inBounds(x,y)) fail('请选择有效地块');
    if(!['plain','hill','plateau'].includes(this.tile(x,y).terrain)) fail('城池只能建在平原、丘陵或高原');
    if(this.state.claims[`${x},${y}`]) fail('此地已属于其他城市');
    if(this.state.cities.some(c=>Math.max(Math.abs(c.x-x),Math.abs(c.y-y))<=2)) fail('城池之间至少间隔三个单元格');
    const owned=this.state.cities.filter(c=>c.owner===user.id);
    if(owned.length>=this.config.rules.maxCities) fail('城池数量已达到服务器上限');
    if(owned.length) { const source=this.city(user,sourceCityId); this.ready(source); if(this.available(source)<this.config.rules.foundingWorkers) fail('建立新城所需空闲工人不足'); this.pay(source,this.config.rules.foundingCost); source.transportWorkers=(source.transportWorkers||0)+this.config.rules.foundingWorkers; }
    const c={id:id(),owner:user.id,ownerName:user.username,name:String(name||'新城').trim().slice(0,18)||'新城',x,y,level:1,population:this.config.rules.startPopulation,comfort:65,education:0,stock:{...this.config.startStock},buildings:[],policy:{embargo:false,tariff:0},readyAt:Date.now()+this.config.rules.foundingSeconds*1000,rates:{},efficiency:1};
    if(owned.length) { c.stock={...this.config.colonyStock};c.foundingSource=sourceCityId;c.foundingWorkers=this.config.rules.foundingWorkers; }
    c.thresholds={};c.autoSupply=true;c.policy.players={};this.state.cities.push(c); this.claim(c);expandWorld(this.state.world,this.area(c.x,c.y,c.level).map(key=>{const [x,y]=key.split(',').map(Number);return {x,y};}),this.config.territory); this.log(`${user.username} 正在建立「${c.name}」`); return c.id;
  }
  build(user, {cityId,type,x,y}) {
    const c=this.city(user,cityId); this.ready(c); const def=Object.hasOwn(this.config.buildings,type)?this.config.buildings[type]:null; if(!def) fail('未知建筑');
    if(!Number.isInteger(x)||!Number.isInteger(y)||this.state.claims[`${x},${y}`]!==c.id) fail('建筑必须位于本城的势力范围');
    if(c.x===x&&c.y===y || c.buildings.some(b=>b.x===x&&b.y===y)) fail('该地块已有建筑');
    const tile=this.tile(x,y); if(['ocean','river','lake'].includes(tile.terrain)) fail('不能在水面建设');
    if(def.deposit&&tile.deposit!==def.deposit) fail(`此建筑需要${RESOURCES[def.deposit][0]}矿藏`);
    if(def.waterSource&&!this.nearWater(x,y)) fail('自来水厂必须紧邻河流或湖泊');
    if(this.available(c)<this.config.rules.constructionWorkers) fail('建造所需空闲工人不足');
    this.pay(c,this.buildingCost(type)); c.buildings.push({id:id(),type,x,y,level:1,readyAt:Date.now()+def.time*1000}); this.log(`${c.name}：开始建造${def.name}`,user.id);
  }
  upgrade(user, {cityId,buildingId}) {
    const c=this.city(user,cityId); this.ready(c);
    if(buildingId) {
      const b=c.buildings.find(b=>b.id===buildingId); if(!b) fail('建筑不存在'); if(b.readyAt) fail('建筑正在施工'); if(b.level>=this.config.rules.maxBuildingLevel) fail('已达到最高等级');
      if(this.available(c)<this.config.rules.constructionWorkers) fail('升级所需空闲工人不足');
      this.pay(c,this.buildingCost(b.type,b.level+1)); b.readyAt=Date.now()+this.config.buildings[b.type].time*(b.level+1)*1000; b.upgrading=true;
    } else {
      if(c.upgradeAt) fail('城池正在升级'); if(c.level>=this.config.rules.maxCityLevel) fail('已达到最高等级');
      if(this.available(c)<this.config.rules.constructionWorkers) fail('需满足全部岗位并留出足够施工工人');
      this.pay(c,this.cityCost(c.level)); c.upgradeAt=Date.now()+30000*c.level;
    }
  }
  demolish(user,{cityId,buildingId}) { const c=this.city(user,cityId); const b=c.buildings.find(b=>b.id===buildingId); if(!b) fail('建筑不存在'); for(const [k,v] of Object.entries(this.buildingCost(b.type,b.level))) this.credit(c,k,v*this.config.economy.demolishRefund); c.buildings=c.buildings.filter(v=>v.id!==b.id); this.log(`${c.name}：拆除${this.config.buildings[b.type].name}，返还 30% 材料`,user.id); }
  route(from,to){return findRoute(this,from,to);}
  transport(from,to,resource,amount,payer,now=Date.now()) {
    if(from.id===to.id) fail('请选择另一座城市'); this.ready(from);this.ready(to);
    const route=this.route(from,to), workers=Math.max(1,Math.ceil(amount/this.config.economy.unitsPerWorker));
    if(this.available(payer)<workers) fail(`运输需要 ${workers} 名空闲工人`);
    const tariffs=Object.entries(route.tolls).map(([cityId,rate])=>({cityId,fee:Math.ceil(amount*(this.config.prices[resource]??1)*rate/100)}));
    const fee=Math.ceil(route.distance*this.config.economy.freightDistance+amount*this.config.economy.freightAmount)+tariffs.reduce((s,t)=>s+t.fee,0);
    this.pay(payer,{money:fee}); for(const t of tariffs) {const c=this.state.cities.find(c=>c.id===t.cityId); if(c)this.credit(c,'money',t.fee);}
    payer.transportWorkers=(payer.transportWorkers||0)+workers;
    const shipment={id:id(),from:from.id,to:to.id,owner:payer.owner,payer:payer.id,resource,amount,workers,fee,path:route.path,departAt:now,arriveAt:now+Math.max(1,Math.ceil(this.config.economy.freightBaseSeconds+route.distance*this.config.economy.freightSeconds))*1000,status:'transit'};
    this.state.shipments.push(shipment); return shipment;
  }
  amount(n) { if(!Number.isFinite(n)||n<1||n>this.config.trade.maxAmount||!Number.isInteger(n)) fail('数量须为服务器范围内的正整数'); }
  action(user,action,p={}) {
    const snapshot=structuredClone(this.state);
    try{return this.coreAction(user,action,p);}catch(error){if(error.supply){const before=snapshot.cities.find(c=>c.id===error.supply.cityId),after=this.state.cities.find(c=>c.id===error.supply.cityId);if(before&&after)error.supply.cost=Object.fromEntries(Object.entries(error.supply.cost).map(([k,v])=>[k,v+Math.max(0,before.stock[k]-after.stock[k])]));}restoreState(this.state,snapshot);
      if(error.supply&&!this.state.paused&&!this.state.pendingActions.some(a=>a.cityId===error.supply.cityId)){
        const c=this.city(user,error.supply.cityId);
        if(requestSupply(this,c,error.supply.cost)){
          this.state.pendingActions.push({id:id(),cityId:c.id,user:{id:user.id,username:user.username,role:user.role},action,params:p,createdAt:Date.now()});
          this.log(`${c.name}：库存不足，已自动发车调配，抵达后执行操作`,user.id);return {pending:true};
        }
      }
      restoreState(this.state,snapshot);throw error;
    }
  }
  coreAction(user, action, p = {}) {
    if(this.state.paused && user.role!=='root') fail('世界已暂停，请等待管理员恢复');
    if(featureAction(this,user,action,p))return;
    if(action==='found') return this.found(user,p);
    if(action==='build') return this.build(user,p);
    if(action==='upgrade') return this.upgrade(user,p);
    if(action==='demolish') return this.demolish(user,p);
    const c=this.city(user,p.cityId); this.ready(c);
    if(action==='policy') { if(!Number.isFinite(p.tariff)||p.tariff<0||p.tariff>this.config.trade.maxTariff)fail('税率超出服务器允许范围'); const policy={embargo:!!p.embargo,tariff:Math.round(p.tariff)};if(p.playerId){if(typeof p.playerId!=='string'||!p.policyPlayer)fail('目标玩家不存在');c.policy.players??={};if(p.remove)delete c.policy.players[p.playerId];else c.policy.players[p.playerId]=policy;}else Object.assign(c.policy,policy);return; }
    if(action==='shop') { this.amount(p.amount); if(typeof p.resource!=='string'||!Object.hasOwn(this.config.prices,p.resource))fail('未知物资'); if(!['buy','sell'].includes(p.side))fail('无效交易方向'); const price=this.config.prices[p.resource]*(p.side==='buy'?this.config.economy.buyMultiplier:this.config.economy.sellMultiplier); if(p.side==='buy'){if(this.state.shop.stock[p.resource]<p.amount)fail('商城本周期库存不足'); if(c.stock[p.resource]+p.amount>this.capacity(c))fail('仓储空间不足'); this.pay(c,{money:payment(p.amount,priceCents(price))}); this.credit(c,p.resource,p.amount); this.state.shop.stock[p.resource]-=p.amount;}else{this.pay(c,{[p.resource]:p.amount});this.credit(c,'money',Math.floor(p.amount*priceCents(price)/100));this.state.shop.stock[p.resource]+=p.amount;} return; }
    if(action==='transfer') { this.amount(p.amount); if(p.resource!=='money'&&(typeof p.resource!=='string'||!Object.hasOwn(this.config.prices,p.resource)))fail('未知物资'); const to=this.city(user,p.to); if(c.stock[p.resource]<p.amount)fail('物资不足'); this.pay(c,{[p.resource]:p.amount});const shipment=this.transport(c,to,p.resource,p.amount,c);return shipment; }
    if(action==='offer') { this.amount(p.amount); if(typeof p.resource!=='string'||!Object.hasOwn(this.config.prices,p.resource))fail('未知物资'); if(!Number.isFinite(p.price)||p.price<this.config.trade.minUnitPrice||p.price>this.config.trade.maxUnitPrice)fail('单价超出服务器允许范围'); if(!['spot','capacity'].includes(p.kind))fail('未知订单类型'); if(this.state.offers.filter(o=>o.owner===user.id&&o.status==='open').length>=this.config.trade.maxOffers)fail('在售挂单数量已达上限');
      const cycles=p.kind==='capacity'?Number(p.cycles):1; if(!Number.isInteger(cycles)||cycles<1||cycles>this.config.trade.maxCycles)fail('合约期数超出服务器允许范围');
      const cents=priceCents(p.price),price=cents/100,perCycle=payment(p.amount,cents),collateral=p.kind==='capacity'?Math.ceil(perCycle*cycles*this.config.economy.collateralRate):0; this.pay(c,p.kind==='spot'?{[p.resource]:p.amount}:{money:collateral});
      this.state.offers.push({id:id(),owner:user.id,seller:user.username,cityId:c.id,resource:p.resource,amount:p.amount,price,priceCents:cents,paymentPerCycle:perCycle,penaltyPerCycle:Math.ceil(perCycle*this.config.economy.collateralRate),kind:p.kind,cycles,collateral,status:'open',createdAt:Date.now()});return; }
    if(action==='cancelOffer') { const o=this.state.offers.find(o=>o.id===p.offerId&&o.cityId===c.id&&o.status==='open');if(!o)fail('挂单不可撤销'); this.credit(c,o.kind==='spot'?o.resource:'money',o.kind==='spot'?o.amount:o.collateral);o.status='cancelled';return; }
    if(action==='buyOffer') {
      const o=this.state.offers.find(o=>o.id===p.offerId&&o.status==='open');if(!o)fail('挂单已被成交或撤回');if(o.owner===user.id)fail('不能购买自己的挂单'); const from=this.state.cities.find(c=>c.id===o.cityId);this.ready(from);
      if(o.kind==='capacity'&&this.state.contracts.filter(ct=>ct.status==='active'&&(ct.sellerOwner===user.id||ct.buyerOwner===user.id)).length>=this.config.trade.maxContracts)fail('活跃产能合约数量已达上限');if(o.kind==='capacity'&&this.state.contracts.filter(ct=>ct.status==='active'&&(ct.sellerOwner===from.owner||ct.buyerOwner===from.owner)).length>=this.config.trade.maxContracts)fail('卖家活跃合约已达上限');const total=orderPayment(o)*o.cycles;
      if(o.kind==='spot') { // Roll back all game state on action errors in the HTTP layer.
        this.pay(c,{money:total}); const shipment=this.transport(from,c,o.resource,o.amount,c); this.credit(from,'money',total); o.shipmentId=shipment.id;
      } else { this.pay(c,{money:total}); this.state.contracts.push({id:id(),offerId:o.id,seller:from.id,buyer:c.id,resource:o.resource,amount:o.amount,price:o.price,priceCents:o.priceCents,paymentPerCycle:orderPayment(o),penaltyPerCycle:o.penaltyPerCycle??Math.ceil(orderPayment(o)*this.config.economy.collateralRate),sellerOwner:from.owner,buyerOwner:c.owner,remaining:o.cycles,totalCycles:o.cycles,escrow:total,collateral:o.collateral,nextAt:Date.now()+this.config.rules.cycleSeconds*1000,status:'active',delivered:0,defaults:0}); }
      o.status='sold';this.log(`${user.username} 与 ${o.seller} 达成${o.kind==='spot'?'现货':'产能'}交易`); return;
    }
    fail('未知操作');
  }
  shiftTime(milliseconds) {
    if(milliseconds<=0)return;
    for(const c of this.state.cities){if(c.readyAt)c.readyAt+=milliseconds;if(c.upgradeAt)c.upgradeAt+=milliseconds;for(const b of c.buildings)if(b.readyAt)b.readyAt+=milliseconds;}
    for(const sh of this.state.shipments)if(sh.status==='transit'){sh.departAt+=milliseconds;sh.arriveAt+=milliseconds;}
    for(const ct of this.state.contracts)if(ct.status==='active')ct.nextAt+=milliseconds;
    for(const i of this.state.infiltrations){i.startedAt+=milliseconds;if(i.finishedAt)i.finishedAt+=milliseconds;}
    if(this.state.shop.refreshAt)this.state.shop.refreshAt+=milliseconds;
  }
  tick(now=Date.now()) {
    const s=this.state; if(s.paused){this.shiftTime(Math.max(0,now-s.lastTick));s.lastTick=now;return;}
    // Cap offline catch-up: the simulation resumes from its saved clock without an offline windfall.
    const elapsed=Math.max(0,Math.min(10,(now-s.lastTick)/1000)), dt=elapsed/this.config.rules.cycleSeconds; s.lastTick=now;const openingStocks=new Map(s.cities.map(c=>[c.id,{...c.stock}]));
    if(now>=s.shop.refreshAt){s.shop={refreshAt:now+this.config.rules.shopSeconds*1000,stock:Object.fromEntries(Object.keys(this.config.prices).map(k=>[k,this.config.rules.shopStock]))};}
    // Resolve simultaneous tick completions by their actual completion time.
    for(const c of s.cities.filter(c=>c.upgradeAt&&now>=c.upgradeAt).sort((a,b)=>a.upgradeAt-b.upgradeAt)){
      c.level++;c.upgradeAt=null;this.log(`${c.name} 升至 ${c.level} 级，领地容量增加，请手动解锁地块`,c.owner);
    }
    for(const c of s.cities){
      if(c.readyAt){if(now>=c.readyAt){c.readyAt=null;if(c.foundingSource){const source=s.cities.find(v=>v.id===c.foundingSource);if(source)source.transportWorkers=Math.max(0,(source.transportWorkers||0)-(c.foundingWorkers??this.config.rules.foundingWorkers));delete c.foundingSource;}this.log(`「${c.name}」建成`,c.owner);}else continue;}
      for(const b of c.buildings)if(b.readyAt&&now>=b.readyAt){b.readyAt=null;if(b.upgrading){b.level++;b.upgrading=false;}this.log(`${c.name}：${this.config.buildings[b.type].name}施工完成`,c.owner);}
      const needs=Object.fromEntries(Object.entries(this.config.needs).map(([k,v])=>[k,c.population*v*2]));for(const b of c.buildings.filter(b=>!b.readyAt)){const def=this.config.buildings[b.type];for(const [k,v]of Object.entries({...def.input,power:def.power||0}))needs[k]=(needs[k]||0)+v*b.level*2;}requestSupply(this,c,needs,now);
      const before={...c.stock}, labor=Math.min(1,Math.max(0,(this.workers(c)-(c.transportWorkers||0)-(c.upgradeAt?this.config.rules.constructionWorkers:0)) / Math.max(1,this.demand(c))));c.efficiency=labor;
      const active=c.buildings.filter(b=>!b.readyAt).sort((a,b)=>Number(!!this.config.buildings[b.type].output.power)-Number(!!this.config.buildings[a.type].output.power));
      let comfort=this.config.economy.baseComfort,education=0,housing=this.config.economy.housing;
      for(const b of active){const def=this.config.buildings[b.type];let scale=b.level*labor;const tile=this.tile(b.x,b.y);scale*=this.config.terrains[tile.terrain].bonus[b.type==='vegetableFarm'?'farm':b.type]||(def.mine?this.config.terrains[tile.terrain].bonus.mine:1)||1;if(['farm','vegetableFarm'].includes(b.type)&&this.nearWater(b.x,b.y))scale*=1+this.config.economy.waterFarmBonus;
        const input={...def.input};if(def.power)input.power=def.power;
        for(const [k,v]of Object.entries(input))if(v*scale*dt>0)scale=Math.min(scale,(c.stock[k]||0)/(v*dt));
        for(const [k,v]of Object.entries(input))c.stock[k]=round(Math.max(0,(c.stock[k]||0)-v*scale*dt));
        for(const [k,v]of Object.entries(def.output))this.credit(c,k,v*scale*dt);
        const operation=b.level?scale/b.level:0;comfort+=(def.comfort||0)*b.level*Math.min(1,operation);education+=(def.education||0)*b.level*Math.min(1,operation);housing+=(def.housing||0)*b.level;
      }
      for(const [k,rate]of Object.entries(this.config.needs)){const need=c.population*rate*dt,available=c.stock[k]||0;if(need>0&&available<need)comfort-=this.config.economy.shortagePenalty*(1-available/need);c.stock[k]=round(Math.max(0,available-need));}
      const meatNeed=c.population*this.config.economy.meatRate*dt,meat=Math.min(c.stock.meat,meatNeed);c.stock.meat=round(c.stock.meat-meat);if(meatNeed>0)comfort+=this.config.economy.meatComfort*meat/meatNeed;
      comfort-=Math.max(0,c.population-housing)*this.config.economy.overcrowdingPenalty; c.comfort=round(Math.max(0,Math.min(100,comfort)));c.education=round(education);c.housing=housing;
      const growth=c.comfort>=this.config.economy.comfortGrowth&&c.population<housing?Math.min(housing-c.population,c.population*this.config.economy.growthRate*(c.comfort/70)*dt):c.comfort<this.config.economy.comfortDecline?-c.population*this.config.economy.declineRate*((this.config.economy.comfortDecline-c.comfort)/this.config.economy.comfortDecline)*dt:0;
      c.population=Math.max(this.config.rules.minPopulation,round(c.population+growth));this.credit(c,'money',c.population*(this.config.economy.taxRate+Math.min(education,5)*this.config.economy.educationTax)*dt);
      c.rates=Object.fromEntries(Object.keys(RESOURCES).map(k=>[k,dt?round(((c.stock[k]||0)-(before[k]||0))/dt):0]));
    }
    for(const sh of s.shipments)if(sh.status==='transit'&&now>=sh.arriveAt){const to=s.cities.find(c=>c.id===sh.to),payer=s.cities.find(c=>c.id===sh.payer);const added=to?this.credit(to,sh.resource,sh.amount):0;sh.status='arrived';sh.received=added;if(payer)payer.transportWorkers=Math.max(0,(payer.transportWorkers||0)-sh.workers);this.log(`运输抵达${to?.name||'目的地'}：${RESOURCES[sh.resource][0]} ${added}${added<sh.amount?'（超出仓储部分损耗）':''}`,to?.owner);}
    for(const ct of s.contracts)if(ct.status==='active'&&now>=ct.nextAt){const from=s.cities.find(c=>c.id===ct.seller),to=s.cities.find(c=>c.id===ct.buyer),payment=Math.min(ct.escrow,orderPayment(ct));let delivered=false;
      if(from&&to&&(from.stock[ct.resource]||0)>=ct.amount){try{this.transport(from,to,ct.resource,ct.amount,from,now);this.pay(from,{[ct.resource]:ct.amount});this.credit(from,'money',payment);delivered=true;}catch { // transport validates before deducting any costs
        // Keep failure local: transport's only failure points precede its mutation.
      }}
      ct.escrow=round(ct.escrow-payment);ct.remaining--;if(delivered){ct.delivered++;}else{ct.defaults++;const penalty=Math.min(ct.collateral,ct.penaltyPerCycle??round(orderPayment(ct)*this.config.economy.collateralRate));ct.collateral=round(ct.collateral-penalty);if(to)this.credit(to,'money',payment+penalty);this.log('产能合约违约：退回本期货款并赔付保证金',from?.owner);}
      ct.nextAt=now+this.config.rules.cycleSeconds*1000;if(!ct.remaining){ct.status='completed';if(from)this.credit(from,'money',ct.collateral);ct.collateral=0;}
    }
    tickFeatures(this,now,dt);
    this.state.contracts=this.state.contracts.filter((ct,i,a)=>ct.status==='active'||i>=a.length-this.config.trade.history);
    for(const c of this.state.cities){const before=openingStocks.get(c.id)||c.stock;c.rates=Object.fromEntries(Object.keys(RESOURCES).map(k=>[k,dt?round((c.stock[k]-before[k])/dt):0]));}
    // Bound historical records while retaining active operations.
    this.state.shipments=this.state.shipments.filter((sh,i,a)=>sh.status==='transit'||i>=a.length-this.config.trade.history);
    this.state.offers=this.state.offers.filter((o,i,a)=>o.status==='open'||i>=a.length-this.config.trade.history);
  }
  view(user,worldToken) {
    return { settings:this.config,players:[],pendingActions:this.state.pendingActions.filter(p=>p.user.id===user.id),messages:this.state.messages.filter(m=>!m.to||m.to===user.id||m.from===user.id).slice(-100),infiltrations:this.state.infiltrations.filter(i=>i.owner===user.id||this.state.cities.some(c=>c.id===i.target&&c.owner===user.id)),world:worldToken===`${this.state.world.seed}:${this.state.world.revision}`?{...this.state.world,tiles:undefined}:this.state.world,claims:this.state.claims,paused:this.state.paused,serverTime:Date.now(),shop:this.state.shop,
      cities:this.state.cities.map(c=>c.owner===user.id||user.role==='root'?{...c,territoryCapacity:territoryCapacity(c),territoryUsed:Object.values(this.state.claims).filter(v=>v===c.id).length,capacity:this.capacity(c),workers:this.workers(c),workerDemand:this.demand(c)}:{id:c.id,owner:c.owner,ownerName:c.ownerName,name:c.name,x:c.x,y:c.y,level:c.level,population:c.population,policy:c.policy,salePrice:c.salePrice,infiltration: this.state.cities.filter(a=>a.owner===user.id).map(a=>({source:a.id,...borderStats(this,c,a)})),readyAt:c.readyAt,buildings:c.buildings.map(({id,type,x,y,level,readyAt})=>({id,type,x,y,level,readyAt}))}),
      offers:this.state.offers.filter(o=>o.status==='open'),contracts:this.state.contracts.filter(ct=>user.role==='root'||ct.sellerOwner===user.id||ct.buyerOwner===user.id),
      shipments:this.state.shipments.filter(sh=>user.role==='root'||sh.owner===user.id||this.state.cities.some(c=>c.id===sh.to&&c.owner===user.id)),events:this.state.events.filter(e=>!e.owner||e.owner===user.id||user.role==='root').slice(0,40) };
  }
}
