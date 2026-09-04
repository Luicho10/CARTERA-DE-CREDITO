(function(){
  function install(){
    const v=document.getElementById('view-flujo'); if(!v)return;
    const head=v.querySelectorAll('.section-head')[0]; if(!head)return;
    if(typeof window.ensureReportDate==='function')window.ensureReportDate(v);
    let btn=document.getElementById('fcPrintBtn');
    if(!btn){btn=document.createElement('button');btn.id='fcPrintBtn';btn.type='button';btn.textContent='Imprimir / PDF';head.appendChild(btn)}
    btn.onclick=printFlujo;
  }
  function replaceSelectWithSelectedText(original,clone,id){
    const src=original.querySelector('#'+id),dst=clone.querySelector('#'+id);
    if(!src||!dst)return;
    const selected=src.options[src.selectedIndex];
    const span=document.createElement('span');
    span.className='fc-print-filter';
    span.textContent=selected?selected.textContent:src.value;
    dst.replaceWith(span);
  }
  function printFlujo(e){
    if(e){e.preventDefault();e.stopImmediatePropagation();}
    const v=document.getElementById('view-flujo'); if(!v)return false;
    if(typeof window.ensureReportDate==='function')window.ensureReportDate(v);
    const content=v.cloneNode(true);
    content.removeAttribute('class');
    content.style.display='block';
    content.querySelectorAll('.view').forEach(x=>{x.classList.remove('view','active');x.style.display='block'});
    content.querySelectorAll('#fcPrintBtn').forEach(x=>x.remove());
    ['fcCurrency','fcPortfolio','fcSeller','fcDays'].forEach(id=>replaceSelectWithSelectedText(v,content,id));
    const styles=[...document.querySelectorAll('link[rel="stylesheet"]')].map(x=>`<link rel="stylesheet" href="${x.href}">`).join('');
    const w=window.open('','_blank','width=1100,height=800');
    if(!w){alert('El navegador bloqueó la ventana de impresión. Permita ventanas emergentes para este sitio.');return false;}
    w.document.open();
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Flujo de Caja</title>${styles}<style>@page{size:A4 landscape;margin:10mm}html,body{background:#fff!important;color:#222!important;margin:0!important;padding:0!important}#view-flujo{display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important}.card,.section-title{break-inside:avoid;max-width:none!important}.table-wrap{overflow:visible!important}table{width:100%!important}.fc-print-hide{display:none!important}.fc-print-filter{display:inline-flex!important;align-items:center!important;min-height:34px!important;padding:0 10px!important;border:1px solid #d7e2d1!important;border-radius:5px!important;background:#fff!important;color:#222!important;font-size:12px!important;box-sizing:border-box!important}.report-date-control{display:none!important}.report-date-print{display:block!important;margin:8px 0 14px!important;font-size:13px!important;font-weight:700!important}</style></head><body></body></html>`);
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