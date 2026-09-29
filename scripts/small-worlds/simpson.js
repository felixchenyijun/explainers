const G={
 slug:'average-that-lied',title:'The Average That Lied',theme:'A game about Simpson’s paradox',
 chapters:['Pick a repair shop','Open the job books','Change the mix','Compare the same work','Choose the right question','A misleading dashboard','Take it with you'],
 initialLab:{aEasy:90,aHard:60,bEasy:80,bHard:50,mixA:20,mixB:80,matched:0},
 model:'An invented town with two bicycle repair shops and two kinds of job. Each shop receives 100 jobs. Easy/hard success rates are fixed in the mix experiments; moving jobs recomputes a deterministic illustrative tally, not a forecast of particular repairs. All displayed counts are exact for the ten-job and ten-percentage-point increments. The first experiment exchanges easy and hard work, preserving the town’s 100 easy and 100 hard jobs. Standardization instead asks a hypothetical question: what if both shops received a specified common mix? These descriptive rates alone do not establish a causal effect of choosing a shop. The support-team transfer example is also invented. Real comparisons need appropriate groups, adequate sample sizes, and knowledge of how people entered each group.',
 sources:[['The Interpretation of Interaction in Contingency Tables — E. H. Simpson (1951)','https://rss.onlinelibrary.wiley.com/doi/10.1111/j.2517-6161.1951.tb00088.x'],['Understanding Simpson’s Paradox — Judea Pearl (2014)','https://ftp.cs.ucla.edu/pub/stat_ser/r414.pdf']],
 render(){
  const d=data(),c=S.chapter;
  if(S.sandbox)return this.lab(d);
  if(c===6)return this.finish();
  if(c===4)return this.causal(d);
  if(c===5)return this.transfer(d);
  let r=Models.simpson(),title,body,art='',controls='',feedback='',after='',ready=false;
  if(c===0){
   title='Who would you trust with your bike?';
   body='Mira and Sol each took on 100 repairs last month. A repair counts as a success if the bike was fixed on the first visit. Here is the town’s leaderboard.';
   art=this.boards(r,{types:false});
   controls=!d.choice?U.choices('What does this tell you about which shop to choose?',[['sol','Sol looks better: 74% beats 66%'],['mira','I’d choose Mira'],['more','I need to know what jobs they took']]):'';
   if(d.choice)feedback=U.feedback('Sol’s overall rate is higher. What is inside it?','Those totals are correct. But the shops did not receive the same kind of work. Before deciding who did the better job, open their job books.',d.choice==='more');
   ready=!!d.choice;
  }else if(c===1){
   title='Mira wins both kinds of repair.';
   body='Some bikes need a simple tire repair. Others have a difficult gear problem. Inspect each kind separately. The 200 jobs are the same ones you just saw.';
   art=this.boards(r,{types:true,compact:true});
   controls=`<div class="choices">${U.button('Inspect easy jobs','inspect','easy',d.easy?'selected':'secondary')}${U.button('Inspect difficult jobs','inspect','hard',d.hard?'selected':'secondary')}</div>`;
   controls+=this.groupTable(r,{easy:!!d.easy,hard:!!d.hard});
   if(d.easy&&d.hard){feedback=U.feedback('90% beats 80%. 60% beats 50%. Yet 66% loses to 74%.','No repair changed and no number is false. This reversal between the grouped and overall comparisons is called Simpson’s paradox. The missing ingredient is how much of each kind of work a shop received.',true);ready=true;}
   else feedback=U.feedback('Look inside both totals.','Use the two buttons to uncover each kind of repair. Pay attention to the number of jobs as well as the percentage.');
  }else if(c===2){
   const mix=d.mix??20;r=Models.simpson({mixA:mix,mixB:100-mix});
   title='Change the work. Flip the leaderboard.';
   body='Mira gets mostly difficult jobs; Sol gets mostly easy ones. Exchange their work without changing either shop’s success rate for either kind. Can you make Mira’s overall rate higher?';
   art=this.boards(r,{types:true});
   controls=`<div class="controls simpson-controls">${U.range('mix','Easy jobs sent to Mira',mix,10,90,10,' of 100')}</div><div class="choices">${U.button('Swap 10 easy jobs toward Mira','swap','10',mix===90?'secondary':'')}${U.button('Restore the original mix','mix-reset','','secondary')}</div><p class="note">Sol gets ${100-mix} easy jobs. Each swap sends 10 difficult jobs the other way. The town still has 100 of each kind.</p>`;
   feedback=U.feedback(r.gap>0?'The ranking flipped. Nobody got better at repairs.':'Mira still wins within each kind.',r.gap>0?`Mira now fixes ${U.fmt(r.a.success)} of 100; Sol fixes ${U.fmt(r.b.success)}. You changed the mix of work, not either shop’s skill. The aggregate moved because its weights moved.`:'Move the slider or swap jobs. Mira stays at 90% on easy jobs and 60% on difficult ones; Sol stays at 80% and 50%.',r.gap>0);
   after=this.calculations(r)+this.groupTable(r);ready=!!d.flipped;
  }else{
   const mix=d.common??50;r=Models.simpson({mixA:mix,mixB:mix});
   title='Give both shops the same recipe.';
   body='Ask a different question: how would these rates compare for the same mix of work? Apply each shop’s rates to an identical basket of 100 jobs. These are standardized scores, not newly observed repairs.';
   art=this.boards(r,{types:true,standard:true});
   controls=`<div class="controls simpson-controls">${U.range('common','Easy jobs in each shop’s comparison basket',mix,10,90,10,' of 100')}</div><div class="choices">${U.button('Mostly difficult','common',20,'secondary')}${U.button('Half and half','common',50,'secondary')}${U.button('Mostly easy','common',80,'secondary')}</div>`;
   const tried=Object.keys(d.mixes||{}).length;
   feedback=U.feedback('The same weights preserve Mira’s lead.',`With ${mix} easy jobs in each basket, Mira scores ${U.fmt(r.a.success)}%; Sol scores ${U.fmt(r.b.success)}%. The gap stays at 10 percentage points. Try two different mixes. ${Math.min(tried,2)} of 2 tested.`,true);
   after=this.calculations(r)+`<details class="simpson-proof"><summary>Why a reversal is impossible with these shared weights</summary><p>Let <b>w</b> be the fraction of easy jobs, from 0 to 1.</p><p class="equation">Mira = w × 90% + (1 − w) × 60%<br>Sol = w × 80% + (1 − w) × 50%</p><p>Subtract the second line from the first:</p><p class="equation">Mira − Sol = w × 10 + (1 − w) × 10<br>= <strong>10 percentage points</strong></p><p>More generally, a weighted average of positive group differences stays positive when both sides use the same nonnegative weights. The original leaderboard used <em>different</em> weights: 20% easy work for Mira and 80% for Sol.</p></details>`;
   ready=tried>=2;
  }
  if(c===2||c===3){art=controls+art;controls='';}
  return U.scene({title,body,art,controls,feedback,after:after+U.note('An invented example. Filled tickets are successful repairs; outlined tickets need another visit.'),ready});
 },
 boards(r,{types=true,compact=false,standard=false}={}){
  const shop=(name,s,id)=>{
   const color=id==='a'?'#8faaa0':'#b69aba';let dots='';
   for(const g of s.groups)for(let j=0;j<g.n;j++)dots+=`<span class="repair-ticket ${types?g.kind:'plain'} ${j<g.success?'fixed':'unfinished'}" aria-hidden="true">${j<g.success?'✓':'·'}</span>`;
   const mix=s.groups[0].n;
   return `<section class="repair-shop" data-shop="${id}"><div class="shop-name"><svg class="shop-actor" viewBox="0 0 90 100" aria-hidden="true">${U.person(43,21,color,.72,'hmm',{id:'mechanic-'+id})}</svg><div><span class="tag">${standard?'SAME-MIX SCORE':'REPAIR SHOP'}</span><h2>${name}</h2></div><div class="repair-score"><b>${U.fmt(s.success)}%</b><span>${U.fmt(s.success)} / 100</span></div></div>${compact?'':`<div class="repair-tickets" role="img" aria-label="${name}: ${U.fmt(s.success)} successful repairs out of 100${types?`, with ${mix} easy and ${100-mix} difficult jobs`:''}.">${dots}</div>`}${types?`<div class="job-mix" aria-label="${mix} easy jobs, ${100-mix} difficult jobs"><span class="easy" style="flex:${mix}">${mix}</span><span class="hard" style="flex:${100-mix}">${100-mix}</span></div><p class="mix-caption"><span>● ${mix} easy</span><span>◆ ${100-mix} difficult</span></p>`:'<p class="mix-caption">All jobs combined</p>'}</section>`;
  };
  return `<div class="repair-board">${shop('Mira',r.a,'a')}${shop('Sol',r.b,'b')}</div>${types?'<p class="ticket-key"><span class="easy-key">● Easy: tires</span><span class="hard-key">◆ Difficult: gears</span></p>':''}`;
 },
 groupTable(r,{easy=true,hard=true}={}){
  return `<div class="repair-breakdown"><table><caption>The same records, separated by job difficulty</caption><thead><tr><th scope="col">Kind of job</th><th scope="col">Mira</th><th scope="col">Sol</th></tr></thead><tbody>${r.a.groups.map((g,i)=>`<tr><th scope="row">${i?'◆ Difficult':'● Easy'}</th>${[r.a,r.b].map(s=>`<td>${(i?hard:easy)?`<b>${s.groups[i].rate}%</b><span>${U.fmt(s.groups[i].success)} of ${s.groups[i].n} fixed</span>`:'<span>Inspect to reveal</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 },
 calculations(r){return `<div class="weighted-math"><h2>A percentage is a recipe.</h2>${[['Mira',r.a],['Sol',r.b]].map(([n,s])=>`<p><strong>${n}:</strong> <span class="easy-text">${s.groups[0].n} × ${s.groups[0].rate}%</span> + <span class="hard-text">${s.groups[1].n} × ${s.groups[1].rate}%</span> = <b>${U.fmt(s.success)} fixed out of 100</b></p>`).join('')}<p class="note">Add successful jobs, then divide by all jobs. A plain average of the two rates assumes equal-sized groups.</p></div>`;},
 causal(d){
  const which=d.case||'before',after=which==='after',answer=d.answers?.[which],right=after?'total':'group';
  const art=`<div class="causal-picture"><p class="tag">${after?'SOMETHING THE PROGRAM CHANGES':'SOMETHING THAT CAME BEFORE'}</p><div class="causal-flow">${after?'<span>Randomly assigned<br><b>coaching</b></span><i>→</i><span>More<br><b>practice</b></span><i>→</i><span>Better<br><b>scores</b></span>':'<span>Job<br><b>difficulty</b></span><i>↙ ↘</i><span>Which shop gets it<br><b>and whether it gets fixed</b></span>'}</div><p>${after?'Practice is one possible way the coaching helps.':'Difficult jobs are sent to Mira more often and are harder for either shop to fix.'}</p></div>`;
  const controls=`<div class="choices">${U.button('The repair shops','case','before',!after?'selected':'secondary')}${U.button('A coaching program','case','after',after?'selected':'secondary')}</div>${!answer?U.choices(after?'You want the coaching program’s total effect. Should you remove the benefit that works through extra practice?':'You want to compare the shops doing similar work. What comparison helps? ',after?[['group','Yes: compare only equal practice hours'],['total','No: retain all ways the program helps']]:[['group','Compare similar job difficulties'],['total','Use only the overall leaderboard']],'causal-answer'):''}`;
  let feedback='';
  if(answer)feedback=U.feedback(after?'Don’t adjust away the pathway you want to measure.':'For this question, compare similar work.',after?'Comparing only people with the same practice time can remove part of the effect you want. Random assignment supports a comparison of the coaching groups’ overall outcomes. More grouping is not automatically better.':'Difficulty affects both the assignment of jobs and the outcome. Comparing within difficulty removes that particular mismatch. Other differences could still matter; these rates alone do not prove that the shop caused the outcome.',answer===right);
  const complete=!!d.answers?.before&&!!d.answers?.after;
  return U.scene({title:'Which average answers your question?',body:'Grouping is a tool, not a truth filter. Try both situations. Ask how the groups were formed and what effect you actually want to compare.',art,controls,feedback,after:U.note(complete?'Both situations explored. The causal story tells you what to compare.':'Explore both situations before continuing.'),ready:complete});
 },
 transfer(d){
  const old=Models.simpson({aEasy:80,aHard:40,mixA:80}).a,now=Models.simpson({aEasy:90,aHard:50,mixA:20}).a;
  const art=`<div class="repair-breakdown transfer-table"><table><caption>Support tickets resolved on the first contact</caption><thead><tr><th scope="col">Type</th><th scope="col">Last month</th><th scope="col">This month</th></tr></thead><tbody><tr><th scope="row">Easy</th><td><b>80%</b><span>64 of 80</span></td><td><b>90%</b><span>18 of 20</span></td></tr><tr><th scope="row">Difficult</th><td><b>40%</b><span>8 of 20</span></td><td><b>50%</b><span>40 of 80</span></td></tr><tr class="overall-row"><th scope="row">Overall</th><td><b>${old.success}%</b></td><td><b>${d.choice?now.success+'%':'Your prediction?'}</b></td></tr></tbody></table></div>`;
  return U.scene({title:d.choice?'Your team improves. The dashboard falls.':'Your team’s month-end review.',body:'A support team resolves a larger fraction of both easy and difficult tickets this month. It also starts taking many more difficult cases. All counts are shown below.',art,controls:!d.choice?U.choices('What happens to its overall resolution rate?',[['up','It rises: both rates improved'],['down','It falls: the mix changed'],['same','It stays the same']]):'',feedback:d.choice?U.feedback('72% → 58%, while both kinds improved.','An overall decline does not by itself show that the team got worse. With a common 50/50 mix, the scores would rise from 60% to 70%. Report the overall result and the case mix; compare like with like before assigning credit or blame.',d.choice==='down'):'',after:U.note('An invented example with the same weighted-average mechanism. Neither overall nor adjusted scores tell the whole causal story on their own.'),ready:!!d.choice,next:'Take the lesson with you →'});
 },
 lab(d){
  const mixB=d.matched?d.mixA:d.mixB,r=Models.simpson({...d,mixB});
  let title=r.reversal?'A reversal: the overall ranking disagrees.':r.gap===0?'An overall tie.':'No reversal in this configuration.';
  let text=r.reversal?'One shop leads within both job types but trails overall. Different mixtures can overpower the within-group advantage.':r.within[0]*r.within[1]<0?'Each shop leads in a different group. That tradeoff is not Simpson’s reversal.':d.matched?'Both shops receive identical mixtures. If one shop leads in both groups, it must lead overall.':'Try giving the stronger shop more difficult jobs. A reversal is possible, but not inevitable.';
  return U.scene({title:'Build your own misleading average.',body:'Change success rates and job mixtures. Every ticket and percentage comes from the same calculation. Can you create a reversal—and then remove it by matching the mix?',art:this.boards(r),controls:`<div class="controls">${U.range('aEasy','Mira: easy success rate',d.aEasy,0,100,10,'%')}${U.range('bEasy','Sol: easy success rate',d.bEasy,0,100,10,'%')}${U.range('aHard','Mira: difficult success rate',d.aHard,0,100,10,'%')}${U.range('bHard','Sol: difficult success rate',d.bHard,0,100,10,'%')}${U.range('mixA','Mira: easy jobs',d.mixA,10,90,10,' of 100')}${d.matched?'':U.range('mixB','Sol: easy jobs',d.mixB,10,90,10,' of 100')}${U.select('matched','Comparison mix',d.matched,[[0,'Each shop has its own mix'],[1,'Give both shops Mira’s mix']])}</div>`,feedback:U.feedback(title,text,!r.reversal),after:this.calculations(r)+this.groupTable(r)});
 },
 finish(){
  const scene=U.completion('Before trusting an average, ask who is inside it.','You reversed a ranking by moving work, compared a common mix, and saw why the right comparison depends on the question.','Ask for the counts. Check the mix. Explain how the groups were formed.');
  scene.html+=`<div class="simpson-habits"><h2>Put it to work.</h2><p><strong>A leaderboard:</strong> ask whether people handled comparable work before praising or penalizing them.</p><p><strong>A before-and-after chart:</strong> check whether the population changed along with the measured rate.</p><p><strong>A claim about what causes what:</strong> say which effect you mean. Neither a bigger total nor a neatly grouped table proves causation by itself.</p><p class="note">A useful sentence: “Show me the counts by relevant group, and the result using the same mix.”</p></div>`;
  return scene;
 },
 act(a,v){const d=data();
  if(a==='choose')d.choice=v;
  if(a==='inspect')d[v]=true;
  if(a==='swap')this.change('mix',Math.min(90,(d.mix??20)+Number(v)));
  if(a==='mix-reset')d.mix=20;
  if(a==='common')this.change('common',Number(v));
  if(a==='case')d.case=v;
  if(a==='causal-answer')(d.answers||={})[d.case||'before']=v;
 },
 change(k,v){const d=data();d[k]=Number(v);if(!S.sandbox&&k==='mix'&&Models.simpson({mixA:d.mix,mixB:100-d.mix}).gap>0)d.flipped=true;if(!S.sandbox&&k==='common')(d.mixes||={})[v]=true;}
};
