import { RESOURCES } from '/shared/config.js';
const GROUPS=[
  {zh:'民生与能源',en:'Essentials & energy',keys:['food','goods','vegetables','clothing','meatProducts','meat','water','power']},
  {zh:'建材与精炼成品',en:'Materials & refined products',keys:['wood','stone','iron','copper','gold','silver','rare','fuel']},
  {zh:'矿石与原料',en:'Ores & raw materials',keys:['coal','oil','ironOre','copperOre','goldOre','silverOre','rareOre']}
];
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatter=language=>new Intl.NumberFormat(language==='en'?'en':'zh-CN',{maximumFractionDigits:2});
const trend=value=>`${value>=0?'+':''}${value.toFixed(1)}`;
export function inventorySummaryHTML(city,language='zh-CN'){
  const en=language==='en',format=formatter(language);
  return `<div class="city-status-name"><span class="eyebrow">${en?'SELECTED CITY':'当前城池'}</span><strong data-no-i18n>${city?escape(city.name):(en?'No city yet':'尚未建城')}</strong></div><div class="city-status-funds"><span aria-hidden="true">◈</span><small>${en?'Funds':'资金'}</small><b>${format.format(city?.stock?.money??0)}</b></div><button class="outline inventory-open" data-open-inventory>${en?'▤ Open inventory':'▤ 查看仓储'} <span aria-hidden="true">→</span></button>`;
}
export function warehouseHTML(city,language='zh-CN'){
  const en=language==='en',format=formatter(language);
  if(!city)return `<div class="empty-state">${en?'Found a city to view its inventory.':'建立城池后，即可在这里查看完整库存。'}<br><button class="outline spaced" data-inventory-world>${en?'Open world map':'前往世界地图'} →</button></div>`;
  const row=key=>{const [name,icon,color]=RESOURCES[key],amount=city.stock[key]??0,rate=city.rates[key]??0;return `<div class="warehouse-row${amount===0?' warehouse-empty':''}" role="row"><div class="warehouse-item" role="cell"><span style="color:${color}" aria-hidden="true">${icon}</span><span>${name}</span></div><strong class="warehouse-amount" role="cell">${format.format(amount)}</strong><span class="warehouse-rate ${rate<0?'negative':''}" role="cell">${trend(rate)}</span></div>`;};
  const known=new Set(['money',...GROUPS.flatMap(g=>g.keys)]),extra=Object.keys(RESOURCES).filter(k=>!known.has(k));
  const groups=extra.length?[...GROUPS,{zh:'其他物资',en:'Other resources',keys:extra}]:GROUPS;
  return `<div class="warehouse-overview"><div><span class="eyebrow">${en?'CITY INVENTORY':'城市仓储'}</span><h2 data-no-i18n>${escape(city.name)}</h2><p>${en?'All quantities shown in full. Net changes are per production cycle.':'完整显示每种物资数量，净变化按一个生产周期计算。'}</p></div><div class="warehouse-wallet"><small>${en?'Funds':'资金'}</small><b>${format.format(city.stock.money??0)}</b><span class="warehouse-rate ${(city.rates.money??0)<0?'negative':''}">${trend(city.rates.money??0)} / ${en?'cycle':'周期'}</span></div></div><div class="warehouse-capacity">${en?'Capacity per resource':'每种物资仓储上限'} <b>${format.format(city.capacity)}</b> <span>${en?'Funds have no storage limit.':'资金不受仓储上限限制。'}</span></div><div class="warehouse-groups">${groups.map(group=>`<section class="warehouse-group"><div class="warehouse-group-heading"><h3>${en?group.en:group.zh}</h3><span>${group.keys.length}</span></div><div role="table" aria-label="${en?group.en:group.zh}"><div class="warehouse-row warehouse-table-heading" role="row"><span role="columnheader">${en?'Resource':'物资'}</span><span role="columnheader">${en?'In stock':'库存'}</span><span role="columnheader">${en?'Net / cycle':'周期净变化'}</span></div>${group.keys.map(row).join('')}</div></section>`).join('')}</div><div class="warehouse-footer"><p>${en?'Change automatic sale thresholds in city management. Select another city in the sidebar to switch inventories.':'自动出售阈值在城市管理中设置；点击左侧城池可切换查看。'}</p><button class="outline" data-inventory-manage>${en?'Manage inventory rules':'管理仓储规则'} →</button></div>`;
}
