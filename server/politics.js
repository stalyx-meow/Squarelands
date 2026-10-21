import {randomUUID} from 'node:crypto';
import {allianceOf} from '../shared/politics.js';
const fail=m=>{throw new Error(m);};
export function politicsAction(g,user,action,p){
 if(action==='playerColor'){if(typeof p.color!=='string'||!/^#[\da-f]{6}$/i.test(p.color))fail('颜色须为六位十六进制色值');g.state.profiles[user.id]={...g.state.profiles[user.id],color:p.color};return true;}
 if(!action.startsWith('alliance'))return false;
 const own=allianceOf(g.state,user.id);
 if(action==='allianceCreate'){
  if(own)fail('请先退出当前联盟');if(typeof p.name!=='string'||p.name.trim().length<2||p.name.trim().length>24)fail('联盟名称须为 2–24 字');
  if(g.state.alliances.some(a=>a.name.toLowerCase()===p.name.trim().toLowerCase()))fail('联盟名称已存在');
  g.state.alliances.push({id:randomUUID(),name:p.name.trim(),founder:user.id,admins:[],members:[user.id],internal:{tariff:0,discount:10},external:{}});return true;
 }
 const target=g.state.alliances.find(a=>a.id===p.allianceId);
 const join=a=>{if(own)fail('只能加入一个联盟');if(!a)fail('联盟不存在');if(a.members.length>=100)fail('联盟人数已满');a.members.push(user.id);delete a.external[user.id];for(const other of g.state.alliances){other.applications=(other.applications||[]).filter(id=>id!==user.id);other.invitations=(other.invitations||[]).filter(id=>id!==user.id);}};
 if(action==='allianceJoin'||action==='allianceApply'){if(own)fail('只能加入一个联盟');if(!target)fail('联盟不存在');target.applications=[...new Set([...(target.applications||[]),user.id])];return true;}
 if(action==='allianceCancelApplication'){if(!target)fail('联盟不存在');target.applications=(target.applications||[]).filter(id=>id!==user.id);return true;}
 if(action==='allianceAcceptInvite'){if(!target?.invitations?.includes(user.id))fail('邀请不存在或已撤回');join(target);return true;}
 if(action==='allianceDeclineInvite'){if(!target)fail('联盟不存在');target.invitations=(target.invitations||[]).filter(id=>id!==user.id);return true;}
 if(!own)fail('请先加入联盟');
 if(action==='allianceLeave'){if(own.founder===user.id)fail('创建者需先转让创建者身份或解散联盟');own.members=own.members.filter(id=>id!==user.id);own.admins=own.admins.filter(id=>id!==user.id);return true;}
 if(action==='allianceDisband'){if(own.founder!==user.id)fail('只有创建者可以解散联盟');g.state.alliances=g.state.alliances.filter(a=>a.id!==own.id);return true;}
 if(action==='allianceAdmin'||action==='allianceFounder'){
  if(own.founder!==user.id)fail('只有创建者可以管理联盟管理员');if(!own.members.includes(p.playerId)||p.playerId===user.id)fail('请选择其他联盟成员');
  if(action==='allianceFounder'){own.founder=p.playerId;own.admins=own.admins.filter(id=>id!==p.playerId);}
  else own.admins=p.value?[...new Set([...own.admins,p.playerId])]:own.admins.filter(id=>id!==p.playerId);return true;
 }
 if(![own.founder,...own.admins].includes(user.id))fail('需要联盟创建者或管理员权限');
 if(action==='allianceInvite'){if(!p.validPlayer)fail('目标玩家不存在');if(allianceOf(g.state,p.playerId))fail('目标玩家已有联盟');own.invitations=[...new Set([...(own.invitations||[]),p.playerId])];return true;}
 if(action==='allianceRevokeInvite'){own.invitations=(own.invitations||[]).filter(id=>id!==p.playerId);return true;}
 if(action==='allianceReview'){
  if(!own.applications?.includes(p.playerId))fail('申请不存在');
  if(p.accept){if(allianceOf(g.state,p.playerId))fail('目标玩家已有联盟');if(own.members.length>=100)fail('联盟人数已满');own.members.push(p.playerId);delete own.external[p.playerId];for(const a of g.state.alliances){a.applications=(a.applications||[]).filter(id=>id!==p.playerId);a.invitations=(a.invitations||[]).filter(id=>id!==p.playerId);}}
  else own.applications=own.applications.filter(id=>id!==p.playerId);return true;
 }
 if(action==='allianceKick'){if(!own.members.includes(p.playerId)||p.playerId===user.id||p.playerId===own.founder)fail('不能移除此成员');if(own.admins.includes(p.playerId)&&own.founder!==user.id)fail('只有创建者可以移出管理员');own.members=own.members.filter(id=>id!==p.playerId);own.admins=own.admins.filter(id=>id!==p.playerId);return true;}
 if(action==='alliancePolicy'){
  if(!Number.isFinite(p.tariff)||p.tariff<0||p.tariff>g.config.trade.maxTariff)fail('税率超出服务器允许范围');
  if(p.playerId){if(own.members.includes(p.playerId))fail('联盟成员使用内部政策');if(!p.validPlayer)fail('目标玩家不存在');if(p.remove)delete own.external[p.playerId];else own.external[p.playerId]={embargo:!!p.embargo,tariff:p.tariff};}
  else {if(!Number.isFinite(p.discount)||p.discount<0||p.discount>50)fail('联盟交易优惠须为 0–50%');own.internal={tariff:p.tariff,discount:p.discount};}
  return true;
 }
 fail('未知联盟操作');
}
