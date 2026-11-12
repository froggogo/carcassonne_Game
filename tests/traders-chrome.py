from pathlib import Path
import os, sys, json, subprocess, time, urllib.request, socket

root=Path(os.environ.get('CARC_TEST_WORKSPACE',r'C:\Users\frogchen\Documents\MagicLomix\2026-10-28\1')).resolve()
script_dir=Path(__file__).resolve().parent
project=script_dir.parent if script_dir.name=='tests' else Path(r'D:\Vscode\store\PlayForge_Al\games\carcassonne-between-mountains')
sys.path.insert(0,str(root/'.tools'))
from playwright.sync_api import sync_playwright
out=root/'traders-verification'
out.mkdir(exist_ok=True)
checks=[]
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
env=dict(os.environ,HOST='127.0.0.1',PORT=str(port))
server=subprocess.Popen([r'C:\nvm4w\nodejs\node.exe',str(project/'server.cjs')],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
origin=f'http://127.0.0.1:{port}'
try:
    ready=False
    for _ in range(40):
        try:
            urllib.request.urlopen(origin+'/api/info',timeout=.5);ready=True;break
        except Exception:
            if server.poll() is not None:
                raise RuntimeError('Test server exited before readiness')
            time.sleep(.1)
    assert ready,'Test server not ready'
    with sync_playwright() as p:
        # The isolated launcher owns this fresh Chrome and the test server.
        browser=p.chromium.launch(channel='chrome',headless=True)
        context=browser.new_context(viewport={'width':1440,'height':1000})
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(origin)
        page.wait_for_function('!!window.GameApp')
        page.locator('[data-mode="local"]').click()
        page.evaluate("window.GameApp.setSelected(['traders','inns'])")
        page.locator('#start').click()
        page.wait_for_function('!!window.GameApp.game')
        page.evaluate('window.GameApp.cancelAI()')
        assert page.locator('#game').is_visible();checks.append('正常首页启动本地对局')
        page.evaluate('''()=>{
            const E=window.CarcassonneEngine,g=E.create({seed:22,expansions:['traders'],players:[{name:'红方',kind:'human'},{name:'蓝方',kind:'human'}]});
            g.board={'0,0':{uid:'shield',type:'cityBridgeShield',x:0,y:0,rot:0},'0,-1':{uid:'north',type:'cityCap',x:0,y:-1,rot:2},'1,0':{uid:'field',type:'plain',x:1,y:0,rot:0},'1,1':{uid:'field2',type:'plain',x:1,y:1,rot:0}};
            g.meeples=[{id:'blue',kind:'normal',player:1,node:'field:f0',pig:true},{id:'red',kind:'normal',player:0,node:'field:f0',pig:true}];
            for(const player of g.players){player.supply.normal=6;player.supply.pig=0;}
            g.phase='tile';g.current={uid:'complete',type:'cityCap'};g.deck=[{uid:'next',type:'plain'}];g.riverDeck=[];g.completed=[];
            window.GameApp.loadGame(g);window.GameApp.cancelAI();window.GameApp.action({type:'place',x:0,y:1});window.GameApp.cancelAI();
        }''')
        assert page.locator('#return-farmer').count()==0
        page.locator('#end-turn').click()
        page.wait_for_function("window.GameApp.game.phase==='pigScoring'")
        assert page.evaluate('window.GameApp.game.players[0].score')==3
        assert page.evaluate('window.GameApp.game.players[0].supply.pig')==1
        assert page.locator('#keep-pig-farmer').is_visible()
        assert not page.locator('#end-turn').is_visible()
        page.screenshot(path=str(out/'pig-choice-chrome-desktop.png'),full_page=True)
        checks.append('城市计分后实际显示小猪计分和农夫选择')
        page.locator('#keep-pig-farmer').click()
        page.wait_for_function('window.CarcassonneEngine.actingPlayer(window.GameApp.game)===1')
        assert page.evaluate("window.GameApp.game.meeples.some(m=>m.id==='red')")
        assert page.evaluate('window.GameApp.game.turn')==0
        checks.append('保留农夫后顺时针切换下一位小猪主人')
        page.set_viewport_size({'width':390,'height':844})
        page.locator('#return-pig-farmer').scroll_into_view_if_needed()
        assert page.locator('#return-pig-farmer').is_visible()
        assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
        page.screenshot(path=str(out/'pig-choice-chrome-mobile.png'),full_page=True)
        page.locator('#return-pig-farmer').click()
        page.wait_for_function("window.GameApp.game.phase==='tile'")
        assert not page.evaluate("window.GameApp.game.meeples.some(m=>m.id==='blue')")
        assert page.evaluate('window.GameApp.game.players[1].score')==3
        checks.append('手机尺寸选择收回农夫并恢复原回合')
        page.set_viewport_size({'width':1440,'height':1000})
        page.evaluate('''()=>{
            const E=window.CarcassonneEngine,g=E.create({seed:1,expansions:['traders'],players:[{name:'红方',kind:'human'},{name:'蓝方',kind:'human'}]});
            g.board={'0,0':{uid:'road',type:'roadStraight',x:0,y:0,rot:0}};g.meeples=[{id:'traveler',kind:'normal',player:0,node:'road:r0',builder:true}];g.players[0].supply.builder=0;
            g.current={uid:'extend',type:'roadStraight'};g.deck=[{uid:'extra',type:'plain'},{uid:'after',type:'plain'}];g.riverDeck=[];g.phase='tile';
            window.GameApp.loadGame(g);window.GameApp.cancelAI();window.GameApp.action({type:'place',x:0,y:1});window.GameApp.cancelAI();
        }''')
        assert '牌堆旁' in page.locator('.builder-turn-notice').inner_text()
        assert page.evaluate('window.GameApp.game.players[0].supply.builder')==0
        page.locator('#end-turn').click()
        assert page.evaluate('window.GameApp.game.builderTurn')
        assert page.evaluate('window.GameApp.game.players[0].supply.builder')==1
        assert '建筑师额外回合' in page.locator('#turn-banner').inner_text()
        page.screenshot(path=str(out/'builder-extra-turn-chrome.png'),full_page=True)
        checks.append('建筑师牌堆旁状态和一次额外回合')
        page.locator('#game-guide').click()
        page.locator('[data-guide="traders"]').click()
        assert '计分选择' in page.locator('#guide-content').inner_text()
        checks.append('游戏内官方规则介绍可读')
        assert not errors,errors
        browser.close()
        result={'status':'passed','browser':'Google Chrome','checks':checks,'pageErrors':errors}
        (out/'chrome-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(result,ensure_ascii=False))
except Exception as exc:
    (out/'chrome-results.json').write_text(json.dumps({'status':'failed','error':str(exc),'checks':checks},ensure_ascii=False,indent=2),encoding='utf-8')
    raise
finally:
    server.terminate()
    try:server.wait(timeout=5)
    except subprocess.TimeoutExpired:server.kill();server.wait(timeout=5)
