//  DATA (embedded — same source as JSON files)
// ════════════════════════════════════════════════
const DATA = {};

// Market data: count = release count share, ccu_* = CCU share (estimated from aggregated data)
DATA.market = [
  {year:2004,indie:8,  aa:42,aaa:38,f2p:12,n:150,  ni:12,  na:63, nb:57, nf:18, ev:null,    ci:2, ca:18,cb:35,cf:45},
  {year:2005,indie:10, aa:40,aaa:37,f2p:13,n:230,  ni:23,  na:92, nb:85, nf:30, ev:null,    ci:3, ca:20,cb:34,cf:43},
  {year:2006,indie:12, aa:39,aaa:36,f2p:13,n:320,  ni:38,  na:125,nb:115,nf:42, ev:null,    ci:4, ca:22,cb:33,cf:41},
  {year:2007,indie:15, aa:38,aaa:35,f2p:12,n:490,  ni:74,  na:186,nb:172,nf:59, ev:null,    ci:5, ca:23,cb:32,cf:40},
  {year:2008,indie:18, aa:37,aaa:33,f2p:12,n:650,  ni:117, na:241,nb:215,nf:78, ev:null,    ci:6, ca:24,cb:30,cf:40},
  {year:2009,indie:22, aa:35,aaa:31,f2p:12,n:820,  ni:180, na:287,nb:254,nf:98, ev:null,    ci:7, ca:24,cb:28,cf:41},
  {year:2010,indie:26, aa:34,aaa:29,f2p:11,n:1100, ni:286, na:374,nb:319,nf:121,ev:null,    ci:9, ca:24,cb:26,cf:41},
  {year:2011,indie:31, aa:32,aaa:27,f2p:10,n:1700, ni:527, na:544,nb:459,nf:170,ev:null,    ci:11,ca:23,cb:24,cf:42},
  {year:2012,indie:40, aa:29,aaa:22,f2p:9, n:2500, ni:1000,na:725,nb:550,nf:225,ev:"Steam Greenlight", ci:13,ca:22,cb:22,cf:43},
  {year:2013,indie:50, aa:26,aaa:16,f2p:8, n:3200, ni:1600,na:832,nb:512,nf:256,ev:null,    ci:16,ca:20,cb:19,cf:45},
  {year:2014,indie:58, aa:22,aaa:13,f2p:7, n:4400, ni:2552,na:968,nb:572,nf:308,ev:null,    ci:18,ca:19,cb:18,cf:45},
  {year:2015,indie:65, aa:19,aaa:10,f2p:6, n:5800, ni:3770,na:1102,nb:580,nf:348,ev:null,    ci:20,ca:18,cb:17,cf:45},
  {year:2016,indie:72, aa:16,aaa:7, f2p:5, n:7600, ni:5472,na:1216,nb:532,nf:380,ev:null,    ci:22,ca:17,cb:16,cf:45},
  {year:2017,indie:80, aa:13,aaa:5, f2p:2, n:9500, ni:7600,na:1235,nb:475,nf:190,ev:"Steam Direct", ci:24,ca:16,cb:15,cf:45},
  {year:2018,indie:83, aa:11,aaa:4, f2p:2, n:11300,ni:9379,na:1243,nb:452,nf:226,ev:null,    ci:26,ca:16,cb:14,cf:44},
  {year:2019,indie:86, aa:9, aaa:3, f2p:2, n:12400,ni:10664,na:1116,nb:372,nf:248,ev:null,    ci:28,ca:15,cb:13,cf:44},
  {year:2020,indie:88, aa:8, aaa:3, f2p:1, n:11600,ni:10208,na:928,nb:348,nf:116,ev:"COVID-19",ci:32,ca:14,cb:12,cf:42},
  {year:2021,indie:89, aa:7, aaa:3, f2p:1, n:12700,ni:11303,na:889,nb:381,nf:127,ev:null,    ci:35,ca:13,cb:11,cf:41},
  {year:2022,indie:91, aa:6, aaa:2, f2p:1, n:13700,ni:12467,na:822,nb:274,nf:137,ev:null,    ci:38,ca:12,cb:10,cf:40},
  {year:2023,indie:93, aa:5, aaa:1.5,f2p:0.5,n:14200,ni:13206,na:710,nb:213,nf:71,ev:null,    ci:40,ca:12,cb:9, cf:39},
  {year:2024,indie:98.9,aa:0.8,aaa:0.2,f2p:0.1,n:18945,ni:18737,na:152,nb:38,nf:19,ev:null,    ci:42,ca:11,cb:8, cf:39},
];

