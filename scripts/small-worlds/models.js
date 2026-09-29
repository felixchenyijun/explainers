/* Original, deterministic teaching models. No external dependencies. */
const Models = (() => {
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
  function robot({deposit=1,disposed=0,hidden=0,broken=0,empty=0,vase=false,steps=8}={}) {
    const initial={floor:3,bin:0,hidden:0,broken:false},memo=new Map();
    function moves(s){const out=[];
      if(s.floor){out.push(['put',{...s,floor:s.floor-1,bin:s.bin+1},1]);out.push(['hide',{...s,floor:0,hidden:s.hidden+s.floor},0]);if(vase)out.push(['sweep',{...s,floor:0,bin:s.bin+s.floor,broken:true},s.floor]);}
      if(s.bin)out.push(['take',{...s,bin:s.bin-1,floor:s.floor+1},0]);out.push(['wait',{...s},0]);return out;
    }
    const end=s=>disposed*s.bin+hidden*s.hidden+broken*Number(s.broken)+empty*Number(s.floor===0);
    function solve(s,t){if(!t)return {value:end(s),path:[]};const k=[s.floor,s.bin,s.hidden,+s.broken,t].join();if(memo.has(k))return memo.get(k);
      let best={value:-Infinity,path:[]};for(const [act,next,n] of moves(s)){const rest=solve(next,t-1),value=rest.value+deposit*n-(act==='wait'?0:.001);if(value>best.value+1e-8)best={value,path:[{action:act,...next,deposit:n},...rest.path]};}memo.set(k,best);return best;
    }
    const best=solve(initial,steps);let points=0;const frames=[{...initial,action:'ready',points:0,deposit:0}];
    for(const step of best.path){points+=deposit*step.deposit;frames.push({...step,points});}const last=frames.at(-1);points+=end(last);last.points=points;
    return {frames,points,bin:last.bin,hidden:last.hidden,broken:last.broken,deposits:frames.reduce((a,f)=>a+f.deposit,0)};
  }
  function traffic({n=4000,shortcut=true,cost=0,share=null}={}){
    n=Math.max(1,n);const x=shortcut?(share===null?clamp(200*(45-cost)-n,0,n):n*clamp(share,0,1)):0;
    const side=(n-x)/2,load=(n+x)/2,outer=45+load/100,cross=2*load/100+cost;
    const mean=((n-x)*outer+x*cross)/n;
    return {n,x,side,load,outer,cross,mean,baseline:45+n/200,optimum:clamp((100*(45-cost)-n)/n,0,1)};
  }
  function serve(arrivals,service,servers=1){const free=Array(servers).fill(0),jobs=[];
    arrivals.forEach((at,i)=>{const lane=free.indexOf(Math.min(...free)),start=Math.max(at,free[lane]),duration=Array.isArray(service)?service[i]:service,end=start+duration;free[lane]=end;jobs.push({at,start,end,wait:start-at,lane});});return jobs;
  }
  function cafe({rate=12,servers=1,variable=true,seed=17,horizon=240}={}){
    const random=rng(seed),arrivals=[];let time=0;
    while(true){time+=variable?-Math.log(Math.max(1e-9,1-random()))*60/rate:60/rate;if(time>horizon)break;arrivals.push(time);}
    const jobs=serve(arrivals,4,servers),waits=jobs.map(j=>j.wait).sort((a,b)=>a-b),mean=waits.reduce((a,b)=>a+b,0)/Math.max(1,waits.length);
    const line=Array.from({length:horizon+1},(_,t)=>({t,q:jobs.filter(j=>j.at<=t&&j.start>t).length}));
    return {jobs,line,mean,p95:waits[Math.max(0,Math.ceil(waits.length*.95)-1)]||0,util:rate*4/(60*servers),max:Math.max(...line.map(p=>p.q)),customers:jobs.length,horizon};
  }
  const profiles={original:[{n:42,rank:'ABC'},{n:26,rank:'BCA'},{n:32,rank:'CBA'}],majority:[{n:51,rank:'ABC'},{n:49,rank:'BCA'},{n:0,rank:'CAB'}],cycle:[{n:34,rank:'ABC'},{n:33,rank:'BCA'},{n:33,rank:'CAB'}],challenge:[{n:45,rank:'ABC'},{n:35,rank:'BCA'},{n:20,rank:'CBA'}]};
  function voting(profile=profiles.original,rule='plurality'){
    const names=['A','B','C'],total=profile.reduce((a,g)=>a+g.n,0),first={A:0,B:0,C:0},points={A:0,B:0,C:0};
    for(const g of profile){first[g.rank[0]]+=g.n;[...g.rank].forEach((c,i)=>points[c]+=g.n*(2-i));}
    let scores={...first},eliminated=null,eliminationTie=false;
    if(rule==='borda')scores=points;
    if(rule==='runoff'&&Math.max(...Object.values(first))<=total/2){const min=Math.min(...Object.values(first)),tied=names.filter(c=>first[c]===min);eliminationTie=tied.length>1;eliminated=tied.at(-1);scores={A:0,B:0,C:0};for(const g of profile)scores[[...g.rank].find(c=>c!==eliminated)]+=g.n;}
    const eligible=names.filter(c=>c!==eliminated),best=Math.max(...eligible.map(c=>scores[c])),winners=total?eligible.filter(c=>scores[c]===best):[];
    const pairwise={};for(const a of names)for(const b of names)if(a!==b)pairwise[a+b]=profile.reduce((sum,g)=>sum+(g.rank.indexOf(a)<g.rank.indexOf(b)?g.n:0),0);
    const condorcet=names.find(a=>names.filter(b=>a!==b).every(b=>pairwise[a+b]>pairwise[b+a]))||null;
    return {scores,first,points,winners,eliminated,eliminationTie,total,pairwise,condorcet};
  }
  function fish({player=4,others=4,quota=null,monitor=false,defector=false,rate=.4,shock=false,years=16,start=80}={}){
    let stock=start,income=0,totalCatch=0;const history=[{year:0,stock,catch:0,growth:0,income:0,fee:0}];
    for(let year=1;year<=years;year++){
      const desired=[player,others,others,others].map((c,i)=>quota===null?c:(defector&&i===3&&!monitor?6:Math.min(c,quota)));
      const demand=desired.reduce((a,b)=>a+b,0),scale=demand?Math.min(1,stock/demand):0,caught=demand*scale,own=desired[0]*scale;
      const left=Math.max(0,stock-caught),r=shock&&year>=7?rate*.6:rate,growth=left<1?0:r*left*(1-left/120);
      stock=left<1?0:clamp(left+growth,0,120);const fee=monitor?.4:0;income+=own-fee;totalCatch+=caught;
      history.push({year,stock,catch:caught,growth,income,fee,own,rate:r});
    }
    return {history,stock,income,totalCatch,extinct:stock<1,maxGrowth:rate*120/4};
  }
  function cascade(signals=[1,1,-1,-1,-1,-1,-1,-1],shareClues=false){let publicEvidence=0;const rows=[];
    for(let i=0;i<signals.length;i++){const signal=signals[i],prior=publicEvidence,posterior=prior+signal,choice=posterior===0?signal:Math.sign(posterior),informative=Math.abs(prior)<2;
      publicEvidence+=shareClues?signal:(informative?choice:0);
      rows.push({i,signal,prior,posterior,choice,informative,publicEvidence,confidence:1/(1+Math.pow(2,-Math.abs(posterior)))});
    }
    return {rows,publicEvidence,allClues:signals.reduce((a,b)=>a+b,0),publicRed:1/(1+Math.pow(2,-publicEvidence))};
  }
  function simpson({aEasy=90,aHard=60,bEasy=80,bHard=50,mixA=20,mixB=80}={}){
    const shop=(easy,hard,mix)=>{
      easy=clamp(Number(easy),0,100);hard=clamp(Number(hard),0,100);mix=clamp(Number(mix),0,100);
      const groups=[{kind:'easy',n:mix,rate:easy,success:mix*easy/100},{kind:'hard',n:100-mix,rate:hard,success:(100-mix)*hard/100}];
      return {groups,total:100,success:groups.reduce((s,g)=>s+g.success,0)};
    };
    const a=shop(aEasy,aHard,mixA),b=shop(bEasy,bHard,mixB),gap=a.success-b.success;
    const within=[a.groups[0].rate-b.groups[0].rate,a.groups[1].rate-b.groups[1].rate];
    const reversal=(within.every(x=>x>0)&&gap<0)||(within.every(x=>x<0)&&gap>0);
    return {a,b,gap,within,reversal};
  }
  return {clamp,rng,robot,traffic,serve,cafe,profiles,voting,fish,cascade,simpson};
})();
if(typeof module!=='undefined')module.exports=Models;
