import { guideEnglish } from '/client/guide-en.js';
import { RESOURCES } from '/shared/config.js';
export function guideHTML(state,language='zh-CN'){if(language==='en')return guideEnglish(state);const {rules:r,economy:e,infiltration:i,territory:t,needs,prices}=state.settings;
return `<div class="eyebrow">SQUARELANDS · 内置玩法手册</div><h2 class="spaced">从第一块土地到城市网络</h2>
<nav class="guide-index"><a href="#guide-start">起步</a> · <a href="#guide-production">生产</a> · <a href="#guide-trade">贸易</a> · <a href="#guide-border">边境</a> · <a href="#guide-social">交流</a></nav>
<h3 id="guide-start">一、建城、人口与地块</h3><p>在无主平原、丘陵或高原建城，城中心之间至少间隔 3 格。首城免费，附带库存；${r.foundingSeconds} 秒建成。后续城池从已有城市支付建城费用，并占用 8 名工人直到建成；每人最多 ${r.maxCities} 城。建城后自动拥有周围尚无归属的 3×3 地块。</p>
<p>升级城池只增加领地数量上限（2×等级+1）²，不会自动占地。选择紧邻本城的无主地块，支付 ${t.unlockMoney} 资金、${t.unlockWood} 木材、${t.unlockStone} 石料手动解锁。可沿任意方向连续扩张；领地距离边缘不足 ${t.margin} 格时，地图向该方向自动扩张 ${t.expansion} 格。已有地形、坐标和归属不变，当前面积上限 ${t.maxTiles} 格。</p>
<p>劳动力为人口的 ${r.laborRatio*100}%，公务岗位为等级×${r.civilWorkers}，每处施工占用 ${r.constructionWorkers} 人，建筑岗位、运输与渗透另计。岗位不够会降低生产效率；人口保护下限 ${r.minPopulation} 人，便于低谷时拆除多余建筑重建。住房默认 ${e.housing}，居民区增加住房。舒适度达到 60 且有空位时增长，低于 40 时流失。学校提高税收。</p>
<h3 id="guide-production">二、生产链与民生</h3><p>模拟每 ${r.tickSeconds} 秒结算一次，下面的消耗与建筑产能均按 ${r.cycleSeconds} 秒一个周期计算。离线时服务器继续运行；关闭服务器期间暂停模拟，不补发离线收益。</p>
<ul class="help-list"><li>粮田 → 粮食；蔬菜田 → 蔬菜。已建成的两种农田可免费、即时互换，等级不变。平原增产 25%，临水再增产 15%。</li><li>粮食 → 养殖场 → 生肉；食品加工厂消耗粮食、生肉和水，产出主食与肉制品；纺织厂消耗粮食和水产出衣物。</li><li>铁矿石＋煤 → 高炉 → 铁锭；铜、金、银矿石分别经炼铜厂、炼金厂、炼银厂精炼；稀土矿石经稀土精炼厂加工。原油＋水 → 炼油厂 → 燃油 → 燃油电站。原矿不可替代锭或燃油使用。</li><li>火电消耗煤，风电与光伏无需燃料。水厂需紧邻河流或湖泊，海洋不算淡水源。无适合水源时可从官方商城购买。</li><li>建筑缺少输入或用电时按可用量降产，不会凭空产出。每种物资各有独立仓储容量，资金不限容量；满仓后不再收纳，运输到货超出容量的部分损耗。</li></ul>
<table class="market-table"><thead><tr><th>居民消耗 / 人 / 周期</th><th>数量</th></tr></thead><tbody>${Object.entries(needs).map(([k,v])=>`<tr><td>${RESOURCES[k][0]}</td><td>${v}</td></tr>`).join('')}</tbody></table><p>缺少上述必需品会降低舒适度。生肉提供额外饮食加成，公园、医院、商场改善生活。先保障民生与工人，再扩张工业。</p>
<h3 id="guide-trade">三、补给、仓储与贸易</h3><p>资源栏可滚动查看全部库存和每周期净变化；仓储面板也列出全部物资。自动调配默认开启：居民与建筑储备不足两个周期时，会从自己的其他城池发车；建造等操作缺资源时会先补给，抵达后自动尝试一次。发货城保留自身民生储备。没有可用源城、资金、工人或路线时不会发车。等待操作可取消，已发车的物资继续运输；调配尚未到达期间仍可能缺货。自动出售会卖掉高于阈值的整数部分，留空关闭，设为 0 则全部出售，请避免与补给目标冲突。</p>
<p>官方商城即时交付，无运输，买入基准价×${e.buyMultiplier}，卖出×${e.sellMultiplier}。每 ${r.shopSeconds} 秒将每种可售库存刷新为 ${r.shopStock}。现货发布冻结货物，买方付款并提供运费与运输工；产能合约买方预付全部货款，卖方冻结 ${(e.collateralRate*100).toFixed(1)}% 保证金，每周期发一批并承担运输。无法履约时退回本期货款并扣保证金赔付。最多 20 个在售订单、40 个参与中的产能合约，保留最近 100 份结束合约。金额按整数分计算，再将每期货款向上取整为资金；已签订单、合约的金额和赔付比例锁定。</p>
<p>运费＝向上取整（路径地形成本×${e.freightDistance}＋数量×${e.freightAmount}）＋第三方关税；运输时间＝向上取整（${e.freightBaseSeconds}＋路径成本×${e.freightSeconds}）秒。每 ${e.unitsPerWorker} 单位需 1 名运输工，抵达后归还。资金同样需要运输，可在运输面板手动调拨。运输按发车时路线、运费、工人数锁定。</p>
<p>城市可以设置默认与针对玩家的通行政策。针对玩家的设置覆盖默认值。买卖双方任一方被第三方城市禁运就需绕路；双方税率取较高值，按货物基准价值征税，每个第三方城池收取一次。运费与税款在发车时支付。</p>
<h3 id="guide-border">四、城池转让与渗透</h3><p>在城市管理里设置整数售价，其他玩家用自己城池资金收购。出售者需保留另一座已建成城池收款；交易前目标不能有未结运输、订单、渗透或升级。城池的领地、人口、建筑、库存随城转让，政策与自动出售阈值重置。留空售价即可撤销挂牌。</p>
<p>针对目标城池，统计与目标领地四向相邻的去重外部格。若外部格与已建成的目标城墙相邻，则整格不计。你的接壤格至少 ${i.minContact} 个、占未受城墙保护边界至少 ${i.minRatio*100}% 才能渗透。支付 ${i.costMoney} 资金与 ${i.costGoods} 主食，占用 ${i.workers} 工人，每周期推进 ${i.progressPerCycle}%。边界不满足、归属改变则取消。达到 100% 使用服务端安全随机数判定一次，随后冷却 ${i.cooldownSeconds} 秒。</p>
<div class="notice">P＝clamp(${i.baseChance}＋${i.borderWeight}×接壤比例＋${i.populationWeight}×人口优势＋${i.unrestWeight}×(1−目标舒适度/100)−${i.levelDefense}×目标等级，${i.minChance}，${i.maxChance})<br>人口优势＝clamp((发起城人口−目标人口)/目标人口，−1，1)。界面持续显示当前成功率，最终使用完成时的数值。</div>
<p>渗透成功后城市易主；原城在售订单撤回、相关产能合约终止，托管货款和保证金分别退回买卖双方城市；已在途货物继续到原目的地城池。目标城库存随城转让，因此风险中包含在途资产。失败和取消不退行动费用，工人归还。</p>
<h3 id="guide-social">五、交流与管理员</h3><p>广播全服可见，私信只有收发双方可见。每条最多 500 字，间隔 2 秒；服务器只保留最近 500 条，个人界面显示可见的最近 100 条。消息不支持 HTML。</p>
<p>root 可在管理中心修改经济、人口、资源价格、初始库存、建筑成本/产能/消耗/岗位、地图与渗透等数值，支持分组与搜索。修改保存进存档，重启保留。初始库存只影响新城，初始地图尺寸只在重置世界时生效。降低仓储容量不会删除已有库存，后续入库受新上限限制。更新参数不会改写已锁定的合同货款、保证金、赔付与运输。</p>
<h3>当前资源基准价</h3><div class="mini-resource-grid">${Object.entries(prices).map(([k,v])=>`<span>${RESOURCES[k][0]}：${v}</span>`).join('')}</div>`;}
