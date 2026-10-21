export const RESOURCES = {
  ironOre: ['铁矿石', '⬡', '#8b9a9e'], copperOre: ['铜矿石', '⬡', '#ad7956'], goldOre: ['金矿石', '✦', '#a98f48'], silverOre: ['银矿石', '✧', '#9aa8ad'], rareOre: ['稀土矿石', '✶', '#8878ad'], fuel: ['燃油', '♦', '#d79d60'], vegetables: ['蔬菜', '♣', '#8bb973'], clothing: ['衣物', '▧', '#c5a4cb'], meatProducts: ['肉制品', '◒', '#d78e7d'],
  money: ['资金', '◈', '#d9bc70'], wood: ['木材', '▤', '#b9a079'], stone: ['石料', '◆', '#afb7c2'],
  iron: ['铁锭', '⬡', '#a6b5bb'], coal: ['煤', '●', '#8e99a4'], copper: ['铜锭', '⬡', '#d19b76'],
  gold: ['金锭', '✦', '#e4c575'], silver: ['银锭', '✧', '#d4e2e6'], rare: ['精炼稀土', '✶', '#b4a0e1'],
  oil: ['原油', '♦', '#ac92b6'], food: ['粮食', '❧', '#c9c578'], meat: ['生肉', '◒', '#db9e92'],
  goods: ['主食', '▣', '#d7bb9d'], water: ['水', '≈', '#7db7cd'], power: ['电力', 'ϟ', '#e5d18a']
};
export const TERRAINS = {
  plain: { name: '平原', color: '#657e50', cost: 1, buff: '粮田产量 +25%', bonus: { farm: 1.25 } },
  hill: { name: '丘陵', color: '#727851', cost: 1.5, buff: '采石场、风电产量 +25%', bonus: { quarry: 1.25, wind: 1.25 } },
  plateau: { name: '高原', color: '#9a8a65', cost: 1.8, buff: '光伏产量 +40%', bonus: { solar: 1.4 } },
  mountain: { name: '山脉', color: '#798387', cost: 3, buff: '矿物产量 +30%，不宜定居', bonus: { mine: 1.3 } },
  ocean: { name: '海洋', color: '#294c61', cost: 4, buff: '不可建设，可经海路运输', bonus: {} },
  river: { name: '河流', color: '#50869a', cost: 2.3, buff: '水源；相邻粮田产量 +15%', bonus: {} },
  lake: { name: '湖泊', color: '#406d85', cost: 2.5, buff: '水源；相邻粮田产量 +15%', bonus: {} }
};
const b = (name, icon, category, cost, workers, output = {}, input = {}, extra = {}) => ({ name, icon, category, cost, workers, output, input, time: 18, power: 1, ...extra });
export const BUILDINGS = {
  airport: b('机场','✈','设施',{money:800,stone:100,iron:60},8,{}, {},{power:4}),
  station: b('火车站','▣','设施',{money:400,stone:60,iron:40},5,{}, {},{power:2}),
  vegetableFarm: b('蔬菜田', '♣', '生产', { money: 65, wood: 15, stone: 5 }, 4, { vegetables: 18 }, { water: 2 }, { power: 0 }),
  blastFurnace: b('高炉', '▰', '工业', { money: 160, stone: 35, wood: 20 }, 6, { iron: 8 }, { ironOre: 10, coal: 4 }, { power: 2 }),
  copperSmelter: b('炼铜厂', '⬡', '工业', { money: 160, stone: 35, iron: 10 }, 6, { copper: 6 }, { copperOre: 8, coal: 3 }, { power: 2 }),
  goldRefinery: b('炼金厂', '✦', '工业', { money: 220, stone: 40, iron: 15 }, 6, { gold: 3 }, { goldOre: 4, coal: 2 }, { power: 2 }),
  silverRefinery: b('炼银厂', '✧', '工业', { money: 180, stone: 35, iron: 10 }, 6, { silver: 4 }, { silverOre: 6, coal: 2 }, { power: 2 }),
  rareRefinery: b('稀土精炼厂', '✶', '工业', { money: 240, stone: 40, iron: 20 }, 7, { rare: 3 }, { rareOre: 5, water: 3 }, { power: 3 }),
  refinery: b('炼油厂', '♦', '工业', { money: 220, stone: 35, iron: 20 }, 6, { fuel: 10 }, { oil: 8, water: 2 }, { power: 2 }),
  generator: b('燃油电站', 'ϟ', '设施', { money: 180, stone: 30, iron: 15 }, 4, { power: 36 }, { fuel: 4 }, { power: 0, comfort: -3 }),
  wall: b('城墙', '▥', '城市', { money: 50, stone: 30 }, 0, {}, {}, { power: 0 }),
  lumber: b('林场', '♣', '生产', { money: 80, wood: 18, stone: 8 }, 4, { wood: 12 }),
  quarry: b('采石场', '◆', '生产', { money: 90, wood: 20, stone: 5 }, 4, { stone: 10 }),
  iron: b('铁矿', '⬡', '采矿', { money: 140, wood: 25, stone: 20 }, 6, { ironOre: 6 }, {}, { deposit: 'iron', mine: true }),
  coal: b('煤矿', '●', '采矿', { money: 120, wood: 25, stone: 15 }, 5, { coal: 8 }, {}, { deposit: 'coal', mine: true }),
  copper: b('铜矿', '⬡', '采矿', { money: 140, wood: 25, stone: 20 }, 6, { copperOre: 6 }, {}, { deposit: 'copper', mine: true }),
  gold: b('金矿', '✦', '采矿', { money: 200, wood: 30, stone: 30 }, 7, { goldOre: 2 }, {}, { deposit: 'gold', mine: true }),
  silver: b('银矿', '✧', '采矿', { money: 160, wood: 25, stone: 25 }, 6, { silverOre: 3 }, {}, { deposit: 'silver', mine: true }),
  rare: b('稀土矿', '✶', '采矿', { money: 220, wood: 30, stone: 35 }, 8, { rareOre: 2 }, {}, { deposit: 'rare', mine: true }),
  oil: b('油井', '♜', '采矿', { money: 200, wood: 20, stone: 30, iron: 15 }, 7, { oil: 5 }, {}, { deposit: 'oil', mine: true }),
  farm: b('粮田', '❧', '生产', { money: 65, wood: 15, stone: 5 }, 4, { food: 18 }, { water: 2 }, { power: 0 }),
  ranch: b('养殖场', '♧', '生产', { money: 100, wood: 25, stone: 10 }, 5, { meat: 8 }, { food: 6, water: 2 }),
  warehouse: b('仓库', '▤', '城市', { money: 90, wood: 30, stone: 15 }, 1, {}, {}, { storage: 600, power: 0 }),
  housing: b('居民区', '▥', '城市', { money: 85, wood: 25, stone: 20 }, 0, {}, {}, { housing: 60, power: 0 }),
  school: b('学校', '⚑', '民生', { money: 170, wood: 30, stone: 35 }, 5, {}, {}, { education: 1, comfort: 4 }),
  park: b('公园', '♠', '民生', { money: 70, wood: 20, stone: 10 }, 2, {}, { water: 1 }, { comfort: 10, power: 0 }),
  hospital: b('医院', '✚', '民生', { money: 220, wood: 30, stone: 40 }, 7, {}, { goods: 1, water: 2 }, { comfort: 14, power: 2 }),
  mall: b('商场', '▦', '民生', { money: 160, wood: 30, stone: 30 }, 5, {}, { goods: 1 }, { comfort: 10 }),
  textile: b('纺织厂', '▧', '工业', { money: 140, wood: 30, stone: 20 }, 6, { clothing: 10 }, { food: 3, water: 2 }, { power: 2 }),
  foodworks: b('食品加工厂', '▨', '工业', { money: 150, wood: 25, stone: 25 }, 6, { goods: 16, meatProducts: 6 }, { food: 8, meat: 4, water: 1 }, { power: 2 }),
  thermal: b('火力电厂', '▰', '设施', { money: 150, wood: 20, stone: 30, iron: 10 }, 5, { power: 28 }, { coal: 4 }, { power: 0, comfort: -6 }),
  wind: b('风力电站', '✣', '设施', { money: 130, wood: 20, stone: 20, iron: 8 }, 2, { power: 10 }, {}, { power: 0 }),
  solar: b('光伏电站', '▱', '设施', { money: 170, stone: 20, copper: 8 }, 2, { power: 12 }, {}, { power: 0 }),
  waterworks: b('自来水厂', '≈', '设施', { money: 100, wood: 20, stone: 20 }, 3, { water: 30 }, {}, { waterSource: true, power: 1 })
};
export const START_STOCK = { ironOre: 0, copperOre: 0, goldOre: 0, silverOre: 0, rareOre: 0, fuel: 0, vegetables: 150, clothing: 150, meatProducts: 60, money: 2200, wood: 220, stone: 180, iron: 45, coal: 70, copper: 20, gold: 0, silver: 0, rare: 0, oil: 0, food: 260, meat: 30, goods: 150, water: 300, power: 220 };
export const PRICES = { ironOre: 5, copperOre: 6, goldOre: 22, silverOre: 12, rareOre: 25, fuel: 20, vegetables: 3, clothing: 8, meatProducts: 12, wood: 4, stone: 4, iron: 10, coal: 5, copper: 12, gold: 45, silver: 24, rare: 50, oil: 16, food: 3, meat: 8, goods: 7, water: 2, power: 3 };
export const RULES = { width: 40, height: 32, tickSeconds: 2, cycleSeconds: 30, shopSeconds: 300, shopStock: 700, maxCityLevel: 5, maxBuildingLevel: 5, foundingSeconds: 25, foundingCost: { money: 700, wood: 70, stone: 60 }, baseStorage: 600 };
export function buildingCost(type, level = 1) { return Object.fromEntries(Object.entries(BUILDINGS[type].cost).map(([k,v]) => [k, Math.ceil(v * Math.pow(1.65, level - 1))])); }
export function cityCost(level) { return { money: 450 * level, wood: 80 * level, stone: 90 * level, iron: 15 * level }; }
