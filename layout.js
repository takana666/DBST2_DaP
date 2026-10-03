'use strict';
(function setupCompactLayout(){
  const app=document.querySelector('.app'),side=document.querySelector('.side'),toolbar=document.querySelector('.toolbar');
  const rail=document.createElement('nav');rail.id='pedActionRail';rail.className='ped-action-rail';rail.setAttribute('aria-label','血統表の操作');app.insertBefore(rail,side);
  const toggle=document.createElement('button');toggle.className='btn panel-toggle';toggle.id='sidePanelToggle';toggle.setAttribute('aria-controls','searchSidePanel');toggle.setAttribute('aria-expanded','true');toggle.textContent='右パネルを閉じる';side.id='searchSidePanel';
  function group(ids,className='rail-group'){const node=document.createElement('div');node.className=className;for(const id of ids)node.appendChild(document.getElementById(id));rail.appendChild(node);return node}
  function divider(){rail.appendChild(document.createElement('hr'))}
  group(['pedigreeLibraryOpen']);divider();
  group(['pedUndo','pedRedo'],'rail-row');
  group(['advanceSire','advanceDam']);
  const erase=document.querySelector('.ped-clear-actions');document.getElementById('pedClearCell').textContent='指定セルを消去';rail.appendChild(erase);
  divider();
  group(['pedigreeZoomOut','pedigreeZoomValue','pedigreeZoomIn'],'rail-row zoom-row');
  group(['pedigreeFit','pedigreeZoomReset','rejudge']);divider();
  rail.appendChild(document.getElementById('pedScreenshotActions'));divider();
  const info=document.createElement('button');info.className='btn';info.id='horseInformationToggle';info.textContent='種牡馬・繁殖牝馬情報 ON';info.setAttribute('aria-pressed','true');rail.appendChild(info);
  info.onclick=()=>{const hidden=app.classList.toggle('horse-information-hidden');window.DABISTA_HIDE_HORSE_INFORMATION=hidden;document.querySelectorAll('.cell[data-name]').forEach(renderPedCell);updateTheory();updateCrosses();info.textContent='種牡馬・繁殖牝馬情報 '+(hidden?'OFF':'ON');info.setAttribute('aria-pressed',String(!hidden))};
  const modes=document.createElement('div');modes.className='rail-row';rail.appendChild(modes);
  const ped=document.getElementById('ped');
  function setOrientation(horizontal){
    ped.dataset.orientation=horizontal?'horizontal':'vertical';
    ped.querySelectorAll('.cell[data-path],.lineage').forEach(cell=>{
      if(!cell.dataset.verticalRow)cell.dataset.verticalRow=cell.style.gridRow;
      const mother=cell.dataset.path?cell.dataset.path[0]==='M':Number(cell.dataset.row)>=8;
      const column=cell.dataset.path?cell.dataset.path.length:6;
      if(horizontal){const row=cell.dataset.verticalRow.split('/').map(Number);cell.style.gridColumn=String(column+(mother?6:0));cell.style.gridRow=(row[0]-(mother?16:0))+'/'+(row[1]-(mother?16:0))}
      else{cell.style.gridColumn='';cell.style.gridRow=cell.dataset.verticalRow}
    });
    modes.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.orientation===ped.dataset.orientation)));
    window.dispatchEvent(new Event('pedigree-layout-change'));
  }
  for(const [value,label] of [['vertical','縦表示'],['horizontal','横表示']]){const button=document.createElement('button');button.className='btn';button.dataset.orientation=value;button.textContent=label;button.id='pedigree'+(value==='vertical'?'Vertical':'Horizontal');button.setAttribute('aria-pressed',String(value==='vertical'));button.onclick=()=>setOrientation(value==='horizontal');modes.appendChild(button)}
  ped.dataset.orientation='vertical';
  const include=document.createElement('button');include.id='includeHomebreds';include.className='status-sort';include.textContent='自家製含む';include.setAttribute('aria-pressed','true');document.querySelector('[data-sort="default"]').after(include);include.onclick=()=>{includeSavedHomebreds=!includeSavedHomebreds;include.textContent=includeSavedHomebreds?'自家製含む':'自家製含まない';include.setAttribute('aria-pressed',String(includeSavedHomebreds));render()};
  const explanation=document.createElement('p');explanation.className='judgment-explanation';explanation.textContent='この配合判定は、選択したセル部分に対する判定になります。例えば、父父のセルを選択して配合理論等の条件を指定した場合、母母の馬に対してサーチした結果になります';document.getElementById('judgmentPanel').prepend(explanation);

  toolbar.querySelectorAll('.generation-actions,.pedigree-zoom').forEach(el=>el.remove());
  toolbar.classList.add('layout-summary');toolbar.append(document.getElementById('nitro'),document.getElementById('crossPanel'));
  app.prepend(toolbar);app.insertBefore(rail,side);
  const input=document.getElementById('compositionInput');input.oninput=()=>input.title=input.value;input.onmouseenter=()=>input.title=input.value;input.title=input.value;
  rail.appendChild(toggle);
  toggle.onclick=()=>{const closed=app.classList.toggle('side-closed');side.hidden=closed;toggle.setAttribute('aria-expanded',String(!closed));toggle.textContent=closed?'右パネルを開く':'右パネルを閉じる'};
})();
