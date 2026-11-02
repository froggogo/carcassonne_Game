'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const E=require('./public/engine.js');
const PORT=Number(process.env.PORT||8787),HOST=process.env.HOST||'0.0.0.0';
const rooms=new Map(),sessions=new Map(),limits=new Map();
const publicDir=path.join(__dirname,'public');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.pdf':'application/pdf','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8'};
const token=()=>crypto.randomBytes(24).toString('hex');
const roomCode=()=>crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();
const clean=s=>String(s||'').trim().slice(0,18)||'旅人';
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function roomView(room,viewer){return{code:room.code,host:room.host,expansions:room.expansions,players:room.players.map(p=>({id:p.id,name:p.name,ready:p.ready,connected:p.connected})),chat:room.chat.slice(-40),started:!!room.game,game:room.game?E.view(room.game,room.players.findIndex(p=>p.id===viewer)):null};}
function publish(room){room.updated=Date.now();for(const[c,client]of room.clients){try{client.res.write('event: state\ndata: '+JSON.stringify(roomView(room,client.player))+'\n\n');}catch{room.clients.delete(c);}}}
function authenticate(req){const auth=req.headers.authorization||'',value=auth.startsWith('Bearer ')?auth.slice(7):new URL(req.url,'http://local').searchParams.get('token');const s=sessions.get(value);if(!s)return null;const room=rooms.get(s.room);if(!room)return null;return{s,room,player:room.players.find(p=>p.id===s.player)};}
async function body(req){let data='';for await(const chunk of req){data+=chunk;if(data.length>20000)throw new Error('请求过大');}return data?JSON.parse(data):{};}
function blocked(req){const ip=req.socket.remoteAddress,now=Date.now(),l=limits.get(ip)||{start:now,count:0};if(now-l.start>10000){l.start=now;l.count=0;}l.count++;limits.set(ip,l);return l.count>180;}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://local');
 if(url.pathname.startsWith('/api/')){
  if(blocked(req))return json(res,429,{error:'操作过快，请稍后再试'});
  // 同源 POST 校验，不允许外部网页操纵已打开房间。
  if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'请求来源不匹配'});
  try{
   if(url.pathname==='/api/info')return json(res,200,{online:true,version:1,port:PORT,addresses:Object.values(os.networkInterfaces()).flat().filter(a=>a.family==='IPv4'&&!a.internal).map(a=>'http://'+a.address+':'+PORT)});
   if(req.method==='POST'&&url.pathname==='/api/create'){
    if(rooms.size>=500)return json(res,503,{error:'房间已满，请稍后再试'});
    const b=await body(req),id=token(),secret=token();let code;do{code=roomCode();}while(rooms.has(code));
    const room={code,host:id,expansions:(b.expansions||[]).filter(id=>E.EXP.some(e=>e.id===id)),players:[{id,name:clean(b.name),ready:true,connected:true}],game:null,clients:new Map(),chat:[],updated:Date.now()};
    rooms.set(code,room);sessions.set(secret,{room:code,player:id});return json(res,200,{token:secret,playerId:id,room:roomView(room,id)});
   }
   if(req.method==='POST'&&url.pathname==='/api/join'){
    const b=await body(req),code=String(b.code||'').trim().toUpperCase(),room=rooms.get(code);if(!room)return json(res,404,{error:'房间不存在，请确认房间码及服务器地址'});
    if(room.game)return json(res,409,{error:'这局已经开始，暂不接受中途新玩家'});if(room.players.length>=6)return json(res,409,{error:'房间最多六人'});
    const id=token(),secret=token();room.players.push({id,name:clean(b.name),ready:false,connected:true});sessions.set(secret,{room:code,player:id});publish(room);return json(res,200,{token:secret,playerId:id,room:roomView(room,id)});
   }
   const a=authenticate(req);if(!a||!a.player)return json(res,401,{error:'房间身份已失效，请重新加入'});const{room,player}=a;
   if(req.method==='GET'&&url.pathname==='/api/events'){
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    const clientId=token();room.clients.set(clientId,{res,player:player.id});player.connected=true;
    res.write('event: state\ndata: '+JSON.stringify(roomView(room,player.id))+'\n\n');publish(room);
    const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),15000);
    req.on('close',()=>{clearInterval(heartbeat);room.clients.delete(clientId);if(![...room.clients.values()].some(c=>c.player===player.id))player.connected=false;publish(room);});return;
   }
   if(req.method==='GET'&&url.pathname==='/api/room')return json(res,200,roomView(room,player.id));
   if(req.method!=='POST')return json(res,405,{error:'不支持的请求'});
   const b=await body(req);
   if(url.pathname==='/api/ready'){if(room.game)return json(res,409,{error:'对局已开始'});player.ready=!!b.ready;}
   else if(url.pathname==='/api/settings'){if(room.host!==player.id||room.game)return json(res,403,{error:'只有房主可以在开局前修改扩展'});room.expansions=[...new Set(b.expansions||[])].filter(id=>E.EXP.some(e=>e.id===id));}
   else if(url.pathname==='/api/start'){
    if(room.host!==player.id)return json(res,403,{error:'只有房主能开始游戏'});if(room.game)return json(res,409,{error:'对局已经开始'});
    if(room.players.length<2||room.players.some(p=>!p.ready))return json(res,409,{error:'至少两名玩家，且所有人都要准备'});
    if(room.players.length===6&&!room.expansions.includes('inns'))room.expansions.push('inns');
    room.game=E.create({expansions:room.expansions,players:room.players.map(p=>({id:p.id,name:p.name,kind:'human'}))});
   }else if(url.pathname==='/api/action'){
    if(!room.game)return json(res,409,{error:'房主尚未开始游戏'});if(b.revision!==room.game.revision)return json(res,409,{error:'对局状态已更新，请重试',refresh:true});
    const p=room.players.findIndex(p=>p.id===player.id);const result=E.apply(room.game,b.action||{},p);if(!result.ok)return json(res,400,{error:result.reason});
   }else if(url.pathname==='/api/chat'){
    const text=String(b.text||'').trim().slice(0,160);if(text)room.chat.push({name:player.name,text,time:Date.now()});if(room.chat.length>80)room.chat.shift();
   }else if(url.pathname==='/api/restart'){
    if(room.host!==player.id||!room.game?.ended)return json(res,403,{error:'对局结束后房主可返回房间'});room.game=null;for(const p of room.players)p.ready=p.id===room.host;
   }else if(url.pathname==='/api/leave'){
    if(room.game)return json(res,409,{error:'对局中离开会断开连接，可稍后用同一浏览器重连'});room.players=room.players.filter(p=>p.id!==player.id);sessions.delete(req.headers.authorization.slice(7));if(room.host===player.id)room.host=room.players[0]?.id;if(!room.players.length)rooms.delete(room.code);
   }else return json(res,404,{error:'未知接口'});
   publish(room);return json(res,200,{ok:true});
  }catch(error){console.error('API:',error.message);return json(res,400,{error:'请求无效，请检查操作后重试'});}
 }
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
 let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{res.writeHead(400);res.end();return;}
 const file=path.resolve(publicDir,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(publicDir+path.sep)){res.writeHead(403);res.end();return;}
 fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);});
});
const cleanup=setInterval(()=>{const now=Date.now();for(const[code,room]of rooms)if(!room.clients.size&&now-room.updated>12*3600000){rooms.delete(code);for(const[k,s]of sessions)if(s.room===code)sessions.delete(k);}for(const[k,l]of limits)if(now-l.start>60000)limits.delete(k);},60000);cleanup.unref();
server.listen(PORT,HOST,()=>{console.log('卡卡颂网页版已启动： http://localhost:'+PORT);for(const a of Object.values(os.networkInterfaces()).flat())if(a.family==='IPv4'&&!a.internal)console.log('局域网： http://'+a.address+':'+PORT);});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'端口被占用，请设置 PORT 后重试。':e.message);process.exitCode=1;});
for(const signal of['SIGINT','SIGTERM'])process.on(signal,()=>{for(const room of rooms.values())for(const c of room.clients.values())c.res.end();server.close(()=>process.exit(0));});
