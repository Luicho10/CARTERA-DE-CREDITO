(function(){
  function montar(){
    const nav=document.querySelector('.tabs'),main=document.querySelector('main');
    if(!nav||!main||document.getElementById('view-cheques-devueltos'))return;
    const tab=document.createElement('button');tab.className='tab';tab.dataset.view='cheques-devueltos';tab.textContent='5. Cheques Devueltos';
    const mora=nav.querySelector('[data-view="mora"]');mora?mora.after(tab):nav.appendChild(tab);
    const sec=document.createElement('section');sec.id='view-cheques-devueltos';sec.className='view';
    sec.innerHTML=`<div class="section-title"><h2>Cheques Devueltos</h2><p>Control exclusivo del Departamento de Crédito sobre cheques devueltos informados por Datapar.</p></div><div class="grid-4"><div class="metric"><small>Cheques devueltos</small><strong id="chequeCount">0</strong></div><div class="metric"><small>Total USD</small><strong id="chequeUSD">0,00</strong></div><div class="metric"><small>Total Gs.</small><strong id="chequeGS">0</strong></div><div class="metric"><small>Alerta de crédito</small><strong class="danger">DEVUELTO</strong></div></div><div class="card hero"><div><h3>Importar informe Datapar</h3><p>Seleccione únicamente el PDF de <b>Cheques Recibidos · Situación DEVUELTO</b>. Los cheques en cartera y cartera banco no forman parte de este módulo.</p></div><div class="import-controls"><label class="file-button"><input id="chequeFile" type="file" accept="application/pdf"/><span>Seleccionar PDF DEVUELTO</span></label><button id="chequePrint">Imprimir / PDF</button></div></div><div class="card"><div class="section-head"><h3>Registro de cheques devueltos</h3><input id="chequeSearch" placeholder="Buscar cliente, cheque, banco…"/></div><div id="chequeStatus" class="status">Aguardando importación.</div><div class="table-wrap"><table class="report"><thead><tr><th>Responsable</th><th>Titular</th><th>RUC / CI</th><th>Banco</th><th>Nº Cheque</th><th>Emisión</th><th>Recepción</th><th>Vencimiento</th><th>Valor</th><th>Situación</th></tr></thead><tbody id="chequeBody"></tbody></table></div></div>`;
    const cons=main.querySelector('#view-consolidado');cons?main.insertBefore(sec,cons):main.appendChild(sec);
    tab.onclick=function(){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));sec.classList.add('active');tab.classList.add('active');if(window.initChequesDevueltos)window.initChequesDevueltos()};
    if(window.initChequesDevueltos)window.initChequesDevueltos();
  }
  const s=document.createElement('script');s.src='cheques-devueltos.js?v=20260917110';s.onload=montar;s.onerror=()=>console.error('No se pudo cargar cheques-devueltos.js');document.body.appendChild(s);
})();
