import test from 'node:test';
import assert from 'node:assert/strict';
import { Game,createState } from '../server/game.js';
import { tickFeatures,requestSupply } from '../server/features.js';
import { applySettings } from '../server/settings.js';
import { buildingStats } from '../shared/building-stats.js';
const player={id:'owner',username:'Owner',role:'player'},other={id:'other',username:'Other',role:'player'};
function setup(){const g=new Game(createState(123));for(const t of g.state.world.tiles){t.terrain='plain';t.deposit=null;}g.tick();return g;}
function city(g,x=5,user=player){const source=g.state.cities.find(c=>c.owner===user.id&&c.stock.wood>=70);const c=g.city(user,g.found(user,{x,y:5,name:`City ${x}`,sourceCityId:source?.id}));c.readyAt=null;delete c.foundingSource;if(source)source.transportWorkers=0;c.stock.money=10000;c.autoSupply=false;return c;}
function action(g,c,type,p){return g.action(player,type,{cityId:c.id,...p});}
test('builders are reserved from production and freight, can build during labor shortage and are never double-counted',()=>{
 const g=setup(),c=city(g),to=city(g,10);c.population=100;c.buildings=[{id:'factory',type:'lumber',level:15,x:4,y:4}];
 assert.equal(c.constructionReserve,4);assert.equal(g.workers(c),62);assert.equal(g.operatingWorkers(c),58);assert.equal(g.available(c),-6);assert.equal(g.constructionAvailable(c),4);
 assert.throws(()=>g.transport(c,to,'wood',1,c),/工人/);
 g.build(player,{cityId:c.id,type:'housing',x:4,y:5});assert.equal(g.constructionBusy(c),4);assert.equal(g.operatingWorkers(c),58);assert.equal(g.constructionAvailable(c),0);
 assert.throws(()=>g.build(player,{cityId:c.id,type:'housing',x:4,y:6}),/工人/);
 c.buildings[1].readyAt=1;g.tick();assert.equal(g.constructionBusy(c),0);assert.equal(g.constructionAvailable(c),4);
 action(g,c,'constructionReserve',{value:8});assert.equal(g.operatingWorkers(c),54);assert.equal(g.constructionAvailable(c),8);
 action(g,c,'constructionReserve',{value:0});assert.equal(g.constructionAvailable(c),0);
 for(const value of [-1,NaN,Infinity,1.5,100001])assert.throws(()=>action(g,c,'constructionReserve',{value}));
});
test('restock thresholds count inbound cargo, preserve donor threshold and never teleport inventory',()=>{
 const g=setup(),to=city(g),from=city(g,10);to.stock.wood=10;from.stock.wood=200;
 action(g,to,'supplyThreshold',{resource:'wood',value:100});action(g,from,'supplyThreshold',{resource:'wood',value:150});
 const now=Date.now();tickFeatures(g,now,0);assert.equal(g.state.shipments.length,1);assert.equal(g.state.shipments[0].amount,50);assert.equal(from.stock.wood,150);assert.equal(to.stock.wood,10);assert.ok(from.transportWorkers>0);
 tickFeatures(g,now+1,0);assert.equal(g.state.shipments.length,1);
 // A separate source can satisfy the remaining deficit without exceeding the target.
 const third=city(g,15);third.stock.wood=200;tickFeatures(g,now+2,0);
 assert.equal(g.state.shipments.filter(s=>s.to===to.id).reduce((n,s)=>n+s.amount,0),90);
 const loaded=new Game(JSON.parse(JSON.stringify(g.state)));assert.equal(loaded.city(player,to.id).supplyThresholds.wood,100);
 action(g,to,'threshold',{resource:'wood',value:120});assert.throws(()=>action(g,to,'supplyThreshold',{resource:'wood',value:121}),/出售/);assert.throws(()=>action(g,to,'threshold',{resource:'wood',value:99}),/补货/);
 action(g,to,'supplyThreshold',{resource:'wood',value:null});assert.equal(to.supplyThresholds.wood,undefined);
});
test('multiple donors cannot exceed receiving capacity and funds shipments charge freight on top',()=>{
 const g=setup(),to=city(g),from=city(g,10),third=city(g,15);to.stock.wood=590;from.stock.wood=100;third.stock.wood=100;
 requestSupply(g,to,{wood:1000},Date.now(),true);assert.equal(g.state.shipments.reduce((n,s)=>n+s.amount,0),10);
 to.stock.money=0;action(g,to,'supplyThreshold',{resource:'money',value:200});const before=from.stock.money;tickFeatures(g,Date.now(),0);
 const sh=g.state.shipments.find(s=>s.resource==='money');assert.equal(sh.amount,200);assert.equal(from.stock.money,before-200-sh.fee);assert.equal(to.stock.money,0);
});
test('periodic transfers validate ownership, update/delete rules, dispatch once per cycle and survive pause/restart',()=>{
 const g=setup(),from=city(g),to=city(g,10),foreign=city(g,15,other);
 assert.throws(()=>action(g,from,'transferRule',{to:foreign.id,resource:'wood',amount:20}),/属于/);assert.throws(()=>action(g,from,'transferRule',{to:from.id,resource:'wood',amount:20}),/另一座/);
 for(const resource of ['__proto__','constructor','toString'])assert.throws(()=>action(g,from,'transferRule',{to:to.id,resource,amount:20}),/物资/);
 action(g,from,'transferRule',{to:to.id,resource:'wood',amount:20});action(g,from,'transferRule',{to:to.id,resource:'wood',amount:25});assert.equal(from.transferRules.length,1);
 const rule=from.transferRules[0],due=rule.nextAt;tickFeatures(g,due-1,0);assert.equal(g.state.shipments.length,0);tickFeatures(g,due,0);assert.equal(g.state.shipments[0].amount,25);tickFeatures(g,due+1,0);assert.equal(g.state.shipments.length,1);
 // Missing many periods creates only one dispatch, no catch-up flood.
 tickFeatures(g,due+300000,0);assert.equal(g.state.shipments.length,2);
 g.state.paused=true;g.state.lastTick=Date.now();const original=rule.nextAt;g.tick(g.state.lastTick+5000);assert.equal(rule.nextAt,original+5000);
 const loaded=new Game(JSON.parse(JSON.stringify(g.state)));assert.equal(loaded.city(player,from.id).transferRules[0].nextAt,rule.nextAt);
 g.state.paused=false;action(g,from,'removeTransferRule',{ruleId:rule.id});assert.equal(from.transferRules.length,0);
});
test('periodic shortages report partial/skip without resource loss; ownership changes disable transfers',()=>{
 const g=setup(),from=city(g),to=city(g,10);action(g,from,'transferRule',{to:to.id,resource:'iron',amount:50});from.stock.iron=12;
 const rule=from.transferRules[0];tickFeatures(g,rule.nextAt,0);assert.equal(rule.lastAmount,12);assert.equal(rule.status,'partial');assert.equal(from.stock.iron,0);
 tickFeatures(g,rule.nextAt,0);assert.equal(rule.lastAmount,0);assert.equal(g.state.shipments.length,1);
 to.owner=other.id;tickFeatures(g,rule.nextAt,0);assert.equal(from.transferRules.length,0);
});
test('legacy saves receive builder and logistics defaults without losing resources',()=>{
 const g=setup(),c=city(g);const snapshot=JSON.parse(JSON.stringify(g.state)),old=snapshot.cities[0];delete old.constructionReserve;delete old.supplyThresholds;delete old.transferRules;delete snapshot.settings.rules.defaultConstructionReserve;
 const loaded=new Game(snapshot),restored=loaded.city(player,c.id);assert.equal(restored.constructionReserve,4);assert.deepEqual(restored.supplyThresholds,{});assert.deepEqual(restored.transferRules,[]);assert.deepEqual(restored.stock,c.stock);
});
// Compare actual production and each buff across levels, independent of the UI helper.
function sample(type,level){const g=setup(),c=city(g);c.population=100;c.buildings=[{id:'b',type,level,x:4,y:4}];c.stock.money=10000;for(const k of Object.keys(c.stock))if(k!=='money')c.stock[k]=300;c.stock.wood=0;g.state.lastTick=Date.now()-3000;g.tick(g.state.lastTick+3000);return {g,c};}
test('building level multiplies actual output, comfort, education, housing and storage; UI reports matching level stats',()=>{
 const one=sample('lumber',1),two=sample('lumber',2);assert.ok(Math.abs(two.c.stock.wood-2*one.c.stock.wood)<.02);
 const park1=sample('park',1),park2=sample('park',2);assert.equal(park2.c.comfort-park1.c.comfort,10);
 const school1=sample('school',1),school2=sample('school',2);assert.equal(school2.c.education,2*school1.c.education);assert.equal(school2.c.comfort-school1.c.comfort,4);
 assert.equal(sample('housing',2).c.housing-sample('housing',1).c.housing,60);
 const w1=sample('warehouse',1),w2=sample('warehouse',2);assert.equal(w2.g.capacity(w2.c)-w1.g.capacity(w1.c),600);
 const def=two.g.config.buildings.lumber,stats=buildingStats(def,2);assert.equal(stats.output.wood,24);assert.equal(stats.workers,8);assert.equal(stats.input.power,2);
 assert.equal(buildingStats(two.g.config.buildings.school,3).education,3);assert.equal(buildingStats(two.g.config.buildings.park,3).comfort,30);
});
test('logistics controls render both languages with translated resources and escaped city names',async()=>{
 const fs=await import('node:fs/promises');await import('../shared/i18n.js');
 const configURL=new URL('../shared/config.js',import.meta.url).href;
 const source=(await fs.readFile(new URL('../client/city-logistics.js',import.meta.url),'utf8')).replace("'/shared/config.js'",JSON.stringify(configURL));
 const {logisticsControls}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
 const g=setup(),c=city(g),to=city(g,10);to.name='<script>bad</script>';c.supplyThresholds.wood=200;c.transferRules=[{id:'rule',to:to.id,resource:'wood',amount:20,status:'sent'}];
 const state={cities:g.state.cities,settings:g.config};const escape=s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;');
 const english=logisticsControls(c,state,escape,true),chinese=logisticsControls(c,state,escape,false);
 assert.match(english,/Reserved builders/);assert.match(english,/Timber/);assert.ok(!english.includes('木材'));assert.match(english,/&lt;script&gt;/);assert.ok(!english.includes('<script>'));
 assert.match(chinese,/建筑工人预留/);assert.match(chinese,/木材/);
});
test('both in-game handbooks render the new rules using active server settings',async()=>{
 const fs=await import('node:fs/promises'),configURL=new URL('../shared/config.js',import.meta.url).href;
 const englishSource=(await fs.readFile(new URL('../client/guide-en.js',import.meta.url),'utf8')).replace("'/shared/config.js'",JSON.stringify(configURL));
 const englishURL=`data:text/javascript;base64,${Buffer.from(englishSource).toString('base64')}`;
 const source=(await fs.readFile(new URL('../client/guide.js',import.meta.url),'utf8')).replace("'/shared/config.js'",JSON.stringify(configURL)).replace("'/client/guide-en.js'",JSON.stringify(englishURL));
 const {guideHTML}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`),g=setup();
 assert.match(guideHTML({settings:g.config},'zh-CN'),/库存下限自动补货/);assert.match(guideHTML({settings:g.config},'en'),/Periodic transfers/);
});
