(function(){
  function install(){
    const v=document.getElementById('view-flujo');
    if(!v)return;
    let btn=document.getElementById('fcPrintBtn');
    const heads=v.querySelectorAll('.section-head');
    const head=heads[0];
    if(!head)return;
    if(!btn){
      btn=document.createElement('button');
      btn.id='fcPrintBtn';btn.type='button';btn.textContent='Imprimir / PDF';
      head.appendChild(btn);
    }
    btn.onclick=printFlujo;
  }
  function printFlujo(){
    const v=document.getElementById('view-flujo');
    if(!v)return;
    const w=window.open('','_blank','width=1100,height=800');
    if(!w){alert('El navegador bloqueó la ventana de impresión. Permita ventanas emergentes para este sitio.');return;}
    const styles=[...document.querySelectorAll('link[rel="stylesheet"]')].map(x=>`<link rel="stylesheet" href="${x.href}">`).join('');
    w.document.open();
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>Flujo de Caja</title>${styles}<style>@page{size:A4 landscape;margin:10mm}body{background:#fff!important}#view-flujo{display:block!important;max-width:none!important;margin:0!important}.fc-print-hide{display:none!important}.section-title h2{font-size:22px}.card{break-inside:avoid;margin-bottom:12px}.table-wrap{overflow:visible!important}table{width:100%!important}</style></head><body>${v.outerHTML}</body></html>`);
    w.document.close();
    setTimeout(()=>{w.focus();w.print();setTimeout(()=>w.close(),500)},700);
  }
  document.addEventListener('click',e=>{if(e.target.closest('.tab[data-view="flujo"]'))setTimeout(install,100)});
  const old=window.loadFlujoCaja;
  if(typeof old==='function'){window.loadFlujoCaja=function(){const r=old.apply(this,arguments);setTimeout(install,150);return r}}
  setTimeout(install,300);
})();