(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.CarcassonneEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const DIR=[[0,-1],[1,0],[0,1],[-1,0]],N=40;
const EXP=[
['river','河流','起始地图',1,'先沿河流铺出起始地图，河弯不能连续同向回转。'],
['abbot','修道院长','特殊米宝',1,'花园得分，并可用放棋子的机会提前收回。'],
['inns','旅馆与大教堂','得分增强',1,'旅馆道路与大教堂城市的完成分更高，大米宝强度为 2。'],
['traders','商人与建筑师','经营连动',2,'货物多数奖励、建筑师额外回合、全场猪计分。'],
['dragon','巨龙与仙女','直接互动',3,'两次直线扫图、仙女保护、魔法门远程放米宝。'],
['towers','高塔与盗贼','事件计分',2,'塔顶守望者获得盗贼悬赏，空塔自动加高。'],
['mayors','信使与市长','特殊米宝',3,'市长争取骑士、信使接力、稻草人与万能市政厅。'],
['jousts','比武与纹章','阶段竞赛',3,'秘密提名，分堆比武，获胜奖图上的雕像带来终局分。'],
['siege','围城与防御','直接互动',3,'派遣守军、投石机围城、反击计分。'],
['buildings','城堡与桥梁','建设经营',3,'桥接道路、城堡少女与谷仓农夫的特殊计分。'],
['sheep','羊群与牧羊人','风险决策',2,'扩群或赶羊，鹅与葡萄园提供奖励。'],
['circus','马戏团与艺人','区域计分',2,'巡回演出、杂技金字塔与团长奖励。']
].map(([id,name,tag,level,desc])=>({id,name,tag,level,desc}));
const TEMPLATES={
start:{edges:['C','R','F','R'],cities:[[0]],roads:[[1,3]]},
monastery:{edges:['F','F','F','F'],monastery:true},monasteryRoad:{edges:['F','F','R','F'],roads:[[2]],monastery:true},
cityCap:{edges:['C','F','F','F'],cities:[[0]]},cityRoad:{edges:['C','F','R','F'],cities:[[0]],roads:[[2]]},
cityTurnRoad:{edges:['C','R','R','F'],cities:[[0]],roads:[[1,2]]},
cityCrossRoad:{edges:['C','R','R','R'],cities:[[0]],roads:[[1],[2],[3]],village:true},
cityCorner:{edges:['C','C','F','F'],cities:[[0,1]]},cityCornerShield:{edges:['C','C','F','F'],cities:[[0,1]],shield:1},
cityCornerRoad:{edges:['C','C','R','R'],cities:[[0,1]],roads:[[2,3]]},
cityThree:{edges:['C','C','C','F'],cities:[[0,1,2]]},cityThreeShield:{edges:['C','C','C','F'],cities:[[0,1,2]],shield:1},
cityThreeRoad:{edges:['C','C','C','R'],cities:[[0,1,2]],roads:[[3]],shield:1},
cityFull:{edges:['C','C','C','C'],cities:[[0,1,2,3]],shield:1},
citySplit:{edges:['C','F','C','F'],cities:[[0],[2]]},citySplitAdjacent:{edges:['C','C','F','F'],cities:[[0],[1]]},
cityBridge:{edges:['C','F','C','F'],cities:[[0,2]]},cityBridgeShield:{edges:['C','F','C','F'],cities:[[0,2]],shield:1},
roadStraight:{edges:['R','F','R','F'],roads:[[0,2]]},roadBend:{edges:['R','R','F','F'],roads:[[0,1]]},
roadThree:{edges:['R','R','R','F'],roads:[[0],[1],[2]],village:true},roadFour:{edges:['R','R','R','R'],roads:[[0],[1],[2],[3]],village:true},
garden:{edges:['F','F','F','F'],garden:true},plain:{edges:['F','F','F','F']},
riverSource:{edges:['V','F','F','F'],river:[[0]],source:true},riverLake:{edges:['V','F','F','F'],river:[[0]],lake:true},
riverStraight:{edges:['V','F','V','F'],river:[[0,2]]},riverBend:{edges:['V','V','F','F'],river:[[0,1]]},
riverCity:{edges:['V','C','V','F'],river:[[0,2]],cities:[[1]]},riverRoad:{edges:['V','R','V','R'],river:[[0,2]],roads:[[1,3]],overpass:true},
riverMonastery:{edges:['V','V','F','F'],river:[[0,1]],monastery:true,center:[.7,.7]},
hall:{edges:['H','H','H','H'],hall:true},prize:{edges:['C','F','F','F'],cities:[[0]],statue:true,shield:1}
};
const memo=new Map();
const key=(x,y)=>x+','+y;
function rotatePoint(p,r){let[x,y]=p;for(let i=0;i<r;i++)[x,y]=[1-y,x];return[x,y];}
function polygonForCity(sides){
 if(sides.length===1){const pts=[[0,0],[1,0],[.90,.18],[.74,.25],[.50,.29],[.26,.25],[.10,.18]];return pts.map(p=>rotatePoint(p,sides[0]));}
 if(sides.length===4)return[[0,0],[1,0],[1,1],[0,1]];
 if(sides.length===3){const missing=[0,1,2,3].find(s=>!sides.includes(s)),r=(missing+1)%4;return[[0,0],[1,0],[1,1],[0,1],[.18,.92],[.30,.74],[.34,.5],[.30,.26],[.18,.08]].map(p=>rotatePoint(p,r));}
 if((sides[0]+2)%4===sides[1])return[[0,0],[1,0],[.86,.16],[.65,.32],[.65,.68],[.86,.84],[1,1],[0,1],[.14,.84],[.35,.68],[.35,.32],[.14,.16]].map(p=>rotatePoint(p,sides[0]));
 const r=sides.find(s=>sides.includes((s+1)%4));return[[0,0],[1,0],[1,1],[.90,.86],[.79,.73],[.54,.53],[.27,.28],[.14,.11]].map(p=>rotatePoint(p,r));
}
function inPoly(x,y,pts){let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const[a,b]=pts[i],[u,v]=pts[j];if(((b>y)!==(v>y))&&(x<(u-a)*(y-b)/(v-b)+a))c=!c;}return c;}
function distanceSegment(px,py,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],q=Math.max(0,Math.min(1,((px-a[0])*dx+(py-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(px-a[0]-q*dx,py-a[1]-q*dy);}
const edgePoint=s=>[[.5,0],[1,.5],[.5,1],[0,.5]][s];
function route(sides,center=[.5,.5]){
 if(sides.length===2){const a=edgePoint(sides[0]),b=edgePoint(sides[1]);if((sides[0]+2)%4===sides[1])return[a,b];const pts=[];for(let i=0;i<=24;i++){const t=i/24;pts.push([(1-t)*(1-t)*a[0]+2*(1-t)*t*center[0]+t*t*b[0],(1-t)*(1-t)*a[1]+2*(1-t)*t*center[1]+t*t*b[1]]);}return pts;}
 return[edgePoint(sides[0]),center];
}
function topology(type){
 if(memo.has(type))return memo.get(type);
 const t=TEMPLATES[type],features=[],cities=(t.cities||[]).map((s,i)=>({id:'c'+i,type:'city',sides:s,poly:polygonForCity(s),pos:s.length===1?rotatePoint([.5,.13],s[0]):[.5,.32]}));
 const roads=(t.roads||[]).map((s,i)=>{const end=s.length===1&&cities.length===1&&cities[0].sides.length===1&&((s[0]+2)%4===cities[0].sides[0])?rotatePoint([.5,.26],cities[0].sides[0]):t.center;const line=route(s,end);return{id:'r'+i,type:'road',sides:s,path:line,pos:line.length===2?[(line[0][0]+line[1][0])/2,(line[0][1]+line[1][1])/2]:line[Math.floor(line.length/2)]};});
 const rivers=(t.river||[]).map((s,i)=>({id:'v'+i,type:'river',sides:s,path:route(s,t.source||t.lake?[.5,.48]:[.5,.5]),pos:[.5,.5]}));
 features.push(...cities,...roads,...rivers);
 const cells=new Int16Array((N+1)*(N+1));cells.fill(-1);
 for(let y=0;y<=N;y++)for(let x=0;x<=N;x++){
  const px=x/N,py=y/N;let mark=-1;
  for(let i=0;i<cities.length;i++)if(inPoly(px,py,cities[i].poly)){mark=100+i;break;}
  if(mark===-1)for(let i=0;i<roads.length;i++)if(roads[i].path.some((p,j)=>j&&distanceSegment(px,py,roads[i].path[j-1],p)<.032)){mark=200+i;break;}
  if(mark===-1)for(let i=0;i<rivers.length;i++)if(rivers[i].path.some((p,j)=>j&&distanceSegment(px,py,rivers[i].path[j-1],p)<.07)){mark=300+i;break;}
  cells[y*(N+1)+x]=mark;
 }
 let fieldIndex=0;const fields=[];
 for(let y=0;y<=N;y++)for(let x=0;x<=N;x++){
  const idx=y*(N+1)+x;if(cells[idx]!==-1)continue;
  const q=[[x,y]],points=[],touch=new Set();cells[idx]=fieldIndex;
  for(let qi=0;qi<q.length;qi++){const[ax,ay]=q[qi];points.push([ax/N,ay/N]);for(const[dx,dy]of DIR){const bx=ax+dx,by=ay+dy;if(bx<0||by<0||bx>N||by>N)continue;const v=cells[by*(N+1)+bx];if(v===-1){cells[by*(N+1)+bx]=fieldIndex;q.push([bx,by]);}else if(v>=100&&v<200)touch.add('c'+(v-100));}}
  if(points.length<3){fieldIndex++;continue;}
  const target=points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]);
  const pos=points.reduce((best,p)=>Math.hypot(p[0]-target[0],p[1]-target[1])<Math.hypot(best[0]-target[0],best[1]-target[1])?p:best,points[0]);
  fields.push({id:'f'+fieldIndex,type:'field',sides:[],ports:[],pos,touches:[...touch],area:points.length});fieldIndex++;
 }
 for(let s=0;s<4;s++)for(let p=0;p<2;p++){const pt=rotatePoint([p?.78:.22,0],s),x=Math.round(pt[0]*N),y=Math.round(pt[1]*N),v=cells[y*(N+1)+x];const f=fields.find(f=>f.id==='f'+v);if(f)f.ports.push(s*2+p);}
 features.push(...fields);
 if(t.monastery)features.push({id:'m',type:'monastery',sides:[],pos:t.center||[.5,.5]});
 if(t.garden)features.push({id:'g',type:'garden',sides:[],pos:[.5,.5]});
 const result={features,cells,cities,roads,rivers,fields};memo.set(type,result);return result;
}
function definition(tile){
 const t=TEMPLATES[tile.type];const r=tile.rot||0,top=topology(tile.type);
 const edges=t.edges.map((_,i)=>t.edges[(i-r+4)%4]);
 const features=top.features.map(f=>({...f,sides:f.sides.map(s=>(s+r)%4),ports:(f.ports||[]).map(p=>((Math.floor(p/2)+r)%4)*2+p%2),pos:rotatePoint(f.pos,r)}));
 if(tile.bridge!=null){const s=tile.bridge;edges[s]=edges[(s+2)%4]='R';features.push({id:'bridge',type:'road',sides:[s,(s+2)%4],pos:[.5,.5],bridge:true});}
 if(tile.fortress)features.push({id:'fort-city',type:'city',sides:[],pos:[.5,.5]});
 return{...t,edges,features};
}
let idSeq=0;
function tile(type,extra={}){return{uid:'t'+(++idSeq),type,rot:0,...extra};}
function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function baseDeck(){const counts={monastery:4,monasteryRoad:2,cityCap:5,cityRoad:3,cityTurnRoad:3,cityCrossRoad:3,cityCorner:3,cityCornerShield:2,cityCornerRoad:3,cityThree:3,cityThreeShield:2,cityThreeRoad:3,cityFull:1,citySplit:3,citySplitAdjacent:2,cityBridge:3,cityBridgeShield:2,roadStraight:8,roadBend:9,roadThree:4,roadFour:1, start:1,garden:1};const a=[];for(const[type,n]of Object.entries(counts))for(let i=0;i<n;i++)a.push(tile(type));while(a.length>71)a.pop();while(a.length<71)a.push(tile('cityCap'));return a;}
function create(config={}){
 idSeq=0;const seed=config.seed??Math.floor(Math.random()*1e9),rand=rng(seed),extensions=[...new Set(config.expansions||[])].filter(id=>EXP.some(e=>e.id===id));
 const names=config.players||[{name:'你',kind:'human'},{name:'电脑',kind:'ai'}];if(names.length<2||names.length>6)throw new Error('人数应为 2–6 人');
 const players=names.map((p,i)=>({id:p.id||'p'+i,name:String(p.name||'玩家 '+(i+1)).slice(0,20),kind:p.kind||'human',score:0,supply:{normal:7+(extensions.includes('siege')?2:0)+(extensions.includes('circus')?2:0),large:extensions.includes('inns')?1:0,abbot:extensions.includes('abbot')?1:0,builder:extensions.includes('traders')?1:0,pig:extensions.includes('traders')?1:0,mayor:extensions.includes('mayors')?1:0,messenger:extensions.includes('mayors')?1:0,scarecrow:extensions.includes('mayors')?1:0,shepherd:extensions.includes('sheep')?1:0,ringmaster:extensions.includes('circus')?1:0},goods:[0,0,0],hall:extensions.includes('mayors'),emblems:extensions.includes('jousts')?[0,1,2,3,5]:[],prize:0,prizeEmblem:null,ready:true}));
 const g={version:1,seed,random:seed,extensions,players,board:{},deck:baseDeck(),riverDeck:[],turn:0,phase:'tile',current:null,last:null,meeples:[],log:[],revision:0,round:1,ended:false,dragon:null,fairy:null,builderBonus:false,stolen:0,towerDeck:[],towerSupply:20,sheepBag:[1,1,1,1,2,2,2,2,2,3,3,3,3,3,4,4,0,0],performance:[1,3,3,3,3,4,4,4,4,4,5,5,5,6,6,7],circus:null,fort:{rows:[[],[],[]],extras:[[],[],[]],catapults:[false,false,false]},joust:null,buildSupply:{bridge:12,castle:6,barn:6},barns:[],castles:[],animations:[],events:[],winner:[]};
 const types=['cityCap','roadStraight','roadBend','cityCorner','monastery','cityThree','citySplit','cityTurnRoad','garden','cityRoad'];
 const count={inns:23,traders:23,dragon:26,towers:12,mayors:11,jousts:8,siege:17,buildings:15,sheep:18,circus:19};
 for(const id of extensions){if(!count[id])continue;for(let i=0;i<count[id];i++){
  let type=types[i%types.length],extra={expansion:id};
  if(id==='inns'){if(i%3===0){type='roadStraight';extra.inn=true;}if(i===5||i===14){type='cityThree';extra.cathedral=true;}}
  if(id==='traders'){type=i%3?'cityCorner':'cityCap';extra.good=i%3;}
  if(id==='dragon'){if(i<6)extra.hoard=true;else if(i<16)extra.dragonSymbol=true;else extra.portal=true;}
  if(id==='towers')extra.thief=2+(i%5);
  if(id==='siege')extra.siege=i%4===3?[i%3,(i+1)%3]:[i%3];
  if(id==='sheep'){if(i<9)extra.geese=true;else extra.vineyard=true;}
  if(id==='circus'){if(i<11)extra.circus=true;else{extra.acrobat=true;type='roadThree';}}
  g.deck.push(tile(type,extra));
 }}
 if(extensions.includes('towers'))g.towerDeck=Array.from({length:5},()=>tile('cityCap',{tower:1,expansion:'towers'}));
 shuffle(g.deck,rand);shuffle(g.performance,rand);
 if(extensions.includes('river')){
  g.board[key(0,0)]=tile('riverSource',{x:0,y:0,rot:2});
  g.riverEnd={x:0,y:0,side:2};g.lastRiverBend=null;
  const riverTypes=['riverStraight','riverBend','riverRoad','riverCity','riverStraight','riverBend','riverMonastery','riverCity','riverStraight','riverBend'];
  g.riverDeck=shuffle(riverTypes.map(t=>tile(t)),rand);g.riverDeck.push(tile('riverLake'));
  for(const id of extensions)if(count[id]){let extra={expansion:id};if(id==='inns')extra.inn=true;if(id==='traders')extra.good=0;if(id==='towers')extra.tower=1;if(id==='sheep')extra.geese=true;if(id==='circus')extra.circus=true;g.riverDeck.splice(Math.max(0,g.riverDeck.length-1),0,tile(id==='inns'||id==='buildings'?'riverRoad':'riverCity',extra));}
 }else g.board[key(0,0)]=tile('start',{x:0,y:0});
 if(extensions.includes('siege')){g.fort.capacity=players.length<=3?players.length+1:players.length;}
 if(extensions.includes('dragon')){g.deck.splice(0,5);if(g.riverDeck.length)g.riverDeck[g.riverDeck.length-1].hoard=true;}
 if(extensions.includes('jousts')){
  const extra=g.deck.length-71-8,tab=[6,6,5,4,3];let stacks=tab[players.length-2];if(extra>=20)stacks=Math.min(12,stacks+Math.floor(extra/20)*(players.length<=3?2:1));
  const per=Math.max(1,Math.floor(12/(stacks-1))),size=Math.ceil(g.deck.length/stacks);
  g.joust={category:players.length<=4?0:players.length===5?1:2,stacks,per,size,nextAt:g.deck.length-size,prizesLeft:12};
 }
 log(g,'欢迎来到卡卡颂。拼接地形，派遣米宝，争取最高分。');draw(g);return g;
}
function random(g){g.random=(Math.imul(1664525,g.random)+1013904223)>>>0;return g.random/4294967296;}
function log(g,message){g.log.push({turn:g.round,message});if(g.log.length>80)g.log.shift();}
function give(g,p,n,why,x,y){if(n<=0)return;g.players[p].score+=n;g.events.push({player:p,points:n,why,x,y});log(g,`${g.players[p].name} +${n} 分 · ${why}`);}
function frontiers(g){const seen=new Map();for(const t of Object.values(g.board))for(const[dx,dy]of DIR){const x=t.x+dx,y=t.y+dy,k=key(x,y);if(!g.board[k])seen.set(k,{x,y});}return[...seen.values()];}
function valid(g,t,x,y,bridge=null){
 if(!Number.isInteger(x)||!Number.isInteger(y)||Math.abs(x)>200||Math.abs(y)>200)return{ok:false,reason:'位置超出地图范围'};
 if(g.board[key(x,y)])return{ok:false,reason:'这个位置已经有版图'};
 const def=definition({...t,bridge:bridge??t.bridge});let adjacent=0;
 for(let s=0;s<4;s++){const[dx,dy]=DIR[s],other=g.board[key(x+dx,y+dy)];if(!other)continue;adjacent++;const a=def.edges[s],b=definition(other).edges[(s+2)%4];if(a!=='H'&&b!=='H'&&a!==b)return{ok:false,reason:`${['上','右','下','左'][s]}侧地形不匹配：${terrain(a)}不能接${terrain(b)}`,side:s};}
 if(!adjacent)return{ok:false,reason:'版图至少一条完整边须接住地图，不能只碰角'};
 if(t.type.startsWith('river')){
  if(!g.riverEnd)return{ok:false,reason:'河流已经封闭'};
  const e=g.riverEnd,[dx,dy]=DIR[e.side];if(x!==e.x+dx||y!==e.y+dy)return{ok:false,reason:'河流阶段必须接续亮起的开放河端'};
  const incoming=(e.side+2)%4;if(def.edges[incoming]!=='V')return{ok:false,reason:'河道必须接续已有河水，先旋转版图'};
  const next=def.edges.findIndex((v,s)=>v==='V'&&s!==incoming);
  if(next>=0&&next!==e.side){const sign=(next-e.side+4)%4===1?1:-1;if(g.lastRiverBend===sign)return{ok:false,reason:'河流不能连续两次向同一方向转弯'};}
 }
 if(bridge!=null){const base=definition({...t,bridge:null});if(!g.extensions.includes('buildings')||g.buildSupply.bridge<1||base.edges[bridge]!=='F'||base.edges[(bridge+2)%4]!=='F')return{ok:false,reason:'桥只能在相对两条纯草地边之间建造'};let road=false;for(const s of[bridge,(bridge+2)%4]){const[dx,dy]=DIR[s],ot=g.board[key(x+dx,y+dy)];if(ot){if(ot.bridge!=null&&definition(ot).edges[(s+2)%4]==='R')return{ok:false,reason:'不能让两个桥端直接相连'};if(definition(ot).edges[(s+2)%4]==='R')road=true;}}if(!road)return{ok:false,reason:'建桥必须接续至少一个已有道路端'};}
 return{ok:true};
}
function terrain(e){return{C:'城市',R:'道路',F:'草地',V:'河流',H:'市政厅'}[e]||e;}
function legalPlacements(g,t=g.current){if(!t)return[];const a=[];for(const pos of frontiers(g))for(let rot=0;rot<4;rot++){const z={...t,rot};if(valid(g,z,pos.x,pos.y).ok)a.push({...pos,rot,bridge:null});else if(g.extensions.includes('buildings')&&g.buildSupply.bridge)for(let bridge=0;bridge<2;bridge++)if(valid(g,z,pos.x,pos.y,bridge).ok)a.push({...pos,rot,bridge});}return a;}
function graph(g){
 const nodes=new Map(),parent=new Map();
 const find=k=>{let p=k;while(parent.get(p)!==p)p=parent.get(p);while(k!==p){const n=parent.get(k);parent.set(k,p);k=n;}return p;};
 const join=(a,b)=>{if(!parent.has(a)||!parent.has(b))return;const x=find(a),y=find(b);if(x!==y)parent.set(y,x);};
 for(const t of Object.values(g.board))for(const f of definition(t).features){const id=t.uid+':'+f.id;nodes.set(id,{...f,tile:t,key:id});parent.set(id,id);}
 for(const t of Object.values(g.board)){const d=definition(t);for(let s=0;s<4;s++){
  const[dx,dy]=DIR[s],other=g.board[key(t.x+dx,t.y+dy)];if(!other||t.type==='hall'||other.type==='hall')continue;const od=definition(other),op=(s+2)%4;
  for(const f of d.features)if(f.type==='city'||f.type==='road'||f.type==='river'){if(f.sides.includes(s)){const q=od.features.find(q=>q.type===f.type&&q.sides.includes(op));if(q)join(t.uid+':'+f.id,other.uid+':'+q.id);}}
  for(let p=0;p<2;p++){const f=d.features.find(f=>f.type==='field'&&f.ports.includes(s*2+p)),q=od.features.find(q=>q.type==='field'&&q.ports.includes(op*2+1-p));if(f&&q)join(t.uid+':'+f.id,other.uid+':'+q.id);}
 }}
 const groups=new Map();for(const[k,n]of nodes){const r=find(k);if(!groups.has(r))groups.set(r,{id:r,type:n.type,nodes:[],tiles:new Set(),meeples:[],open:0,shields:0,inn:false,cathedral:false});const c=groups.get(r);c.nodes.push(n);c.tiles.add(n.tile.uid);if(n.type==='city'){c.shields+=n.id==='c0'?(TEMPLATES[n.tile.type].shield||0):0;c.cathedral ||=!!n.tile.cathedral;}if(n.type==='road')c.inn ||=!!n.tile.inn;for(const s of n.sides){const[dx,dy]=DIR[s];if(!g.board[key(n.tile.x+dx,n.tile.y+dy)])c.open++;}}
 for(const m of g.meeples){if(!m.node)continue;if(parent.has(m.node))groups.get(find(m.node)).meeples.push(m);}
 return{nodes,groups,find,get(node){return parent.has(node)?groups.get(find(node)):null;}};
}
function strength(m){return m.kind==='large'?2:m.kind==='mayor'||(m.kind==='scarecrow'&&!m.lying)||m.kind==='shepherd'?0:1;}
function scoreValue(g,c,final=false){
 if(c.type==='road'){let v=0;for(const n of c.nodes)if(n.bridge)v+=final?1:3;const count=new Set(c.nodes.filter(n=>!n.bridge).map(n=>n.tile.uid)).size;return v+count*(c.inn&&!final?2:1);}
 if(c.type==='city')return(c.tiles.size+c.shields)*(final?1:c.cathedral?3:2);
 if(c.type==='monastery'||c.type==='garden'){const t=c.nodes[0].tile;let n=t.type==='hall'?0:1;for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)if(dx||dy){const q=g.board[key(t.x+dx,t.y+dy)];if(q&&q.type!=='hall')n++;}return n;}
 if(c.type==='field'){const gr=graph(g),cities=new Set();for(const n of c.nodes)for(const id of n.touches||[]){const city=gr.get(n.tile.uid+':'+id);if(city&&city.open===0)cities.add(city.id);}return cities.size*3;}
 return 0;
}
function complete(g,c){if(c.type==='road'||c.type==='city')return c.open===0;if(c.type==='monastery'||c.type==='garden'){const t=c.nodes[0].tile;for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)if(!g.board[key(t.x+dx,t.y+dy)])return false;return true;}return false;}
function remove(g,m){
 if(m.builder){g.players[m.player].supply.builder++;delete m.builder;}if(m.pig){g.players[m.player].supply.pig++;delete m.pig;}
 if(m.emblem!=null){g.players[m.player].emblems.push(m.emblem);delete m.emblem;}
 if(m.sheep?.length)g.sheepBag.push(...m.sheep);
 if(['maiden','watchman','acrobat'].includes(m.kind))g.players[m.player].supply.normal++;else g.players[m.player].supply[m.kind]++;
 g.meeples=g.meeples.filter(x=>x.id!==m.id);if(g.fairy===m.id)g.fairy=null;
}
function addMeeple(g,p,kind,node,extra={}){const m={id:'m'+g.round+'-'+g.meeples.length+'-'+g.revision,player:p,kind,node,...extra};g.meeples.push(m);g.players[p].supply[kind]--;return m;}
function nodePosition(g,m){const[tuid,fid]=(m.node||'').split(':');const t=Object.values(g.board).find(t=>t.uid===tuid);if(!t)return m.pos||null;return{tile:t,feature:definition(t).features.find(f=>f.id===fid),x:t.x,y:t.y};}
function options(g,p=g.turn){
 if(g.phase!=='meeple')return[];const t=g.board[key(g.last.x,g.last.y)],d=definition(t),gr=graph(g),s=g.players[p].supply,res=[];
 const allowed=(kind,f)=>{if(f.type==='river'||t.type==='hall'||t.hoard)return false;if(kind==='normal'||kind==='large'||kind==='ringmaster')return['road','city','field','monastery'].includes(f.type);if(kind==='abbot')return['monastery','garden'].includes(f.type);if(kind==='mayor')return f.type==='city';if(kind==='scarecrow'||kind==='shepherd')return f.type==='field';if(kind==='messenger')return f.type==='road';return false;};
 const candidateTiles=t.portal?Object.values(g.board):[t];
 for(const at of candidateTiles){if(at.hoard||at.type==='hall')continue;for(const f of definition(at).features){const c=gr.get(at.uid+':'+f.id);for(const kind of Object.keys(s)){if(!s[kind]||!allowed(kind,f))continue;if(at!==t&&complete(g,c))continue;
  const ignore=['mayor','scarecrow'].includes(kind);if(kind==='shepherd'){if(c.meeples.some(m=>m.kind==='shepherd'))continue;}else if(!ignore&&c.meeples.length)continue;
  res.push({kind,node:at.uid+':'+f.id,x:at.x,y:at.y,pos:f.pos,type:f.type});
 }}}
 if(g.extensions.includes('towers'))for(const at of Object.values(g.board))if(at.tower&&s.normal&&((at.x===t.x&&Math.abs(at.y-t.y)<=at.tower)||(at.y===t.y&&Math.abs(at.x-t.x)<=at.tower)))res.push({kind:'watchman',node:null,x:at.x,y:at.y,pos:[.5,.38],type:'tower'});
 if(t.acrobat&&s.normal)res.push({kind:'acrobat',node:null,x:t.x,y:t.y,pos:[.5,.5],type:'acrobat'});
 else if(s.normal&&g.extensions.includes('circus'))for(const at of Object.values(g.board))if(at.acrobat&&Math.abs(at.x-t.x)<=1&&Math.abs(at.y-t.y)<=1&&g.meeples.filter(m=>m.kind==='acrobat'&&m.pos.x===at.x&&m.pos.y===at.y).length<3)res.push({kind:'acrobat',node:null,x:at.x,y:at.y,pos:[.5,.5],type:'acrobat'});
 return res;
}
function draw(g){
 if(g.ended)return;
 if(g.phase==='finalPrizes'){if(g.players.some(p=>p.prize))return;if(g.players.some(p=>p.hall)){g.phase='hallOnly';g.current=null;return;}finish(g);return;}
 if(g.riverDeck.length){g.current=g.riverDeck.shift();g.riverPhase=true;}
 else{g.riverPhase=false;if(!g.deck.length){if(g.players.some(p=>p.prize)){g.phase='finalPrizes';g.current=null;while(!g.players[g.turn].prize)g.turn=(g.turn+1)%g.players.length;return;}if(g.joust&&g.joust.prizesLeft>0&&!g.joust.finalDone){tournament(g,true);g.phase='finalPrizes';g.current=null;if(g.players.some(p=>p.prize)){while(!g.players[g.turn].prize)g.turn=(g.turn+1)%g.players.length;}else{g.phase='tile';draw(g);}return;}if(g.players.some(p=>p.hall)){g.phase='hallOnly';g.current=null;return;}finish(g);return;}if(g.joust&&g.deck.length<=g.joust.nextAt){tournament(g,false);g.joust.nextAt-=g.joust.size;}g.current=g.deck.shift();}
 if(g.dragon?.owner!=null&&g.dragon.owner===g.turn){const hoard=Object.values(g.board).find(t=>t.hoard);if(hoard)g.dragon={x:hoard.x,y:hoard.y,dir:orientDragon(g,hoard.x,hoard.y),owner:null};}
 if(!g.current.drawEventsResolved){
  if(g.current.dragonSymbol&&g.dragon&&g.dragon.owner==null)dragonMove(g);
  if(g.current.thief)thieves(g);
  if(g.current.siege)for(const post of g.current.siege)attack(g,post);
  g.current.drawEventsResolved=true;
 }
 if(!legalPlacements(g).length){log(g,'抽到的版图没有合法位置，自动移出并重新抽取。');draw(g);return;}
 g.phase=g.players[g.turn].prize?'prize':'tile';
}
function orientDragon(g,x,y){
 const choices=[];for(let s=0;s<4;s++){const[dx,dy]=DIR[s];if(!g.board[key(x+dx,y+dy)])continue;let found=false;for(let i=1;i<300;i++){const t=g.board[key(x+dx*i,y+dy*i)];if(!t)break;if(g.meeples.some(m=>{const q=nodePosition(g,m);return q&&q.x===t.x&&q.y===t.y&&!m.barn&&m.kind!=='maiden';}))found=true;}choices.push({s,found});}
 return(choices.find(c=>c.found)||choices[0]||{s:0}).s;
}
function dragonMove(g){for(let n=0;n<2;n++){const dr=g.dragon,[dx,dy]=DIR[dr.dir];for(let i=0;i<300;i++){const t=g.board[key(dr.x+dx,dr.y+dy)];if(!t)break;dr.x+=dx;dr.y+=dy;const at=g.meeples.filter(m=>{const p=nodePosition(g,m);return p&&p.x===dr.x&&p.y===dr.y&&!m.barn&&m.kind!=='maiden';});const protectedM=at.find(m=>m.id===g.fairy);for(const m of at)if(m!==protectedM)remove(g,m);if(protectedM){dr.owner=protectedM.player;log(g,'仙女保护米宝，巨龙被赶出地图。');return;}}dr.dir=orientDragon(g,dr.x,dr.y);}log(g,'巨龙完成两次直线移动，途经的米宝已回到库存。');}
function thieves(g){const n=g.current.thief;for(const t of Object.values(g.board))if(t.tower&&!g.meeples.some(m=>m.kind==='watchman'&&m.pos.x===t.x&&m.pos.y===t.y)&&t.tower<5&&g.towerSupply>0){t.tower++;g.towerSupply--;}
 const guards=g.meeples.filter(m=>m.kind==='watchman');if(!guards.length){g.stolen=n;g.current=g.towerDeck.length?g.towerDeck.shift():g.deck.shift();if(!g.current)g.current=tile('cityCap',{tower:1});log(g,'盗贼偷走版图，改抽塔版图。');}else{for(const m of guards){give(g,m.player,n+g.stolen,'守望者悬赏',m.pos.x,m.pos.y);remove(g,m);}g.stolen=0;}}
