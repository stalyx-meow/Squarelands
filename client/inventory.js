import { RESOURCES } from '/shared/config.js';
const ORDER=['money','wood','stone','food','goods','vegetables','clothing','meatProducts','water','power','meat','coal','iron','copper','gold','silver','rare','fuel','oil','ironOre','copperOre','goldOre','silverOre','rareOre'];
export function inventoryHTML(city,language='zh-CN'){
  const format=new Intl.NumberFormat(language==='en'?'en':'zh-CN',{maximumFractionDigits:2});
  const compact=new Intl.NumberFormat(language==='en'?'en':'zh-CN',{notation:'compact',maximumFractionDigits:1});
  return [...new Set([...ORDER,...Object.keys(RESOURCES)])].map(key=>{
    const [name,icon,color]=RESOURCES[key],stock=city?.stock[key]??0,rate=city?.rates[key]??0;
    const value=stock>=1000000?compact.format(stock):format.format(stock),trend=`${rate>=0?'+':''}${rate.toFixed(1)}`;
    return `<div class="resource${city&&stock===0?' resource-empty':''}${rate<0?' resource-falling':''}" role="listitem" title="${name} · 库存 ${format.format(stock)} · 每周期 ${trend}"><span class="resource-icon" style="color:${color}" aria-hidden="true">${icon}</span><div class="resource-content"><small>${name}</small><div class="resource-values"><b>${value}</b><span class="rate ${rate<0?'negative':''}">${trend}</span></div></div></div>`;
  }).join('');
}
