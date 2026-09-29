const assert=require('node:assert/strict'),M=require('./models.js');
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
test('Robot can exploit deposit counts; litter is conserved in every state',()=>{const r=M.robot();assert.ok(r.deposits>3);for(const f of r.frames)assert.equal(f.floor+f.bin+f.hidden,3);});
test('Rewarding an empty floor allows concealment',()=>{const r=M.robot({deposit:0,empty:10});assert.equal(r.hidden,3);assert.equal(r.bin,0);});
test('Disposal reward cleans, but neglecting fragile objects breaks a vase',()=>{assert.equal(M.robot({deposit:0,disposed:2}).bin,3);assert.equal(M.robot({deposit:0,disposed:2,vase:true}).broken,true);const r=M.robot({deposit:0,disposed:2,broken:-10,vase:true});assert.equal(r.broken,false);assert.equal(r.bin,3);});
test('Braess example is 65 min closed and 80 min open',()=>{near(M.traffic({shortcut:false}).mean,65);near(M.traffic().mean,80);});
test('Shortcut helps low demand, equilibrium conserves cars and has no cheaper unused route',()=>{assert.ok(M.traffic({n:2000}).mean<M.traffic({n:2000,shortcut:false}).mean);for(let n=500;n<=10000;n+=500)for(let cost=0;cost<=40;cost+=5){const r=M.traffic({n,cost});near(2*r.side+r.x,n);if(r.side>0&&r.x>0)near(r.outer,r.cross);if(r.x===n)assert.ok(r.cross<=r.outer+1e-8);if(r.x===0)assert.ok(r.outer<=r.cross+1e-8);}});
test('Coordinated allocation improves the 4000-driver equilibrium',()=>{const r=M.traffic();near(r.optimum,.125);assert.ok(M.traffic({share:r.optimum}).mean<65);});
test('Queue exact FCFS schedule and capacity',()=>{assert.deepEqual(M.serve([0,1,2],4).map(j=>j.wait),[0,3,6]);assert.deepEqual(M.serve([0,1,2],4,2).map(j=>j.wait),[0,0,2]);near(M.cafe({variable:false}).mean,0);});
test('Queue replay deterministic, adding barista cannot increase any wait',()=>{const a=M.cafe(),b=M.cafe({servers:2});assert.deepEqual(a,M.cafe());assert.equal(a.jobs.length,b.jobs.length);a.jobs.forEach((j,i)=>{assert.ok(j.start>=j.at);assert.ok(b.jobs[i].wait<=j.wait+1e-9);});assert.ok(a.mean>0);});
test('Same 100 voters elect three different winners',()=>{assert.deepEqual(M.voting(undefined,'plurality').winners,['A']);assert.deepEqual(M.voting(undefined,'runoff').winners,['C']);assert.deepEqual(M.voting(undefined,'borda').winners,['B']);assert.equal(M.voting().condorcet,'B');});
test('Voting ties, zero electorate, majority counterexample, and transfer',()=>{assert.deepEqual(M.voting([{n:1,rank:'ABC'},{n:1,rank:'BAC'}]).winners,['A','B']);assert.equal(M.voting([{n:0,rank:'ABC'}]).winners.length,0);assert.deepEqual(M.voting(M.profiles.majority,'borda').winners,['B']);assert.deepEqual(M.voting(M.profiles.challenge,'runoff').winners,['B']);assert.equal(M.voting(M.profiles.cycle).condorcet,null);});
test('Fish stock and catch remain bounded; sustainable quota survives',()=>{const r=M.fish({quota:3,player:6,others:6,monitor:true,defector:true,years:60});assert.ok(r.stock>60);for(const h of r.history){assert.ok(h.stock>=0&&h.stock<=120);assert.ok(h.catch>=0);}});
test('Individual restraint alone cannot fix overfishing; monitoring cannot fix an excessive quota',()=>{assert.ok(M.fish({player:2,others:5,years:30}).extinct);assert.ok(M.fish({quota:5,monitor:true,player:6,others:6,years:30}).extinct);assert.ok(M.fish({quota:3,player:6,others:6,defector:true,years:30}).extinct);});
test('Rational cascade counts informative decisions, not every echo',()=>{const r=M.cascade();assert.ok(r.rows.every(x=>x.choice===1));assert.equal(r.publicEvidence,2);assert.equal(r.rows[2].posterior,1);near(r.rows[2].confidence,2/3);near(r.publicRed,.8);});
test('Sharing private clues can reverse a mistaken cascade',()=>{const r=M.cascade(undefined,true);assert.equal(r.publicEvidence,-4);near(r.publicRed,1/17);assert.equal(r.rows.at(-1).choice,-1);});
test('Every eight-person history agrees with Bayes over all 512 weighted possible worlds',()=>{
  // Independent oracle: condition the distribution over jar + complete clue
  // sequences. It uses neither the log-odds update nor the cascade threshold.
  for(const share of [false,true]){
    const worlds=[];
    for(let mask=0;mask<256;mask++){
      const signals=Array.from({length:8},(_,i)=>(mask>>i)&1?1:-1);
      const result=M.cascade(signals,share);
      for(const jar of [1,-1])worlds.push({jar,signals,result,weight:2**signals.filter(s=>s===jar).length});
    }
    let groups=[worlds];
    const mass=ws=>ws.reduce((sum,w)=>(sum[w.jar===1?0:1]+=w.weight,sum),[0,0]);
    for(let i=0;i<8;i++){
      const next=[];
      for(const group of groups){
        const prior=mass(group),observations=new Map();
        for(const signal of [1,-1]){
          const privateWorlds=group.filter(w=>w.signals[i]===signal),posterior=mass(privateWorlds);
          const choice=posterior[0]===posterior[1]?signal:posterior[0]>posterior[1]?1:-1;
          for(const w of privateWorlds){
            const row=w.result.rows[i];
            near(2**row.prior,prior[0]/prior[1]);
            near(2**row.posterior,posterior[0]/posterior[1]);
            assert.equal(row.choice,choice);
            const observed=share?signal:choice;
            if(!observations.has(observed))observations.set(observed,[]);
            observations.get(observed).push(w);
          }
        }
        for(const groupAfter of observations.values()){
          const posterior=mass(groupAfter);
          for(const w of groupAfter)near(2**w.result.rows[i].publicEvidence,posterior[0]/posterior[1]);
          next.push(groupAfter);
        }
      }
      groups=next;
    }
    near(groups.flat().reduce((sum,w)=>sum+w.weight,0),2*3**8);
  }
});
test('The exact eight-red-choice likelihood is 4/9 versus 1/9; private evidence differs',()=>{
  let redMass=0,blueMass=0;
  for(let mask=0;mask<256;mask++){
    const signals=Array.from({length:8},(_,i)=>(mask>>i)&1?1:-1);
    if(M.cascade(signals).rows.every(row=>row.choice===1)){
      redMass+=2**signals.filter(s=>s===1).length;
      blueMass+=2**signals.filter(s=>s===-1).length;
    }
  }
  near(redMass/3**8,4/9);near(blueMass/3**8,1/9);
  near(redMass/(redMass+blueMass),4/5);
  const original=M.cascade(),flipped=M.cascade([1,1,1,-1,-1,-1,-1,-1]);
  assert.deepEqual(original.rows.map(x=>x.choice),flipped.rows.map(x=>x.choice));
  near(original.rows[2].confidence,2/3);near(flipped.rows[2].confidence,8/9);
  near(original.publicRed,flipped.publicRed);
  near(M.cascade(undefined,true).publicRed,4/(4+64));
});
test('The shortcut is individually beneficial throughout adoption, despite the worse final average',()=>{
  for(let x=0;x<=4000;x+=500){const r=M.traffic({share:x/4000});near(r.outer-r.cross,25-x/200);assert.ok(r.cross<r.outer);}
  const first=M.traffic({share:0}),last=M.traffic({share:1});near(first.cross,40);near(first.outer,65);near(last.cross,80);near(last.outer,85);
});
test('Simpson example preserves counts and reverses both within-group advantages',()=>{
 const r=M.simpson();assert.equal(r.a.success,66);assert.equal(r.b.success,74);assert.deepEqual(r.within,[10,10]);assert.equal(r.reversal,true);
 assert.deepEqual(r.a.groups.map(g=>[g.n,g.success]),[[20,18],[80,48]]);assert.deepEqual(r.b.groups.map(g=>[g.n,g.success]),[[80,64],[20,10]]);
});
test('Exchanging work conserves the city mix and flips the ranking without changing group rates',()=>{
 for(let n=10;n<=90;n+=10){const r=M.simpson({mixA:n,mixB:100-n});near(r.a.groups[0].n+r.b.groups[0].n,100);near(r.a.groups[1].n+r.b.groups[1].n,100);near(r.a.success,60+.3*n);near(r.b.success,80-.3*n);assert.deepEqual(r.within,[10,10]);}
 assert.equal(M.simpson({mixA:30,mixB:70}).reversal,true);assert.equal(M.simpson({mixA:40,mixB:60}).reversal,false);
});
test('A common mixture cannot reverse strict dominance within both groups',()=>{
 for(let ae=20;ae<=100;ae+=20)for(let ah=20;ah<=100;ah+=20)for(let w=0;w<=100;w+=5){
  const r=M.simpson({aEasy:ae,aHard:ah,bEasy:ae-20,bHard:ah-20,mixA:w,mixB:w});near(r.gap,20);assert.equal(r.reversal,false);
 }
});
test('Simpson detector handles reverse dominance, ties, crossed groups, and extreme rates',()=>{
 const reversed=M.simpson({aEasy:80,aHard:50,bEasy:90,bHard:60,mixA:80,mixB:20});assert.equal(reversed.reversal,true);assert.ok(reversed.gap>0);
 assert.equal(M.simpson({aEasy:50,aHard:50,bEasy:50,bHard:50}).reversal,false);
 assert.equal(M.simpson({aEasy:90,aHard:40,bEasy:80,bHard:60}).reversal,false);
 const extremes=M.simpson({aEasy:100,aHard:0,bEasy:0,bHard:100,mixA:20,mixB:80});near(extremes.a.success,20);near(extremes.b.success,20);assert.equal(extremes.reversal,false);
});
test('Every supported ticket grid has exactly 100 jobs and integer successful counts',()=>{
 for(let e=0;e<=100;e+=10)for(let h=0;h<=100;h+=10)for(let n=10;n<=90;n+=10){
  const s=M.simpson({aEasy:e,aHard:h,mixA:n}).a;assert.equal(s.groups.reduce((a,g)=>a+g.n,0),100);assert.ok(s.success>=0&&s.success<=100);for(const g of s.groups)assert.ok(Number.isInteger(g.success));
 }
});
test('Improving both support rates can lower the overall rate when the case mix shifts',()=>{
 const old=M.simpson({aEasy:80,aHard:40,mixA:80}).a,now=M.simpson({aEasy:90,aHard:50,mixA:20}).a;near(old.success,72);near(now.success,58);
 near(M.simpson({aEasy:80,aHard:40,mixA:50}).a.success,60);near(M.simpson({aEasy:90,aHard:50,mixA:50}).a.success,70);
});
console.log(`${count} mathematical checks passed.`);
