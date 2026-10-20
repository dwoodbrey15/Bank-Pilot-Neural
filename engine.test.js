const assert=require('node:assert/strict');
const E=require('../engine.js')();
let checks=0;
const player=(score=0,active=true)=>({score,active,banked:0,style:'learn',evidence:E.bases.map(()=>0)});
const state=(players,pot=100,round=20)=>({players,pot,round,rounds:20,rolls:3,lastBank:-1});
const near=(a,b)=>{assert(Math.abs(a-b)<1e-11,`${a} != ${b}`);checks++;};
for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
 const safe=E.transition(130,2,a,b),risk=E.transition(130,3,a,b);
 assert.equal(safe.pot,130+(a+b===7?70:a+b));assert.equal(safe.bust,false);
 assert.equal(risk.pot,a+b===7?0:a===b?260:130+a+b);assert.equal(risk.bust,a+b===7);checks+=4;
}
for(let target=1;target<180;target+=7){
 const oracle=new Array(target+1).fill(1);
 for(let pot=target-1;pot>=1;pot--){let total=0;for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
  if(a+b===7)continue;const next=a===b?pot*2:pot+a+b;total+=next>=target?1:oracle[next];
 }oracle[pot]=total/36;}
 const table=E.hittingTable(target);for(let pot=1;pot<=target;pot++)near(table[pot],oracle[pot]);
}
for(const [target,expected]of [[101,5/6],[150,.5244009633308733],[200,.5014406071472695],[300,.27123652876385346]])near(E.hittingTable(target)[100],expected);
const tied=state([player(0),player(100,false)]);near(E.exactEnd(tied).bank,.5);near(E.exactEnd(tied).roll,5/6);
assert.equal(E.exactEnd({...tied,rolls:2}),null);checks++;
assert.equal(E.guaranteed(state([player(101),player(100)],70,1)).action,'WAIT');
assert.equal(E.guaranteed(state([player(100),player(90),player(80)],50,20)),null);
assert.equal(E.guaranteed(state([player(100),player(140,false)],50,5)).action,'BANK');checks+=3;
const root=state([player(),player()],100,20),post=root.players.map(p=>E.modelWeights(p));
let event=false;
for(let seed=1;seed<100&&!event;seed++){
 const g=E.prepare(root),w=E.makeWorld(seed,post,5);w.styles[1]={family:'fixed',base:1};E.advance(g,1,w);
 if(!g.active[1]){assert.equal(g.pot,100);assert.equal(g.step,3);assert.equal(g.lastBank,1);assert.equal(g.active[0],true);assert.equal(g.done,false);E.advance(g,0,w);assert.equal(g.done,true);assert.deepEqual(g.scores,[100,100]);event=true;checks+=7;}
}
assert(event);
for(let seed=1;seed<=250;seed++){
 const s=state([player(110),player(100)],52,1),g=E.prepare(s),w=E.makeWorld(seed*1709,s.players.map(p=>E.modelWeights(p)));
 for(let k=0;k<2000&&!g.done;k++)E.advance(g,E.policyAction(g,{threshold:100,future:130,adaptive:true,competitive:true}),w);
 assert(g.done);assert.equal(g.scores[0]-g.scores[1],10);assert.equal(E.reward(g.scores),1);checks+=3;
}
const p=player();for(let k=0;k<60;k++)E.observe(p,k%2?250:25,[100,110],0,5,k%2===1,{active:[true,true],banked:[0,0],lastBank:-1});
assert.equal(p.modelObservations,60);assert.equal(p.modelEvidence.length,E.models.length);assert(p.modelEvidence.every(Number.isFinite));near(E.modelWeights(p).reduce((a,b)=>a+b,0),1);assert(E.modelWeights(p).every(x=>x>0));checks+=4;
const final=state([player(0),player(0,false)]);assert.equal(E.analyzePart(final).action,'BANK');assert.equal(E.analyzePart(final).samples,0);checks+=2;
for(const n of [3,8,60]){
 const s=state(Array.from({length:n},(_,i)=>player(i?1000:0)),100),part=E.analyzePart(s,{budgetMs:120,seed:n*17}),r=E.combine([part]);
 assert.equal(r.action,'ROLL');assert.equal(r.bank,0);assert(r.roll>=0&&r.roll<=1+1e-12);assert(r.samples>0);assert.equal(part.enumeratedOutcomes%10,0);assert(r.sensitivity.every(g=>g.n===0||Number.isFinite(g.delta)));checks+=6;
}
console.log(checks+' engine rule, oracle, banking-response, lead-preservation, learning and search checks passed.');
for(const family of ['adaptive','chaser','strategic']){
 const m={family,base:130};
 const before=E.modelHazard(m,100,[100,100,100],2,5,{active:[true,true,true],banked:[0,0,0],lastBank:-1});
 const after=E.modelHazard(m,100,[100,200,100],2,5,{active:[true,false,true],banked:[0,100,0],lastBank:1});
 near(before,after);
}
const shield={round:20,rounds:20,rolls:3,pot:80,players:[player(500),player(450),player(400,false)]};
assert.equal(E.guaranteed(shield).guarantee,'final-shadow');
assert.equal(E.guaranteed({...shield,players:[player(500),player(450),player(600,false)]}),null);
const reproducible=state([player(),player(),player()],80,10);
const opts={seed:9188,work:{policy:12,tree:16,tune:8,validation:12}};
const r1=E.analyzePart(reproducible,opts),r2=E.analyzePart(reproducible,opts);
for(const k of ['b','r','d','d2','n','fallbackAction','searchGames'])assert.equal(r1[k],r2[k]);
console.log('Banking-score invariance, final-round shadowing and deterministic-work checks passed.');

const zeroTie=E.combine([{n:24,b:0,r:0,b2:0,r2:0,d:0,d2:0,fallbackAction:'ROLL',elapsed:1}]);
assert.equal(zeroTie.close,true);assert.equal(zeroTie.action,'ROLL');
const oneTie=E.combine([{n:24,b:24,r:24,b2:24,r2:24,d:0,d2:0,fallbackAction:'BANK',elapsed:1}]);
assert.equal(oneTie.close,true);assert.equal(oneTie.action,'BANK');
console.log('Zero-variance equality uses the fallback rather than a bank-by-default tie.');
