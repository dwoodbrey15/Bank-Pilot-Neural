process.chdir(require('node:path').resolve(__dirname,'..'));
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const engine=require('../engine.js')();
let checks=0;
function check(a,b){assert.deepEqual(a,b);checks++;}
for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
  check(engine.transition(130,0,a,b),{pot:130+(a+b===7?70:a+b),bust:false});
  check(engine.transition(130,3,a,b),a+b===7?{pot:0,bust:true}:{pot:a===b?260:130+a+b,bust:false});
}
function endState(own,other,pot){return {round:20,rounds:20,rolls:3,pot,players:[{score:own,active:true},{score:other,active:false}]};}
check(engine.exactEnd(endState(0,100,101)).action,'BANK');
check(engine.exactEnd(endState(0,100,101)).roll,5/6);
check(engine.exactEnd(endState(0,100,100)).action,'ROLL');
check(engine.exactEnd(endState(0,100,100)).bank,.5);
check(engine.exactEnd(endState(0,100,100)).roll,5/6);
check(engine.exactEnd(endState(100,100,50)).roll,11/12);
check(engine.exactEnd(endState(101,100,50)).roll,1);
check(engine.exactEnd(endState(101,100,1000000000000)).action,'BANK');
for(let goal=10;goal<200;goal+=17){let last=0;for(let pot=6;pot<goal;pot++){const r=engine.exactEnd(endState(0,goal,pot));assert(r.roll>=last-1e-10&&r.roll<=1);last=r.roll;checks++;}}
const learned={style:'learn',evidence:engine.bases.map(()=>0)};
const before=engine.weights(learned).reduce((v,w,i)=>v+w*engine.bases[i],0);
for(let i=0;i<8;i++)engine.observe(learned,200,[0,0],1,10,false);
const after=engine.weights(learned).reduce((v,w,i)=>v+w*engine.bases[i],0);
assert(after>before);checks++;
const els=new Map(),all=[];
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.dataset={};this.value='';this.disabled=false;this._classes=new Set();this.classList={add:(...c)=>c.forEach(x=>this._classes.add(x)),remove:(...c)=>c.forEach(x=>this._classes.delete(x)),toggle:(c,on)=>{if(on===undefined)on=!this._classes.has(c);on?this._classes.add(c):this._classes.delete(c);},contains:c=>this._classes.has(c)};all.push(this);}
 set id(v){this._id=v;els.set(v,this);}get id(){return this._id;}
 set className(v){this._classes=new Set(v.split(' ').filter(Boolean));}get className(){return [...this._classes].join(' ');}
 append(...c){this.children.push(...c);}replaceChildren(...c){this.children=[...c];}
 setAttribute(k,v){this.attributes??={};this.attributes[k]=v;}getAttribute(k){return this.attributes?.[k];}
 focus(){}click(){if(!this.disabled)this.onclick?.();}
 querySelector(sel){return this.walk().find(e=>sel.split(',').some(x=>e.tagName===x.trim().toUpperCase()));}
 walk(){return this.children.flatMap(c=>[c,...c.walk()]);}
}
const html=fs.readFileSync('index.html','utf8');
for(const match of html.matchAll(/<([a-z0-9]+)\b([^>]*)>/gi)){
 const attrs=match[2],id=attrs.match(/\bid="([^"]+)"/),cl=attrs.match(/\bclass="([^"]*)"/),screen=attrs.match(/\bdata-screen="([^"]*)"/);
 if(id||screen){const e=new Element(match[1]);if(id)e.id=id[1];if(cl)e.className=cl[1];if(screen)e.dataset.screen=screen[1];}
}
els.get('engine-source').textContent=fs.readFileSync('engine.js','utf8');
const storage=new Map();
const ctx=vm.createContext({console,BankNet:require('../neural.js'),BankSolo:require('../solo-engine.js'),BankTarget:require('../target-policy.js'),BankGoals:require('../goal-engine.js'),BankMultiplayer:require('../multiplayer-policy.js'),Blob,URL,Math,JSON,Number,Array,Float64Array,Infinity,Set,Map,Error,String,document:{getElementById:id=>els.get(id),createElement:tag=>new Element(tag),querySelectorAll:sel=>sel==='.screen'?all.filter(e=>e.classList.contains('screen')):sel==='[data-screen]'?all.filter(e=>e.dataset.screen):[],addEventListener:()=>{}},navigator:{},location:{protocol:'file:'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>2,clearInterval:()=>{}});
vm.runInContext([...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('const engineText='))[1],ctx);
const run=s=>vm.runInContext(s,ctx);
const state=()=>JSON.parse(run('JSON.stringify(state)'));
function roll(a,b){els.get('die1choices').children[a-1].click();els.get('die2choices').children[b-1].click();els.get('record').click();}
check(state().pot,0);check(els.get('bankme').disabled,true);
roll(5,2);check(state().pot,70);roll(4,4);check(state().pot,78);roll(1,1);check(state().pot,80);check(els.get('bankme').disabled,false);
els.get('bankme').click();check(state().players[0].score,80);check(state().players[0].active,false);roll(4,4);check(state().pot,160);roll(5,2);check(state().ended,true);check(state().players[0].score,80);check(state().players[1].score,0);
els.get('undo').click();check(state().pot,160);check(state().ended,false);run('bankPlayer(1)');check(state().ended,true);check(state().players[1].score,160);
els.get('nextround').click();check(state().round,2);check(state().players.every(p=>p.active),true);check(state().rolls,0);
els.get('addplayer').click();els.get('newcount').value=20;els.get('newname').value='Guest';els.get('modal').children.at(-1).children.at(-1).click();check(state().players.length,22);check(els.get('playerlist').children.length,22);check(els.get('playercount').textContent,'22 players · Scroll for more');
run('state.round=20;state.rolls=3;state.pot=120;state.players.forEach(p=>p.active=false);state.players[0].active=true;render();');
run('showResult(engine.exactEnd(state))');check(els.get('recommend').textContent,'BANK NOW');check(els.get('bankodds').textContent,'100.0%');
run('editPlayer(1)');els.get('editscore').value=450;els.get('editactive').value='active';els.get('modal').children.at(-1).children.at(-1).click();check(state().players[1].score,450);check(state().players[1].active,true);
check(run('valid(state)'),true);check(run('valid({...state,pot:NaN})'),false);check(run('valid({...state,players:[]})'),false);
const saved=state();run('state=fresh();render();');run('state=JSON.parse(localStorage.getItem("bank-pilot-v3"));render();');check(state(),saved);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);check(new Set(ids).size,ids.length);
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));check(manifest.scope,'./');
for(const file of ['index.html','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'])assert(fs.existsSync(''+file));
assert(!/https?:\/\/[^'"\s]+/.test(html));checks++;
class FakeWorker{
 static instances=[];
 constructor(url){this.url=url;FakeWorker.instances.push(this);}
 postMessage(message){this.message=message;}
 terminate(){this.terminated=true;}
}
Object.assign(ctx,{performance,Worker:FakeWorker});ctx.navigator.hardwareConcurrency=6;
run("state=fresh();state.rolls=3;state.pot=52;render();analyze(4);");
check(FakeWorker.instances.length,6);check(run('workers.length'),6);
for(const w of FakeWorker.instances){assert(w.message.options.deadline>performance.timeOrigin+performance.now()+3000);assert(w.message.options.deadline<performance.timeOrigin+performance.now()+4200);checks++;}
check(new Set(FakeWorker.instances.map(w=>w.message.options.seed)).size,6);
const part={n:36,b:18,r:20,b2:18,r2:20,d:2,d2:10,nodes:200,searchGames:400,treeTrials:70,guarded:0,plans:50,useTree:[false,true],elapsed:4000};
for(const w of FakeWorker.instances)w.onmessage({data:{result:part}});
check(run('workers.length'),0);check(els.get('bankodds').textContent,'50.0%');check(els.get('rollodds').textContent,'55.6%');check(run('result.workers'),6);
FakeWorker.instances=[];run("analyze(4)");const stale=FakeWorker.instances.slice();run('state.rolls=0;render();');for(const w of stale)w.onmessage({data:{result:part}});check(els.get('recommend').textContent,'SAFE ROLL');check(stale.every(w=>w.terminated),true);
FakeWorker.instances=[];run("state.rolls=3;analyze(4)");FakeWorker.instances[0].onerror({});for(const w of FakeWorker.instances.slice(1))w.onmessage({data:{result:part}});check(run('result.workers'),5);check(run('result.failedWorkers'),1);
FakeWorker.instances=[];run("analyze(4)");for(const w of FakeWorker.instances)w.onerror({});check(els.get('recommend').textContent,'ANALYSIS UNAVAILABLE');
check(run("migrate({...fresh(),version:1,quality:'normal',workers:undefined}).quality"),'deep');check(run("migrate({...fresh(),version:1,workers:undefined}).workers"),'auto');
check(run("valid({...fresh(),workers:'99'})"),false);check(els.get('die1choices').children.length,6);check(els.get('die2choices').children.length,6);
run("state={...fresh(),players:[freshPlayer('A'),freshPlayer('B'),freshPlayer('C'),freshPlayer('D')]};state.players[2].evidence[0]=-7;state.players[2].observations=12;state.players[2].score=190;render();editPlayer(2);");
els.get('editscore').value=195;els.get('makemyseat').click();check(state().mySeat,2);check(state().players.map(p=>p.name),['A','B','C','D']);check(state().players[2].evidence[0],-7);check(state().players[2].score,195);
run('state.rolls=3;state.pot=52;render();');roll(1,2);check(state().players[0].observations,1);check(state().players[1].observations,1);check(state().players[2].observations,12);check(state().players[3].observations,1);
FakeWorker.instances=[];run("analyze(4)");check(FakeWorker.instances[0].message.state.players.map(p=>p.name),['C','A','B','D']);run('stopWork();');
els.get('bankme').click();check(state().players[2].score,250);check(state().players[2].active,false);check(state().players[0].score,0);
run('removePlayer(0)');check(state().mySeat,1);check(state().players[state().mySeat].name,'C');check(state().players[1].evidence[0],-7);
els.get('undo').click();check(state().mySeat,2);check(state().players.length,4);
run('removePlayer(3)');check(state().mySeat,2);check(state().players.length,3);
run('editPlayer(2)');els.get('removeplayer').click();check(state().mySeat,1);check(state().players[state().mySeat].name,'B');check(state().players.length,2);
run('editPlayer(0)');check(els.get('removeplayer').disabled,true);run('removePlayer(0)');check(state().players.length,2);
check(run('valid(state)'),true);check(run('valid({...state,mySeat:2})'),false);check(run('valid({...state,mySeat:-1})'),false);check(run('migrate({...fresh(),mySeat:undefined}).mySeat'),0);
run("state={...fresh(),mySeat:2,rolls:3,players:[freshPlayer('A'),freshPlayer('B'),freshPlayer('C')]};state.players[0].active=false;state.players[1].active=false;render();removePlayer(2);");check(state().ended,true);check(state().mySeat,1);
run("state={...fresh(),mySeat:1};state.finished=true;state.ended=true;state.players[1].score=500;render();");check(els.get('recommend').textContent,'YOU WIN');
els.get('newgame').click();els.get('modal').children.at(-1).children.at(-1).click();check(state().mySeat,1);check(state().players[1].score,0);
console.log(checks+' rule, endgame, learning, UI-state, persistence and packaging checks passed.');

run("state={...fresh(),mySeat:2,rolls:3,pot:100,players:[freshPlayer('A'),freshPlayer('B'),freshPlayer('C')]};bankPlayer(0);");
check(state().lastBank,0);check(state().players[0].modelObservations,1);
FakeWorker.instances=[];run("analyze(4)");check(FakeWorker.instances[0].message.state.lastBank,1);run('stopWork();');
roll(1,2);check(state().lastBank,-1);check(state().players[1].modelObservations,1);check(state().players[2].modelObservations,0);
check(run('valid({...state,lastBank:99})'),false);
run('state=migrate({...state,version:2,lastBank:undefined,players:state.players.map(p=>({...p,modelVersion:undefined,modelEvidence:undefined,modelObservations:undefined}))});');
check(state().version,3);check(state().lastBank,-1);check(state().players.every(p=>p.modelEvidence.length===77&&p.modelObservations===0),true);
run("showResult({action:'WAIT',bank:null,roll:1,exact:true,samples:0,guarantee:'shadow',reason:'Match their bank.'})");check(els.get('recommend').textContent,'MATCH THEIR BANK');check(els.get('bankodds').textContent,'—');
check(els.get('rollodds').textContent,'100.0%');
console.log('V3 reaction context, seat mapping, migration and guarantee display checks passed.');
run('state=fresh();render();');
check(state().thinkSeconds,4);
check(run("migrate({...fresh(),thinkSeconds:undefined,quality:'normal'}).thinkSeconds"),1);
check(run("migrate({...fresh(),thinkSeconds:undefined,quality:'deep'}).thinkSeconds"),4);
for(const value of [0,-1,Infinity,NaN,'4'])check(run('valid({...fresh(),thinkSeconds:'+String(value=== '4'?"'4'":value)+'})'),false);
for(const seconds of [.25,7.5,60,3600])check(run('valid({...fresh(),thinkSeconds:'+seconds+'})'),true);
els.get('thinkseconds').value='7.5';els.get('thinkseconds').onchange();check(state().thinkSeconds,7.5);check(JSON.parse(storage.get('bank-pilot-v3')).thinkSeconds,7.5);
els.get('thinkseconds').value='0';els.get('thinkseconds').onchange();check(state().thinkSeconds,7.5);check(els.get('thinkseconds').value,7.5);
run('closeModal();state.rolls=3;state.pot=52;render();');
FakeWorker.instances=[];const customStarted=performance.timeOrigin+performance.now();run('analyze(state.thinkSeconds)');
check(FakeWorker.instances.length,6);
for(const w of FakeWorker.instances){assert(w.message.options.deadline>=customStarted+7500&&w.message.options.deadline<customStarted+7700);checks++;}
const progressWorkers=FakeWorker.instances.slice();
progressWorkers[0].onmessage({data:{progress:{phase:'Searching future decisions',games:120,nodes:32,outcomes:10}}});
progressWorkers[1].onmessage({data:{progress:{phase:'Checking chance outcomes and opponent assumptions',games:80,nodes:19,outcomes:20}}});
check(els.get('searchgames').textContent,'200');check(els.get('searchnodes').textContent,'51');check(els.get('searchoutcomes').textContent,'30');check(els.get('searchstats').classList.contains('hidden'),false);
check(els.get('searchclock').textContent.endsWith('/ 7.5 s'),true);
run('state.rolls=0;render()');progressWorkers[0].onmessage({data:{progress:{phase:'STALE',games:999,nodes:999,outcomes:999}}});check(els.get('recommend').textContent,'SAFE ROLL');check(els.get('searchstats').classList.contains('hidden'),true);check(run('progressTimer'),0);
run('state.rolls=3;render()');FakeWorker.instances=[];run('analyze(.25)');for(const w of FakeWorker.instances)w.onmessage({data:{result:part}});
check(els.get('searchstats').classList.contains('hidden'),true);check(run('progressTimer'),0);check(els.get('deeper').textContent,'Rethink · 7.5s');
FakeWorker.instances=[];els.get('deeper').click();run('analyze(state.thinkSeconds)');check(FakeWorker.instances.length,6);run('stopWork()');
check(run('progressTimer'),0);
els.get('newgame').click();els.get('modal').children.at(-1).children.at(-1).click();check(state().thinkSeconds,7.5);
check(html.includes('id="quality"'),false);check(html.includes('v4.5'),true);
console.log('Custom decimal durations, migration, validation, persistence, new-game settings, worker budgets, aggregated live progress, stale updates and timer cleanup passed.');
run("state={...fresh(),rolls:3,pot:50,mySeat:1,players:[freshPlayer('Other'),freshPlayer('Me'),freshPlayer('Third')]};state.players[0].score=199;state.players[1].score=100;render();");
check(els.get('targetmetric').classList.contains('hidden'),false);check(els.get('targetmetric').textContent.startsWith('Reach 100 pot before 7:'),true);
els.get('targetmetric').click();check(els.get('modal').children[1].textContent.includes('not your chance of winning'),true);run('closeModal()');
els.get('targetaware').value='on';els.get('targetaware').onchange();check(state().targetAware,true);
FakeWorker.instances=[];run('analyze(.25)');check(FakeWorker.instances[0].message.state.targetAware,true);run('stopWork()');
check(run('valid({...fresh(),targetAware:1})'),false);check(run('valid({...fresh(),targetAware:true})'),true);
check(run('migrate({...fresh(),targetAware:undefined}).targetAware'),run('TARGET_DEFAULT'));
run('state.pot=100;render()');check(els.get('targetmetric').textContent,'Current pot reaches the lead target');
run('state.rolls=0;render()');check(els.get('targetmetric').classList.contains('hidden'),true);
els.get('newgame').click();els.get('modal').children.at(-1).children.at(-1).click();check(state().targetAware,true);
console.log('Target display, seat mapping, contextual explanation, experimental mode, worker snapshot and settings persistence passed.');
ctx.soloFixture=JSON.parse(fs.readFileSync('solo-data.json','utf8'));
run('soloEngine=BankSolo.create(soloFixture);state=fresh();state.players[0].score=777;state.round=8;state.rolls=3;state.pot=200;save();render();');
const multiplayerBefore=JSON.parse(storage.get('bank-pilot-v3'));
FakeWorker.instances=[];run("switchMode('solo')");check(state().solo,true);check(state().players.length,1);check(state().rounds,20);check(state().players[0].score,0);check(els.get('rounds').disabled,true);check(els.get('adviser').disabled,true);check(els.get('addplayer').disabled,true);check(els.get('recommend').textContent,'SAFE ROLL');check(FakeWorker.instances.length,0);
run('state.rolls=3;state.pot=912;render()');check(els.get('recommend').textContent,'STAY IN');check(els.get('reason').textContent.includes('913'),true);check(els.get('bankprobtitle').textContent,'REACH 2,335 IF BANK');check(els.get('deeper').classList.contains('hidden'),true);
run('state.pot=913;render()');check(els.get('recommend').textContent,'BANK NOW');els.get('bankme').click();check(state().players[0].score,913);check(state().ended,true);els.get('nextround').click();check(state().round,2);check(state().rolls,0);check(state().players[0].active,true);
run("switchMode('multi')");check(state().players[0].score,777);check(state().round,8);check(state().pot,200);check(els.get('rounds').disabled,false);check(els.get('addplayer').disabled,false);check(JSON.parse(storage.get('bank-pilot-v3')),multiplayerBefore);
run("switchMode('solo')");check(state().players[0].score,913);check(state().round,2);check(JSON.parse(storage.get('bank-pilot-solo-exact-v1')).solo,true);check(storage.get('bank-pilot-play-mode'),'solo');
els.get('position').click();els.get('stateround').value='2';els.get('staterolls').value='3';els.get('statepot').value='252';els.get('statescore').value='1000';els.get('modal').children.at(-1).children.at(-1).click();check(state().players[0].score,1000);check(els.get('recommend').textContent,'BANK NOW');check(els.get('modalback').classList.contains('open'),false);
check(run('valid({...freshSolo(),rounds:10})'),false);check(run('valid({...freshSolo(),players:[freshPlayer("A"),freshPlayer("B")]})'),false);check(run('valid({...fresh(),players:[freshPlayer("A")]})'),false);check(run('valid(freshSolo())'),true);
els.get('newgame').click();els.get('modal').children.at(-1).children.at(-1).click();check(state().solo,true);check(state().players.length,1);check(state().players[0].score,0);check(state().rounds,20);
for(let r=1;r<=20;r++){roll(1,6);roll(1,6);roll(1,6);check(state().pot,210);els.get('bankme').click();check(state().players[0].score,r*210);if(r<20)els.get('nextround').click();}
check(state().finished,true);check(els.get('recommend').textContent,'TARGET REACHED');check(state().players[0].score,4200);els.get('undo').click();check(state().finished,false);check(state().players[0].active,true);check(state().players[0].score,3990);check(run('valid(state)'),true);
run("switchMode('multi')");check(state().players[0].score,777);check(state().round,8);check(els.get('bankother').textContent,'Opponent BANK');
console.log('Exact solo UI, separate-mode saves, threshold cases, manual position editing, multiplayer restoration, 20 rounds, new-game mode and undo passed.');
run("state={...fresh(),adviser:'target',mySeat:1,rolls:3,pot:913,players:[freshPlayer('Other'),freshPlayer('Me'),freshPlayer('Third')]};state.players[0].score=4000000;render();");
check(els.get('recommend').textContent,'BANK NOW');check(els.get('advisorylabel').textContent,'Solo target · multiplayer');check(els.get('bankprobtitle').textContent,'REACH 2,335 IF BANK');check(els.get('deeper').textContent,'Compare win search');check(els.get('workers').disabled,true);check(els.get('adviser').disabled,false);
const targetOdds=els.get('bankodds').textContent;run('state.players[0].score=0;render()');check(els.get('bankodds').textContent,targetOdds);
check(run("valid({...fresh(),adviser:'target',rounds:20})"),true);check(run("valid({...fresh(),adviser:'target',rounds:10})"),false);
els.get('rounds').value='10';els.get('rounds').onchange();check(state().rounds,20);check(els.get('rounds').value,20);run('closeModal()');
FakeWorker.instances=[];els.get('deeper').click();check(FakeWorker.instances.length,6);check(FakeWorker.instances[0].message.state.players.length,3);run('stopWork()');
run('state.players[1].score=2400;state.pot=6;render()');check(els.get('recommend').textContent,'BANK NOW');check(els.get('reason').textContent.includes('Rivals may still beat you'),true);
run("save();switchMode('solo');switchMode('multi')");check(state().adviser,'target');check(state().players[1].score,2400);
console.log('Multiplayer target port, own-seat mapping, rival independence, objective labels, 20-round restriction, search comparison and saved selection passed.');
ctx.goalFixture=JSON.parse(fs.readFileSync('goal-data.json','utf8'));
run("goalEngine=BankGoals.create(goalFixture);goalError='';state={...fresh(),adviser:'relative',mySeat:2,rolls:3,pot:100,players:Array.from({length:5},(_,i)=>freshPlayer('Seat '+i))};render();");
check(els.get('advisorylabel').textContent,'Relative goal · multiplayer');check(els.get('odds').classList.contains('hidden'),true);check(els.get('workers').disabled,true);check(els.get('deeper').textContent,'Compare win search');
const firstGoal=els.get('targetmetric').textContent;run('state.players[0].score=5000;render()');check(els.get('targetmetric').textContent===firstGoal,false);check(els.get('recommend').textContent,'STAY IN');
run('state.players[0].score=0;state.players[2].score=1000;render()');check(els.get('recommend').textContent,'WAIT FOR BANK');check(els.get('reason').textContent.includes('reassess'),true);
run('bankPlayer(0)');check(state().players[0].score,100);check(els.get('recommend').textContent,'BANK NOW');check(state().mySeat,2);
check(run("valid({...fresh(),adviser:'relative',rounds:20})"),true);check(run("valid({...fresh(),adviser:'relative',rounds:10})"),false);els.get('rounds').value='15';els.get('rounds').onchange();check(state().rounds,20);run('closeModal()');
FakeWorker.instances=[];els.get('deeper').click();check(FakeWorker.instances.length,6);check(FakeWorker.instances[0].message.state.players.length,5);run('stopWork();save();switchMode("solo");switchMode("multi")');check(state().adviser,'relative');check(state().mySeat,2);
run("goalEngine=null;goalError='Missing table';render()");check(els.get('recommend').textContent,'GOAL TABLE UNAVAILABLE');check(els.get('odds').classList.contains('hidden'),true);
console.log('Relative-goal adviser, rival-score changes, banking response, selected seat, objective labels, save restoration, 20-round restriction, search comparison and missing-data guard passed.');

check(html.includes('id=\"prevplayers\"'),false);check(html.includes('id=\"nextplayers\"'),false);run('goalEngine=BankGoals.create(goalFixture);state={...fresh(),adviser:\"relative\",players:Array.from({length:12},(_,i)=>freshPlayer(\"Seat \"+i))};render()');check(els.get('playerlist').children.length,12);els.get('playerlist').scrollTop=210;run('renderPlayers()');check(els.get('playerlist').scrollTop,210);check(els.get('playerlist').children[11].children[1].children[0].textContent,'Seat 11');console.log('All players render in one scrollable list; scroll position survives refresh and pagination is removed.');
run("state={...fresh(),adviser:'v35',targetAware:false,rounds:10,rolls:3,pot:100,mySeat:2,players:Array.from({length:5},(_,i)=>freshPlayer('Seat '+i))};render()");check(run('valid(state)'),true);check(els.get('targetaware').disabled,true);check(els.get('targetaware').value,'on');check(els.get('thinkseconds').disabled,false);check(els.get('workers').disabled,false);FakeWorker.instances=[];run('analyze(.25)');check(FakeWorker.instances.length,6);check(FakeWorker.instances[0].message.state.targetAware,true);check(FakeWorker.instances[0].message.state.players[0].name,'Seat 2');run('stopWork();save();switchMode("solo");switchMode("multi")');check(state().adviser,'v35');check(state().targetAware,false);run("state.adviser='monte';render()");check(els.get('targetaware').disabled,false);check(els.get('targetaware').value,'off');console.log('v3.5 preset forces benchmark target plans, preserves custom preferences, seat order and mode saves, and supports 10 rounds and six workers.');
