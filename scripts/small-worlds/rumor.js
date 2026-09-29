const G={
 slug:'everyone-says',finalInteractive:true,title:'Everyone Says It’s True',theme:'A game about the evidence inside a crowd',
 chapters:['Your private clue','The crowd before you','How sure is the crowd?','Ask a better question','Repair the conversation','Trace the sources','Take it with you'],
 initialLab:{signals:[1,1,-1,-1,-1,-1,-1,-1],share:0,tick:8},
 model:'There are two equally likely jars. A clue matches the jar with probability 2/3; clues are independent across people conditional on the jar. Everyone knows the model and maximizes their probability of being correct, following their own clue at exact posterior ties. Before a cascade, choices reveal clues; after public log₂ odds reach ±2, both possible clues lead to the same choice. Later choices then add no information. Opening envelopes after decisions reveals evidence without rewriting those decisions. Replaying with clues shared changes the information available at each decision. The story deliberately starts with a misleading clue order; it is not a measurement of real-world error rates. The source-tracing challenge assumes known, equally reliable, conditionally independent original sources; copied posts contain no additional clue.',
 sources:[['How social influence can undermine the wisdom of crowd effect — Lorenz et al. (2011)','https://www.sg.ethz.ch/publications/2011/lorenz2011how-social-influence/PNAS-2011-Lorenz-9020-5.pdf'],['Classroom Games: Information Cascades — Anderson & Holt','https://www.aeaweb.org/articles?id=10.1257/jep.10.4.187'],['Information Cascades and Social Learning — Bikhchandani, Hirshleifer, Tamuz & Welch','https://www.aeaweb.org/articles?id=10.1257/jel.20241472'],['Distinguishing informational cascades from herd behavior — Çelen & Kariv','https://www.aeaweb.org/articles?id=10.1257/0002828041464461']],
 render(){
  const d=data(),c=S.chapter;
  if(!S.sandbox&&c===6)return RumorLife.render(d);
  if(!S.sandbox&&c===5)return this.sourceLesson(d);
  const original=[1,1,-1,-1,-1,-1,-1,-1];
  const signals=S.sandbox?d.signals:c===4&&d.order==='blue'?[-1,-1,1,1,-1,-1,-1,-1]:[...original];
  if(!S.sandbox&&c===2&&d.probe===1)signals[2]=1;
  const share=S.sandbox?!!d.share:c===4&&!!d.shareOn;
  const opened=!S.sandbox&&c===3&&!!d.shared;
  const r=Models.cascade(signals,share);
  const count=S.sandbox?(d.tick||0):c===0?0:c===1?2:c===2?(d.tick||0):8;
  const reveal=S.sandbox||opened||c===4;
  let title,body,controls='',feedback='',extra='',ready=false;
  if(S.sandbox){
   title='Give the crowd different evidence.';body='Flip a private clue, change what people can see, then step through their decisions. Can you make ten more opinions add less information than one honest envelope?';
   controls=`<p class="prompt">Click a private clue to flip its color.</p><div class="choices">${signals.map((v,i)=>U.button(`${i+1}: ${v===1?'Red':'Blue'}`,'signal',i,'small secondary')).join('')}</div><div class="controls">${U.select('share','People can observe',d.share,[[0,'Earlier choices only'],[1,'Earlier private clues']])}</div><div class="choices">${U.button(isRunning()?'Pause':count>0&&count<8?'Resume the crowd':'Run the crowd',isRunning()?'pause':'play')}${U.button('One person','step','','secondary')}${U.button('Reset clues','resetclues','','secondary')}</div>`;
   if(count===8)feedback=U.feedback(share?'Independent clues keep arriving.':'Choices can stop carrying new information.',`Public odds are ${this.odds(r.publicEvidence)}. With all eight private clues visible, the odds are ${this.odds(r.allClues)}. Inspect a person below to see exactly what their choice reveals.`);
  }else if(c===0){
   title='A secret jar. One small clue.';body='A hidden jar is either red or blue, equally likely. Your private clue says <strong>blue</strong>. Clues match the jar two times out of three. For now, you know nothing about anyone else.';
   controls=!d.choice?U.choices('Which jar is more likely?',[['red','Red'],['blue','Blue']]):'';
   if(d.choice)feedback=U.feedback('Blue, with a 2 in 3 chance.','You have a reason to lean blue, not a guarantee. Keep your blue clue. Now you will hear from two other people.',d.choice==='blue');
   ready=!!d.choice;
  }else if(c===1){
   title='Two people chose red before you.';body='The first two people each chose <strong>red</strong>. At this point their choices reveal two independent red clues. Your own clue still says blue. Your job is to be right—not to agree, and not to be different.';
   controls=!d.choice?U.choices('Which choice gives you the better chance?',[['red','Choose red with the crowd'],['blue','Stick with my blue clue']]):'';
   if(d.choice)feedback=U.feedback('Red is now the better bet: 2 in 3.','The two red clues multiply red-to-blue odds by 2 × 2. Your blue clue multiplies by ½. Together: 2 : 1 for red. You did not stop thinking; you used all the evidence available to you.',d.choice==='red');
   ready=!!d.choice;
  }else if(c===2){
   title='Eight voices. How much evidence?';body='Let everyone choose. Each person sees earlier <strong>choices</strong>, not the clues inside the envelopes. Then judge the crowd as an outside observer with no private clue.';
   controls=`<div class="choices">${U.button(isRunning()?'Pause':count===8?'Replay the crowd':count?'Resume the crowd':'Let everyone choose',isRunning()?'pause':'play')}${U.button('One person','step','','secondary')}</div>`;
   if(count===8&&!d.confidence)controls+=U.choices('All eight chose red. What probability should an outside observer assign to red?',[['50','50% · no useful evidence'],['80','80% · four to one'],['99','99.6% · eight agreeing clues']],'confidence');
   if(d.confidence){
    feedback=U.feedback('Eight red choices. Still only 80% red.','The first two choices reveal clues. Every later person would choose red with either possible clue. Those choices add no new evidence. More agreement can be louder without being stronger.',d.confidence==='80');
    extra=this.confidencePlot(r.rows,count);
    if(count===8){
     extra+=`<div class="clue-experiment"><h2>Change a mind. Does the crowd notice?</h2><p>Person 3 is you. Swap only your private clue. Watch your own belief and the public evidence separately.</p><div class="choices">${U.button('Your clue: blue','probe',-1,d.probe!==1?'selected':'secondary')}${U.button('What if your clue were red?','probe',1,d.probe===1?'selected':'secondary')}</div>${RumorMath.bar(r.rows[2].posterior,'Your private belief after two red choices')}${RumorMath.bar(r.publicEvidence,'Outside observer, seeing all eight choices')}<p class="experiment-result">${d.probe===1?'Your confidence rises from 66.7% to 88.9% red. Your choice stays red. All eight public choices stay red. The outside observer remains at 80%.':'With a blue clue, your belief is 66.7% red. Swap it to red to see what your choice fails to communicate.'}</p><p class="math-aside">A choice is a compressed message. “Red” can mean “I saw red” or “I saw blue, but the earlier evidence outweighed it.”</p></div>`;
    }
   }
   ready=count===8&&!!d.confidence&&!!d.probeTried;
  }else if(c===3){
   title='Ask a better question.';body='Return to the original day. All eight already chose red. You can ask what they <strong>chose</strong>, or what they actually <strong>saw</strong>. Which question uncovers something new?';
   controls=`<div class="choices">${U.button('Ask for their choices again','ask-choices','','secondary')}${U.button(d.shared?'The envelopes are open':'Ask to see their private clues','share','1',d.shared?'selected':'')}</div>`;
   if(opened)feedback=U.feedback('Six blue clues were hiding inside a red crowd.','The old choices stay on the screen: nobody can un-say them. The newly opened clues change your belief to 16/17 ≈ 94.1% blue. Two red clues and six blue clues are much stronger evidence than eight repeated red choices.',true);
   else if(d.asked)feedback=U.feedback('Eight more answers. Zero new clues.','They repeat the same choices. You are still at 80% red. Asking again did not create another independent observation. Try asking what each person actually saw.');
   else feedback=U.feedback('Agreement is visible. Its sources are hidden.','The person who disagreed privately can look exactly like the person whose clue agreed with the crowd.');
   ready=opened;
  }else if(c===4){
   title='Repair the conversation.';body='Keep the same two red clues and six blue clues. First change who speaks first. Then change what people share. Can you make the final evidence stop depending on the speaking order?';
   controls=`<p class="prompt">Who speaks first?</p><div class="choices">${U.button('Two red clues first','order','red',d.order!=='blue'?'selected':'secondary')}${U.button('Two blue clues first','order','blue',d.order==='blue'?'selected':'secondary')}</div><p class="prompt">What does each person share before the next decides?</p><div class="choices">${U.button('Only their choice','communication','choices',!share?'selected':'secondary')}${U.button('Their actual clue','communication','clues',share?'selected':'secondary')}</div>`;
   if(share){
    feedback=U.feedback('The final evidence survives either speaking order.','With each clue shared, the next person can use it even if it disagrees with the speaker’s choice. Both orders end at 16 : 1 for blue. The choices along the way can differ; the combined evidence does not.',true);
    extra=`<p class="repair-progress">${d.openOrders?.red?'✓':'○'} Red-first order tested with clues shared &nbsp; ${d.openOrders?.blue?'✓':'○'} Blue-first order tested with clues shared</p><p class="note">Try both orders while sharing clues to finish the experiment.</p>`;
   }else feedback=U.feedback(d.order==='blue'?'A blue crowd from the very same clues.':'A red crowd gets stuck at 80%.','Changing the first speakers changes which cascade forms. It does not create any new evidence. Now share the actual clues and compare both orders.');
   ready=share&&!!d.openOrders?.red&&!!d.openOrders?.blue;
  }
  const masked=!S.sandbox&&c===2&&!d.confidence,ev=opened?r.allClues:count?r.rows[count-1].publicEvidence:0;
  const math=masked?'':RumorMath.panel({chapter:c,d,r,count,share,reveal,lab:S.sandbox,opened});
  return U.scene({title,body,art:c===0&&!S.sandbox?U.svg('A private blue clue between two possible jars.',`<rect x="177" y="70" width="120" height="160" rx="36" fill="#d69482"/><rect x="423" y="70" width="120" height="160" rx="36" fill="#8aabbc"/><path d="M186 63h101M433 63h100" class="line"/>${U.text(237,154,'RED','svg-big')}${U.text(483,154,'BLUE','svg-big')}<circle cx="360" cy="210" r="23" fill="#3d6b86"/>${U.text(360,270,'your clue','svg-small')}`):Art.crowd(r.rows,count,reveal),metrics:c===0&&!S.sandbox?'':U.metrics([[count,'public choices'],[masked?'Your prediction?':this.odds(ev),opened?'odds after opening the clues':'public odds from visible evidence'],[share?'each turn':opened?'opened afterward':'hidden','private clues']]),controls,feedback,after:extra+math+U.note('Clues are 2/3 accurate and independent conditional on the jar. The story deliberately starts with a misleading sequence.'),ready:!S.sandbox&&ready});
 },
 confidencePlot(rows,count){
  const values=[.5,...rows.slice(0,count).map(x=>1/(1+2**(-x.publicEvidence)))],x=i=>45+i*78,y=p=>155-p*125,path=values.map((v,i)=>`${i?'L':'M'}${x(i)} ${y(v)}`).join(' ');
  return `<div class="confidence-story"><h2>Confidence stops. The crowd keeps growing.</h2><svg viewBox="0 0 720 205" role="img" aria-label="Public probability of red rises from 50 percent to 67 percent to 80 percent, then stays at 80 percent for every later red choice."><path d="M45 24V155H674" fill="none" stroke="#a9b4a5"/>${[.5,.8,1].map(p=>`<path d="M45 ${y(p)}H674" stroke="#d6d9cd" stroke-dasharray="4 5"/><text x="35" y="${y(p)+5}" text-anchor="end">${p*100}%</text>`).join('')}<path d="${path}" fill="none" stroke="#b44b3c" stroke-width="3"/>${values.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="#b44b3c"/><text x="${x(i)}" y="179" text-anchor="middle">${i}</text>`).join('')}<text x="360" y="202" text-anchor="middle">Number of public choices</text>${count>=3?'<text x="414" y="39" text-anchor="middle" class="plot-note">More choices ≠ more independent evidence</text>':''}</svg><p class="note">This is an outside observer’s belief from the choices, without a private clue.</p></div>`;
 },
 sourceLesson(d){
  const independent=d.sourceCase===1,traced=!!d.traced,answer=d.sourceAnswers?.[independent?1:0],correct=independent?'red':'tie',complete=!!d.sourceAnswers?.[0]&&!!d.sourceAnswers?.[1];
  const title='Ten posts. How many sources?',body='Ten posts say the jar is red. One says blue. Before trusting the majority—or rejecting it—find out where the reports came from.';
  let art=`<div class="source-scene"><div class="source-posts">${Array.from({length:10},(_,i)=>`<div class="post red-post"><span>POST ${i+1}</span><b>RED</b><small>${traced?(independent?'Reporter '+(i+1):i===0?'Reporter A':'Copied from A'):'Source unknown'}</small></div>`).join('')}</div><div class="source-origin ${traced?'traced':''}">${traced?(independent?'<strong>10 separate observations</strong><span>Each reporter saw a fresh, independent clue.</span>':'<strong>All ten lead back to reporter A.</strong><span>One red clue. Nine repetitions. No new observations.</span>'):'↑ Follow the claims back to their source.'}</div><div class="blue-report"><b>BLUE</b><span>${traced?'Reporter B saw an independent blue clue.':'One other report disagrees.'}</span></div></div>`;
  let controls=!traced?`<div class="choices">${U.button('Trace the sources','trace-sources')}</div>`:`<p class="note">Assume equal prior odds. Each original reporter is 2/3 accurate, with independent clues conditional on the jar.</p>`;
  if(traced&&!answer)controls+=U.choices('Given these sources, what should you believe?',[['red','Red is more likely'],['tie','Exactly 50/50'],['blue','Blue is more likely']],'source-answer');
  let feedback='';
  if(answer){
   feedback=U.feedback(independent?'Independent agreement really does count.':'One red clue. One blue clue. A tie.',independent?'The ten red reports now come from ten independent observations. Red-to-blue odds are 2¹⁰ × ½ = 512 : 1, or about 99.8% red. The same eleven visible opinions carry much more evidence.':'The ten copied posts contain only one red clue. Multiply 2 × ½ = 1. The odds are 1 : 1. Repetition did not make red stronger, and uncovering repetition did not prove blue.',answer===correct);
   controls+=`<div class="choices">${U.button(independent?'Return to the copied posts':'Now give each red post its own independent source','source-case',independent?0:1,'secondary')}</div>`;
  }
  return U.scene({title,body,art,controls,feedback,after:traced?`<p class="source-lesson">${complete?'You tested both cases. Count independent observations and their reliability—not the number of people repeating them.':'Test both source patterns. The number of red and blue posts will stay exactly the same.'}</p>${answer?RumorMath.bar(independent?9:0,'Your belief given the traced sources'):''}<p class="note">This calculation assumes known source quality and independence. In real life, those are questions to investigate, not facts to assume.</p>`:'',ready:complete,next:'Finish the story →'});
 },
 odds(k){return k>=0?`${2**k}:1 red`:`${2**(-k)}:1 blue`;},
 act(a,v){
  const d=data();
  if(a.startsWith('life-')){RumorLife.act(a,v,d);return;}
  if(a==='math'){stop();d.mathOpen=!d.mathOpen;}
  if(a==='math-proof'){stop();d.proofOpen=!d.proofOpen;}
  if(a==='math-person'){stop();d.mathPerson=Number(v);}
  if(a==='choose')d.choice=v;
  if(a==='confidence')d.confidence=v;
  if(a==='probe'){d.probe=Number(v);if(d.probe===1)d.probeTried=true;d.mathPerson=2;}
  if(a==='ask-choices')d.asked=true;
  if(a==='share')d.shared=true;
  if(a==='order'){d.order=v;if(d.shareOn)(d.openOrders||={})[v]=true;}
  if(a==='communication'){d.shareOn=v==='clues';if(d.shareOn)(d.openOrders||={})[d.order||'red']=true;}
  if(a==='trace-sources')d.traced=true;
  if(a==='source-answer')(d.sourceAnswers||={})[d.sourceCase===1?1:0]=v;
  if(a==='source-case')d.sourceCase=Number(v);
  if(a==='signal'){delete d.mathPerson;d.signals[Number(v)]*=-1;d.tick=0;}
  if(a==='resetclues'){d.signals=[1,1,-1,-1,-1,-1,-1,-1];d.tick=0;delete d.mathPerson;}
  if(a==='play'){delete d.mathPerson;if((d.tick||0)>=8)d.tick=0;animate(8,700);}
  if(a==='step'){stop();delete d.mathPerson;d.tick=Math.min(8,(d.tick||0)+1);}
 },
 change(k,v){data()[k]=Number(v);data().tick=0;delete data().mathPerson;}
};
