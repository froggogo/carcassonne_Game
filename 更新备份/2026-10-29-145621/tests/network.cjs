'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawn}=require('node:child_process');
const E=require('../public/engine.js');
const port=Number(process.env.TEST_PORT||8892),origin='http://127.0.0.1:'+port;
const child=spawn(process.execPath,[path.join(__dirname,'../server.cjs')],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
const results=[];
let stderr='';child.stderr.on('data',d=>stderr+=d);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function request(endpoint,body,token){const r=await fetch(origin+'/api/'+endpoint,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});const value=await r.json();return{status:r.status,value};}
async function sse(token){const controller=new AbortController(),response=await fetch(origin+'/api/events?token='+token,{signal:controller.signal});assert.equal(response.status,200);const reader=response.body.getReader(),updates=[],decoder=new TextDecoder();let buffer='';const reading=(async()=>{try{while(true){const{value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let i;while((i=buffer.indexOf('\n\n'))>=0){const record=buffer.slice(0,i);buffer=buffer.slice(i+2);const data=record.split('\n').find(l=>l.startsWith('data: '));if(data)updates.push(JSON.parse(data.slice(6)));}}}catch{}})();return{updates,stop(){controller.abort();},reading};}
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await delay(20);}assert.ok(fn(),'等待同步状态超时');}
function pass(name){results.push(name);console.log('✓ '+name);}
(async()=>{
 let started=false;for(let i=0;i<50;i++){try{const r=await request('info');if(r.status===200){started=true;break;}}catch{}await delay(50);}assert.ok(started,stderr);
 const create=await request('create',{name:'房主',expansions:['river','abbot','inns']});assert.equal(create.status,200);const host=create.value,code=host.room.code;assert.equal(code.length,6);pass('创建房间与身份令牌');
 const first=await sse(host.token);await until(()=>first.updates.length);
 const join=await request('join',{name:'访客',code});assert.equal(join.status,200);const guest=join.value;
 const second=await sse(guest.token);await until(()=>first.updates.at(-1)?.players.length===2&&second.updates.length);pass('两名独立客户端加入并通过SSE同步房间');
 let r=await request('start',{},guest.token);assert.equal(r.status,403);r=await request('start',{},host.token);assert.equal(r.status,409);pass('房主权限与全员准备条件检查');
 await request('ready',{ready:true},guest.token);r=await request('start',{},host.token);assert.equal(r.status,200);
 await until(()=>first.updates.at(-1)?.game&&second.updates.at(-1)?.game);pass('全员准备后开启对局并同步双方');
 const g=first.updates.at(-1).game;assert.ok(g.deck.every(t=>t.back));const action=E.chooseAI(g);
 r=await request('action',{revision:g.revision,action},guest.token);assert.equal(r.status,400);assert.match(r.value.error,/轮到/);pass('服务器拒绝未轮到玩家的落子');
 r=await request('action',{revision:g.revision,action},host.token);assert.equal(r.status,200);
 await until(()=>first.updates.at(-1).game.revision>g.revision&&second.updates.at(-1).game.revision>g.revision);
 const a=first.updates.at(-1).game,b=second.updates.at(-1).game;assert.deepEqual(a.board,b.board);assert.equal(a.phase,'meeple');pass('合法落子经服务器验证并同步同一棋盘');
 r=await request('action',{revision:g.revision,action},host.token);assert.equal(r.status,409);pass('过时修订被拒绝，避免重复落子');
 r=await request('action',{revision:a.revision,action:{type:'meeple',kind:'normal',node:'fake'}},host.token);assert.equal(r.status,400);pass('服务器拒绝伪造米宝位置');
 const reconnect=await request('room',undefined,host.token);assert.equal(reconnect.value.code,code);assert.deepEqual(reconnect.value.game.board,a.board);pass('身份令牌支持断线后获取已有房间与棋盘');
 const choice=E.options(a).find(o=>o.kind==='normal');assert.ok(choice);const supply=a.players[0].supply.normal;
 r=await request('action',{revision:a.revision,action:{...choice,type:'meeple'}},host.token);assert.equal(r.status,200);
 await until(()=>first.updates.at(-1).game.revision>a.revision&&second.updates.at(-1).game.revision>a.revision);
 const pending=first.updates.at(-1).game;assert.ok(pending.meepleDraft);assert.equal(pending._meepleUndo,undefined);assert.equal(second.updates.at(-1).game._meepleUndo,undefined);pass('联网米宝待确认同步，私有撤销快照不泄露牌堆');
 r=await request('action',{revision:pending.revision,action:{type:'undoMeeple'}},guest.token);assert.equal(r.status,400);
 r=await request('action',{revision:pending.revision,action:{type:'undoMeeple'}},host.token);assert.equal(r.status,200);
 await until(()=>first.updates.at(-1).game.revision>pending.revision&&second.updates.at(-1).game.revision>pending.revision);
 const undone=first.updates.at(-1).game;assert.equal(undone.newMeeple,null);assert.equal(undone.players[0].supply.normal,supply);assert.deepEqual(undone.board,a.board);assert.deepEqual(undone.meeples,second.updates.at(-1).game.meeples);pass('当前玩家可撤销并同步双方，非当前玩家不能撤销');
 r=await request('action',{revision:undone.revision,action:{...choice,type:'meeple'}},host.token);assert.equal(r.status,200);
 await until(()=>first.updates.at(-1).game.revision>undone.revision);
 const confirmed=first.updates.at(-1).game;
 r=await request('action',{revision:confirmed.revision,action:{type:'endTurn'}},host.token);assert.equal(r.status,200);
 await until(()=>first.updates.at(-1).game.revision>confirmed.revision&&second.updates.at(-1).game.revision>confirmed.revision);
 const locked=first.updates.at(-1).game;assert.equal(locked.meepleDraft,undefined);
 r=await request('action',{revision:locked.revision,action:{type:'undoMeeple'}},host.token);assert.equal(r.status,400);
 r=await request('action',{revision:locked.revision,action:{type:'undoMeeple'}},guest.token);assert.equal(r.status,400);pass('结束回合后双方都不能撤销已确认米宝');
 await request('chat',{text:'你好，准备下一轮'},guest.token);await until(()=>first.updates.at(-1).chat.some(c=>c.text==='你好，准备下一轮'));pass('不同客户端聊天消息同步');
 const anon=await request('room');assert.equal(anon.status,401);pass('房间状态接口需要有效身份');
 const traversal=await fetch(origin+'/%2e%2e%2fserver.cjs');assert.notEqual(traversal.status,200);pass('静态文件目录限制不暴露服务器代码');
 first.stop();second.stop();console.log(JSON.stringify({status:'passed',tests:results.length}));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{child.kill();await delay(100);});
