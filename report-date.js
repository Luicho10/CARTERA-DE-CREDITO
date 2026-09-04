(function(){
  const KEY='cartera_fecha_reporte';
  function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function value(){return localStorage.getItem(KEY)||today()}
  function fmt(s){if(!s)return '';const p=String(s).slice(0,10).split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:s}
  function mount(view){
    if(!view||view.dataset.reportDateMounted==='1')return;
    view.dataset.reportDateMounted='1';
    const box=document.createElement('div');
    box.className='report-date-control';
    box.style.cssText='display:flex;align-items:center;gap:10px;margin:8px 0 14px;padding:9px 12px;background:#f6faf4;border:1px solid #d7e2d1;border-radius:6px;max-width:390px;box-sizing:border-box;';
    box.innerHTML='<label style="font-weight:700;white-space:nowrap">Fecha del reporte:</label><input type="date" aria-label="Fecha del reporte">';
    const input=box.querySelector('input'); input.value=value();
    const print=document.createElement('div'); print.className='report-date-print'; print.style.cssText='display:none;margin:8px 0 14px;font-size:13px;font-weight:700;'; print.textContent=`Fecha del reporte: ${fmt(input.value)}`;
    input.addEventListener('change',()=>{if(!input.value)return;localStorage.setItem(KEY,input.value);print.textContent=`Fecha del reporte: ${fmt(input.value)}`});
    const title=view.querySelector('.section-title');
    if(title)title.insertAdjacentElement('afterend',box);else view.insertBefore(box,view.firstChild);
    box.insertAdjacentElement('afterend',print);
  }
  window.getReportDate=value;
  window.ensureReportDate=mount;
  function mountAll(){mount(document.getElementById('view-importar'));mount(document.getElementById('view-mora'));mount(document.getElementById('view-consolidado'));mount(document.getElementById('view-flujo'))}
  document.addEventListener('click',e=>{if(e.target.closest('.tab[data-view="mora"],.tab[data-view="consolidado"],.tab[data-view="importar"]'))setTimeout(mountAll,150);if(e.target.closest('.tab[data-view="flujo"]'))setTimeout(mountAll,350)});
  setTimeout(mountAll,500);
})();