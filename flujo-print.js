(function(){
  function install(){
    const v=document.getElementById('view-flujo'); if(!v)return;
    const head=v.querySelectorAll('.section-head')[0]; if(!head)return;
    let btn=document.getElementById('fcPrintBtn');
    if(!btn){btn=document.createElement('button');btn.id='fcPrintBtn';btn.type='button';btn.textContent='Imprimir / PDF';head.appendChild(btn)}
    btn.onclick=printFlujo;
  }
  function printFlujo(e){
    if(e){e.preventDefault();e.stopImmediatePropagation();}
    const v=document.getElementById('view-flujo'); if(!v)return false;
    const w=window.open('','_blank','width=1100,height=800');
    if(!w){alert('El navegador bloqueó la ventana de impresión. Permita ventanas emergentes para este sitio.');return false;}
    const styles=[...document.querySelectorAll('link[rel="stylesheet"]')].map(x=>`<link rel="stylesheet" href="${x.href}">`).join('');
    const content=v.cloneNode(true);
    content.querySelectorAll('#fcPrintBtn').forEach(x=>x.remove());
    w.document.open();
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>Flujo de Caja</title>${styles}<style>@page{size:A4 landscape;margin:10mm}html,body{background:#fff!important;margin:0!important}.view{display:block!important}.card,.section-title{max-width:none!important}.table-wrap{overflow:visible!important}table{width:100%!important}.fc-print-hide{display:none!important}</style></head><body>${content.outerHTML}</body></html>`);
    w.document.close();
    setTimeout(()=>{w.focus();w.print();setTimeout(()=>w.close(),700)},800);
    return false;
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('#fcPrintBtn');
    if(b){e.preventDefault();e.stopImmediatePropagation();printFlujo(e);return;}
    if(e.target.closest('.tab[data-view="flujo"]'))setTimeout(install,150);
  },true);
  const old=window.loadFlujoCaja;
  if(typeof old==='function')window.loadFlujoCaja=function(){const r=old.apply(this,arguments);setTimeout(install,200);return r};
  setTimeout(install,500);
})();