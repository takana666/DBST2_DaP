'use strict';
(function setupMobileLayout(){
  const app=document.querySelector('.app'),side=document.querySelector('.side'),rail=document.getElementById('pedActionRail');
  const backdrop=document.createElement('button');backdrop.id='mobileBackdrop';backdrop.className='mobile-backdrop';backdrop.setAttribute('aria-label','パネルを閉じる');backdrop.hidden=true;app.appendChild(backdrop);
  const bar=document.createElement('nav');bar.className='mobile-bar';bar.setAttribute('aria-label','携帯の操作');bar.innerHTML='<span id="mobileSelected">父セル</span><div><button id="mobileFit">全体表示</button><button id="mobileSearch">馬を検索</button><button id="mobileActions">操作</button><button id="mobileDetails">詳細</button><button id="mobileSummary">判定</button></div>';document.body.appendChild(bar);
  const header=document.createElement('div');header.className='mobile-sheet-header';header.innerHTML='<strong>馬の検索・探索</strong><button type="button" id="mobileScrollTop" aria-label="条件・候補一覧の一番上へ" title="一番上へ">↑</button><button type="button" id="mobileScrollBottom" aria-label="条件・候補一覧の一番下へ" title="一番下へ">↓</button><button id="mobileSheetClose">閉じる</button>';side.prepend(header);
  const actionHeader=document.createElement('div');actionHeader.className='mobile-action-header';actionHeader.innerHTML='<strong>血統表の操作</strong><button id="mobileActionClose">閉じる</button>';rail.prepend(actionHeader);
  const modeRow=document.createElement('label');modeRow.className='mobile-mode-row';modeRow.innerHTML='表示方式 <select id="deviceDisplayMode"><option value="auto">自動</option><option value="pc">PC表示</option><option value="mobile">携帯表示</option></select>';rail.insertBefore(modeRow,document.getElementById('sidePanelToggle'));
  const detail=document.createElement('dialog');detail.className='mobile-horse-detail';detail.id='mobileHorseDetail';detail.innerHTML='<h2></h2><p></p><button>閉じる</button>';document.body.appendChild(detail);detail.querySelector('button').onclick=()=>detail.close();detail.onclick=e=>{if(e.target===detail){const r=detail.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)detail.close()}};
  const searchHeader=side.querySelector('.side-header'),sidebody=side.querySelector('.sidebody'),tabs=side.querySelector('.tabs');
  let mobile=false,pcState=null,returnFocus=null,forced='auto';
  function updateMobileViewport(){
    if(!mobile)return;
    const viewport=window.visualViewport;
    const height=viewport&&viewport.scale===1?viewport.height:window.innerHeight;
    document.documentElement.style.setProperty('--mobile-viewport-height',height+'px');
    document.documentElement.style.setProperty('--mobile-viewport-top',(viewport&&viewport.scale===1?viewport.offsetTop:0)+'px');
    window.dispatchEvent(new CustomEvent('pedigree-layout-change'));
    document.documentElement.style.setProperty('--mobile-bar-height',Math.ceil(bar.getBoundingClientRect().height)+'px');
  }
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(updateMobileViewport).observe(bar);
  window.visualViewport?.addEventListener('resize',updateMobileViewport);
  window.addEventListener('resize',updateMobileViewport);

  function closeSheets(){app.classList.remove('mobile-search-open','mobile-actions-open');backdrop.hidden=true;if(mobile)side.hidden=true;document.getElementById('mobileSearch').setAttribute('aria-expanded','false');document.getElementById('mobileActions').setAttribute('aria-expanded','false');if(returnFocus?.isConnected)returnFocus.focus();returnFocus=null}
  function openSheet(kind){if(!mobile)return;closeSheets();returnFocus=document.activeElement;app.classList.add(kind==='search'?'mobile-search-open':'mobile-actions-open');if(kind==='search'){side.hidden=false;side.classList.add('mobile-sheet-full')}backdrop.hidden=false;document.getElementById(kind==='search'?'mobileSearch':'mobileActions').setAttribute('aria-expanded','true');document.getElementById(kind==='search'?'mobileSheetClose':'mobileActionClose').focus()}
  function detailForSelected(){const h=selected?.dataset;if(!h?.name){show('詳細を見る馬を配置してください');return}const sub=h.path==='MF'?cellAt('M')?.dataset.sublineage||h.sublineage:h.sublineage;detail.querySelector('h2').textContent=h.name;detail.querySelector('p').textContent=[pathLabel(h.path)+'セル',h.lineage&&h.lineage!=='--'?'大系統【'+h.lineage+'】':'',sub?'小系統：'+sub:'',h.factors?'因子：'+h.factors:'',horseInformation(h.name,h.homebred==='1'),h.homebred==='1'?'自家製'+homebredGeneration(h)+'代':''].filter(Boolean).join('\n');detail.querySelector('.homebred-factor-controls')?.remove();if(h.homebred==='1'&&h.path.endsWith('F'))detail.querySelector('button').insertAdjacentHTML('beforebegin',homebredFactorControls(h));if(!detail.open)detail.showModal()}
  detail.addEventListener('change',e=>{const control=e.target.closest('[data-homebred-factor]');if(!control)return;const original=selected?.querySelector('[data-homebred-factor="'+control.dataset.homebredFactor+'"]');if(original){original.value=control.value;original.dispatchEvent(new Event('change',{bubbles:true}));detailForSelected()}});
  function fitOverview(){document.getElementById('pedigreeFit').click();const scroll=document.querySelector('.ped-scroll');scroll.scrollLeft=0;scroll.scrollTop=0}
  document.getElementById('mobileFit').onclick=fitOverview;
  document.getElementById('mobileSearch').onclick=()=>openSheet('search');document.getElementById('mobileActions').onclick=()=>openSheet('actions');document.getElementById('mobileDetails').onclick=detailForSelected;document.getElementById('mobileSummary').onclick=()=>{app.classList.toggle('mobile-summary-expanded');window.dispatchEvent(new CustomEvent('pedigree-layout-change'))};
  function scrollSearchToEdge(bottom){
    const top=bottom?Math.max(0,sidebody.scrollHeight-sidebody.clientHeight):0;
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    sidebody.scrollTo({top,behavior:reduced?'auto':'smooth'});
  }
  document.getElementById('mobileScrollTop').onclick=()=>scrollSearchToEdge(false);
  document.getElementById('mobileScrollBottom').onclick=()=>scrollSearchToEdge(true);
  document.getElementById('mobileSheetClose').onclick=closeSheets;document.getElementById('mobileActionClose').onclick=closeSheets;backdrop.onclick=closeSheets;
  window.addEventListener('pedigree-restored',()=>{if(mobile){closeSheets();updateSelection();document.getElementById('pedigreeFit').getAttribute('aria-pressed')==='true'?fitOverview():selected?.scrollIntoView?.({block:'nearest',inline:'nearest'})}});
  document.addEventListener('keydown',e=>{if(mobile&&e.key==='Escape')closeSheets()});
  function updateSelection(){document.getElementById('mobileSelected').textContent='選択：'+(selected?.dataset.cell||'父')+'セル'}
  document.getElementById('ped').addEventListener('click',()=>{if(mobile)updateSelection()});
  let beforePlacement='';document.getElementById('apply').addEventListener('click',()=>{beforePlacement=JSON.stringify(currentSnapshot())},true);document.getElementById('apply').addEventListener('click',()=>{if(mobile&&beforePlacement!==JSON.stringify(currentSnapshot())){closeSheets();document.getElementById('pedigreeFit').getAttribute('aria-pressed')==='true'?fitOverview():selected?.scrollIntoView?.({block:'nearest',inline:'nearest'});updateSelection()}});
  const oldToggle=document.getElementById('sidePanelToggle').onclick;document.getElementById('sidePanelToggle').onclick=()=>{if(mobile){if(app.classList.contains('mobile-search-open'))closeSheets();else openSheet('search')}else oldToggle()};
  function switchLayout(){
    const width=window.innerWidth||document.documentElement.clientWidth,coarse=window.matchMedia?.('(pointer: coarse)').matches||false;
    const next=forced==='mobile'||(forced==='auto'&&(width<=700||(coarse&&width<=1000)));if(next===mobile)return;
    if(next){pcState={closed:app.classList.contains('side-closed'),percent:parseFloat(document.getElementById('pedigreeZoomValue').textContent)||100,automatic:document.getElementById('pedigreeFit').getAttribute('aria-pressed')==='true',orientation:document.getElementById('ped').dataset.orientation};mobile=true;document.body.classList.add('mobile-layout');sidebody.prepend(searchHeader);updateMobileViewport();app.classList.remove('side-closed');side.hidden=true;document.getElementById('pedigreeVertical').click();window.dispatchEvent(new CustomEvent('pedigree-zoom-request',{detail:{percent:100,automatic:true}}));updateSelection()}
    else{closeSheets();mobile=false;document.body.classList.remove('mobile-layout');side.insertBefore(searchHeader,tabs);side.classList.remove('mobile-sheet-full');app.classList.remove('mobile-summary-expanded');app.classList.toggle('side-closed',pcState?.closed||false);side.hidden=!!pcState?.closed;document.getElementById(pcState?.orientation==='horizontal'?'pedigreeHorizontal':'pedigreeVertical').click();window.dispatchEvent(new CustomEvent('pedigree-zoom-request',{detail:{percent:pcState?.percent||100,automatic:pcState?.automatic??true}}))}
  }
  document.getElementById('deviceDisplayMode').onchange=e=>{forced=e.target.value;switchLayout()};window.addEventListener('resize',switchLayout);switchLayout();
})();
