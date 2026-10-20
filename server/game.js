import { randomUUID } from 'node:crypto';
import { BUILDINGS, RESOURCES, RULES, START_STOCK, PRICES, TERRAINS, buildingCost, cityCost } from '../shared/config.js';
import { makeWorld } from './world.js';
const id = () => randomUUID();
const fail = message => { throw new Error(message); };
const round = n => Math.round(n * 100) / 100;
export function createState(seed) { return { world: makeWorld(seed), cities: [], claims: {}, offers: [], contracts: [], shipments: [], events: [], shop: { refreshAt: 0, stock: {} }, paused: false, lastTick: Date.now() }; }
export class Game {
  constructor(state = createState()) { this.state = state; }
  tile(x,y) { return this.state.world.tiles[y*this.state.world.width+x]; }
  log(message, owner = null) { this.state.events.unshift({id:id(),time:Date.now(),message,owner}); this.state.events.length=Math.min(150,this.state.events.length); }
  city(user, cityId) { const c=this.state.cities.find(c=>c.id===cityId); if(!c || c.owner!==user.id) fail('找不到属于你的城市'); return c; }
  ready(c) { if(c.readyAt) fail('城市正在建设中'); }
  pay(c, cost) { for(const [k,v] of Object.entries(cost)) if((c.stock[k]||0)<v) fail(`${RESOURCES[k][0]}不足（需要 ${v}）`); for(const [k,v] of Object.entries(cost)) c.stock[k]=round(c.stock[k]-v); }
  credit(c, resource, amount) { const cap=resource==='money'?Infinity:this.capacity(c); const added=Math.max(0,Math.min(amount,cap-(c.stock[resource]||0))); c.stock[resource]=round((c.stock[resource]||0)+added); return added; }
  capacity(c) { return RULES.baseStorage+c.buildings.filter(b=>!b.readyAt&&b.type==='warehouse').reduce((s,b)=>s+BUILDINGS.warehouse.storage*b.level,0); }
  area(x,y,level) { const a=[]; for(let yy=y-level;yy<=y+level;yy++) for(let xx=x-level;xx<=x+level;xx++) if(xx>=0&&yy>=0&&xx<this.state.world.width&&yy<this.state.world.height) a.push(`${xx},${yy}`); return a; }
  claim(c) { for(const key of this.area(c.x,c.y,c.level)) if(!this.state.claims[key]) this.state.claims[key]=c.id; }
  workers(c) { return Math.floor(c.population*.62); }
  demand(c) { return 4*c.level + c.buildings.reduce((s,b)=>s+(b.readyAt?4:BUILDINGS[b.type].workers*b.level),0); }
  available(c) { return this.workers(c)-this.demand(c)-(c.transportWorkers||0)-(c.upgradeAt?4:0); }
  nearWater(x,y) { return [[x+1,y],[x-1,y],[x,y+1],[x,y-1]].some(([xx,yy])=>xx>=0&&yy>=0&&xx<this.state.world.width&&yy<this.state.world.height&&['river','lake'].includes(this.tile(xx,yy)?.terrain)); }
  found(user, {x,y,name,sourceCityId}) {
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=this.state.world.width||y>=this.state.world.height) fail('请选择有效地块');
    if(!['plain','hill','plateau'].includes(this.tile(x,y).terrain)) fail('城池只能建在平原、丘陵或高原');
    if(this.state.claims[`${x},${y}`]) fail('此地已属于其他城市');
    if(this.state.cities.some(c=>Math.max(Math.abs(c.x-x),Math.abs(c.y-y))<=2)) fail('城池之间至少间隔三个单元格');
    const owned=this.state.cities.filter(c=>c.owner===user.id);
    if(owned.length>=5) fail('每位玩家最多建立五座城市');
    if(owned.length) { const source=this.city(user,sourceCityId); this.ready(source); if(this.available(source)<8) fail('建立新城需要 8 名空闲工人'); this.pay(source,RULES.foundingCost); source.transportWorkers=(source.transportWorkers||0)+8; }
    const c={id:id(),owner:user.id,ownerName:user.username,name:String(name||'新城').trim().slice(0,18)||'新城',x,y,level:1,population:80,comfort:65,education:0,stock:{...START_STOCK},buildings:[],policy:{embargo:false,tariff:0},readyAt:Date.now()+RULES.foundingSeconds*1000,rates:{},efficiency:1};
    if(owned.length) { c.stock={...START_STOCK,money:400,wood:80,stone:70,iron:10,coal:20,copper:0};c.foundingSource=sourceCityId; }
    this.state.cities.push(c); this.claim(c); this.log(`${user.username} 正在建立「${c.name}」`); return c.id;
  }
  build(user, {cityId,type,x,y}) {
    const c=this.city(user,cityId); this.ready(c); const def=BUILDINGS[type]; if(!def) fail('未知建筑');
    if(!Number.isInteger(x)||!Number.isInteger(y)||this.state.claims[`${x},${y}`]!==c.id) fail('建筑必须位于本城的势力范围');
    if(c.x===x&&c.y===y || c.buildings.some(b=>b.x===x&&b.y===y)) fail('该地块已有建筑');
    const tile=this.tile(x,y); if(['ocean','river','lake'].includes(tile.terrain)) fail('不能在水面建设');
    if(def.deposit&&tile.deposit!==def.deposit) fail(`此建筑需要${RESOURCES[def.deposit][0]}矿藏`);
    if(def.waterSource&&!this.nearWater(x,y)) fail('自来水厂必须紧邻河流或湖泊');
    if(this.available(c)<4) fail('建造需要 4 名空闲建筑工人');
    this.pay(c,buildingCost(type)); c.buildings.push({id:id(),type,x,y,level:1,readyAt:Date.now()+def.time*1000}); this.log(`${c.name}：开始建造${def.name}`,user.id);
  }
  upgrade(user, {cityId,buildingId}) {
    const c=this.city(user,cityId); this.ready(c);
    if(buildingId) {
      const b=c.buildings.find(b=>b.id===buildingId); if(!b) fail('建筑不存在'); if(b.readyAt) fail('建筑正在施工'); if(b.level>=RULES.maxBuildingLevel) fail('已达到最高等级');
      if(this.available(c)<4) fail('升级需要 4 名空闲建筑工人');
      this.pay(c,buildingCost(b.type,b.level+1)); b.readyAt=Date.now()+BUILDINGS[b.type].time*(b.level+1)*1000; b.upgrading=true;
    } else {
      if(c.upgradeAt) fail('城池正在升级'); if(c.level>=RULES.maxCityLevel) fail('已达到最高等级');
      if(this.available(c)<4) fail('工作人员不足，需满足全部岗位并留出 4 名建筑工人');
      this.pay(c,cityCost(c.level)); c.upgradeAt=Date.now()+30000*c.level;
    }
  }
  demolish(user,{cityId,buildingId}) { const c=this.city(user,cityId); const b=c.buildings.find(b=>b.id===buildingId); if(!b) fail('建筑不存在'); for(const [k,v] of Object.entries(buildingCost(b.type,b.level))) this.credit(c,k,v*.3); c.buildings=c.buildings.filter(v=>v.id!==b.id); this.log(`${c.name}：拆除${BUILDINGS[b.type].name}，返还 30% 材料`,user.id); }
  route(from,to) {
    // Dijkstra on the square grid. Foreign embargoes remove tiles from the graph.
    const {width,height}=this.state.world, size=width*height, dist=new Float64Array(size).fill(Infinity), prev=new Int32Array(size).fill(-1), visited=new Uint8Array(size);
    const start=from.y*width+from.x, end=to.y*width+to.x; dist[start]=0;
    for(let i=0;i<size;i++) { let u=-1,best=Infinity; for(let j=0;j<size;j++) if(!visited[j]&&dist[j]<best){u=j;best=dist[j];} if(u<0||u===end)break; visited[u]=1;
      const x=u%width,y=Math.floor(u/width);
      for(const [xx,yy] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) { if(xx<0||yy<0||xx>=width||yy>=height)continue; const v=yy*width+xx, claim=this.state.cities.find(c=>c.id===this.state.claims[`${xx},${yy}`]); const foreign=claim&&claim.owner!==from.owner&&claim.owner!==to.owner; if(foreign&&claim.policy.embargo)continue; const cost=TERRAINS[this.tile(xx,yy).terrain].cost+(foreign?claim.policy.tariff*.1:0); if(best+cost<dist[v]){dist[v]=best+cost;prev[v]=u;} }
    }
    if(!Number.isFinite(dist[end])) fail('运输路线被禁运封锁');
    const path=[]; let u=end; while(u>=0){path.push({x:u%width,y:Math.floor(u/width)}); if(u===start)break;u=prev[u];} path.reverse();
    const tolls={}; for(const p of path){const c=this.state.cities.find(c=>c.id===this.state.claims[`${p.x},${p.y}`]); if(c&&c.owner!==from.owner&&c.owner!==to.owner) tolls[c.id]=c.policy.tariff;}
    return {path,distance:round(dist[end]),tolls};
  }
  transport(from,to,resource,amount,payer,now=Date.now()) {
    if(from.id===to.id) fail('请选择另一座城市'); this.ready(from);this.ready(to);
    const route=this.route(from,to), workers=Math.max(1,Math.ceil(amount/50));
    if(this.available(payer)<workers) fail(`运输需要 ${workers} 名空闲工人`);
    const tariffs=Object.entries(route.tolls).map(([cityId,rate])=>({cityId,fee:Math.ceil(amount*PRICES[resource]*rate/100)}));
    const fee=Math.ceil(route.distance*.25+amount*.03)+tariffs.reduce((s,t)=>s+t.fee,0);
    this.pay(payer,{money:fee}); for(const t of tariffs) {const c=this.state.cities.find(c=>c.id===t.cityId); if(c)this.credit(c,'money',t.fee);}
    payer.transportWorkers=(payer.transportWorkers||0)+workers;
    const shipment={id:id(),from:from.id,to:to.id,owner:payer.owner,payer:payer.id,resource,amount,workers,fee,path:route.path,departAt:now,arriveAt:now+Math.ceil(8+route.distance*1.2)*1000,status:'transit'};
    this.state.shipments.push(shipment); return shipment;
  }
  amount(n) { if(!Number.isFinite(n)||n<1||n>10000||!Number.isInteger(n)) fail('数量须为 1–10000 的整数'); }
  action(user, action, p = {}) {
    if(this.state.paused && user.role!=='root') fail('世界已暂停，请等待管理员恢复');
    if(action==='found') return this.found(user,p);
    if(action==='build') return this.build(user,p);
    if(action==='upgrade') return this.upgrade(user,p);
    if(action==='demolish') return this.demolish(user,p);
    const c=this.city(user,p.cityId); this.ready(c);
    if(action==='policy') { if(!Number.isFinite(p.tariff)||p.tariff<0||p.tariff>30)fail('关税范围为 0–30%'); c.policy={embargo:!!p.embargo,tariff:Math.round(p.tariff)}; return; }
    if(action==='shop') { this.amount(p.amount); if(!PRICES[p.resource])fail('未知物资'); if(!['buy','sell'].includes(p.side))fail('无效交易方向'); const price=PRICES[p.resource]*(p.side==='buy'?1.2:.75); if(p.side==='buy'){if(this.state.shop.stock[p.resource]<p.amount)fail('商城本周期库存不足'); if(c.stock[p.resource]+p.amount>this.capacity(c))fail('仓储空间不足'); this.pay(c,{money:Math.ceil(price*p.amount)}); this.credit(c,p.resource,p.amount); this.state.shop.stock[p.resource]-=p.amount;}else{this.pay(c,{[p.resource]:p.amount});this.credit(c,'money',Math.floor(price*p.amount));this.state.shop.stock[p.resource]+=p.amount;} return; }
    if(action==='transfer') { this.amount(p.amount); if(!PRICES[p.resource])fail('未知物资'); const to=this.city(user,p.to); if(c.stock[p.resource]<p.amount)fail('物资不足'); const shipment=this.transport(c,to,p.resource,p.amount,c); this.pay(c,{[p.resource]:p.amount});return shipment; }
    if(action==='offer') { this.amount(p.amount); if(!PRICES[p.resource])fail('未知物资'); if(!Number.isFinite(p.price)||p.price<.1||p.price>10000)fail('单价范围为 0.1–10000'); if(!['spot','capacity'].includes(p.kind))fail('未知订单类型'); if(this.state.offers.filter(o=>o.owner===user.id&&o.status==='open').length>=20)fail('最多发布 20 个挂单');
      const cycles=p.kind==='capacity'?Number(p.cycles):1; if(!Number.isInteger(cycles)||cycles<1||cycles>20)fail('合约周期须为 1–20');
      const price=round(p.price),collateral=p.kind==='capacity'?Math.ceil(Math.ceil(p.amount*price)*cycles*.2):0; this.pay(c,p.kind==='spot'?{[p.resource]:p.amount}:{money:collateral});
      this.state.offers.push({id:id(),owner:user.id,seller:user.username,cityId:c.id,resource:p.resource,amount:p.amount,price,kind:p.kind,cycles,collateral,status:'open',createdAt:Date.now()});return; }
    if(action==='cancelOffer') { const o=this.state.offers.find(o=>o.id===p.offerId&&o.cityId===c.id&&o.status==='open');if(!o)fail('挂单不可撤销'); this.credit(c,o.kind==='spot'?o.resource:'money',o.kind==='spot'?o.amount:o.collateral);o.status='cancelled';return; }
    if(action==='buyOffer') {
      const o=this.state.offers.find(o=>o.id===p.offerId&&o.status==='open');if(!o)fail('挂单已被成交或撤回');if(o.owner===user.id)fail('不能购买自己的挂单'); const from=this.state.cities.find(c=>c.id===o.cityId);this.ready(from);
      const total=Math.ceil(o.amount*o.price)*o.cycles; if(c.stock.money<total)fail('资金不足');
      if(o.kind==='spot') { // Roll back all game state on action errors in the HTTP layer.
        this.pay(c,{money:total}); const shipment=this.transport(from,c,o.resource,o.amount,c); this.credit(from,'money',total); o.shipmentId=shipment.id;
      } else { this.pay(c,{money:total}); this.state.contracts.push({id:id(),offerId:o.id,seller:from.id,buyer:c.id,resource:o.resource,amount:o.amount,price:o.price,remaining:o.cycles,totalCycles:o.cycles,escrow:total,collateral:o.collateral,nextAt:Date.now()+RULES.cycleSeconds*1000,status:'active',delivered:0,defaults:0}); }
      o.status='sold';this.log(`${user.username} 与 ${o.seller} 达成${o.kind==='spot'?'现货':'产能'}交易`); return;
    }
    fail('未知操作');
  }
  shiftTime(milliseconds) {
    if(milliseconds<=0)return;
    for(const c of this.state.cities){if(c.readyAt)c.readyAt+=milliseconds;if(c.upgradeAt)c.upgradeAt+=milliseconds;for(const b of c.buildings)if(b.readyAt)b.readyAt+=milliseconds;}
    for(const sh of this.state.shipments)if(sh.status==='transit'){sh.departAt+=milliseconds;sh.arriveAt+=milliseconds;}
    for(const ct of this.state.contracts)if(ct.status==='active')ct.nextAt+=milliseconds;
    if(this.state.shop.refreshAt)this.state.shop.refreshAt+=milliseconds;
  }
  tick(now=Date.now()) {
    const s=this.state; if(s.paused){this.shiftTime(Math.max(0,now-s.lastTick));s.lastTick=now;return;}
    // Cap offline catch-up: the simulation resumes from its saved clock without an offline windfall.
    const elapsed=Math.max(0,Math.min(10,(now-s.lastTick)/1000)), dt=elapsed/RULES.cycleSeconds; s.lastTick=now;
    if(now>=s.shop.refreshAt){s.shop={refreshAt:now+RULES.shopSeconds*1000,stock:Object.fromEntries(Object.keys(PRICES).map(k=>[k,RULES.shopStock]))};}
    // Resolve simultaneous tick completions by their actual completion time.
    for(const c of s.cities.filter(c=>c.upgradeAt&&now>=c.upgradeAt).sort((a,b)=>a.upgradeAt-b.upgradeAt)){
      c.level++;c.upgradeAt=null;this.claim(c);this.log(`${c.name} 升至 ${c.level} 级，已扩张至无主地块`,c.owner);
    }
    for(const c of s.cities){
      if(c.readyAt){if(now>=c.readyAt){c.readyAt=null;if(c.foundingSource){const source=s.cities.find(v=>v.id===c.foundingSource);if(source)source.transportWorkers=Math.max(0,(source.transportWorkers||0)-8);delete c.foundingSource;}this.log(`「${c.name}」建成`,c.owner);}else continue;}
      for(const b of c.buildings)if(b.readyAt&&now>=b.readyAt){b.readyAt=null;if(b.upgrading){b.level++;b.upgrading=false;}this.log(`${c.name}：${BUILDINGS[b.type].name}施工完成`,c.owner);}
      const before={...c.stock}, labor=Math.min(1,Math.max(0,(this.workers(c)-(c.transportWorkers||0)-(c.upgradeAt?4:0)) / Math.max(1,this.demand(c))));c.efficiency=labor;
      const active=c.buildings.filter(b=>!b.readyAt).sort((a,b)=>Number(!!BUILDINGS[b.type].output.power)-Number(!!BUILDINGS[a.type].output.power));
      let comfort=64,education=0,housing=100;
      for(const b of active){const def=BUILDINGS[b.type];let scale=b.level*labor;const tile=this.tile(b.x,b.y);scale*=TERRAINS[tile.terrain].bonus[b.type]||(def.mine?TERRAINS[tile.terrain].bonus.mine:1)||1;if(b.type==='farm'&&this.nearWater(b.x,b.y))scale*=1.15;
        const input={...def.input};if(def.power)input.power=def.power;
        for(const [k,v]of Object.entries(input))if(v*scale*dt>0)scale=Math.min(scale,(c.stock[k]||0)/(v*dt));
        for(const [k,v]of Object.entries(input))c.stock[k]=round(Math.max(0,(c.stock[k]||0)-v*scale*dt));
        for(const [k,v]of Object.entries(def.output))this.credit(c,k,v*scale*dt);
        const operation=b.level?scale/b.level:0;comfort+=(def.comfort||0)*b.level*Math.min(1,operation);education+=(def.education||0)*b.level*Math.min(1,operation);housing+=(def.housing||0)*b.level;
      }
      for(const [k,rate]of Object.entries({food:.075,goods:.025,water:.09,power:.04})){const need=c.population*rate*dt,available=c.stock[k]||0;if(need>0&&available<need)comfort-=20*(1-available/need);c.stock[k]=round(Math.max(0,available-need));}
      const meatNeed=c.population*.012*dt,meat=Math.min(c.stock.meat,meatNeed);c.stock.meat=round(c.stock.meat-meat);if(meatNeed>0)comfort+=4*meat/meatNeed;
      comfort-=Math.max(0,c.population-housing)*.7; c.comfort=round(Math.max(0,Math.min(100,comfort)));c.education=round(education);c.housing=housing;
      const growth=c.comfort>=60&&c.population<housing?Math.min(housing-c.population,c.population*.012*(c.comfort/70)*dt):c.comfort<40?-c.population*.025*((40-c.comfort)/40)*dt:0;
      c.population=Math.max(10,round(c.population+growth));this.credit(c,'money',c.population*(.36+Math.min(education,5)*.025)*dt);
      c.rates=Object.fromEntries(Object.keys(RESOURCES).map(k=>[k,dt?round(((c.stock[k]||0)-(before[k]||0))/dt):0]));
    }
    for(const sh of s.shipments)if(sh.status==='transit'&&now>=sh.arriveAt){const to=s.cities.find(c=>c.id===sh.to),payer=s.cities.find(c=>c.id===sh.payer);const added=to?this.credit(to,sh.resource,sh.amount):0;sh.status='arrived';sh.received=added;if(payer)payer.transportWorkers=Math.max(0,(payer.transportWorkers||0)-sh.workers);this.log(`运输抵达${to?.name||'目的地'}：${RESOURCES[sh.resource][0]} ${added}${added<sh.amount?'（超出仓储部分损耗）':''}`,to?.owner);}
    for(const ct of s.contracts)if(ct.status==='active'&&now>=ct.nextAt){const from=s.cities.find(c=>c.id===ct.seller),to=s.cities.find(c=>c.id===ct.buyer),payment=Math.min(ct.escrow,Math.ceil(ct.amount*ct.price));let delivered=false;
      if(from&&to&&(from.stock[ct.resource]||0)>=ct.amount){try{this.transport(from,to,ct.resource,ct.amount,from,now);this.pay(from,{[ct.resource]:ct.amount});this.credit(from,'money',payment);delivered=true;}catch { // transport validates before deducting any costs
        // Keep failure local: transport's only failure points precede its mutation.
      }}
      ct.escrow=round(ct.escrow-payment);ct.remaining--;if(delivered){ct.delivered++;}else{ct.defaults++;const penalty=Math.min(ct.collateral,round(Math.ceil(ct.amount*ct.price)*.2));ct.collateral=round(ct.collateral-penalty);if(to)this.credit(to,'money',payment+penalty);this.log('产能合约违约：退回本期货款并赔付保证金',from?.owner);}
      ct.nextAt=now+RULES.cycleSeconds*1000;if(!ct.remaining){ct.status='completed';if(from)this.credit(from,'money',ct.collateral);ct.collateral=0;}
    }
    // Bound historical records while retaining active operations.
    s.shipments=s.shipments.filter((sh,i,a)=>sh.status==='transit'||i>=a.length-100);
    s.offers=s.offers.filter((o,i,a)=>o.status==='open'||i>=a.length-100);
  }
  view(user) {
    return { world:this.state.world,claims:this.state.claims,paused:this.state.paused,serverTime:Date.now(),shop:this.state.shop,
      cities:this.state.cities.map(c=>c.owner===user.id||user.role==='root'?{...c,capacity:this.capacity(c),workers:this.workers(c),workerDemand:this.demand(c)}:{id:c.id,owner:c.owner,ownerName:c.ownerName,name:c.name,x:c.x,y:c.y,level:c.level,population:c.population,policy:c.policy,readyAt:c.readyAt,buildings:c.buildings.map(({id,type,x,y,level,readyAt})=>({id,type,x,y,level,readyAt}))}),
      offers:this.state.offers.filter(o=>o.status==='open'),contracts:this.state.contracts.filter(ct=>user.role==='root'||this.state.cities.some(c=>(c.id===ct.seller||c.id===ct.buyer)&&c.owner===user.id)),
      shipments:this.state.shipments.filter(sh=>user.role==='root'||sh.owner===user.id||this.state.cities.some(c=>c.id===sh.to&&c.owner===user.id)),events:this.state.events.filter(e=>!e.owner||e.owner===user.id||user.role==='root').slice(0,40) };
  }
}