DATA.bubbles = [
  {name:"CS:GO / CS2",       type:"F2P",  pr:86,ccu:1818773,own:55,  yr:2012,price:0,    rc:5400000, dev:["Valve"],             tags:["FPS","竞技","免费","动作","多人"]},
  {name:"DOTA 2",            type:"F2P",  pr:89,ccu:1291328,own:42,  yr:2013,price:0,    rc:1850000, dev:["Valve"],             tags:["MOBA","策略","免费","多人","竞技"]},
  {name:"PUBG",              type:"AAA",  pr:67,ccu:3257248,own:22,  yr:2017,price:29.99,rc:1100000, dev:["PUBG Studios"],      tags:["大逃杀","生存","射击","多人","开放世界"]},
  {name:"Cyberpunk 2077",    type:"AAA",  pr:87,ccu:1054388,own:15,  yr:2020,price:59.99,rc:650000,  dev:["CD Projekt RED"],    tags:["开放世界","RPG","动作","赛博朋克","单人"]},
  {name:"Elden Ring",        type:"AAA",  pr:97,ccu:952523, own:10,  yr:2022,price:59.99,rc:650000,  dev:["FromSoftware"],      tags:["魂类","动作RPG","开放世界","困难","黑暗"]},
  {name:"Hogwarts Legacy",   type:"AAA",  pr:86,ccu:879308, own:8,   yr:2023,price:59.99,rc:280000,  dev:["Avalanche Software"],tags:["魔法","开放世界","动作","RPG","单人"]},
  {name:"GTA V",             type:"AAA",  pr:87,ccu:364548, own:25,  yr:2015,price:29.99,rc:1400000, dev:["Rockstar North"],    tags:["开放世界","动作","犯罪","多人","单人"]},
  {name:"The Witcher 3",     type:"AAA",  pr:97,ccu:103000, own:12,  yr:2015,price:39.99,rc:420000,  dev:["CD Projekt RED"],    tags:["开放世界","RPG","剧情","奇幻","单人"]},
  {name:"Black Myth: Wukong",type:"AA",   pr:96,ccu:2416376,own:20,  yr:2024,price:59.99,rc:380000,  dev:["Game Science"],      tags:["动作","魂类","中国神话","优美","单人"]},
  {name:"Baldur's Gate 3",   type:"AA",   pr:97,ccu:875343, own:8,   yr:2023,price:59.99,rc:420000,  dev:["Larian Studios"],    tags:["RPG","回合制","多人","剧情","奇幻"]},
  {name:"Monster Hunter: World",type:"AA",pr:90,ccu:330519, own:9,   yr:2018,price:29.99,rc:310000,  dev:["Capcom"],            tags:["动作","狩猎","合作","开放世界","RPG"]},
  {name:"No Man's Sky",      type:"AA",   pr:88,ccu:212321, own:8,   yr:2016,price:59.99,rc:390000,  dev:["Hello Games"],       tags:["太空","探索","生存","多人","开放世界"]},
  {name:"Palworld",          type:"Indie",pr:79,ccu:2101867,own:20,  yr:2024,price:29.99,rc:280000,  dev:["Pocketpair"],        tags:["生存","制作","多人","开放世界","驯兽"]},
  {name:"Rust",              type:"Indie",pr:85,ccu:245243, own:14,  yr:2013,price:39.99,rc:650000,  dev:["Facepunch Studios"], tags:["生存","多人","制作","开放世界","PvP"]},
  {name:"Valheim",           type:"Indie",pr:96,ccu:502387, own:10,  yr:2021,price:19.99,rc:230000,  dev:["Iron Gate Studio"],  tags:["生存","维京","制作","多人","开放世界"]},
  {name:"Stardew Valley",    type:"Indie",pr:98,ccu:89063,  own:21,  yr:2016,price:14.99,rc:640000,  dev:["ConcernedApe"],      tags:["农场模拟","放松","RPG","像素","单人"]},
  {name:"Hades",             type:"Indie",pr:97,ccu:100654, own:6,   yr:2020,price:24.99,rc:280000,  dev:["Supergiant Games"],  tags:["Roguelite","动作","地牢","剧情","高重玩"]},
  {name:"Celeste",           type:"Indie",pr:97,ccu:12124,  own:2.5, yr:2018,price:19.99,rc:92000,   dev:["Maddy Makes Games"], tags:["平台","困难","独立","精准跳跃","剧情"]},
  {name:"Among Us",          type:"Indie",pr:89,ccu:447476, own:22,  yr:2018,price:4.99, rc:560000,  dev:["Innersloth"],        tags:["社交推理","多人","搞笑","合作","在线"]},
  {name:"Terraria",          type:"Indie",pr:98,ccu:489886, own:30,  yr:2011,price:9.99, rc:910000,  dev:["Re-Logic"],          tags:["沙盒","制作","2D","生存","挖矿"]},
  {name:"Hollow Knight",     type:"Indie",pr:98,ccu:48665,  own:5,   yr:2017,price:14.99,rc:220000,  dev:["Team Cherry"],       tags:["银河城","困难","大气","独立","单人"]},
  {name:"Factorio",          type:"Indie",pr:98,ccu:125789, own:4,   yr:2020,price:35,   rc:180000,  dev:["Wube Software"],     tags:["基地建设","自动化","策略","制作","单人"]},
  {name:"RimWorld",          type:"Indie",pr:98,ccu:89741,  own:5,   yr:2018,price:34.99,rc:190000,  dev:["Ludeon Studios"],    tags:["殖民地模拟","基地建设","策略","科幻","生存"]},
  {name:"Lethal Company",    type:"Indie",pr:97,ccu:237554, own:6,   yr:2023,price:9.99, rc:240000,  dev:["Zeekerss"],          tags:["合作","恐怖","搞笑","多人","生存"]},
  {name:"Subnautica",        type:"Indie",pr:97,ccu:46236,  own:7,   yr:2018,price:29.99,rc:200000,  dev:["Unknown Worlds"],    tags:["生存","开放世界","水下","制作","大气"]},
  {name:"Satisfactory",      type:"Indie",pr:98,ccu:77714,  own:4,   yr:2020,price:34.99,rc:170000,  dev:["Coffee Stain Studios"],tags:["基地建设","工厂","合作","探索","自动化"]},
  {name:"Schedule I",        type:"Indie",pr:98,ccu:414000, own:5,   yr:2025,price:29.99,rc:180000,  dev:["TVGS"],              tags:["犯罪","模拟","独立","沙盒","开放世界"]},
  {name:"Warframe",          type:"F2P",  pr:87,ccu:128220, own:14,  yr:2013,price:0,    rc:510000,  dev:["Digital Extremes"],  tags:["免费","动作","第三人称","科幻","多人"]},
  {name:"Apex Legends",      type:"F2P",  pr:81,ccu:228439, own:18,  yr:2019,price:0,    rc:420000,  dev:["Respawn Entertainment"],tags:["大逃杀","免费","FPS","竞技","多人"]},
  {name:"Path of Exile",     type:"F2P",  pr:86,ccu:232724, own:9,   yr:2013,price:0,    rc:450000,  dev:["Grinding Gear Games"],tags:["动作RPG","免费","黑暗奇幻","困难","多人"]},
];

