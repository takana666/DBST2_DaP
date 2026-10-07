'use strict';
function savedSearchCandidates(path){
  if(!/^[FM]{1,5}$/.test(path))return [];
  try{return JSON.parse(localStorage.getItem('dabista2-saved-pedigrees-v1')||'[]').map(validateSavedPedigree).filter(record=>savedPedigreeCompatible(record,path)).map(record=>{
    const father=record.snapshot.F||{},ancestors=Object.fromEntries(Object.entries(record.snapshot).map(([p,h])=>[[...p].map(x=>x==='F'?'父':'母').join(''),{...h,factors:[...(h.factors||'')]}]));
    return {...record,id:'homebred-'+record.id,recordId:record.id,savedPedigree:true,type:path.endsWith('M')?'繁殖牝馬':'種牡馬',lineage:father.lineage,lineageCode:father.lineage,sublineage:father.sublineage,factors:[],ancestors,stats:'自家製'+(Math.max(snapshotHomebredGeneration(record.snapshot,'F'),snapshotHomebredGeneration(record.snapshot,'M'))+1)+'代'};
  })}catch{return []}
}
function savedCandidateSnapshot(horse){
  const base=selected.dataset.path,snap=currentSnapshot();for(const p of Object.keys(snap))if(p.startsWith(base))delete snap[p];
  const projection=savedPedigreeProjection(horse,base);projection[base].lineage=horse.lineage||'';projection[base].sublineage=horse.sublineage||'';Object.assign(snap,projection);
  for(let depth=base.length-1;depth>=1;depth--){const p=base.slice(0,depth),sibling=p+(base[depth]==='F'?'M':'F');if(!snap[p]?.homebred)for(const q of Object.keys(snap))if(q.startsWith(sibling))delete snap[q];const father=snap[p+'F'];snap[p]={name:'1薄自家製'+(p.endsWith('M')?'牝馬':'種牡馬'),homebred:true,lineage:father?.lineage||'',sublineage:father?.sublineage||'',factors:snap[p]?.homebred?snap[p].factors||'':''}}
  return snap;
}
function savedPedigreeCompatible(record,path){return record.sex==='any'||record.sex===(path.endsWith('M')?'dam':'sire')}
function validateSavedPedigree(record){
  if(!record||typeof record.name!=='string'||!record.name.trim()||record.name.length>80||!['any','sire','dam'].includes(record.sex)||!record.snapshot||typeof record.snapshot!=='object'||Array.isArray(record.snapshot))throw new Error('保存血統の形式が不正です');
  const snapshot={};
  for(const [path,h] of Object.entries(record.snapshot)){
    if(!/^[FM]{1,5}$/.test(path)||!h||typeof h.name!=='string'||!h.name||h.name.length>160)throw new Error('血統セルの形式が不正です');
    for(const key of ['lineage','sublineage','factors'])if(h[key]!=null&&(typeof h[key]!=='string'||h[key].length>160))throw new Error('血統情報の形式が不正です');
    snapshot[path]={name:h.name,lineage:h.lineage||'',sublineage:h.sublineage||'',factors:correctedHorseFactors(h),homebred:h.homebred===true,homebredGeneration:homebredGeneration(h)};
  }
  return {id:typeof record.id==='string'&&/^[\w-]{1,100}$/.test(record.id)?record.id:newSavedPedigreeId(),name:record.name.trim(),sex:record.sex,snapshot};
}
function newSavedPedigreeId(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'saved-'+Date.now()+'-'+Math.random().toString(36).slice(2)}
function savedPedigreeProjection(record,base){
  if(!savedPedigreeCompatible(record,base))throw new Error('保存した性別と配置先が一致しません');
  if(!/^[FM]{1,5}$/.test(base))throw new Error('1〜5代目の配置セルを選んでください');
  const father=record.snapshot.F||{};
  const projected={[base]:{name:record.name,lineage:father.lineage||'',sublineage:father.sublineage||'',factors:'',homebred:true,homebredGeneration:Math.max(snapshotHomebredGeneration(record.snapshot,'F'),snapshotHomebredGeneration(record.snapshot,'M'))+1}};
  for(const [path,h] of Object.entries(record.snapshot))if(base.length+path.length<=5)projected[base+path]={...h};
  return projected;
}
function writePedigreeSnapshot(snapshot){
  document.querySelectorAll('.cell[data-path]').forEach(clearCell);
  for(const [path,h] of Object.entries(snapshot)){
    const cell=cellAt(path);if(!cell)continue;
    Object.assign(cell.dataset,{name:h.name,lineage:h.lineage||'',sublineage:h.sublineage||'',factors:h.factors||''});
    if(h.homebred){cell.dataset.homebred='1';cell.dataset.homebredGeneration=String(homebredGeneration(h))}
  }
}
function refreshPedigreeBoard(){chosen=null;updateInheritedLineages();updateLineages();updateComposition();updateNitro();render()}
function placeWholeSavedPedigree(record){
  try{record=validateSavedPedigree(record);writePedigreeSnapshot(record.snapshot);cellAt('F')?.click();refreshPedigreeBoard();document.getElementById('pedigreeLibrary').close();window.dispatchEvent(new Event('pedigree-restored'));show(record.name+'の保存血統を全体に配置しました')}
  catch(error){show(error.message)}
}
function placeSavedPedigree(record){
  try{
    record=validateSavedPedigree(record);const base=selected.dataset.path,projection=savedPedigreeProjection(record,base),snap=currentSnapshot();
    for(const path of Object.keys(snap))if(path.startsWith(base))delete snap[path];
    Object.assign(snap,projection);
    for(let depth=base.length-1;depth>=1;depth--){
      const path=base.slice(0,depth),sibling=path+(base[depth]==='F'?'M':'F');
      if(!snap[path]?.homebred)for(const p of Object.keys(snap))if(p.startsWith(sibling))delete snap[p];
      snap[path]={name:(base.length-depth)+'薄自家製'+(path.endsWith('M')?'牝馬':'種牡馬'),lineage:'',sublineage:'',factors:snap[path]?.homebred?snap[path].factors||'':'',homebred:true};
    }
    writePedigreeSnapshot(snap);refreshPedigreeBoard();document.getElementById('pedigreeLibrary').close();show(record.name+'の血統を配置しました（5代目まで）');
  }catch(error){show(error.message)}
}
(function setupPedigreeTools(){
  document.querySelectorAll('.cell[data-path]').forEach(cell=>{if([3,4,5].includes(cell.dataset.path.length))cell.classList.add('generation-'+cell.dataset.path.length)});
  const undo=document.getElementById('pedUndo'),redo=document.getElementById('pedRedo');let restoring=false;
  const capture=()=>({snapshot:currentSnapshot(),selectedPath:selected?.dataset.path||'F'}),history=[capture()];let position=0;
  function updateHistoryButtons(){undo.disabled=position===0;redo.disabled=position===history.length-1}
  function recordHistory(){
    if(restoring)return;const state=capture();
    if(JSON.stringify(state.snapshot)===JSON.stringify(history[position].snapshot))return;
    history.splice(position+1);history.push(state);if(history.length>100)history.shift();position=history.length-1;updateHistoryButtons();
  }
  const originalComposition=updateComposition;
  updateComposition=function(){originalComposition();recordHistory()};
  function restoreHistory(next){
    if(next<0||next>=history.length)return;restoring=true;
    try{
      position=next;writePedigreeSnapshot(history[position].snapshot);
      const cell=cellAt(history[position].selectedPath);if(cell)cell.click();
      refreshPedigreeBoard();updateHistoryButtons();show(next===0?'初期の血統表に戻しました':'血統表の編集を復元しました');
    }finally{restoring=false}
  }
  undo.onclick=()=>restoreHistory(position-1);redo.onclick=()=>restoreHistory(position+1);updateHistoryButtons();
  document.getElementById('rejudge').onclick=()=>{refreshPedigreeBoard();show('配合理論・ニトロ・候補を再計算しました')};
  const dialog=document.getElementById('pedigreeLibrary'),key='dabista2-saved-pedigrees-v1';let records=[];
  try{const raw=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(raw)||raw.length>500)throw new Error();records=raw.map(validateSavedPedigree)}catch{show('保存血統を読み込めませんでした。保存データのバックアップがあれば読み込んでください')}
  function persist(next){localStorage.setItem(key,JSON.stringify(next));records=next;render()}
  function renderSaved(){
    const path=selected?.dataset.path||'F',targetSex=path.endsWith('M')?'牝馬':'牡馬';
    document.getElementById('savedPedigreeTarget').textContent='呼出先：'+pathLabel(path)+'セル（'+targetSex+'）。'+targetSex+'・設定なしの保存血統を表示します。';
    const visible=records.filter(r=>savedPedigreeCompatible(r,path));
    document.getElementById('savedPedigreeList').innerHTML=visible.length?visible.map(r=>`<article class="saved-pedigree"><div><strong>${escapeCellText(r.name)}</strong><small>${{sire:'牡馬',dam:'牝馬',any:'設定なし'}[r.sex]}／${escapeCellText(r.snapshot.F?.name||'未選択')} × ${escapeCellText(r.snapshot.M?.name||'未選択')}</small></div><button class="btn primary" data-saved-place="${r.id}">選択セルに配置</button><button class="btn" data-saved-whole="${r.id}">全体に配置</button><button class="btn" data-saved-delete="${r.id}">削除</button></article>`).join(''):'<p>この配置先で呼び出せる保存血統はありません。</p>';
  }
  document.getElementById('pedigreeLibraryOpen').onclick=()=>{renderSaved();dialog.showModal()};
  document.getElementById('savedPedigreeClose').onclick=()=>dialog.close();
  document.getElementById('savedPedigreeCancel').onclick=()=>dialog.close();
  dialog.onclick=e=>{
    if(e.target!==dialog)return;
    const rect=dialog.getBoundingClientRect();
    if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close();
  };
  document.getElementById('savedPedigreeSave').onclick=()=>{
    try{
      const name=document.getElementById('savedPedigreeName').value,sex=document.getElementById('savedPedigreeSex').value,record=validateSavedPedigree({id:newSavedPedigreeId(),name,sex,snapshot:currentSnapshot()});
      if(records.length>=500)throw new Error('保存数の上限（500件）です。不要な保存血統を削除してください');
      persist([...records,record]);document.getElementById('savedPedigreeName').value='';renderSaved();show(record.name+'を保存しました');
    }catch(error){show('保存できませんでした：'+error.message)}
  };
  document.getElementById('savedPedigreeList').onclick=e=>{
    const place=e.target.closest('[data-saved-place]'),whole=e.target.closest('[data-saved-whole]'),remove=e.target.closest('[data-saved-delete]');
    if(place){const record=records.find(r=>r.id===place.dataset.savedPlace);if(record)placeSavedPedigree(record)}
    if(whole){const record=records.find(r=>r.id===whole.dataset.savedWhole);if(record)placeWholeSavedPedigree(record)}
    if(remove)try{persist(records.filter(r=>r.id!==remove.dataset.savedDelete));renderSaved()}catch(error){show('削除できませんでした：'+error.message)}
  };
  document.getElementById('savedPedigreeExport').onclick=()=>{
    const blob=new Blob([JSON.stringify({format:'dabista2-saved-pedigrees',version:1,records},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='dabista2-saved-pedigrees.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  document.getElementById('savedPedigreeImport').onchange=async e=>{
    try{
      const file=e.target.files[0];if(!file)return;if(file.size>5*1024*1024)throw new Error('5MB以下のJSONを選んでください');
      const data=JSON.parse(await file.text());if(data.format!=='dabista2-saved-pedigrees'||data.version!==1||!Array.isArray(data.records)||data.records.length>500)throw new Error('対応していない保存データです');
      const imported=data.records.map(validateSavedPedigree),byId=new Map(records.map(r=>[r.id,r]));for(const r of imported)if(!byId.has(r.id))byId.set(r.id,r);
      if(byId.size>500)throw new Error('保存数の上限（500件）を超えます');persist([...byId.values()]);renderSaved();show('保存データを読み込みました');
    }catch(error){show('読み込めませんでした：'+error.message)}finally{e.target.value=''}
  };
})();

render();
