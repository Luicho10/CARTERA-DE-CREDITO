window.addEventListener('DOMContentLoaded',()=>{
  const style=document.createElement('style');
  style.textContent='@media print{.view{display:none!important}#view-mora.view:not(#view-consolidado){display:block!important}#view-consolidado{display:block!important}.report-date-control{display:none!important}.report-date-print{display:block!important}}';
  document.head.appendChild(style);
  function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function getDate(){return localStorage.getItem('cartera_fecha_reporte')||today()}
  function fmt(s){if(!s)return '';const [y,m,d]=s.split('-');return `${d}/${m}/${y}`}
  window.getReportDate=getDate;
  window.ensureReportDate=function(view){
    if(!view)return;
    let box=view.querySelector('.report-date-control');
    if(!box){
      box=document.createElement('div');box.className='report-date-control';
      box.style.cssText='display:flex;align-items:center;gap:10px;margin:8px 0 14px;padding:9px 12px;background:#f6faf4;border:1px solid #d7e2d1;border-radius:6px;max-width:360px;';
      box.innerHTML='<label style="font-weight:700;white-space:nowrap">Fecha del reporte:</label><input id="reportDateInput" type="date" style="padding:5px 8px;border:1px solid #cbd8c5;border-radius:5px;">';
      const title=view.querySelector('.section-title');
      if(title)title.appendChild(box);else view.insertBefore(box,view.firstChild);
      const input=box.querySelector('input');input.value=getDate();input.addEventListener('change',()=>{if(input.value)localStorage.setItem('cartera_fecha_reporte',input.value);});
      const print=document.createElement('div');print.className='report-date-print';print.style.cssText='display:none;margin:8px 0 14px;font-size:13px;font-weight:700;';print.textContent=`Fecha del reporte: ${fmt(getDate())}`;box.insertAdjacentElement('afterend',print);
      input.addEventListener('change',()=>print.textContent=`Fecha del reporte: ${fmt(input.value)}`);
    }
    const input=box.querySelector('input');if(input&&!input.value)input.value=getDate();
    const print=view.querySelector('.report-date-print');if(print)print.textContent=`Fecha del reporte: ${fmt(input?.value||getDate())}`;
  }
  function prepare(){ensureReportDate(document.getElementById('view-mora'));ensureReportDate(document.getElementById('view-consolidado'));ensureReportDate(document.getElementById('view-flujo'));}
  prepare();
  const observer=new MutationObserver(()=>{const v=document.getElementById('view-flujo');if(v&&v.querySelector('.section-title'))ensureReportDate(v);});
  const flow=document.getElementById('view-flujo');if(flow)observer.observe(flow,{childList:true,subtree:true});
  document.querySelectorAll('.tab[data-view="mora"],.tab[data-view="consolidado"],.tab[data-view="flujo"]').forEach(b=>b.addEventListener('click',()=>setTimeout(prepare,150)));
  const p=$('printBtn');if(p)p.onclick=()=>{prepare();window.print()};
  const m=$('moraPrintBtn');if(m)m.onclick=()=>{prepare();const s=style;s.textContent='@media print{.view{display:none!important}#view-mora.view:not(#view-consolidado){display:block!important}.report-date-control{display:none!important}.report-date-print{display:block!important}}';window.print();setTimeout(()=>{s.textContent='@media print{.view{display:none!important}#view-mora.view:not(#view-consolidado){display:block!important}#view-consolidado{display:block!important}.report-date-control{display:none!important}.report-date-print{display:block!important}}'},1000)};
});