// ── 衰减曲线：参数化生成（固定种子）
function genDecay(seed, a, b, c, floor) {
  let s = seed;
  function rand() { s=(s*1664525+1013904223)&0xffffffff; return (s>>>0)/0xffffffff; }
  const v = Array.from({length:25},(_,m)=>{
    const base = Math.max(floor, a*Math.exp(-b*m)+c);
    return Math.min(1.05, Math.max(floor-0.02, base+(rand()-0.5)*0.028));
  });
  v[0]=1.0; return v.map(x=>Math.round(x*1e4)/1e4);
}
DATA.decay = [
  {name:"GTA V",              type:"AAA",  color:"#ff5252", peak:364548,  yr:2015, data:genDecay(1, 0.90,0.58,0.05,0.04)},
  {name:"Cyberpunk 2077",     type:"AAA",  color:"#ff7070", peak:1054388, yr:2020, data:genDecay(2, 0.88,0.72,0.04,0.03)},
  {name:"Hogwarts Legacy",    type:"AAA",  color:"#ff9090", peak:879308,  yr:2023, data:genDecay(3, 0.92,0.82,0.03,0.02)},
  {name:"Black Myth: Wukong", type:"AA",   color:"#ffd54f", peak:2416376, yr:2024, data:genDecay(4, 0.85,0.55,0.08,0.06)},
  {name:"Baldur's Gate 3",    type:"AA",   color:"#ffe082", peak:875343,  yr:2023, data:genDecay(5, 0.70,0.24,0.22,0.16)},
  {name:"Stardew Valley",     type:"Indie",color:"#1de9b6", peak:89063,   yr:2016, data:genDecay(6, 0.55,0.06,0.36,0.31)},
  {name:"Valheim",            type:"Indie",color:"#00bfa5", peak:502387,  yr:2021, data:genDecay(7, 0.75,0.32,0.18,0.12)},
  {name:"Terraria",           type:"Indie",color:"#00897b", peak:489886,  yr:2011, data:genDecay(8, 0.50,0.05,0.42,0.38)},
  {name:"Hades",              type:"Indie",color:"#80cbc4", peak:100654,  yr:2020, data:genDecay(9, 0.65,0.14,0.29,0.24)},
  {name:"DOTA 2",             type:"F2P",  color:"#69f0ae", peak:1291328, yr:2013, data:genDecay(10,0.28,0.03,0.68,0.64)},
];

