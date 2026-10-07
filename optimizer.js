(function(){
'use strict';
const theoryNames={funny:'面白',splendid:'見事',perfect:'完璧',elaborate:'凝った'};
const funnyPaths=['FFFF','FFMF','FMFF','FMMF','MFFF','MFMF','MMFF','MMMF'];
const splendidSirePaths=['FFFMF','FFMMF','FMFMF','FMMMF'];
const splendidDamPaths=['MFFF','MFMF','MMFF','MMMF'];
const cloneSnap=s=>Object.fromEntries(Object.entries(s).map(([p,h])=>[p,{...h}]));
const horseEntry=h=>({name:h.name,lineage:displayLineage(h),sublineage:h.sublineage||'',factors:(h.factors||[]).join(''),homebred:false});
const ancestorEntry=a=>({name:a.name,lineage:displayLineage(a),sublineage:a.sublineage||'',factors:(a.factors||[]).join(''),homebred:false});
const poolAt=path=>path.endsWith('M')?window.DABISTA2_DATA.dams:window.DABISTA2_DATA.sires;
const relLabel=rel=>[...rel].map(x=>x==='F'?'父':'母').join('');
const entryFor=(horse,rel)=>rel?horse.ancestors?.[relLabel(rel)]:horse;
const codeOf=x=>x?(x.lineageCode||lineageCode(x.lineage)||''):'';
const norm=normalizedName;

function propagated(source){
  const snap=cloneSnap(source);
  Object.keys(snap).sort((a,b)=>b.length-a.length).forEach(path=>{
    const h=snap[path];if(!h.homebred)return;
    const sire=snap[path+'F'];
    if(!sire&&path.length===5)return;
    h.lineage=sire?.lineage||'';h.sublineage=sire?.sublineage||'';
  });
  return snap;
}
function frontiers(snap){
  const answer=[];
  for(let depth=1;depth<=5;depth++)for(let i=0;i<2**depth;i++){
    const path=i.toString(2).padStart(depth,'0').replaceAll('0','F').replaceAll('1','M');
    if(snap[path])continue;
    const parent=path.slice(0,-1);
    if(depth===1||snap[parent]?.homebred)answer.push(path);
  }
  return answer;
}
function compatible(horse,base,snap){
  for(const [path,fixed] of Object.entries(snap)){
    if(!path.startsWith(base)||path===base)continue;
    const rel=path.slice(base.length),candidate=entryFor(horse,rel);
    if(fixed.homebred||!candidate||norm(candidate.name)!==norm(fixed.name))return false;
  }
  return true;
}
function candidatesFor(base,snap){return poolAt(base).filter(h=>compatible(h,base,snap))}
function assignHorse(source,base,horse){
  const snap=cloneSnap(source);snap[base]=horseEntry(horse);
  for(const [jp,a] of Object.entries(horse.ancestors||{})){
    const path=base+jpToPath(jp);if(path.length<=5&&!snap[path])snap[path]=ancestorEntry(a);
  }
  return propagated(snap);
}
function assignHomebred(source,base){
  if(base.length>=5)throw new Error('自家製馬の父母が5代血統表の範囲を超えます');
  if(source[base]&&!source[base].homebred)throw new Error('配置済みの馬は固定されています');
  const snap=cloneSnap(source);snap[base]={name:'自家製'+(base.endsWith('M')?'牝馬':'種牡馬')+'（'+pathLabel(base)+'）',lineage:'',sublineage:'',factors:'',homebred:true};
  return propagated(snap);
}
function rebuildSolution(original,assignments){let snap=cloneSnap(original);for(const a of assignments)snap=a.homebred?assignHomebred(snap,a.base):assignHorse(snap,a.base,a.horse);return snap}
function compositionText(snap,path){const h=snap[path];if(!h)return'未選択';return h.homebred?'（'+compositionText(snap,path+'F')+'×'+compositionText(snap,path+'M')+'）':h.name}
function breedingSteps(snap){
  const steps=[];function visit(path){const h=snap[path];if(!h?.homebred)return;visit(path+'F');visit(path+'M');steps.push({path,sire:snap[path+'F']?.name||'未選択',dam:snap[path+'M']?.name||'未選択',name:h.name})}
  visit('F');visit('M');steps.push({path:'',sire:snap.F?.name||'未選択',dam:snap.M?.name||'未選択',name:'最終産駒'});return steps;
}
function crossesOf(snap){
  const memo=new Map(),identity=path=>{
    if(memo.has(path))return memo.get(path);const h=snap[path];if(!h)return'';
    const key=h.homebred?'homebred('+identity(path+'F')+'×'+identity(path+'M')+')':'horse:'+norm(h.name);memo.set(path,key);return key;
  };
  const groups=new Map();
  for(const [path,h] of Object.entries(snap)){
    if(!h.name)continue;const key=identity(path),child=path.length===1?'':identity(path.slice(0,-1));
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push({name:h.name,side:path[0],child,generation:path.length});
  }
  return [...groups.values()].filter(list=>new Set(list.map(x=>x.side)).size>1&&new Set(list.map(x=>x.child).filter(Boolean)).size>1);
}
function metrics(source){
  const snap=propagated(source),code=p=>youngestTheoryLineage(snap,p);
  const funnyCodes=funnyPaths.map(code),funny=funnyCodes.every(Boolean)&&new Set(funnyCodes).size>=7;
  const sire=splendidSirePaths.map(code),dam=splendidDamPaths.map(code),sorted=a=>[...a].sort().join('|');
  const splendid=sire.every(Boolean)&&dam.every(Boolean)&&new Set(dam).size>=3&&sorted(sire)===sorted(dam);
  const paternal=Object.entries(snap).filter(([p,h])=>p.startsWith('F')&&p.length<=4&&h.name);
  const maternal=Object.entries(snap).filter(([p,h])=>p.startsWith('M')&&p.length<=4&&h.name);
  const elaborate=paternal.some(([,a])=>maternal.some(([,b])=>elaboratePairs.has(norm(a.name)+'\t'+norm(b.name))));
  const counts=nitroFactorCounts(Object.values(snap));
  const crosses=crossesOf(snap);
  return {funny,splendid,perfect:funny&&splendid,elaborate,
    nick:nickStrengthFor(snap.F?.sublineage,snap.M?.sublineage),crosses:crosses.length,
    crossSignature:crosses.map(x=>norm(x[0].name)+':'+x.map(o=>o.generation).sort().join(',')).sort().join('|'),
    speed:counts.短*2+counts.速,stamina:counts.長+counts.底-counts.短,power:counts.パ};
}
function conditions(){return {
  theories:[...document.querySelectorAll('#optimizerTheories input:checked')].map(x=>x.value),
  nick:Number(document.getElementById('optimizerNick').value),cross:document.getElementById('optimizerCross').value,
  speed:Number(document.getElementById('optimizerSpeed').value)||0,stamina:Number(document.getElementById('optimizerStamina').value)||0,power:Number(document.getElementById('optimizerPower').value)||0
}}
function satisfies(m,c){return c.theories.every(k=>m[k])&&m.nick>=c.nick&&(c.cross==='any'||(c.cross==='yes'?m.crosses>0:m.crosses===0))&&m.speed>=c.speed&&m.stamina>=c.stamina&&m.power>=c.power}

function optionCodes(path,snap,fs,cache){
  const key='youngest>'+path;if(cache.has(key))return cache.get(key);
  for(const youngPath of theoryLineagePaths(path)){
    const fixed=snap[youngPath]?.lineage;
    if(majorLineageCodes.includes(fixed)){const result=new Set([fixed]);cache.set(key,result);return result}
    const base=fs.find(x=>youngPath.startsWith(x));if(!base)continue;
    if(Number(document.getElementById('optimizerDepth')?.value)>0)return new Set(majorLineageCodes);
    const result=new Set();
    candidatesFor(base,snap).forEach(h=>{
      const code=youngestTheoryLineage(assignHorse(snap,base,h),path);
      if(code)result.add(code);
    });
    cache.set(key,result);return result;
  }
  const result=new Set();cache.set(key,result);return result;
}
function funnyPossible(snap,fs,cache){
  let masks=new Set([0]);const codeIndex=new Map(majorLineageCodes.map((x,i)=>[x,i]));
  for(const path of funnyPaths){const opts=optionCodes(path,snap,fs,cache);if(!opts.size)return false;const next=new Set();for(const mask of masks)for(const c of opts){const i=codeIndex.get(c);if(i!==undefined)next.add(mask|(1<<i))}masks=next}
  return [...masks].some(m=>{let n=0;while(m){n+=m&1;m>>>=1}return n>=7});
}
function multisetKeys(paths,snap,fs,cache,requireThree){
  let states=[[]];for(const path of paths){const opts=[...optionCodes(path,snap,fs,cache)];if(!opts.length)return new Set();const next=[];for(const a of states)for(const c of opts)next.push([...a,c]);states=next}
  return new Set(states.filter(a=>!requireThree||new Set(a).size>=3).map(a=>a.sort().join('|')));
}
function splendidPossible(snap,fs,cache){const a=multisetKeys(splendidSirePaths,snap,fs,cache,false),b=multisetKeys(splendidDamPaths,snap,fs,cache,true);for(const x of a)if(b.has(x))return true;return false}
function possibleNames(side,snap,fs){
  const names=new Set(Object.entries(snap).filter(([p,h])=>p.startsWith(side)&&p.length<=4&&h.name).map(([,h])=>norm(h.name)));
  fs.filter(base=>base.startsWith(side)&&base.length<=4).forEach(base=>(Number(document.getElementById('optimizerDepth')?.value)>0?[...window.DABISTA2_DATA.sires,...window.DABISTA2_DATA.dams]:candidatesFor(base,snap)).forEach(h=>{
    names.add(norm(h.name));for(const [jp,a] of Object.entries(h.ancestors||{}))if(base.length+jp.length<=4)names.add(norm(a.name));
  }));return names;
}
function elaboratePossible(snap,fs){const p=possibleNames('F',snap,fs),m=possibleNames('M',snap,fs);for(const pair of window.DABISTA2_DATA.elaboratePairs||[])if(p.has(norm(pair[0]))&&m.has(norm(pair[1])))return true;return false}
function refreshAvailability(){
  const snap=propagated(currentSnapshot()),fs=frontiers(snap),cache=new Map();
  const possible={funny:funnyPossible(snap,fs,cache),splendid:splendidPossible(snap,fs,cache)};
  possible.perfect=possible.funny&&possible.splendid;possible.elaborate=elaboratePossible(snap,fs);
  const reasons=[];document.querySelectorAll('#optimizerTheories input').forEach(input=>{
    input.disabled=!possible[input.value];if(input.disabled){input.checked=false;input.closest('label').title='現在の固定血統からは成立できません';reasons.push(theoryNames[input.value]+'：現在の固定血統では成立不可')}else input.closest('label').removeAttribute('title');
  });document.getElementById('optimizerTheoryHint').textContent=reasons.join('／');
}

function partialScore(snap,c){
  const m=metrics(snap);let score=m.speed+m.stamina+m.power*2+m.nick*15+(m.elaborate?40:0)+(m.funny?40:0)+(m.splendid?40:0);
  const unique=new Set(funnyPaths.map(p=>youngestTheoryLineage(snap,p)).filter(Boolean)).size;score+=unique*5;
  c.theories.forEach(k=>{if(m[k])score+=100});if(m.nick>=c.nick)score+=30;return score;
}
function setStatus(text,error=false){const el=document.getElementById('optimizerStatus');el.textContent=text;el.classList.toggle('error',error)}
const yieldUi=()=>new Promise(resolve=>setTimeout(resolve,0));
let solutions=[],searchOriginal={},searchInfo=null,sortDirection=-1;
function totalPrice(snap){
  const visit=path=>{const h=snap[path];if(!h)return 0;if(h.homebred)return visit(path+'F')+visit(path+'M');
    const horse=poolAt(path).find(x=>norm(x.name)===norm(h.name));return Number(horse?.price)||0;};
  return visit('F')+visit('M');
}
function sortValue(s){const key=document.getElementById('optimizerSort').value,m=s.metrics;
  if(key==='price')return s.price;if(key==='theory')return ['funny','splendid','elaborate'].filter(k=>m[k]).length;
  return m[key]||0;
}
function sortSolutions(){solutions.sort((a,b)=>sortDirection*(sortValue(a)-sortValue(b))||(a.breedings||0)-(b.breedings||0)||a.assignments.map(x=>x.horse?.name||'自家製').join('×').localeCompare(b.assignments.map(x=>x.horse?.name||'自家製').join('×'),'ja'))}
function invalidateResults(){solutions=[];searchInfo=null;document.getElementById('optimizerResults').innerHTML='';setStatus('血統表を変更しました。条件を指定して再探索してください。')}
function afterErase(){chosen=null;updateInheritedLineages();updateLineages();updateComposition();updateNitro();render();refreshAvailability()}
function eraseRelatedCells(path){
  // Stock horses have a fixed pedigree: deleting any ancestor removes the
  // enclosing stock horse and its entire pedigree. Homebred descendants
  // depend on the erased branch, but their other parent remains independent.
  let base=path;
  for(let length=path.length-1;length>=1;length--){
    const parent=cellAt(path.slice(0,length));
    if(parent?.dataset.name&&parent.dataset.homebred!=='1')base=parent.dataset.path;
  }
  clearBranch(base);
  for(let length=base.length-1;length>=1;length--){
    const parent=cellAt(base.slice(0,length));if(parent)clearCell(parent);
  }
}
const screenshotActions=document.getElementById('pedScreenshotActions');
function attachEraseButtons(){
  const bar=document.getElementById('pedActionRail')||document.getElementById('nitro');if(bar.querySelector('.ped-clear-actions'))return;
  const actions=document.createElement('div');actions.className='ped-clear-actions';
  actions.innerHTML='<button class="btn" id="pedClearAll">血統表全消去</button><button class="btn" id="pedClearCell">指定セル消去</button>';bar.appendChild(actions);
  if(screenshotActions)actions.prepend(screenshotActions);
  actions.querySelector('#pedClearAll').onclick=()=>{document.querySelectorAll('.cell[data-path]').forEach(clearCell);afterErase();show('血統表を全消去しました')};
  actions.querySelector('#pedClearCell').onclick=()=>{if(!selected?.dataset.path)return;eraseRelatedCells(selected.dataset.path);afterErase();show('選択セルに関係する馬・血統・系統を消去しました')};
}
let stopRequested=false;
function diverseStates(states,width){
  states.sort((a,b)=>b.score-a.score);
  const buckets=new Map();
  for(const state of states){
    const snap=state.snap;
    const paternal=new Set(Object.entries(snap).filter(([p])=>p.startsWith('F')).map(([,h])=>norm(h.name)));
    const shared=[...new Set(Object.entries(snap).filter(([p,h])=>p.startsWith('M')&&paternal.has(norm(h.name))).map(([,h])=>norm(h.name)))].sort().join(',');
    const key=[...funnyPaths,...splendidSirePaths,...splendidDamPaths,'F','M'].map(p=>snap[p]?.lineage||'_').join(',')+'|'+(snap.F?.sublineage||'')+'|'+(snap.M?.sublineage||'')+'|'+shared;
    if(!buckets.has(key))buckets.set(key,[]);const bucket=buckets.get(key);if(bucket.length<width)bucket.push(state);
  }
  const result=[],groups=[...buckets.values()];
  for(let round=0;result.length<width;round++){
    let added=false;for(const group of groups)if(group[round]){result.push(group[round]);added=true;if(result.length===width)break}
    if(!added)break;
  }
  return result;
}
async function searchBase(original,c){
  const groups=frontiers(original).map(base=>({base,candidates:candidatesFor(base,original)})).sort((a,b)=>a.candidates.length-b.candidates.length);
  if(groups.some(g=>!g.candidates.length))return {limited:false,product:0,checked:0};
  const product=groups.reduce((n,g)=>Math.min(10000001,n*g.candidates.length),1),limited=product>1000000;let checked=0;
  const accept=(snap,assignments)=>{checked++;const m=metrics(snap);if(Object.keys(snap).length===62&&satisfies(m,c))solutions.push({assignments,metrics:m,price:totalPrice(snap),depth:0,breedings:breedingSteps(snap).length})};
  if(!limited){
    const dfs=async(i,snap,assignments)=>{
      if(stopRequested)return;
      if(i===groups.length){accept(snap,assignments);if(checked%1000===0){setStatus(`追加なしの構成を全件探索中… ${checked.toLocaleString()} / ${product.toLocaleString()}件`);await yieldUi()}return}
      const g=groups[i];for(const h of g.candidates){if(stopRequested)break;await dfs(i+1,assignHorse(snap,g.base,h),[...assignments,{base:g.base,horse:h}])}
    };await dfs(0,original,[]);
  }else{
    let states=[{snap:original,assignments:[]}];
    for(let i=0;i<groups.length&&!stopRequested;i++){
      const g=groups[i];let expanded=[];
      for(const state of states)for(const h of g.candidates){
        if(stopRequested)break;const snap=assignHorse(state.snap,g.base,h),assignments=[...state.assignments,{base:g.base,horse:h}];
        if(i===groups.length-1)accept(snap,assignments);else{expanded.push({snap,assignments,score:partialScore(snap,c)});if(expanded.length>=4000)expanded=diverseStates(expanded,2000)}
        if(++checked%1000===0){setStatus(`追加なしの構成を優先探索中… ${checked.toLocaleString()}件`);await yieldUi()}
      }
      states=diverseStates(expanded,1000);await yieldUi();
    }
  }
  return {limited:limited||stopRequested,product,checked};
}
function generateTemplates(original,maxDepth,maxTemplates=160){
  const roots=frontiers(original),templates=[],seen=new Set();
  const depthAt=base=>{const root=roots.find(r=>base.startsWith(r));return root?base.length-root.length:0};
  const add=splits=>{const ordered=[...new Set(splits)].sort((a,b)=>a.length-b.length||a.localeCompare(b));const key=ordered.join('|');if(seen.has(key))return;
    let snap=cloneSnap(original);for(const base of ordered){if(base.length>=5||depthAt(base)>=maxDepth||original[base])return;snap=assignHomebred(snap,base)}
    seen.add(key);templates.push({snap,splits:ordered,depth:ordered.length?Math.max(...ordered.map(p=>depthAt(p)+1)):0});};
  add([]);
  // Seed each requested depth as well as asymmetric and balanced structures.
  for(let depth=1;depth<=maxDepth;depth++)for(const mode of ['M','F','both']){
    for(const root of roots){const splits=[];const visit=(p,d)=>{if(d<=0||p.length>=5||original[p])return;splits.push(p);if(mode==='both'){visit(p+'F',d-1);visit(p+'M',d-1)}else visit(p+mode,d-1)};visit(root,depth);add(splits)}
    const combined=[];for(const root of roots){const visit=(p,d)=>{if(d<=0||p.length>=5||original[p])return;combined.push(p);if(mode==='both'){visit(p+'F',d-1);visit(p+'M',d-1)}else visit(p+mode,d-1)};visit(root,depth)}add(combined);
  }
  // Add alternative shapes within the same per-blank maximum depth.
  for(let i=0;i<templates.length&&templates.length<maxTemplates;i++){
    const t=templates[i];for(const base of frontiers(t.snap)){
      if(base.length<5&&depthAt(base)<maxDepth&&!original[base])add([...t.splits,base]);
      if(templates.length>=maxTemplates)break;
    }
  }
  const buckets=Array.from({length:maxDepth+1},(_,d)=>templates.filter(t=>t.depth===d)),scheduled=[];
  while(buckets.some(b=>b.length))for(const bucket of buckets)if(bucket.length)scheduled.push(bucket.shift());
  return scheduled;
}
function deepScore(snap,c){
  const m=metrics(snap);let score=0;
  for(const k of ['speed','stamina','power'])score+=(c[k]>0?Math.min(m[k],c[k])*12:m[k]);
  if(c.nick>0)score+=Math.min(c.nick,m.nick)*70;
  for(const k of c.theories)if(m[k])score+=350;
  if(c.theories.includes('funny')||c.theories.includes('perfect'))score+=new Set(funnyPaths.map(p=>youngestTheoryLineage(snap,p)).filter(Boolean)).size*25;
  if(c.theories.includes('splendid')||c.theories.includes('perfect')){
    const sire=splendidSirePaths.map(p=>snap[p]?.lineage).filter(Boolean),dam=splendidDamPaths.map(p=>snap[p]?.lineage).filter(Boolean),left=[...dam];let n=0;
    for(const x of sire){const j=left.indexOf(x);if(j>=0){n++;left.splice(j,1)}}score+=n*50+new Set(dam).size*10;
  }
  if(c.cross==='no')score-=m.crosses*90;else if(c.cross==='yes'&&m.crosses>0)score+=50;
  const key=document.getElementById('optimizerSort').value;
  if(key==='price')score-=sortDirection*totalPrice(snap)/100000;
  return score;
}
async function searchTemplate(template,original,c,limits){
  const groups=frontiers(template.snap).map(base=>({base,candidates:candidatesFor(base,template.snap)})).sort((a,b)=>a.candidates.length-b.candidates.length||a.base.length-b.base.length||a.base.localeCompare(b.base));
  if(groups.some(g=>!g.candidates.length))return;
  let states=[{snap:template.snap,assignments:template.splits.map(base=>({base,homebred:true}))}];
  const width=groups.length>4?16:32;
  for(let index=0;index<groups.length;index++){
    const g=groups[index];let expanded=[];
    for(const state of states)for(const horse of g.candidates){
      if(stopRequested||Date.now()>=limits.deadline||Date.now()>=limits.templateDeadline)return;
      const snap=assignHorse(state.snap,g.base,horse),assignments=[...state.assignments,{base:g.base,horse}];limits.checked++;
      if(index===groups.length-1){
        const m=metrics(snap);if(Object.keys(snap).length===62&&satisfies(m,c)){
          const key=compositionText(snap,'F')+'×'+compositionText(snap,'M');
          if(!limits.seen.has(key)){limits.seen.add(key);solutions.push({assignments,metrics:m,price:totalPrice(snap),depth:template.depth,breedings:breedingSteps(snap).length})}
        }
      }else{
        expanded.push({snap,assignments,score:deepScore(snap,c)});
        if(expanded.length>=width*4)expanded=diverseStates(expanded,width*2);
      }
      if(limits.checked%100===0){setStatus(`深い世代を探索中…\n追加深さ ${template.depth}世代／評価 ${limits.checked.toLocaleString()}件／該当 ${solutions.length}件\n経過 ${Math.floor((Date.now()-limits.start)/1000)}秒`);await yieldUi()}
    }
    states=diverseStates(expanded,width);if(index<groups.length-1&&!states.length)return;
  }
}
async function runDeepOptimizer(original,c,maxDepth){
  stopRequested=false;document.getElementById('optimizerStop').disabled=false;
  const seconds=Math.max(5,Math.min(120,Number(document.getElementById('optimizerSeconds').value)||30));
  const templates=generateTemplates(original,maxDepth).filter(t=>t.depth>0);
  let tried=0,reached=0;
  try{
    if(!frontiers(original).length){const m=metrics(original);if(Object.keys(original).length===62&&satisfies(m,c))solutions.push({assignments:[],metrics:m,price:totalPrice(original),depth:0,breedings:breedingSteps(original).length});renderSolutions(false,1,solutions.length);return}
    const base=await searchBase(original,c),baseCount=solutions.length;
    // Expanded templates contain at least one new homebred node, so they
    // cannot duplicate an unexpanded plan. Avoid rebuilding all base results
    // inside the timed deep-search budget just to seed this set.
    const start=Date.now(),limits={start,deadline:start+seconds*1000,checked:0,seen:new Set()};
    for(const template of templates){if(stopRequested||Date.now()>=limits.deadline)break;
      tried++;reached=Math.max(reached,template.depth);limits.templateDeadline=Math.min(limits.deadline,Date.now()+Math.max(1500,seconds*1000/8));
      await searchTemplate(template,original,c,limits);await yieldUi();
    }
    const reason=stopRequested?'停止しました':Date.now()>=limits.deadline?'時間上限に達しました':'予定した優先探索を完了しました';
    const summary=`追加なし：${base.limited?'優先探索':'全件確認'}で ${baseCount}件を確保。\n${reason}。追加深さ ${reached}世代まで ${tried}構成を探索、${limits.checked.toLocaleString()}件を評価しました。\n該当 ${solutions.length}件。深い探索は構成の多様性を保って候補を絞ります。未発見でも成立不能とは限りません。`;
    deepSearchSummary=summary;renderSolutions(true,limits.checked,solutions.length);if(!solutions.length)setStatus(summary,true);
  }finally{document.getElementById('optimizerStop').disabled=true}
}
let deepSearchSummary='';
async function runOptimizer(){
  const button=document.getElementById('optimizerRun');button.disabled=true;solutions=[];deepSearchSummary='';document.getElementById('optimizerResults').innerHTML='';
  try{
    const original=propagated(currentSnapshot()),c=conditions(),fs=frontiers(original);searchOriginal=cloneSnap(original);
    if(Number(document.getElementById('optimizerDepth').value)>0){await runDeepOptimizer(original,c,Number(document.getElementById('optimizerDepth').value));return}
    if(!fs.length){const m=metrics(original);if(satisfies(m,c)){solutions=[{assignments:[],metrics:m,price:totalPrice(original)}];renderSolutions(false,1,1)}else setStatus('空欄はありませんが、現在の血統は指定条件を満たしていません。',true);return}
    stopRequested=false;document.getElementById('optimizerStop').disabled=false;
    const base=await searchBase(original,c);renderSolutions(base.limited,base.product,solutions.length);
  }catch(error){console.error(error);setStatus('探索中にエラーが発生しました：'+error.message,true)}finally{button.disabled=false;document.getElementById('optimizerStop').disabled=true}
}
let resultGroups=[],groupShown=[];
function groupSolutions(items){
  const groups=[],wildcards=new Map();
  items.forEach((s,index)=>{
    const leaves=s.assignments.filter(a=>!a.homebred).sort((a,b)=>a.base.localeCompare(b.base));
    const shape=s.assignments.filter(a=>a.homebred).map(a=>a.base).sort().join(',');
    const m=s.metrics,feature=[shape,m.nick,m.crossSignature||m.crosses,...['funny','splendid','perfect','elaborate'].map(k=>!!m[k]),Math.floor(m.speed/3),Math.floor(m.stamina/3),Math.floor(m.power/3),Math.floor(Math.log2(Math.max(1,s.price)))].join('|');
    const signatures=leaves.map((a,i)=>feature+'|'+JSON.stringify(leaves.map((b,j)=>[b.base,i===j?'*':norm(b.horse.name)])));
    const match=signatures.map(key=>wildcards.get(key)).find(x=>x!==undefined);
    if(match!==undefined)groups[match].indices.push(index);
    else{const group=groups.length;groups.push({indices:[index]});signatures.forEach(key=>wildcards.set(key,group))}
  });return groups;
}
function variantHtml(index){
  const s=solutions[index],snap=rebuildSolution(searchOriginal,s.assignments),m=s.metrics;
  return `<div class="optimizer-variant"><p>${compositionText(snap,'F')} × ${compositionText(snap,'M')}</p><p>スピ${m.speed}／スタ${m.stamina}／パ${m.power}・ニックス${nickStars(m.nick)}・クロス${m.crosses}本・${s.price.toLocaleString()}万円</p><button class="btn" data-optimizer-apply="${index}">この入替候補を反映</button></div>`;
}
function showMoreVariants(groupIndex,button){
  const group=resultGroups[groupIndex],start=groupShown[groupIndex]||1,end=Math.min(group.indices.length,start+10);
  button.insertAdjacentHTML('beforebegin',group.indices.slice(start,end).map(variantHtml).join(''));groupShown[groupIndex]=end;
  if(end===group.indices.length)button.remove();else button.textContent=`続きを表示（残り${group.indices.length-end}件）`;
}
function renderSolutions(limited,product,totalMatches){
  searchInfo={limited,product,totalMatches};sortSolutions();
  if(!solutions.length){setStatus(limited?'有望候補を優先した探索範囲では、条件を満たす組合せが見つかりませんでした。条件を緩めるか、配置済みの馬を変更してください。':'全組合せを確認しましたが、条件を満たす配合はありませんでした。',true);return}
  setStatus(`${limited?solutions.length:totalMatches}件の候補が見つかりました。${limited?'（組合せが多いため有望候補を優先して探索）':'（全組合せを確認）'}\n指定のソート順で先頭20件を表示しています。`);
  const diverse=document.getElementById('optimizerView')?.value!=='all';
  resultGroups=diverse?groupSolutions(solutions):solutions.map((s,i)=>({indices:[i]}));groupShown=[];
  const displayInfo=diverse?`${resultGroups.length}構成に整理し、指定のソート順で先頭20構成を表示しています。`:'指定のソート順で先頭20件を表示しています。';
  setStatus((deepSearchSummary||`${limited?solutions.length:totalMatches}件の候補が見つかりました。${limited?'（優先探索）':'（全組合せを確認）'}`)+'\n'+displayInfo);
  document.getElementById('optimizerResults').innerHTML=resultGroups.slice(0,20).map((group,groupIndex)=>{
    const i=group.indices[0],s=solutions[i];
    const m=s.metrics,theories=Object.keys(theoryNames).filter(k=>m[k]).map(k=>`<span class="optimizer-badge">${theoryNames[k]}</span>`).join('');
    const snap=rebuildSolution(searchOriginal,s.assignments),steps=breedingSteps(snap),placed=compositionText(snap,'F')+'×'+compositionText(snap,'M');
    const plan=steps.map((x,j)=>`<li>${x.sire} × ${x.dam} → ${x.name}</li>`).join('');
    const variants=group.indices.length>1?`<details><summary>入替候補を表示（${group.indices.length-1}件）</summary><button class="btn" data-optimizer-more="${groupIndex}">入替候補を10件表示</button></details>`:'';
    return `<article class="optimizer-result"><h4>候補 ${groupIndex+1}</h4><div>${theories}<span class="optimizer-badge nick">ニックス ${nickStars(m.nick)}</span></div><p>${placed}</p><p>追加深さ ${s.depth||0}世代／配合回数 ${steps.length}回（既存自家製馬の配合を含む構成全体）</p><p>クロス ${m.crosses}本　スピ${m.speed}／スタ${m.stamina}／パワー${m.power}</p><p>全価格 ${s.price.toLocaleString()}万円</p><details><summary>作成順を見る</summary><ol>${plan}</ol></details><button class="btn primary" data-optimizer-apply="${i}">この配合を血統表に反映</button>${variants}</article>`
  }).join('');
}
function applySolution(index){
  const solution=solutions[index];if(!solution)return;
  // Each result is a complete plan based on the search snapshot. Applying it
  // replaces the displayed pedigree, including after another result or erase.
  const resultSnap=rebuildSolution(searchOriginal,solution.assignments);
  document.querySelectorAll('.cell[data-path]').forEach(clearCell);
  Object.entries(resultSnap).sort(([a],[b])=>a.length-b.length).forEach(([path,h])=>{
    const cell=cellAt(path);if(!cell)return;
    if(h.homebred){cell.dataset.name=h.name;cell.dataset.lineage=h.lineage||'--';cell.dataset.sublineage=h.sublineage||'';cell.dataset.factors=h.factors||'';cell.dataset.homebred='1';renderPedCell(cell)}
    else setCell(cell,{name:h.name,lineage:h.lineage,lineageCode:h.lineage,sublineage:h.sublineage,factors:[...(h.factors||'')]});
  });
  updateInheritedLineages();updateLineages();updateComposition();updateNitro();render();refreshAvailability();show('全体最適化の候補を血統表に反映しました');
}

document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{
  const optimizer=tab.dataset.tab==='optimizer';document.getElementById('optimizerPanel').hidden=!optimizer;document.getElementById('candidateActions').hidden=optimizer;
  if(optimizer){document.getElementById('results').hidden=true;refreshAvailability()}else document.getElementById('results').hidden=false;
}));
document.getElementById('optimizerRun').addEventListener('click',runOptimizer);
document.getElementById('optimizerDepth').onchange=()=>{refreshAvailability();invalidateResults()};
document.getElementById('optimizerStop').onclick=()=>{stopRequested=true;setStatus('停止処理中…見つかった候補を表示します。')};
document.getElementById('optimizerSort').onchange=()=>{if(searchInfo)renderSolutions(searchInfo.limited,searchInfo.product,searchInfo.totalMatches)};
document.getElementById('optimizerView').onchange=()=>{if(searchInfo)renderSolutions(searchInfo.limited,searchInfo.product,searchInfo.totalMatches)};
document.getElementById('optimizerSortDirection').onclick=e=>{sortDirection*=-1;e.currentTarget.textContent=sortDirection===1?'昇順 ↑':'降順 ↓';if(searchInfo)renderSolutions(searchInfo.limited,searchInfo.product,searchInfo.totalMatches)};
document.getElementById('optimizerClear').addEventListener('click',()=>{document.querySelectorAll('#optimizerTheories input').forEach(x=>x.checked=false);document.getElementById('optimizerNick').value='0';document.getElementById('optimizerCross').value='any';['optimizerSpeed','optimizerStamina','optimizerPower'].forEach(id=>document.getElementById(id).value='0');solutions=[];document.getElementById('optimizerResults').innerHTML='';setStatus('条件をクリアしました。')});
document.getElementById('optimizerResults').addEventListener('click',e=>{const b=e.target.closest('[data-optimizer-apply]');if(b)applySolution(Number(b.dataset.optimizerApply));const more=e.target.closest('[data-optimizer-more]');if(more)showMoreVariants(Number(more.dataset.optimizerMore),more)});
let refreshTimer;new MutationObserver(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(!document.getElementById('optimizerPanel').hidden)refreshAvailability()},80)}).observe(document.getElementById('ped'),{subtree:true,childList:true,attributes:true});
refreshAvailability();
attachEraseButtons();new MutationObserver(attachEraseButtons).observe(document.getElementById('nitro'),{childList:true});
})();
