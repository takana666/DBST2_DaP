'use strict';
(function setupHomebredFactors(){
  const pedigree=document.getElementById('ped');
  pedigree.addEventListener('change',e=>{
    const control=e.target.closest('[data-homebred-factor]');if(!control)return;
    const cell=control.closest('.cell'),selects=[...cell.querySelectorAll('[data-homebred-factor]')];
    if(cell.dataset.homebred!=='1'||!cell.dataset.path.endsWith('F'))return;
    const values=selects.map(select=>select.value);
    if(values[0]&&values[0]===values[1]){show('同じ因子は2つ選択できません');renderPedCell(cell);return}
    cell.dataset.factors=values.filter(Boolean).join('');
    selects.forEach((select,i)=>[...select.options].forEach(option=>{option.disabled=!!option.value&&option.value===values[1-i]}));
    cell.querySelector('.factor-row').innerHTML=factors([...cell.dataset.factors]);
    updateComposition();updateNitro();render();show('自家製種牡馬の因子を更新しました');
  });
})();