// ════════════════════════════════════════════════

// ── 尝试从预处理 JSON 覆盖内嵌数据 ──────────────────
async function loadJSON(path) {
  try {
    const r = await fetch(path);
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch { return null; }
}

window.loadRealData = async function() {
  const [market, bubbles, decay] = await Promise.all([
    loadJSON('../data/processed/market_share.json'),
    loadJSON('../data/processed/bubbles.json'),
    loadJSON('../data/processed/decay.json'),
  ]);
  if (market)  { DATA.market  = market;  console.log('[data] market_share.json loaded'); }
  if (bubbles) {
    DATA.bubbles = bubbles.map(d => ({
      name:  d.name,
      type:  d.type,
      pr:    d.pos_rate  ?? d.pr,
      ccu:   d.peak_ccu  ?? d.ccu,
      own:   d.owners_m  ?? d.own,
      yr:    d.year      ?? d.yr,
      price: d.price     ?? 0,
      rc:    d.review_count ?? d.rc ?? 0,
      dev:   d.developers ?? d.dev ?? [],
      tags:  d.top_tags  ?? d.tags ?? [],
    }));
    console.log('[data] bubbles.json loaded, ' + DATA.bubbles.length + ' games');
  }
  if (decay) {
    DATA.decay = decay.map(d => ({
      name:  d.name,
      type:  d.type,
      color: d.color || C[d.type] || '#888',
      peak:  d.peak_ccu ?? d.peak,
      yr:    d.release_year ?? d.yr,
      data:  d.normalized ?? d.data,
    }));
    console.log('[data] decay.json loaded');
    // hide badge if real data
    const badge = document.getElementById("decay-badge");
    if (badge) badge.style.display = "none";
  }
  return { market: !!market, bubbles: !!bubbles, decay: !!decay };
};
