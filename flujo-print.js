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
    const content=v.cloneNode(true);
    content.removeAttribute('class');
    content.style.display='block';
    content.querySelectorAll('.view').forEach(x=>{x.classList.remove('view','active');x.style.display='block'});
    content.querySelectorAll('#fcPrintBtn').forEach(x=>x.remove());
    const styles=[...document.querySelectorAll('link[rel="stylesheet"]')].map(x=>`<link rel="stylesheet" href="${x.href}">`).join('');
    const w=window.open('','_blank','width=1100,height=800');
    if(!w){alert('El navegador bloqueó la ventana de impresión. Permita ventanas emergentes para este sitio.');return false;}
    w.document.open();
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Flujo de Caja</title>${styles}<style>@page{size:A4 landscape;margin:10mm}html,body{background:#fff!important;color:#222!important;margin:0!important;padding:0!important}#view-flujo{display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important}.card,.section-title{break-inside:avoid;max-width:none!important}.table-wrap{overflow:visible!important}table{width:100%!important}.fc-print-hide{display:none!important}</style></head><body></body></html>`);
    w.document.close();
    w.document.body.appendChild(content);
    setTimeout(()=>{w.focus();w.print();setTimeout(()=>w.close(),700)},1000);
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