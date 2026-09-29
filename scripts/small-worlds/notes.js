/* Original, optional explanations. Nutshell itself is vendored without changes. */
window.SmallWorldNotes = (() => {
 const anchor = key => key.toLowerCase().replace(/[^a-z0-9]/g,'');
 const link = (key, label) => `<a href="#${anchor(key)}">:${label}</a>`;
 const entries = {
  Sandbox: `<p>A sandbox is the part where you get to change the rules. Add a barista, change a reward, or give the crowd different clues. Ask “what if?” and watch what follows.</p><p>Try changing <em>one thing at a time</em>. That makes it easier to see what caused the difference. Each game is a ${link('Model','model')}, with its assumptions listed underneath.</p>`,
  Model: `<p>A model is a small world with explicit rules. We leave things out so one mechanism becomes easier to see.</p><p>A toy café can show how bursts create a queue. It does not know your local café’s staffing costs, impatient customers, or broken espresso machine.</p><p><strong>The useful question:</strong> “Which assumptions would need to hold for this lesson to apply here?”</p>`,
  'Independent clues': `<p>Imagine drawing a clue, replacing it, and mixing the jar before the next draw. Once you know which jar is being used, seeing one person’s draw does not tell you what the next draw will be.</p><p>That is what <em>independent conditional on the jar</em> means here. The same hidden jar can still make the clues tend to agree. Independence does not mean disagreement.</p><p>A copied report is different: it reuses an observation instead of creating one. In everyday life, ask about ${link('Independent evidence','independent evidence')}.</p>`,
  'Independent evidence': `<p>Five articles repeating one battery test are still describing <strong>one test</strong>. Five labs making their own measurements can bring new evidence.</p><p>“Independent” is not a magic quality stamp. The labs might share a faulty instrument or the same bad assumption. Check their methods as well as their origins.</p><p><strong>Try saying:</strong> “What did each source actually observe, and what do they all rely on?”</p>`,
  Odds: `<p>Odds compare the two possibilities directly. Odds of <strong>3 : 1</strong> mean three parts for one possibility and one part for the other: 3 out of 4, or 75%.</p><p>To turn odds of <em>a : b</em> into a probability for the first possibility, use <strong>a / (a + b)</strong>.</p><p>New evidence can change those odds. Repeating the same evidence is not another independent update.</p>`,
  'Information cascade': `<p>An information cascade begins when someone’s best choice is the same whichever private clue they received. Their public choice then stops revealing that clue.</p><p>The person can be reasoning sensibly. But later people see the agreement without seeing the private evidence it hides. A cascade can support a true belief or a false one.</p><p>The repair is to share observations, not merely votes. That lets ${link('Independent clues','fresh clues')} reach the group.</p>`,
  'Weighted average': `<p>Imagine making a blend. The result depends on the ingredients <em>and how much of each you use</em>. A percentage works the same way.</p><p>In the original repair-shop mix, Mira gets 20 easy jobs and 80 difficult ones:</p><p><strong>20% × 90% + 80% × 60% = 66%.</strong></p><p>The weights, 20% and 80%, are the shares of all jobs. You cannot simply average 90% and 60% unless the two groups are equally large.</p><p>To compare the rates for identical work, give both shops a ${link('Common mix','common mix')}.</p>`,
  'Common mix': `<p>Choose one basket of work and apply each shop’s rates to that same basket.</p><p>For 50 easy and 50 difficult jobs, Mira’s score is <strong>75%</strong> and Sol’s is <strong>65%</strong>. These are hypothetical standardized scores, not a new batch of observed repairs.</p><p>Another common mix can change both scores. Here Mira still leads by 10 ${link('Percentage points','percentage points')}, because its advantage is 10 points in each group.</p>`,
  'Percentage points': `<p>A move from 60% to 70% is an increase of <strong>10 percentage points</strong>.</p><p>The relative increase is different: 10 ÷ 60 ≈ 16.7%. “Ten percent better” is ambiguous unless you say which comparison you mean.</p>`,
  'Simpsons paradox': `<p>One option can lead in every group yet trail when the groups are combined. The totals and the group comparisons can all be correct.</p><p>The trick is that the two totals use <em>different mixtures</em>. The better shop can get enough difficult work to pull its overall rate below the other shop’s.</p><p>Look at the ${link('Weighted average','weights inside the average')}. Then ask which comparison answers your actual question.</p>`,
  Confounder: `<p>A confounder is a shared cause of the thing you are comparing and the outcome.</p><p>Here, job difficulty affects which shop receives a bike <em>and</em> whether it gets fixed. The shops therefore start with different kinds of work.</p><p>Comparing similar difficulties addresses that particular mismatch. It does not guarantee that every other relevant difference has disappeared.</p>`,
  Mediator: `<p>A mediator is part of the pathway through which something has an effect.</p><p>Suppose coaching causes more practice, which improves scores. If you compare only people with equal practice time, you can remove part of the very benefit you wanted to measure.</p><p>For the coaching program’s <em>total</em> effect, include the paths through which it helps. This is why “always split into more groups” is not a safe rule.</p>`
 };
 const N = window.Nutshell;
 N.setOptions({startOnLoad:false,dontEmbedHeadings:true});
 N.addStyles();

 // Only our authored, embedded notes are accepted. No remote fetching, Markdown
 // input, URL-supplied text, iframe fallback, or parent-window messaging is used.
 const noteHTML = Object.entries(entries).map(([title,body])=>`<h2>${title}</h2>${body}`).join('');
 const safeHTML = DOMPurify.sanitize(noteHTML,{FORBID_ATTR:['style','id','class'],FORBID_TAGS:['style']});
 N.promisePurifiedHTMLFromURL = () => Promise.resolve(safeHTML);
 const getSection = N.promiseSectionContainer;
 N.promiseSectionContainer = expandable => {
  const url = new URL(expandable.href,location.href);
  const current = new URL(location.href);
  if(url.origin!==current.origin || url.pathname!==current.pathname || url.search!==current.search || !Object.keys(entries).some(key=>anchor(key)===anchor(url.hash.slice(1)))) {
   const message=document.createElement('p');message.textContent='This explanation is not available.';
   return Promise.resolve(message);
  }
  return getSection(expandable);
 };

 // Keep upstream's nested expansions while making the controls keyboard-usable.
 let serial=0;
 const convert=N.convertLinksToExpandables;
 N.convertLinksToExpandables=(root,parent)=>{
  convert(root,parent);
  root.querySelectorAll('.nutshell-expandable').forEach(ex=>{
   if(ex.dataset.notesReady)return;
   ex.dataset.notesReady='true';ex.id='note-link-'+(++serial);
   ex.setAttribute('role','button');ex.setAttribute('aria-expanded','false');
   ex.removeAttribute('target');
   const open=ex.open,close=ex.close;
   ex.open=event=>{
    if(ex.isOpen)return;
    // Game rendering reuses this note node, so pausing cannot interrupt its click.
    if(typeof isRunning==='function' && isRunning()){stop();Sound.silence();render();}
    const rect=ex.getClientRects()[0]||ex.getBoundingClientRect();
    open(!event||event.detail===0?{clientX:rect.x+rect.width/2}:event);
    ex.setAttribute('aria-expanded','true');
   };
   ex.close=()=>{
    if(!ex.isOpen)return;
    const bubble=document.getElementById(ex.getAttribute('aria-controls'));
    bubble?.querySelectorAll('.nutshell-expandable').forEach(child=>{child.isOpen=false;child.setAttribute('aria-expanded','false');});
    close();ex.setAttribute('aria-expanded','false');ex.removeAttribute('aria-controls');ex.focus({preventScroll:true});
   };
   ex.addEventListener('keydown',event=>{
    if(event.key===' '){event.preventDefault();ex.click();}
    if(event.key==='Escape'&&ex.isOpen){event.preventDefault();event.stopPropagation();ex.close();}
   });
  });
 };
 const createBubble=N.createBubble;
 N.createBubble=(ex,x)=>{
  const bubble=createBubble(ex,x);
  bubble.id='note-bubble-'+(++serial);bubble.setAttribute('role','region');
  bubble.setAttribute('aria-label',ex.textContent.trim());
  ex.setAttribute('aria-controls',bubble.id);
  const close=bubble.querySelector('.nutshell-bubble-overflow-close');
  close.textContent='Close explanation ↑';close.setAttribute('aria-label','Close '+ex.textContent.trim()+' explanation');
  // Upstream's scroll-on-close animates even in reduced-motion mode.
  close.onclick=()=>{ex.close();if(ex.getBoundingClientRect().top<0)ex.scrollIntoView({block:'center',behavior:'instant'});};
  bubble.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();ex.close();}
  });
  return bubble;
 };

 // A native, in-flow close-all button replaces the upstream floating div.
 // Count the actual attached links so removed chapters cannot leave stale UI.
 N._updateCloseAllNutshells=()=>{
  const open=[...document.querySelectorAll('.sw-notes .nutshell-expandable')].filter(ex=>ex.isOpen);
  N._nutshellsOpen=open.length;
  document.querySelectorAll('.notes-close-all').forEach(b=>b.hidden=open.length<2);
 };
 function decorate(panel){
  N.convertLinksToExpandables(panel);
  const close=document.createElement('button');close.className='textbtn notes-close-all';close.textContent='Close all explanations';close.hidden=true;
  close.addEventListener('click',()=>{
   const tops=[...panel.querySelectorAll('.nutshell-expandable')].filter(ex=>ex.isOpen&&!ex.closest('.nutshell-bubble'));
   tops.forEach(ex=>ex.close());tops[0]?.focus({preventScroll:true});
  });
  panel.append(close);
 }
 function sentence(){
  if(S.sandbox)return G.slug==='everyone-says'?`A little help with ${link('Odds','odds')} and ${link('Independent clues','independent clues')}.`:`A little help with ${link('Weighted average','weighted averages')}.`;
  if(G.slug==='everyone-says'){
   if(S.chapter===0)return `One assumption to unpack: ${link('Independent clues','independent clues')}.`;
   if(S.chapter===1)return `A little help with ${link('Odds','odds')}.`;
   if(S.chapter===2&&data().confidence)return `There’s a name for this: an ${link('Information cascade','information cascade')}.`;
   if(S.chapter===5&&data().traced)return `What counts as ${link('Independent evidence','independent evidence')}?`;
   if(S.chapter===6)return `A useful distinction: ${link('Independent evidence','independent evidence')} is more than repeated agreement.`;
  }
  if(G.slug==='average-that-lied'){
   if(S.chapter===1&&data().easy&&data().hard)return `You’ve uncovered ${link('Simpsons paradox','Simpson’s paradox')}.`;
   if(S.chapter===2)return `The moving part is a ${link('Weighted average','weighted average')}.`;
   if(S.chapter===3)return `Compare the same recipe: a ${link('Common mix','common mix')}.`;
   if(S.chapter===4&&data().answers?.before&&data().answers?.after)return `Two different roles: ${link('Confounder','confounder')} and ${link('Mediator','mediator')}.`;
   if(S.chapter===5&&data().choice)return `A useful distinction: ${link('Percentage points','percentage points')} versus percent change.`;
   if(S.chapter===6)return `Revisit the mechanism: ${link('Weighted average','weighted averages')}.`;
  }
  return '';
 }
 let panel=null,key='';
 return {
  detach(reset=false){
   if(reset){panel=null;key='';}
   else panel?.remove();
  },
  mount(){
   const text=sentence(),next=`${G.slug}/${S.sandbox?'lab':S.chapter}/${text}`;
   if(next!==key){panel=null;key=next;}
   if(!text){N._updateCloseAllNutshells();return;}
   if(!panel){panel=document.createElement('aside');panel.className='sw-notes';panel.setAttribute('aria-label','Optional explanations');panel.innerHTML=`<p>${text}</p>`;}
   document.querySelector('.scene-head').append(panel);
   if(!panel.querySelector('.nutshell-expandable'))decorate(panel);
   const sources=document.querySelector('.sources');
   if(sources&&!sources.querySelector('.notes-credit')){const credit=document.createElement('p');credit.className='notes-credit';credit.innerHTML='Expandable explanations use <a href="https://ncase.me/nutshell/" target="_blank" rel="noopener">Nutshell by Nicky Case</a>. <a href="../small-worlds/THIRD-PARTY-NOTICES.txt">Open-source notices</a>.';sources.append(credit);}
   N._updateCloseAllNutshells();
  },
  collection(){
   const panel=document.querySelector('.collection-notes');
   if(panel){panel.classList.add('sw-notes');decorate(panel);}
  }
 };
})();
