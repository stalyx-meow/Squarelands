import {playerPolicy} from '../shared/politics.js';
export function transitPolicy(city,from,to,state={}) {
  const policies=[from.owner,to.owner].map(owner=>playerPolicy(state,city,owner));
  return {embargo:policies.some(p=>p.embargo),tariff:Math.max(...policies.map(p=>p.tariff))};
}
class Heap {
  values=[];
  push(v){let i=this.values.length;this.values.push(v);while(i){const p=(i-1)>>1;if(this.values[p][0]<=v[0])break;this.values[i]=this.values[p];i=p;}this.values[i]=v;}
  pop(){const root=this.values[0],last=this.values.pop();if(this.values.length){let i=0;while(i*2+1<this.values.length){let j=i*2+1;if(j+1<this.values.length&&this.values[j+1][0]<this.values[j][0])j++;if(this.values[j][0]>=last[0])break;this.values[i]=this.values[j];i=j;}this.values[i]=last;}return root;}
}
export function findRoute(game,from,to) {
  const {width,height,minX=0,minY=0}=game.state.world,size=width*height,dist=new Float64Array(size).fill(Infinity),prev=new Int32Array(size).fill(-1),heap=new Heap();
  const index=(x,y)=>(y-minY)*width+x-minX,start=index(from.x,from.y),end=index(to.x,to.y),cities=new Map(game.state.cities.map(c=>[c.id,c]));dist[start]=0;heap.push([0,start]);
  const ownerAt=(x,y)=>cities.get(game.state.claims[`${x},${y}`]);
  while(heap.values.length){const [best,u]=heap.pop();if(best!==dist[u])continue;if(u===end)break;const x=u%width+minX,y=Math.floor(u/width)+minY;
    for(const [xx,yy] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){if(!game.inBounds(xx,yy))continue;const c=ownerAt(xx,yy),foreign=c&&c.owner!==from.owner&&c.owner!==to.owner,policy=foreign?transitPolicy(c,from,to,game.state):{tariff:0};if(policy.embargo)continue;const v=index(xx,yy),cost=game.config.terrains[game.tile(xx,yy).terrain].cost+policy.tariff*.1;if(best+cost<dist[v]){dist[v]=best+cost;prev[v]=u;heap.push([dist[v],v]);}}
  }
  if(!Number.isFinite(dist[end]))throw new Error('运输路线被禁运封锁');
  const path=[];for(let u=end;u>=0;u=prev[u]){path.push({x:u%width+minX,y:Math.floor(u/width)+minY});if(u===start)break;}path.reverse();
  const tolls={};for(const p of path){const c=ownerAt(p.x,p.y);if(c&&c.owner!==from.owner&&c.owner!==to.owner)tolls[c.id]=transitPolicy(c,from,to,game.state).tariff;}
  return {path,distance:Math.round(dist[end]*100)/100,tolls};
}
