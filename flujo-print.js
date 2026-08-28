(function(){
  function install(){
    const v=document.getElementById('view-flujo');
    if(!v||document.getElementById('fcPrintBtn'))return;
    const heads=v.querySelectorAll('.section-head');
    const head=heads[0];
    if(!head)return;
    const btn=document.createElement('button');
    btn.id='fcPrintBtn';btn.type='button';btn.textContent='Imprimir / PDF';
    btn.addEventListener('click',()=>window.print());
    head.appendChild(btn);
  }
  document.addEventListener('click',e=>{if(e.target.closest('.tab[data-view="flujo"]'))setTimeout(install,50)});
  const old=window.loadFlujoCaja;
  if(typeof old==='function'){window.loadFlujoCaja=function(){const r=old.apply(this,arguments);setTimeout(install,100);return r}}
})();