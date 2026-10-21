export const allianceOf=(state,userId)=>state.alliances?.find(a=>a.members.includes(userId));
export function playerPolicy(state,city,owner){
 const alliance=allianceOf(state,city.owner),target=allianceOf(state,owner);
 if(alliance?.external?.[owner])return alliance.external[owner];
 if(city.policy.players?.[owner])return city.policy.players[owner];
 if(alliance&&target?.id===alliance.id)return {embargo:false,tariff:alliance.internal.tariff};
 return city.policy;
}
export function alliancePrice(state,offer,buyerOwner){
 if(offer.owner===buyerOwner)return offer.priceCents;
 const a=allianceOf(state,offer.owner),b=allianceOf(state,buyerOwner);
 return a&&a.id===b?.id?Math.max(1,Math.round(offer.priceCents*(1-a.internal.discount/100))):offer.priceCents;
}
