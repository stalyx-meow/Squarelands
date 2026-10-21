import {randomUUID} from 'node:crypto';
import {RESOURCES,TERRAINS} from '../shared/config.js';
const fail=m=>{throw new Error(m);};
export function editTile(g,p){
 if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||!g.inBounds(p.x,p.y))fail('无效地块坐标');
 const tile=g.tile(p.x,p.y),key=`${p.x},${p.y}`,center=g.state.cities.find(c=>c.x===p.x&&c.y===p.y);
 if(p.terrain!==undefined&&!Object.hasOwn(TERRAINS,p.terrain))fail('未知地形');
 if(p.deposit!==undefined&&p.deposit!==null&&!['iron','copper','gold','silver','rare','coal','oil'].includes(p.deposit))fail('未知矿藏');
 const target=p.ownerCityId?g.state.cities.find(c=>c.id===p.ownerCityId):null;
 if(p.ownerCityId&&!target)fail('目标城池不存在');if(center&&p.ownerCityId!==undefined&&target?.id!==center.id)fail('城池中心必须保留本城归属');
 const old=g.state.cities.flatMap(c=>c.buildings.map(b=>({c,b}))).find(v=>v.b.x===p.x&&v.b.y===p.y);
 const type=p.buildingType===undefined?old?.b.type:p.buildingType;
 if(type&&(!Object.hasOwn(g.config.buildings,type)||center))fail('无效建筑类型或城池中心');
 const city=p.ownerCityId===undefined?(old?.c||g.state.cities.find(c=>c.id===g.state.claims[key])):target;
 if(type&&!city)fail('建筑需要归属城池');
 const level=p.level??old?.b.level??1;if(!Number.isInteger(level)||level<1||level>g.config.rules.maxBuildingLevel)fail('建筑等级超出上限');
 const overrides=p.overrides??old?.b.overrides??{};
 if(!overrides||typeof overrides!=='object'||Array.isArray(overrides))fail('建筑属性格式无效');
 for(const [k,v]of Object.entries(overrides)){
  if(['input','output'].includes(k)){if(!v||typeof v!=='object'||Array.isArray(v))fail('资源属性无效');for(const [r,n]of Object.entries(v))if(!Object.hasOwn(RESOURCES,r)||r==='money'||!Number.isFinite(n)||n<0||n>1000000)fail('资源属性无效');}
  else if(!['workers','power','housing','storage','comfort','education'].includes(k)||!Number.isFinite(v)||v<(k==='comfort'?-100:0)||v>1000000||(['workers','housing','storage'].includes(k)&&!Number.isInteger(v)))fail('建筑属性超出范围');
 }
 if(p.terrain!==undefined)tile.terrain=p.terrain;if(p.deposit!==undefined)tile.deposit=p.deposit;
 if(p.ownerCityId!==undefined){if(target)g.state.claims[key]=target.id;else delete g.state.claims[key];}
 if(p.buildingType!==undefined||p.level!==undefined||p.overrides!==undefined||p.ownerCityId!==undefined){
  if(old)old.c.buildings=old.c.buildings.filter(b=>b.id!==old.b.id);
  if(type)city.buildings.push({id:old?.b.id||randomUUID(),type,x:p.x,y:p.y,level,readyAt:null,overrides});
 }
 if(p.rail!==undefined){if(p.rail){if(!city)fail('铁路需要归属城池');g.state.rails[key]={owner:city.owner};}else delete g.state.rails[key];}
 g.state.world.revision++;g.log(`管理员编辑地块 ${p.x},${p.y}`);
}
