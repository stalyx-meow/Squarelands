import { BUILDINGS, PRICES, START_STOCK, RULES, TERRAINS } from '../shared/config.js';
export const DEFAULT_SETTINGS={
  prices:PRICES,startStock:START_STOCK,colonyStock:{...START_STOCK,money:400,wood:80,stone:70,iron:10,coal:20,copper:0},buildings:BUILDINGS,terrains:TERRAINS,
  rules:{...RULES,cityUpgradeCost:{money:450,wood:80,stone:90,iron:15},foundingWorkers:8,startPopulation:80,maxCities:5,constructionWorkers:4,defaultConstructionReserve:4,defaultTransportReserve:4,civilWorkers:4,laborRatio:.62,minPopulation:40},
  economy:{buyMultiplier:1.2,sellMultiplier:.75,freightDistance:.25,freightAmount:.03,freightBaseSeconds:8,freightSeconds:1.2,unitsPerWorker:50,collateralRate:.2,taxRate:.36,educationTax:.025,waterFarmBonus:.15,baseComfort:64,growthRate:.012,declineRate:.025,housing:100,meatRate:.012,meatComfort:4,comfortGrowth:60,comfortDecline:40,shortagePenalty:20,overcrowdingPenalty:.7,buildingCostMultiplier:1.65,demolishRefund:.3},
  trade:{maxTransferRules:100,maxOffers:20,maxContracts:40,maxCycles:20,maxAmount:10000,minUnitPrice:.1,maxUnitPrice:10000,maxTariff:30,history:100},
  needs:{food:.04,goods:.04,vegetables:.035,clothing:.025,meatProducts:.012,water:.09,power:.04},
  territory:{unlockMoney:30,unlockWood:5,unlockStone:5,margin:4,expansion:16,maxTiles:262144},
  automation:{supplyRatio:.05,saleRatio:.95},
  transport:{railCost:{money:20,iron:2,stone:3},railBaseSeconds:3,railSeconds:.25,railFeeMultiplier:.8,airBaseSeconds:2,airSeconds:.1,airFeeMultiplier:2,airFuel:2}
};
function range(path){
  const key=path.at(-1),group=path[0];
  if(['width','height'].includes(key)&&group==='rules')return [16,256,true];
  if(key==='maxTiles')return [4096,1048576,true];
  if(key==='expansion')return [8,64,true];if(key==='margin')return [1,8,true];
  if(group==='terrains'&&key==='cost')return [.1,100,false];
  if(['supplyRatio','saleRatio','baseChance','borderWeight','populationWeight','unrestWeight','levelDefense','minChance','maxChance','collateralRate','laborRatio','growthRate','declineRate','demolishRefund'].includes(key))return [0,1,false];
  if(key==='maxCityLevel'||key==='maxBuildingLevel')return [1,10,true];if(key==='maxCities')return [1,50,true];
  if(['tickSeconds','cycleSeconds'].includes(key))return [1,300,true];
  if(['shopSeconds','cooldownSeconds'].includes(key))return [10,86400,true];
  if(['unitsPerWorker'].includes(key))return [1,10000,true];
  if(['minPopulation'].includes(key))return [20,1000,true];
  if(['progressPerCycle'].includes(key))return [.1,100,false];
  if(group==='prices')return [.01,100000,false];
  if(key==='time'||key==='foundingSeconds')return [1,86400,true];
  if(['workers','constructionWorkers','defaultConstructionReserve','defaultTransportReserve','civilWorkers','minContact','housing','storage','baseStorage','shopStock'].includes(key))return [0,100000,true];
  if(['railFeeMultiplier','airFeeMultiplier'].includes(key))return [.1,10,false];
  if(['railSeconds','airSeconds','railBaseSeconds','airBaseSeconds','freightBaseSeconds','freightSeconds'].includes(key))return [0,3600,false];
  if(['comfortGrowth','comfortDecline','maxTariff'].includes(key))return [0,100,false];
  if(key==='buildingCostMultiplier')return [1,5,false];
  if(['maxTransferRules','maxOffers','maxContracts','maxCycles','history'].includes(key))return [1,1000,true];
  if(key==='comfort')return [-100,100,false];
  return [0,1000000,false];
}
export function settingFields(settings=DEFAULT_SETTINGS){const result=[];function visit(node,path=[]){for(const [key,value]of Object.entries(node)){const next=[...path,key];if(typeof value==='number'){const [min,max,integer]=range(next);result.push({path:next.join('.'),value,min,max,step:integer?1:.001});}else if(value&&typeof value==='object'&&!Array.isArray(value))visit(value,next);}}visit(settings);return result;}
export function configured(overrides={}){const config=structuredClone(DEFAULT_SETTINGS);return applySettings(config,overrides,true);}
export function applySettings(config,values,nested=false){
  const patch=nested?Object.fromEntries(settingFields(values).map(f=>[f.path,f.value])):values;
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new Error('参数格式无效');
  const allowed=new Map(settingFields(DEFAULT_SETTINGS).map(f=>[f.path,f]));const next=structuredClone(config);
  for(const [path,value]of Object.entries(patch)){const f=allowed.get(path);if(!f||typeof value!=='number'||!Number.isFinite(value)||value<f.min||value>f.max||(f.step===1&&!Number.isInteger(value)))throw new Error(`参数 ${path} 无效${f?`，允许 ${f.min}–${f.max}${f.step===1?' 整数':''}`:''}`);let node=next;const keys=path.split('.');for(const key of keys.slice(0,-1))node=node[key];node[keys.at(-1)]=value;}
  if(next.trade.minUnitPrice>next.trade.maxUnitPrice)throw new Error('最低单价不能大于最高单价');
  if(next.economy.comfortDecline>=next.economy.comfortGrowth||next.economy.comfortDecline<1)throw new Error('迁出舒适度阈值需大于 0 且低于增长阈值');
  if(next.automation.supplyRatio>next.automation.saleRatio)throw new Error('默认补货比例不能超过默认出售比例');
  if(next.territory.expansion<next.territory.margin)throw new Error('扩张步长不能小于边缘距离');
  if(Math.floor(next.rules.minPopulation*next.rules.laborRatio)<next.rules.civilWorkers*next.rules.maxCityLevel+next.rules.constructionWorkers)throw new Error('人口下限需要足以承担最高等级公务与至少一处施工岗位');
  return next;
}