function attack(g,post){if(!g.fort.catapults[post]){g.fort.catapults[post]=true;log(g,`投石机在${['骑士','道路','修道院'][post]}岗前推进。`);return;}const all=[...g.fort.rows[post],...g.fort.extras[post]];for(let p=0;p<g.players.length;p++){const n=all.filter(v=>v===p).length;give(g,p,n*3,'岗哨防御');if(!n){const gr=graph(g),m=g.meeples.find(m=>m.player===p&&['normal','large','abbot'].includes(m.kind)&&[post===0?'city':post===1?'road':'monastery',...(post===2?['garden']:[])].includes(gr.get(m.node)?.type));if(m){remove(g,m);log(g,`${g.players[p].name} 缺少守軍，收回一枚对应地图米宝。`);}}g.players[p].supply.normal+=n;}g.fort.rows[post]=[];g.fort.extras[post]=[];g.fort.catapults[post]=false;}
function herd(g,m){const gr=graph(g),c=gr.get(m.node),all=c.meeples.filter(x=>x.kind==='shepherd'),n=all.reduce((n,x)=>n+(x.sheep||[]).reduce((a,b)=>a+b,0),0);for(const s of all){const pos=nodePosition(g,s);give(g,s.player,n,'赶羊收获',pos.x,pos.y);if(s===m){let geese=Object.values(g.board).filter(t=>t.geese&&Math.abs(t.x-pos.x)<=1&&Math.abs(t.y-pos.y)<=1).length;give(g,s.player,geese,'鹅群奖励',pos.x,pos.y);}remove(g,s);}}
function grow(g,m){if(!g.sheepBag.length){herd(g,m);return;}const n=g.sheepBag.splice(Math.floor(random(g)*g.sheepBag.length),1)[0];if(n){(m.sheep||(m.sheep=[])).push(n);log(g,`羊群增加 ${n} 只。`);}else{const all=graph(g).get(m.node).meeples.filter(m=>m.kind==='shepherd');g.sheepBag.push(0);for(const s of all)remove(g,s);log(g,'摸到狼！同片草地的羊群逃走，牧羊人收回。');}}
function tournament(g,final){
 const j=g.joust,entries=[],category=['road','city','field'][j.category],gr=graph(g);
 for(let p=0;p<g.players.length;p++){const candidates=g.meeples.filter(m=>m.player===p&&m.emblem!=null&&gr.get(m.node)?.type===category).map(m=>{const c=gr.get(m.node),pos=nodePosition(g,m);let n=c.tiles.size;if(category==='field'){n=0;for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)if((dx||dy)&&g.board[key(pos.x+dx,pos.y+dy)]?.type!=='hall'&&g.board[key(pos.x+dx,pos.y+dy)])n++;if(n===8)for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)if(Math.abs(dx)===2||Math.abs(dy)===2){const t=g.board[key(pos.x+dx,pos.y+dy)];if(t&&t.type!=='hall')n++;}}return{p,m,value:n+m.emblem};}).sort((a,b)=>b.value-a.value);if(candidates.length)entries.push(candidates[0]);}
 entries.sort((a,b)=>b.value-a.value||((a.p-g.turn+g.players.length)%g.players.length)-((b.p-g.turn+g.players.length)%g.players.length));
 const prizes=Math.min(j.per,j.prizesLeft),winners=[];for(let i=0;i<entries.length;){const same=entries.filter(e=>e.value===entries[i].value);if(winners.length+same.length>prizes)break;winners.push(...same);i+=same.length;}
 const best=entries[0]?.value,unique=entries.filter(e=>e.value===best).length===1;
 for(const e of entries){if(winners.includes(e)){g.players[e.p].prize++;j.prizesLeft--;if(e.value===best&&unique)g.players[e.p].prizeEmblem=e.m.emblem;}delete e.m.emblem;}
 log(g,`${['道路','城市','草地'][j.category]}比武：${entries.length?entries.map(e=>g.players[e.p].name+' '+e.value).join(' / '):'无人有符合的提名'}。${winners.length?'获奖：'+winners.map(e=>g.players[e.p].name).join('、'):'未发奖'}`);
 j.category=(j.category+1)%3;if(final)j.finalDone=true;
}
function triggerEnclosed(g){const gr=graph(g);for(const m of[...g.meeples])if(m.kind==='mayor'||(m.kind==='scarecrow'&&!m.lying)){const pos=nodePosition(g,m);if(!pos)continue;const enclosed=DIR.every(([dx,dy])=>g.board[key(pos.x+dx,pos.y+dy)]);if(!enclosed)continue;
 if(m.kind==='mayor'){const last=g.board[key(g.last.x,g.last.y)];if(last.type!=='hall'){const other=gr.get(m.node)?.meeples.find(z=>z.player!==m.player&&z.kind==='normal');if(other&&g.players[m.player].supply.normal){if(other.builder){g.players[other.player].supply.builder++;delete other.builder;}if(other.pig){g.players[other.player].supply.pig++;delete other.pig;}if(other.emblem!=null){g.players[other.player].emblems.push(other.emblem);delete other.emblem;}g.players[other.player].supply.normal++;other.player=m.player;g.players[m.player].supply.normal--;log(g,'市长让一枚对手骑士转为自己的颜色。');}}remove(g,m);}else{m.lying=true;log(g,'稻草人被四边围住，躺倒成为农夫。');}}}
