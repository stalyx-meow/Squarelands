import { RULES } from '../shared/config.js';
export function random(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function makeTile(seed,x,y) {
  const rng=random((seed ^ Math.imul(x,73856093) ^ Math.imul(y,19349663))>>>0), phase=(seed%997)/71;
  const wave=Math.sin(x*.24+phase)+Math.cos(y*.32-phase)+Math.sin((x+y)*.17+phase);
  let terrain=wave < -1.8 ? 'ocean' : wave>1.35?'mountain':wave>.7?'hill':wave<-.9?'plateau':'plain';
  if(Math.abs(x-Math.round(18+Math.sin(y*.35+phase)*3+Math.floor(x/40)*40))===0&&terrain!=='ocean')terrain='river';
  if(((x%40+40)%40-9)**2+((y%32+32)%32-23)**2<7)terrain='lake';
  const deposits=['iron','coal','copper','gold','silver','rare','oil'];
  const deposit=!['ocean','river','lake'].includes(terrain)&&rng()<(terrain==='mountain'?.43:.13)?deposits[Math.floor(rng()*deposits.length)]:null;
  return {x,y,terrain,deposit};
}
export function makeWorld(seed=Date.now()>>>0,dimensions=RULES) {
  const {width,height}=dimensions,tiles=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)tiles.push(makeTile(seed,x,y));
  return {seed,width,height,minX:0,minY:0,revision:1,tiles};
}
export function expandWorld(world,points,settings={margin:4,expansion:16,maxTiles:262144}) {
  let left=world.minX??0,top=world.minY??0,right=left+world.width,bottom=top+world.height;
  for(const {x,y} of points){if(x-left<settings.margin)left=Math.min(left,x-settings.expansion);if(right-1-x<settings.margin)right=Math.max(right,x+settings.expansion+1);if(y-top<settings.margin)top=Math.min(top,y-settings.expansion);if(bottom-1-y<settings.margin)bottom=Math.max(bottom,y+settings.expansion+1);}
  if(left===(world.minX??0)&&top===(world.minY??0)&&right-left===world.width&&bottom-top===world.height)return false;
  if((right-left)*(bottom-top)>settings.maxTiles)throw new Error('地图已达到管理员设置的面积上限');
  const old=new Map(world.tiles.map(t=>[`${t.x},${t.y}`,t])),tiles=[];
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)tiles.push(old.get(`${x},${y}`)??makeTile(world.seed,x,y));
  Object.assign(world,{minX:left,minY:top,width:right-left,height:bottom-top,tiles,revision:(world.revision||1)+1});return true;
}
