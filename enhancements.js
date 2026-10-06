'use strict';
function homebredGeneration(h){if(!h||!(h.homebred===true||h.homebred==='1'))return 0;return Number(h.homebredGeneration)||Number((h.name||'').match(/^(\d+)薄自家製/)?.[1])||1}
function snapshotHomebredGeneration(snap,path){const h=snap[path];if(!h?.homebred)return 0;if(snap[path+'F']||snap[path+'M'])return Math.max(snapshotHomebredGeneration(snap,path+'F'),snapshotHomebredGeneration(snap,path+'M'))+1;return homebredGeneration(h)}
function metadataName(name){return (name||'').normalize('NFKC').toLowerCase().replace(/[\s.・'’`´\-‐‑‒–—―]/g,'')}
function nitroFactorCounts(horses){
  const counts=Object.fromEntries(['短','速','パ','底','長','ダ','丈','早','晩','堅','気'].map(f=>[f,0])),seen=new Set();
  for(const horse of horses){
    const name=metadataName(horse.name);if(!name)continue;
    for(const factor of new Set([...(horse.factors||'')])){
      const key=name+'\t'+factor;if(!(factor in counts)||seen.has(key))continue;
      seen.add(key);counts[factor]++;
    }
  }
  return counts;
}
const metadataHorses=new Map([...window.DABISTA2_DATA.sires,...window.DABISTA2_DATA.dams].map(h=>[metadataName(h.name),h]));
function escapeCellText(text){return String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function horseInformation(name,homebred){
  if(homebred)return '';const horse=metadataHorses.get(metadataName(name));if(!horse)return '';
  const info=[];
  if(horse.price!==null&&horse.price!==undefined)info.push('価格'+Number(horse.price).toLocaleString()+'万円');
  if(horse.distanceMin!=null&&horse.distanceMax!=null)info.push('距離'+horse.distanceMin+'〜'+horse.distanceMax+'m');
  for(const [key,label] of [['speed','SP'],['stamina','ST'],['power','PW'],['achievement','実績'],['bottom','底力'],['stability','安定'],['temperament','気性'],['constitution','体質'],['dirt','ダート'],['growth','成長']])if(horse[key]!==null&&horse[key]!==undefined&&horse[key]!=='')info.push(label+horse[key]);
  return info.join('・');
}
function updateDetailLines(cell){const depth=cell.dataset.path.length,font=[0,18,16,14,12,10][depth],nameLine=[0,28,25,23,20,16][depth];const ped=typeof document.getElementById==='function'?document.getElementById('ped'):null;const horizontal=ped?.dataset?.orientation==='horizontal',height=Number(ped?.dataset?.renderHeight)||(horizontal?512:1024);const rowHeight=height/2**(depth-(horizontal?1:0));const ratio=Number(ped?.dataset?.fontRatio)||1;cell.style?.setProperty('--detail-lines',Math.max(1,Math.floor((rowHeight-nameLine*ratio-3)/(font*ratio))))}
function homebredFactorControls(h){if(h.homebred!=='1'||!h.path.endsWith('F'))return '';const choices=['短','速','パ','底','長','ダ','丈','早','晩','堅','気'],assigned=[...(h.factors||'')];return `<div class="homebred-factor-controls" aria-label="自家製種牡馬の因子">${[0,1].map(i=>`<select data-homebred-factor="${i}" aria-label="${escapeCellText(h.name)}の因子${i+1}"><option value="">因子${i+1}：なし</option>${choices.map(f=>`<option value="${f}" ${assigned[i]===f?'selected':''} ${assigned[1-i]===f?'disabled':''}>${f}</option>`).join('')}</select>`).join('')}</div>`}
function renderHorseCell(cell){
  const h=cell.dataset,name=escapeCellText(h.name),lineage=h.path.endsWith('F')&&h.lineage&&h.lineage!=='--'?`<span class="lineage-code">【${escapeCellText(h.lineage)}】</span>`:'';
  const subValue=h.path==='MF'?(typeof cellAt==='function'?cellAt('M')?.dataset.sublineage:'')||h.sublineage:h.sublineage;const sub=['F','MF'].includes(h.path)&&subValue&&subValue!=='子系統未確認'?subValue:'';
  const info=h.placed==='1'&&!window.DABISTA_HIDE_HORSE_INFORMATION?horseInformation(h.name,h.homebred==='1'):'',detail=[sub,info].filter(Boolean).join('・');
  updateDetailLines(cell);
  cell.innerHTML=`<div class="cell-main"><div class="name-row"><span class="horse-name" title="${name}">${name}</span>${h.homebred==='1'&&!/^\d+薄自家製/.test(h.name)?`<span class="homebred-age">自家製${homebredGeneration(h)}代</span>`:''}${lineage}<span class="factor-row">${factors([...(h.factors||'')])}</span></div>${detail?`<div class="horse-details" title="${escapeCellText(detail)}">${sub?`<span class="sublineage-info">${escapeCellText(sub)}</span>`:''}${info?`<span class="horse-statistics">${escapeCellText(info)}</span>`:''}</div>`:''}${homebredFactorControls(h)}</div>`;
}
function candidateFactorCount(horse,depth,selectedFactors){
  const nodes=[horse,...Object.entries(horse.ancestors||{}).filter(([path])=>path.length+1<=depth).map(([,h])=>h)];
  const counts=nitroFactorCounts(nodes);return selectedFactors.reduce((sum,f)=>sum+(counts[f]||0),0);
}
function defaultCandidateCompare(a,b){
  const overseas=h=>/^SS0*(\d+)-/.test(h.id||'')?Number((h.id||'').match(/^SS0*(\d+)-/)[1])>=57:/^[A-Za-z]/.test(h.name||'');
  return Number(overseas(a))-Number(overseas(b))||(Number(b.price)||0)-(Number(a.price)||0)||a.name.localeCompare(b.name,'ja');
}
function candidateNameCompare(a,b){const english=h=>/^[A-Za-z]/.test((h.name||'').normalize('NFKC'));return Number(english(a))-Number(english(b))||a.name.localeCompare(b.name,'ja')}
function sortCandidateRows(rows,sort,direction,depth,selectedFactors){
  if(sort==='factors')rows.forEach(row=>row.factorCount=candidateFactorCount(row.horse,depth,selectedFactors));
  rows.sort((a,b)=>Number(!!b.horse.savedPedigree)-Number(!!a.horse.savedPedigree)||((sort==='default'||!sort)?candidateNameCompare(a.horse,b.horse):direction*((sort==='factors'?a.factorCount:Number(a.horse[sort])||0)-(sort==='factors'?b.factorCount:Number(b.horse[sort])||0))||candidateNameCompare(a.horse,b.horse)));
}
function cycleCandidateSort(state,key){
  if(key==='default'){state.sort='';state.direction=-1;return}
  if(key==='price'&&state.sort==='price'&&state.direction===1){state.sort='';state.direction=-1;return}
  if(state.sort===key)state.direction*=-1;
  else{state.sort=key;state.direction=-1}
}
function pedigreeFitPercent(width,height,baseWidth=1400,baseHeight=1024){return Math.max(5,Math.min(160,Math.floor(Math.min(Math.max(0,width)/baseWidth,Math.max(0,height)/baseHeight)*100)))}
(function setupScreenshotButtons(){
  const buttons=[document.getElementById('screenScreenshot'),document.getElementById('pedigreeScreenshot')];
  async function capture(kind){
    if(typeof html2canvas!=='function')throw new Error('画像作成ファイルが読み込めません。ZIP内のファイルをすべて同じフォルダに展開してください。');
    await document.fonts.ready;
    const pedigree=document.getElementById('ped'),workspace=document.querySelector('.workspace');
    const width=Math.ceil(Math.max(pedigree.scrollWidth,pedigree.getBoundingClientRect().width));
    const target=kind==='pedigree'?pedigree:workspace;const baseHeight=Number(pedigree.dataset?.renderHeight)||(pedigree.dataset?.orientation==='horizontal'?512:1024);
    const canvas=await html2canvas(target,{
      backgroundColor:'#ffffff',scale:2,logging:false,windowWidth:Math.max(window.innerWidth,width+32),
      onclone:doc=>{
        const w=doc.querySelector('.workspace'),p=doc.getElementById('ped'),scroll=doc.querySelector('.ped-scroll');
        Object.assign(w.style,{width:(width+30)+'px',height:'auto',maxHeight:'none',overflow:'visible',flex:'none'});
        const app=doc.querySelector('.app');Object.assign(app.style,{display:'block',height:'auto',width:(width+62)+'px'});
        Object.assign(scroll.style,{overflow:'visible',height:'auto',maxHeight:'none',flex:'none'});scroll.scrollLeft=0;scroll.scrollTop=0;
        p.style.setProperty('width',width+'px','important');p.style.setProperty('min-width',width+'px','important');p.style.setProperty('height',baseHeight+'px','important');p.style.transform='none';p.style.position='relative';
        const size=doc.querySelector('.pedigree-size');if(size)Object.assign(size.style,{width:width+'px',height:baseHeight+'px'});
        const summary=doc.querySelector('.layout-summary');if(kind==='screen'&&summary){const copy=summary.cloneNode(true);Object.assign(copy.style,{display:'flex',overflow:'visible',width:'auto',flexWrap:'nowrap'});w.prepend(copy)}
        doc.querySelectorAll('.screenshot-actions,.pedigree-zoom').forEach(el=>el.remove());
      }
    });
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG画像を作成できませんでした。')),'image/png'));
  }
  function preview(blob){
    const url=URL.createObjectURL(blob),dialog=document.createElement('dialog');dialog.className='screenshot-preview';
    dialog.innerHTML='<p>画像を作成しました。画像を右クリックしてコピーするか、下のボタンでコピー・保存してください。</p><img alt="血統表のスクリーンショット"><div><button class="btn primary" data-copy>画像コピー</button><a class="btn" download="dabista2-pedigree.png">PNG保存</a><button class="btn" data-close>閉じる</button></div>';
    dialog.querySelector('img').src=url;dialog.querySelector('a').href=url;
    dialog.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);show('画像をコピーしました');dialog.close()}catch{dialog.querySelector('p').textContent='画像を右クリックして「画像をコピー」を選択してください。'}};
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclose=()=>{URL.revokeObjectURL(url);dialog.remove()};document.body.appendChild(dialog);dialog.showModal();
  }
  async function copy(kind){
    buttons.forEach(b=>b.disabled=true);
    try{
      // Supply the rendering promise during the original click so browsers
      // requiring user activation can authorize the clipboard operation.
      const png=capture(kind);
      if(navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){
        try{await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);show('画像をクリップボードにコピーしました');return}catch{preview(await png)}
      }else preview(await png);
    }catch(error){show('スクショを作成できませんでした：'+error.message)}finally{buttons.forEach(b=>b.disabled=false)}
  }
  buttons[0].onclick=()=>copy('screen');buttons[1].onclick=()=>copy('pedigree');
})();
(function setupPedigreeZoom(){
  const ped=document.getElementById('ped'),size=document.querySelector('.pedigree-size'),out=document.getElementById('pedigreeZoomOut'),inside=document.getElementById('pedigreeZoomIn'),label=document.getElementById('pedigreeZoomValue');
  const fit=document.getElementById('pedigreeFit'),scroll=document.querySelector('.ped-scroll');let automatic=true;
  let percent=100;try{const saved=Number(localStorage.getItem('dabista2-pedigree-zoom'));if(saved>=40&&saved<=160)percent=Math.round(saved/10)*10}catch{}
  function setZoom(value){
    percent=Math.max(5,Math.min(160,value));const scale=percent/100;
    const horizontal=ped.dataset?.orientation==='horizontal';
    const mobile=document.body.classList.contains('mobile-layout');
    const padding=mobile?8:28,availableHeight=Math.max(0,(scroll?.clientHeight||0)-padding);
    // Stretch rows independently of the width on phones; manual zoom scales
    // this fitted height as well so the overview can always be restored.
    const mobileFit=pedigreeFitPercent((scroll?.clientWidth||0)-padding,1e9,horizontal?2800:1400)/100;
    const height=mobile?availableHeight*scale/mobileFit:horizontal?Math.max(512*scale,availableHeight):1024*scale;
    size.style.width=((horizontal?2800:1400)*scale)+'px';size.style.height=height+'px';
    ped.style.setProperty('height',(height/scale)+'px','important');if(ped.dataset)ped.dataset.renderHeight=String(height/scale);
    const reference=automatic?pedigreeFitPercent((scroll?.clientWidth||0)-28,(scroll?.clientHeight||0)-28)/100:scale;
    const ratio=mobile?Math.max(1,Math.min(.6,availableHeight/(horizontal?16:32)/30)/mobileFit):horizontal?reference/scale:1;
    ped.style.setProperty('--text-size-ratio',String(ratio));if(ped.dataset)ped.dataset.fontRatio=String(ratio);
    ped.style.transform=`scale(${scale})`;document.querySelectorAll?.('.cell[data-name]').forEach(updateDetailLines);
    label.textContent=percent+'%';out.disabled=percent===5;inside.disabled=percent===160;
    if(fit)fit.setAttribute('aria-pressed',String(automatic));
    try{localStorage.setItem('dabista2-pedigree-zoom',String(percent))}catch{}
  }
  function fitFrame(){
    const mobile=document.body.classList.contains('mobile-layout'),padding=mobile?8:28;
    if(automatic&&scroll?.clientWidth>padding&&scroll?.clientHeight>padding)setZoom(pedigreeFitPercent(scroll.clientWidth-padding,mobile||ped.dataset?.orientation==='horizontal'?1e9:scroll.clientHeight-padding,ped.dataset?.orientation==='horizontal'?2800:1400,ped.dataset?.orientation==='horizontal'?512:1024));
  }
  out.onclick=()=>{automatic=false;setZoom(percent-10)};inside.onclick=()=>{automatic=false;setZoom(percent+10)};document.getElementById('pedigreeZoomReset').onclick=()=>{automatic=false;setZoom(100)};
  if(fit)fit.onclick=()=>{automatic=true;fitFrame()};setZoom(percent);fitFrame();
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(fitFrame).observe(scroll);
  if(typeof window.addEventListener==='function'){window.addEventListener('resize',fitFrame);window.addEventListener('pedigree-zoom-request',e=>{automatic=!!e.detail.automatic;setZoom(e.detail.percent);fitFrame()});window.addEventListener('pedigree-layout-change',()=>{setZoom(percent);fitFrame()})}
})();
