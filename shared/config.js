export const RESOURCES = {
  money: ['资金', '◈', '#d9bc70'], wood: ['木材', '▤', '#b9a079'], stone: ['石料', '◆', '#afb7c2'],
  iron: ['铁', '⬡', '#a6b5bb'], coal: ['煤', '●', '#8e99a4'], copper: ['铜', '⬡', '#d19b76'],
  gold: ['金', '✦', '#e4c575'], silver: ['银', '✧', '#d4e2e6'], rare: ['稀土', '✶', '#b4a0e1'],
  oil: ['石油', '♦', '#ac92b6'], food: ['粮食', '❧', '#c9c578'], meat: ['肉类', '◒', '#db9e92'],
  goods: ['日用品', '▣', '#d7bb9d'], water: ['水', '≈', '#7db7cd'], power: ['电力', 'ϟ', '#e5d18a']
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
  lumber: b('林场', '♣', '生产', { money: 80, wood: 18, stone: 8 }, 4, { wood: 12 }),
  quarry: b('采石场', '◆', '生产', { money: 90, wood: 20, stone: 5 }, 4, { stone: 10 }),
  iron: b('铁矿', '⬡', '采矿', { money: 140, wood: 25, stone: 20 }, 6, { iron: 6 }, {}, { deposit: 'iron', mine: true }),
  coal: b('煤矿', '●', '采矿', { money: 120, wood: 25, stone: 15 }, 5, { coal: 8 }, {}, { deposit: 'coal', mine: true }),
  copper: b('铜矿', '⬡', '采矿', { money: 140, wood: 25, stone: 20 }, 6, { copper: 6 }, {}, { deposit: 'copper', mine: true }),
  gold: b('金矿', '✦', '采矿', { money: 200, wood: 30, stone: 30 }, 7, { gold: 2 }, {}, { deposit: 'gold', mine: true }),
  silver: b('银矿', '✧', '采矿', { money: 160, wood: 25, stone: 25 }, 6, { silver: 3 }, {}, { deposit: 'silver', mine: true }),
  rare: b('稀土矿', '✶', '采矿', { money: 220, wood: 30, stone: 35 }, 8, { rare: 2 }, {}, { deposit: 'rare', mine: true }),
  oil: b('油井', '♜', '采矿', { money: 200, wood: 20, stone: 30, iron: 15 }, 7, { oil: 5 }, {}, { deposit: 'oil', mine: true }),
  farm: b('粮田', '❧', '生产', { money: 65, wood: 15, stone: 5 }, 4, { food: 18 }, { water: 2 }, { power: 0 }),
  ranch: b('养殖场', '♧', '生产', { money: 100, wood: 25, stone: 10 }, 5, { meat: 8 }, { food: 6, water: 2 }),
  warehouse: b('仓库', '▤', '城市', { money: 90, wood: 30, stone: 15 }, 1, {}, {}, { storage: 600, power: 0 }),
  housing: b('居民区', '▥', '城市', { money: 85, wood: 25, stone: 20 }, 0, {}, {}, { housing: 60, power: 0 }),
  school: b('学校', '⚑', '民生', { money: 170, wood: 30, stone: 35 }, 5, {}, {}, { education: 1, comfort: 4 }),
  park: b('公园', '♠', '民生', { money: 70, wood: 20, stone: 10 }, 2, {}, { water: 1 }, { comfort: 10, power: 0 }),
  hospital: b('医院', '✚', '民生', { money: 220, wood: 30, stone: 40 }, 7, {}, { goods: 1, water: 2 }, { comfort: 14, power: 2 }),
  mall: b('商场', '▦', '民生', { money: 160, wood: 30, stone: 30 }, 5, {}, { goods: 1 }, { comfort: 10 }),
  textile: b('纺织厂', '▧', '工业', { money: 140, wood: 30, stone: 20 }, 6, { goods: 10 }, { food: 3, water: 2 }, { power: 2 }),
  foodworks: b('食品加工厂', '▨', '工业', { money: 150, wood: 25, stone: 25 }, 6, { goods: 12 }, { food: 4, meat: 2, water: 1 }, { power: 2 }),
  thermal: b('火力电厂', '▰', '设施', { money: 150, wood: 20, stone: 30, iron: 10 }, 5, { power: 28 }, { coal: 4 }, { power: 0, comfort: -6 }),
  wind: b('风力电站', '✣', '设施', { money: 130, wood: 20, stone: 20, iron: 8 }, 2, { power: 10 }, {}, { power: 0 }),
  solar: b('光伏电站', '▱', '设施', { money: 170, stone: 20, copper: 8 }, 2, { power: 12 }, {}, { power: 0 }),
  waterworks: b('自来水厂', '≈', '设施', { money: 100, wood: 20, stone: 20 }, 3, { water: 30 }, {}, { waterSource: true, power: 1 })
};
export const START_STOCK = { money: 2200, wood: 220, stone: 180, iron: 45, coal: 70, copper: 20, gold: 0, silver: 0, rare: 0, oil: 0, food: 260, meat: 30, goods: 150, water: 300, power: 220 };
export const PRICES = { wood: 4, stone: 4, iron: 10, coal: 5, copper: 12, gold: 45, silver: 24, rare: 50, oil: 16, food: 3, meat: 8, goods: 7, water: 2, power: 3 };
export const RULES = { width: 40, height: 32, tickSeconds: 2, cycleSeconds: 30, shopSeconds: 300, shopStock: 700, maxCityLevel: 5, maxBuildingLevel: 5, foundingSeconds: 25, foundingCost: { money: 700, wood: 70, stone: 60 }, baseStorage: 600 };
export function buildingCost(type, level = 1) { return Object.fromEntries(Object.entries(BUILDINGS[type].cost).map(([k,v]) => [k, Math.ceil(v * Math.pow(1.65, level - 1))])); }
export function cityCost(level) { return { money: 450 * level, wood: 80 * level, stone: 90 * level, iron: 15 * level }; }
