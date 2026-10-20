import { RULES } from '../shared/config.js';
export function random(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function makeWorld(seed = Date.now() >>> 0) {
  const rng = random(seed), {width, height} = RULES, tiles = [];
  const deposits = ['iron','coal','copper','gold','silver','rare','oil'];
  for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
    const wave = Math.sin(x*.24)+Math.cos(y*.32)+Math.sin((x+y)*.17), r=rng();
    let terrain = x<2 || y<1 || (x>width-5 && wave<.3) ? 'ocean' : wave>1.35 ? 'mountain' : wave>.7 ? 'hill' : wave<-.9 ? 'plateau' : 'plain';
    const river = Math.round(width*.47 + Math.sin(y*.35)*3);
    if (x===river && terrain!=='ocean') terrain='river';
    if ((x-9)**2+(y-23)**2<7) terrain='lake';
    const deposit = !['ocean','river','lake'].includes(terrain) && r < (terrain==='mountain'?.43:.13) ? deposits[Math.floor(rng()*deposits.length)] : null;
    tiles.push({x,y,terrain,deposit});
  }
  return {seed,width,height,tiles};
}