function settle(g,final=false){
 const gr=graph(g);let emptyCompleted=false,shieldDone=false;
 for(const c of gr.groups.values()){
  if(c.type==='field'&&!final||c.type==='river')continue;
  const done=complete(g,c);if(!final&&!done)continue;
  if(c.type==='city'&&c.nodes.some(n=>g.castles.some(b=>b.nodes.includes(n.key))))continue;
  const stamp=c.nodes.map(n=>n.key).sort().join('|');if(!final&&g.completed?.includes(stamp))continue;
  if(!final){(g.completed||(g.completed=[])).push(stamp);if(c.shields)shieldDone=true;}
  const participants=c.meeples.filter(m=>!['shepherd','acrobat','watchman','maiden'].includes(m.kind));
  const totals=Array(g.players.length).fill(0);for(const m of participants)totals[m.player]+=strength(m);
  const max=Math.max(...totals),who=[...new Set(participants.map(m=>m.player))].filter(p=>totals[p]===max),value=scoreValue(g,c,final&& !done||c.type==='field');
  const pos=c.nodes[0].tile;
  for(const p of who)give(g,p,value,({road:'道路',city:'城市',monastery:'修道院',garden:'花园',field:'农夫草地'}[c.type])+(final?' · 终局':''),pos.x,pos.y);
  if(!final&&['city','road'].includes(c.type)&&!who.includes(g.turn))emptyCompleted=true;
  if(!final&&c.type==='city'){for(const n of c.nodes)if(n.tile.good!=null){g.players[g.turn].goods[n.tile.good]++;log(g,`${g.players[g.turn].name} 获得${['鸡','谷物','布'][n.tile.good]}货物。`);}}
  for(const m of participants){
   const mp=nodePosition(g,m);
   if(g.fairy===m.id)give(g,m.player,3,'仙女奖励',mp.x,mp.y);
   if(m.kind==='ringmaster'){const n=Object.values(g.board).filter(t=>(t.circus||t.acrobat)&&Math.abs(t.x-mp.x)<=1&&Math.abs(t.y-mp.y)<=1).length;give(g,m.player,n*2,'团长奖励',mp.x,mp.y);}
   if(!final&&['monastery','garden'].includes(c.type)){const n=Object.values(g.board).filter(t=>t.vineyard&&Math.abs(t.x-mp.x)<=1&&Math.abs(t.y-mp.y)<=1&&(t.x!==mp.x||t.y!==mp.y)).length;give(g,m.player,n*3,'葡萄园',mp.x,mp.y);}
   if(!final&&m.kind==='messenger'&&c.type==='road'){
    const next=[];for(const n of c.nodes){const d=definition(n.tile);for(const f of d.features)if(f.type==='road'&&f.id!==n.id&&d.village||f.type==='city'){const q=gr.get(n.tile.uid+':'+f.id);if(q&&!complete(g,q))next.push(q.nodes[0].key);}}
    if(next.length){m.node=next[0];log(g,'信使转移到相接的未完成道路或城市。');continue;}
   }
   remove(g,m);
  }
 }
 if(!final&&shieldDone){const now=graph(g);for(const m of[...g.meeples])if(m.pig){const c=now.get(m.node),pos=nodePosition(g,m);give(g,m.player,scoreValue(g,c,true),'猪的草地奖励',pos.x,pos.y);g.players[m.player].supply.pig++;delete m.pig;if(m.returnFarmer)remove(g,m);}}
 if(emptyCompleted&&g.extensions.includes('dragon'))g.canFairy=true;
}
function performance(g,circus){if(!circus)return;for(const m of g.meeples){if(m.barn||m.kind==='maiden')continue;const pos=nodePosition(g,m);if(pos&&Math.abs(pos.x-circus.x)<=1&&Math.abs(pos.y-circus.y)<=1)give(g,m.player,circus.value,'马戏演出',pos.x,pos.y);}}
function finish(g){if(g.ended)return;performance(g,g.circus);for(let post=0;post<3;post++){const all=[...g.fort.rows[post],...g.fort.extras[post]];for(let p=0;p<g.players.length;p++)give(g,p,all.filter(v=>v===p).length*3,'最终反击');}
 for(const m of[...g.meeples]){if(m.kind==='watchman')give(g,m.player,5+g.stolen,'守望者终局');if(m.kind==='acrobat')give(g,m.player,5,'杂技演员终局');if(m.kind==='maiden')give(g,m.player,0,'未收回少女');}
 settle(g,true);
 if(g.extensions.includes('traders'))for(let i=0;i<3;i++){const max=Math.max(...g.players.map(p=>p.goods[i]));if(max>0)for(let p=0;p<g.players.length;p++)if(g.players[p].goods[i]===max)give(g,p,10,['鸡','谷物','布'][i]+'货物多数');}
 const gr=graph(g);for(const t of Object.values(g.board))if(t.statuePlayer!=null){const c=gr.get(t.uid+':c0');give(g,t.statuePlayer,c.shields*3,'雕像纹章');}
 g.ended=true;g.phase='end';const max=Math.max(...g.players.map(p=>p.score));g.winner=g.players.map((p,i)=>p.score===max?i:-1).filter(i=>i>=0);log(g,'本局结束！'+g.winner.map(i=>g.players[i].name).join('、')+' 获胜。');
}
function resolve(g){
 delete g._meepleUndo;delete g.meepleDraft;
 triggerEnclosed(g);settle(g);
 const t=g.board[key(g.last.x,g.last.y)];if(t.circus){performance(g,g.circus);g.circus={x:t.x,y:t.y,value:g.performance.shift()||3};}
 if(g.canFairy&&g.meeples.some(m=>m.player===g.turn&&!m.barn&&m.kind!=='maiden')){g.phase='fairy';return;}
 advance(g);
}
function advance(g){g.canFairy=false;g.current=null;const bonus=g.builderBonus;g.builderBonus=false;if(bonus){g.players[g.turn].supply.builder++;log(g,'建筑师触发额外回合。');}else g.turn=(g.turn+1)%g.players.length;g.round++;g.phase='tile';g.last=null;draw(g);if(['hallOnly','finalPrizes'].includes(g.phase)&&!g.players[g.turn].hall&&!g.players[g.turn].prize){for(let i=0;i<g.players.length;i++){if(g.players[g.turn].hall||g.players[g.turn].prize)break;g.turn=(g.turn+1)%g.players.length;}}
}
function apply(g,action,p=g.turn){
 if(g.ended)return{ok:false,reason:'本局已经结束'};if(p!==g.turn)return{ok:false,reason:'还没有轮到你，请等待当前玩家'};g.events=[];
 const fail=reason=>({ok:false,reason});const player=g.players[p];
 if(g.meepleDraft?.type==='abbotReturn'&&!['endTurn','undoMeeple'].includes(action.type))return fail('已预选收回修道院长，请先取消收回，或点击结束回合确认');
 if(action.type==='place'){
  if(!['tile','prize','hallOnly','finalPrizes'].includes(g.phase))return fail('先完成本回合的米宝或特殊行动');
  let t=g.current;if(g.phase==='prize'||g.phase==='finalPrizes'){if(!player.prize)return fail('没有待放的奖图');t=tile('prize',{uid:'prize-'+g.revision,statuePlayer:player.prizeEmblem!=null?p:null});}
  if(action.hall){if(!player.hall)return fail('市政厅已经使用');if(g.phase==='prize'||g.phase==='finalPrizes')return fail('请先放待放奖图');t=tile('hall',{uid:'hall-'+g.revision});}
  if(!t)return fail('普通牌堆已结束，请使用保留的市政厅');
  t={...t,rot:((action.rot||0)%4+4)%4};const check=valid(g,t,action.x,action.y,action.bridge);if(!check.ok)return check;
  const previous=[...g.meeples];t.x=action.x;t.y=action.y;if(action.bridge!=null){t.bridge=action.bridge;g.buildSupply.bridge--;}
  g.board[key(t.x,t.y)]=t;g.last={x:t.x,y:t.y};
  if(t.tower){g.towerSupply=Math.max(0,g.towerSupply-1);}
  if(t.hoard)g.dragon={x:t.x,y:t.y,dir:orientDragon(g,t.x,t.y),owner:null};
  if(t.type.startsWith('river')){const incoming=(g.riverEnd.side+2)%4,d=definition(t),next=d.edges.findIndex((e,s)=>e==='V'&&s!==incoming);if(next<0)g.riverEnd=null;else{if(next!==g.riverEnd.side)g.lastRiverBend=(next-g.riverEnd.side+4)%4===1?1:-1;g.riverEnd={x:t.x,y:t.y,side:next};}}
  if(t.type==='hall'){player.hall=false;if(g.current){if(g.riverPhase)g.riverDeck.unshift(g.current);else g.deck.unshift(g.current);}for(const m of[...g.meeples])if(m.kind==='mayor'){const pos=nodePosition(g,m);if(pos&&Math.abs(pos.x-t.x)+Math.abs(pos.y-t.y)===1)remove(g,m);}}
  if(g.phase==='prize'||g.phase==='finalPrizes'){player.prize--;player.prizeEmblem=null;settle(g);g.phase=g.phase==='finalPrizes'?'finalPrizes':'tile';if(g.phase==='finalPrizes'){advance(g);}return success(g);}
  const after=graph(g),def=definition(t);
  for(const m of previous){const c=after.get(m.node);if(!c)continue;const extended=def.features.some(f=>after.get(t.uid+':'+f.id)?.id===c.id);if(extended&&m.builder&&t.type!=='hall'&&m.player===p){delete m.builder;g.builderBonus=true;}if(extended&&m.kind==='shepherd'&&m.player===p&&t.type!=='hall')g.sheepChoice=m.id;}
  g.phase='meeple';g.newMeeple=null;g.built=action.bridge!=null;g.nomination=false;log(g,`${player.name} 放置${tileName(t)}。`);return success(g);
 }
 if(action.type==='meeple'){
  if(g.phase!=='meeple'||g.newMeeple)return fail('本回合已经放过米宝，或还没有放版图');
  const opt=options(g,p).find(o=>o.kind===action.kind&&o.node===action.node&&(o.node||o.x===action.x&&o.y===action.y));if(!opt)return fail('该地形已有米宝，或这个棋子不能放在这里');
  if(action.kind==='acrobat'&&g.meeples.filter(m=>m.kind==='acrobat'&&m.pos.x===opt.x&&m.pos.y===opt.y).length>=3)return fail('杂技金字塔已经满三枚');
  // Keep this private on the server; undo restores the exact pre-assignment state.
  delete g._meepleUndo;delete g.meepleDraft;
  g._meepleUndo=JSON.parse(JSON.stringify(g));
  g.meepleDraft={player:p,round:g.round,post:action.post??null};
  let m;if(action.kind==='watchman'||action.kind==='acrobat'){
   const at=g.board[key(opt.x,opt.y)];if(action.kind==='watchman'){const old=g.meeples.find(m=>m.kind==='watchman'&&m.pos.x===at.x&&m.pos.y===at.y);if(old){if(old.player!==p)g.meepleDraft.watchmanReward=old.player;remove(g,old);}}
   m=addMeeple(g,p,'normal',null,{kind:action.kind,pos:{x:opt.x,y:opt.y}});
  }else m=addMeeple(g,p,action.kind,action.node);
  g.newMeeple=m.id;g.meepleDraft.id=m.id;g.meepleDraft.featureType=opt.type;
  if(action.builder&&['normal','large'].includes(m.kind)&&['road','city'].includes(opt.type)&&player.supply.builder){m.builder=true;player.supply.builder--;}
  if(action.pig&&['normal','large'].includes(m.kind)&&opt.type==='field'&&player.supply.pig){m.pig=true;m.returnFarmer=!!action.returnFarmer;player.supply.pig--;}
  // Revealing sheep and scoring a post/replaced guard waits for End Turn.
  return success(g);
 }
 if(action.type==='undoMeeple'){
  if(g.phase!=='meeple'||!g.newMeeple||!g.meepleDraft||!g._meepleUndo||g.meepleDraft.player!==p||g.meepleDraft.round!==g.round)return fail('只有本回合待确认的米宝可以撤销；结束回合后不能修改');
  const revision=g.revision,snapshot=g._meepleUndo;
  for(const k of Object.keys(g))delete g[k];Object.assign(g,JSON.parse(JSON.stringify(snapshot)));
  g.revision=revision;g.events=[];return success(g);
 }
 if(action.type==='orient'){
  if(g.phase!=='meeple'||!g.dragon||g.dragon.owner!=null)return fail('只能在自己的行动阶段给地图上的巨龙定向');
  const s=Number(action.dir);if(!Number.isInteger(s)||s<0||s>3)return fail('方向无效');
  const dr=g.dragon,choices=[];for(let d=0;d<4;d++){const[dx,dy]=DIR[d];if(!g.board[key(dr.x+dx,dr.y+dy)])continue;let visible=false;for(let n=1;n<300;n++){const t=g.board[key(dr.x+dx*n,dr.y+dy*n)];if(!t)break;if(g.meeples.some(m=>{const p=nodePosition(g,m);return p&&p.x===t.x&&p.y===t.y&&!m.barn&&m.kind!=='maiden';}))visible=true;}choices.push({d,visible});}
  if(!choices.some(c=>c.d===s)||choices.some(c=>c.visible)&&!choices.some(c=>c.d===s&&c.visible))return fail('巨龙必须朝相邻版图；视野内有米宝时须朝其中一个合法目标');
  dr.dir=s;return success(g);
 }
 if(action.type==='endTurn'){
  if(g.phase!=='meeple')return fail('当前不能结束回合');
  const draft=g.meepleDraft,m=g.meeples.find(m=>m.id===g.newMeeple);
  delete g._meepleUndo;delete g.meepleDraft;
  if(draft&&m){
   if(draft.watchmanReward!=null)give(g,draft.watchmanReward,2,'守望者被替换');
   if(m.kind==='shepherd')grow(g,m);
   const post=Number(draft.post),type=draft.featureType;
   if(draft.post!=null&&Number.isInteger(post)&&post>=0&&post<3&&g.extensions.includes('siege')&&['normal','large','abbot'].includes(m.kind)&&player.supply.normal){
    const expected=type==='city'?0:type==='road'?1:['monastery','garden'].includes(type)?2:null;
    if(type==='field'){g.fort.extras[post].push(p);player.supply.normal--;}
    else if(expected===post&&g.fort.rows[post].length<g.fort.capacity){g.fort.rows[post].push(p);player.supply.normal--;if(g.fort.rows[post].length===g.fort.capacity){const all=[...g.fort.rows[post],...g.fort.extras[post]];for(let z=0;z<g.players.length;z++){const n=all.filter(q=>q===z).length;give(g,z,n*3,'岗哨反击');g.players[z].supply.normal+=n;}g.fort.rows[post]=[];g.fort.extras[post]=[];g.fort.catapults[post]=false;}}
   }
  }
  if(draft?.type==='abbotReturn'){
   const abbot=g.meeples.find(m=>m.id===draft.id&&m.player===p&&m.kind==='abbot');
   if(abbot){const c=graph(g).get(abbot.node),pos=nodePosition(g,abbot);give(g,p,scoreValue(g,c,true),'提前收回修道院长',pos.x,pos.y);const vines=Object.values(g.board).filter(t=>t.vineyard&&Math.abs(t.x-pos.x)<=1&&Math.abs(t.y-pos.y)<=1&&(t.x!==pos.x||t.y!==pos.y)).length;give(g,p,vines*3,'葡萄园');if(g.fairy===abbot.id)give(g,p,3,'仙女奖励',pos.x,pos.y);remove(g,abbot);}
  }
  if(g.sheepChoice){const m=g.meeples.find(m=>m.id===g.sheepChoice);if(m){const c=graph(g).get(m.node);(action.herd||c.open===0&&c.nodes.every(n=>n.ports.every(port=>{const side=Math.floor(port/2),[dx,dy]=DIR[side];return !!g.board[key(n.tile.x+dx,n.tile.y+dy)];})))?herd(g,m):grow(g,m);}g.sheepChoice=null;}resolve(g);return success(g);
 }
 if(action.type==='abbot'){
  if(g.phase!=='meeple'||g.newMeeple)return fail('提前收回修道院长必须替代本回合放米宝');const m=g.meeples.find(m=>m.player===p&&m.kind==='abbot'&&(!action.id||m.id===action.id));if(!m)return fail('地图上没有可收回的自己的修道院长');
  delete g._meepleUndo;delete g.meepleDraft;g._meepleUndo=JSON.parse(JSON.stringify(g));
  g.newMeeple='abbotReturn';g.meepleDraft={type:'abbotReturn',id:m.id,player:p,round:g.round};
  return success(g);
 }
 if(action.type==='fairy'){
  if(g.phase!=='fairy')return fail('本回合未获得移动仙女机会');if(action.id){const m=g.meeples.find(m=>m.id===action.id&&m.player===p&&!m.barn&&m.kind!=='maiden');if(!m)return fail('只能保护自己地图上合法的米宝');g.fairy=m.id;}advance(g);return success(g);
 }
 if(action.type==='nominate'){
  if(g.phase!=='meeple'||!g.joust||g.nomination)return fail('本回合没有提名机会');const m=g.meeples.find(m=>m.id===action.id&&m.player===p&&m.emblem==null&&['normal','large','scarecrow'].includes(m.kind));if(!m)return fail('只能提名已有旅人、骑士或农夫');const gr=graph(g),c=gr.get(m.node),t=g.board[key(g.last.x,g.last.y)];if(!['city','road','field'].includes(c?.type)||!definition(t).features.some(f=>gr.get(t.uid+':'+f.id)?.id===c.id)||t.type==='hall')return fail('本回合必须延伸该米宝的地形');const n=Number(action.emblem);if(!player.emblems.includes(n))return fail('没有这个数字的纹章');player.emblems.splice(player.emblems.indexOf(n),1);m.emblem=n;g.nomination=true;return success(g);
 }
 if(action.type==='pyramid'){
  if(g.phase!=='meeple'||g.newMeeple)return fail('结算金字塔需要替代放米宝');const all=g.meeples.filter(m=>m.kind==='acrobat'&&m.pos.x===action.x&&m.pos.y===action.y);if(all.length!==3||!all.some(m=>m.player===p))return fail('只能结算有自己演员参与的完整金字塔');for(const m of all){give(g,m.player,5,'杂技金字塔',action.x,action.y);g.players[m.player].supply.normal++;g.meeples=g.meeples.filter(q=>q.id!==m.id);}g.newMeeple='pyramid';resolve(g);return success(g);
 }
 if(action.type==='castle'){
  if(g.phase!=='meeple'||g.built||!g.extensions.includes('buildings')||!g.buildSupply.castle)return fail('本回合已建建筑或没有城堡库存');const t=g.board[key(g.last.x,g.last.y)],gr=graph(g),c=gr.get(action.node);if(!c||c.type!=='city'||c.nodes.length!==2||c.open||!c.nodes.some(n=>n.tile.uid===t.uid)||c.meeples.some(m=>m.kind!=='normal'||m.builder))return fail('只有刚完成的两段小城、且没有特殊棋子时可建城堡');if(c.nodes.some(n=>n.sides.some(s=>{const[dx,dy]=DIR[s];return g.board[key(n.tile.x+dx,n.tile.y+dy)]?.type==='hall';})))return fail('接市政厅的小城不能建城堡');const ids=c.nodes.map(n=>n.key);for(const n of c.nodes)n.tile.castle=true;const pos=c.nodes[0].tile;for(const m of c.meeples){m.bornRound=g.round;if(g.fairy===m.id)g.fairy=null;m.kind='maiden';m.pos={x:pos.x,y:pos.y};m.node=null;}g.castles.push({x:pos.x,y:pos.y,nodes:ids});if(!c.meeples.length&&player.supply.normal&&!g.newMeeple){const m=addMeeple(g,p,'normal',null,{kind:'maiden',pos:{x:pos.x,y:pos.y}});g.newMeeple=m.id;}g.buildSupply.castle--;g.built=true;return success(g);
 }
 if(action.type==='maiden'){
  if(g.phase!=='meeple'||g.newMeeple)return fail('收回少女需要替代放米宝');const m=g.meeples.find(m=>m.id===action.id&&m.player===p&&m.kind==='maiden');if(!m)return fail('选择自己的城堡少女');if(m.bornRound===g.round)return fail('刚从骑士转来的少女要等以后回合才能收回');const n=g.meeples.filter(m=>m.kind==='maiden'||graph(g).get(m.node)?.type==='city'&&['normal','large'].includes(m.kind)).length;give(g,p,n,'少女回城',m.pos.x,m.pos.y);remove(g,m);g.newMeeple='maiden';resolve(g);return success(g);
 }
 if(action.type==='barn'){
  if(g.phase!=='meeple'||g.built||!g.extensions.includes('buildings')||!g.buildSupply.barn)return fail('本回合已建建筑或没有谷仓');const t=g.board[key(g.last.x,g.last.y)],gr=graph(g);const corner=Number(action.corner);if(![0,1,2,3].includes(corner))return fail('请选择版图角落');const cx=t.x+(corner===1||corner===2?1:0),cy=t.y+(corner>=2?1:0),four=[[cx-1,cy-1,2],[cx,cy-1,3],[cx,cy,0],[cx-1,cy,1]];let field=null;
  for(const[x,y,c]of four){const q=g.board[key(x,y)];if(!q)return fail('谷仓需要四张版图的草地角全部齐全');const d=definition(q),s=c,prev=(s+3)%4;if(d.edges[s]==='C'||d.edges[prev]==='C')return fail('交点含城墙，不能建谷仓');const f=d.features.find(f=>f.type==='field'&&(f.ports.includes(s*2)||f.ports.includes(prev*2+1)));if(f)field=gr.get(q.uid+':'+f.id);}
  const m=field?.meeples.find(m=>m.player===p&&!m.barn&&(['normal','large'].includes(m.kind)||m.kind==='scarecrow'&&m.lying));if(!m)return fail('该草地需要自己一枚未进入谷仓的农夫');m.barn={x:cx,y:cy};if(m.pig){player.supply.pig++;delete m.pig;}if(m.emblem!=null){player.emblems.push(m.emblem);delete m.emblem;}g.barns.push({x:cx,y:cy,player:p});g.buildSupply.barn--;g.built=true;const n=g.meeples.filter(m=>graph(g).get(m.node)?.type==='field'&&(['normal','large'].includes(m.kind)||m.kind==='scarecrow'&&m.lying)).length;give(g,p,n,'谷仓经营',cx,cy);return success(g);
 }
 return fail('未知操作');
}
function success(g){g.revision++;return{ok:true};}
function tileName(t){return(t.hoard?'巨龙藏宝地 · ':t.portal?'魔法门 · ':t.inn?'旅馆 · ':t.cathedral?'大教堂 · ':t.circus?'马戏场 · ':t.acrobat?'杂技场 · ':t.geese?'鹅群 · ':t.vineyard?'葡萄园 · ':t.tower?'高塔 · ':'')+({C:'城市',R:'道路',F:'草地',V:'河流',H:'市政厅'}[definition(t).edges[0]]||'版图')+'版图';}
function chooseAI(g){
 if(g.phase==='end')return null;
 if(g.phase==='fairy'){const m=g.meeples.find(m=>m.player===g.turn&&!m.barn&&m.kind!=='maiden');return{type:'fairy',id:m?.id};}
 if(['tile','prize','hallOnly','finalPrizes'].includes(g.phase)){
  const t=['prize','finalPrizes'].includes(g.phase)?tile('prize'):g.phase==='hallOnly'?tile('hall'):g.current;
  const list=legalPlacements(g,t);if(!list.length){if(g.players[g.turn].hall)return{type:'place',...frontiers(g)[0],rot:0,hall:true};return null;}
  const gr=graph(g);let best=null,bestScore=-1e9;
  for(const a of list){let score=0;const d=definition({...t,rot:a.rot,bridge:a.bridge});for(let s=0;s<4;s++){const[dx,dy]=DIR[s],ot=g.board[key(a.x+dx,a.y+dy)];if(!ot)continue;score+=1;for(const f of definition(ot).features)if(f.sides.includes((s+2)%4)){const c=gr.get(ot.uid+':'+f.id);const own=c.meeples.filter(m=>m.player===g.turn).length,others=c.meeples.filter(m=>m.player!==g.turn).length;score+=own*(c.open<=1?10:2)-others*(c.open<=1?5:1);}}score+=Math.sin(a.x*17+a.y*33+a.rot*7+(g.seed||0))*.35-Math.hypot(a.x,a.y)*.04;if(score>bestScore){bestScore=score;best=a;}}
  return{type:'place',...best,hall:g.phase==='hallOnly'};
 }
 if(g.phase==='meeple'){
  if(g.newMeeple)return{type:'endTurn',herd:true};
  const opts=options(g),gr=graph(g),p=g.players[g.turn];let best=null,score=1.3;
  for(const o of opts){const c=o.node?gr.get(o.node):null;let v=o.type==='city'?4:o.type==='road'?2:o.type==='monastery'?5:o.type==='garden'?4:o.type==='tower'?4:o.type==='acrobat'?3:o.type==='field'&&g.deck.length<24?3:0;
   if(c&&complete(g,c))v+=scoreValue(g,c);if(c)v+=Math.min(c.tiles.size,6)*.25;if(o.kind==='large')v-=1;if(['scarecrow','shepherd'].includes(o.kind))v+=1;if(p.supply.normal<3&&o.kind==='normal')v-=2;if(v>score){score=v;best=o;}}
  if(best)return{...best,type:'meeple',builder:true,pig:true,post:best.type==='city'?0:best.type==='road'?1:best.type==='monastery'||best.type==='garden'?2:null};
  const abbot=g.meeples.find(m=>m.player===g.turn&&m.kind==='abbot');if(abbot&&scoreValue(g,gr.get(abbot.node))>=5)return{type:'abbot'};
  return{type:'endTurn',herd:true};
 }
 return null;
}
function view(g,p){const c=JSON.parse(JSON.stringify(g));delete c._meepleUndo;c.deck=c.deck.map(()=>({back:true}));c.riverDeck=c.riverDeck.map(()=>({back:true}));c.sheepBag=c.sheepBag.map(()=>-1);c.performance=c.performance.map(()=>-1);if(c.circus)c.circus.value=-1;delete c.random;delete c.seed;for(const player of c.players)if(player!==c.players[p])player.emblems=player.emblems.map(()=>-1);for(const m of c.meeples)if(m.emblem!=null&&m.player!==p)m.emblem=-1;return c;}
return{EXP,TEMPLATES,DIR,N,create,apply,valid,frontiers,legalPlacements,graph,definition,topology,scoreValue,complete,options,nodePosition,strength,tileName,chooseAI,view,key,rotatePoint,terrain,finish};
});
