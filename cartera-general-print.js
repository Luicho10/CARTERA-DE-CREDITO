/* Cartera general + impresion individual de carteras
   Mantiene las 6 carteras operativas y agrega una vista virtual consolidada. */
(function(){
  const GENERAL_ID='__GENERAL__';

  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/gi,' ').trim().toUpperCase();

  function portfolioName(id){
    const c=(window.carteras||[]).find(x=>String(x.id)===String(id));
    return c?.nombre||'';
  }

  function portfolioCurrency(id){
    const c=(window.carteras||[]).find(x=>String(x.id)===String(id));
    return c?.moneda||'USD';
  }

  function injectStyles(){
    if(document.getElementById('cartera-general-print-style'))return;
    const s=document.createElement('style');
    s.id='cartera-general-print-style';
    s.textContent=`
      .portfolio-general-option{font-weight:700}
      .portfolio-print-btn{margin-top:10px;width:100%;background:#f5fbf1;border-color:#b9d8b8;color:#23733a}
      .portfolio-print-btn:hover{background:#eaf5e3}
      .general-totals{display:none;gap:12px;flex-wrap:wrap;margin:-4px 0 14px}
      .general-totals .gt-item{background:#f5fbf1;border:1px solid #dcebd8;border-radius:7px;padding:8px 12px}
      .general-totals small{display:block;color:#65736a;font-size:11px}
      .general-totals strong{display:block;color:#23733a;font-size:16px;margin-top:2px}
      @media print{
        .portfolio-print-btn,.general-totals{display:none!important}
      }
    `;
    document.head.appendChild(s);
  }

  function ensureGeneralOption(){
    const sel=document.getElementById('portfolioSelect');
    if(!sel)return;
    const exists=[...sel.options].some(o=>o.value===GENERAL_ID);
    if(!exists){
      const o=document.createElement('option');
      o.value=GENERAL_ID;
      o.textContent='CARTERA GENERAL';
      o.className='portfolio-general-option';
      sel.insertBefore(o,sel.firstChild);
    }
  }

  function ensureGeneralTotals(){
    const card=document.querySelector('#view-carteras .card:last-of-type');
    if(!card)return null;
    let box=document.getElementById('generalTotals');
    if(!box){
      box=document.createElement('div');
      box.id='generalTotals';
      box.className='general-totals';
      const tableWrap=card.querySelector('.table-wrap');
      if(tableWrap)card.insertBefore(box,tableWrap);
    }
    return box;
  }

  function setGeneralTotals(rows){
    const box=ensureGeneralTotals();
    if(!box)return;
    const currency=x=>String(x.moneda||portfolioCurrency(x.cartera_id)||'USD').toUpperCase();
    const usd=rows.filter(x=>currency(x)==='USD').reduce((a,x)=>a+Number(x.saldo||0),0);
    const gs=rows.filter(x=>currency(x)!=='USD').reduce((a,x)=>a+Number(x.saldo||0),0);
    const today=new Date().toISOString().slice(0,10);
    const usdV=rows.filter(x=>currency(x)==='USD'&&x.vencimiento&&x.vencimiento<today).reduce((a,x)=>a+Number(x.saldo||0),0);
    const gsV=rows.filter(x=>currency(x)!=='USD'&&x.vencimiento&&x.vencimiento<today).reduce((a,x)=>a+Number(x.saldo||0),0);
    box.innerHTML=`
      <div class="gt-item"><small>TOTAL USD</small><strong>${fmt(usd,'USD')}</strong></div>
      <div class="gt-item"><small>VENCIDO USD</small><strong>${fmt(usdV,'USD')}</strong></div>
      <div class="gt-item"><small>TOTAL GS.</small><strong>${fmt(gs,'GS')}</strong></div>
      <div class="gt-item"><small>VENCIDO GS.</small><strong>${fmt(gsV,'GS')}</strong></div>
    `;
    box.style.display='flex';
  }

  function hideGeneralTotals(){
    const box=document.getElementById('generalTotals');
    if(box)box.style.display='none';
  }

  async function loadGeneralDetails(){
    const q=(document.getElementById('filterText')?.value||'').trim().toLowerCase();
    const sellerValue=document.getElementById('sellerFilter')?.value||'';
    const {data,error}=await sb.from('documentos_cartera')
      .select('*,cliente:cartera_clientes(nombre,codigo),vendedor:cartera_vendedores(id,nombre)')
      .order('cartera_id').order('vencimiento');
    if(error){
      console.error(error);
      toast('No se pudo cargar la cartera general: '+error.message);
      return;
    }
    const docs=data||[];
    const active=docs.filter(x=>String(x.estado||'').toUpperCase()!=='ANULADO');
    const effective=x=>x.vendedor_actual_id||'';
    const filtered=active.filter(x=>{
      const sellerOk=!sellerValue || String(effective(x))===String(sellerValue);
      const text=`${x.cliente?.nombre||''} ${x.cliente?.codigo||''} ${x.cod_interno||''} ${x.factura||''} ${x.vendedor_origen||''} ${portfolioName(x.cartera_id)}`.toLowerCase();
      return sellerOk&&(!q||text.includes(q));
    });
    const head=document.querySelector('#view-carteras .table-wrap table thead');
    if(head)head.innerHTML='<tr><th>Cartera</th><th>Cliente</th><th>Vendedor actual</th><th>Vendedor origen</th><th>Cod. Interno</th><th>Factura / Nro. Documento</th><th>Venc.</th><th>Saldo</th><th>Estado</th></tr>';
    const body=document.getElementById('detailBody');
    body.innerHTML=filtered.map(x=>{
      const current=effective(x);
      const options='<option value="">SIN VENDEDOR</option>'+(window.vendedores||[]).map(v=>`<option value="${v.id}" ${String(current)===String(v.id)?'selected':''}>${esc(v.nombre)}</option>`).join('');
      return `<tr>
        <td>${esc(portfolioName(x.cartera_id))}</td>
        <td>${esc(x.cliente?.nombre||'')}</td>
        <td><select class="seller-select" data-doc-id="${x.id}" onchange="saveDocumentSeller('${x.id}',this.value)">${options}</select></td>
        <td>${esc(x.vendedor_origen||'')}</td>
        <td>${esc(x.cod_interno||'')}</td>
        <td>${esc(x.factura||'')}</td>
        <td>${showDate(x.vencimiento)}</td>
        <td>${fmt(x.saldo,portfolioCurrency(x.cartera_id))}</td>
        <td>${esc(x.estado||'')}</td>
      </tr>`;
    }).join('');
    setGeneralTotals(active);
  }
  window.loadGeneralDetails=loadGeneralDetails;

  async function loadSelectedDetails(){
    const sel=document.getElementById('portfolioSelect');
    if(sel?.value===GENERAL_ID)return loadGeneralDetails();
    hideGeneralTotals();
    const head=document.querySelector('#view-carteras .table-wrap table thead');
    if(head)head.innerHTML='<tr><th>Cliente</th><th>Vendedor actual</th><th>Vendedor origen</th><th>Cod. Interno</th><th>Factura / Nro. Documento</th><th>Venc.</th><th>Saldo Cuenta</th><th>Estado</th><th></th></tr>';
    if(typeof window.__carteraOriginalLoadDetails==='function')return window.__carteraOriginalLoadDetails();
  }

  async function printPortfolio(id){
    const isGeneral=String(id)===GENERAL_ID;
    let docs=[];
    if(isGeneral){
      const {data,error}=await sb.from('documentos_cartera')
        .select('*,cliente:cartera_clientes(nombre,codigo),vendedor:cartera_vendedores(nombre)')
        .order('cartera_id').order('vencimiento');
      if(error){toast(`No se pudo preparar la impresion: ${error.message}`);return}
      docs=data||[];
    }else{
      const {data,error}=await sb.from('documentos_cartera')
        .select('*,cliente:cartera_clientes(nombre,codigo),vendedor:cartera_vendedores(nombre)')
        .eq('cartera_id',id).order('vencimiento');
      if(error){toast(`No se pudo preparar la impresion: ${error.message}`);return}
      docs=data||[];
    }

    const vig=docs.filter(x=>String(x.estado||'').toUpperCase()!=='ANULADO');
    const today=new Date().toISOString().slice(0,10);
    const {data:portfolioRows,error:portfolioError}=await sb.from('carteras').select('id,nombre,moneda');
    if(portfolioError){toast(`No se pudo obtener la moneda de la cartera: ${portfolioError.message}`);return}
    const currencyById=new Map((portfolioRows||[]).map(x=>[String(x.id),String(x.moneda||'USD').toUpperCase()]));
    const currencyOf=x=>currencyById.get(String(x.cartera_id))||String(portfolioCurrency(x.cartera_id)||'USD').toUpperCase();
    const usd=vig.filter(x=>currencyOf(x)==='USD').reduce((a,x)=>a+Number(x.saldo||0),0);
    const gs=vig.filter(x=>currencyOf(x)!=='USD').reduce((a,x)=>a+Number(x.saldo||0),0);
    const usdV=vig.filter(x=>currencyOf(x)==='USD'&&x.vencimiento&&x.vencimiento<today).reduce((a,x)=>a+Number(x.saldo||0),0);
    const gsV=vig.filter(x=>currencyOf(x)!=='USD'&&x.vencimiento&&x.vencimiento<today).reduce((a,x)=>a+Number(x.saldo||0),0);

    const title=isGeneral?'CARTERA GENERAL':'CARTERA '+portfolioName(id);
    const summary=isGeneral
      ?`USD: ${fmt(usd,'USD')} · Vencido USD: ${fmt(usdV,'USD')} · Gs.: ${fmt(gs,'GS')} · Vencido Gs.: ${fmt(gsV,'GS')}`
      :`${portfolioCurrency(id)==='USD'?'USD':'Gs.'}: ${fmt(vig.reduce((a,x)=>a+Number(x.saldo||0),0),portfolioCurrency(id))} · Vencido: ${fmt(vig.filter(x=>x.vencimiento&&x.vencimiento<today).reduce((a,x)=>a+Number(x.saldo||0),0),portfolioCurrency(id))}`;

    const w=window.open('','_blank','width=1200,height=800');
    if(!w){toast('El navegador bloqueo la ventana de impresion. Permita ventanas emergentes para este sitio.');return}
    const rowsHtml=vig.map(x=>{
      const cur=currencyOf(x);
      return `<tr>
        ${isGeneral?`<td>${esc(portfolioName(x.cartera_id))}</td>`:''}
        <td>${esc(x.cliente?.nombre||'')}</td>
        <td>${esc(x.vendedor?.nombre||'SIN VENDEDOR')}</td>
        <td>${esc(x.vendedor_origen||'')}</td>
        <td>${esc(x.cod_interno||'')}</td>
        <td>${esc(x.factura||'')}</td>
        <td>${showDate(x.vencimiento)}</td>
        <td class="num">${fmt(x.saldo,cur)}</td>
        <td>${esc(x.estado||'')}</td>
      </tr>`;
    }).join('');

    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title>
      <style>
        @page{size:A4 landscape;margin:8mm}
        *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#26342b;margin:0;font-size:9px}
        h1{margin:0;color:#23733a;font-size:18px}p{margin:3px 0;color:#65736a}
        .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #d9f2c8;padding-bottom:7px;margin-bottom:8px}
        .summary{font-weight:700;color:#23733a;margin:7px 0 10px}
        table{width:100%;border-collapse:collapse;table-layout:fixed}
        th{background:#eaf5e3;color:#1f6f35;text-align:left}
        th,td{border-bottom:1px solid #dfe7df;padding:4px;white-space:normal;word-break:break-word}
        .num{text-align:right;font-weight:700}
        .foot{margin-top:8px;color:#65736a;font-size:8px}
      </style></head><body>
      <div class="head"><div><h1>${esc(title)}</h1><p>Detalle de cartera de crédito</p></div><div><strong>Fecha: ${new Date().toLocaleDateString('es-PY')}</strong></div></div>
      <div class="summary">${esc(summary)} · Documentos: ${vig.length}</div>
      <table><thead><tr>
        ${isGeneral?'<th>Cartera</th>':''}
        <th>Cliente</th><th>Vendedor actual</th><th>Vendedor origen</th><th>Cod. Interno</th><th>Factura / Nro. Documento</th><th>Venc.</th><th>Saldo</th><th>Estado</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="foot">Reporte generado desde CARTERA DE CRÉDITO.</div>
      <script>window.onload=function(){window.focus();window.print();setTimeout(function(){window.close()},500)};<\/script>
      </body></html>`);
    w.document.close();
  }

  window.printPortfolio=printPortfolio;

  function addPrintButtonsToCards(){
    const grid=document.getElementById('portfolioCards');
    if(!grid)return;
    grid.querySelectorAll('.portfolio').forEach((card,i)=>{
      if(card.querySelector('.portfolio-print-btn'))return;
      const h=card.querySelector('h3');
      if(!h)return;
      const name=h.textContent.trim();
      const c=(window.carteras||[]).find(x=>x.nombre===name);
      if(!c)return;
      const b=document.createElement('button');
      b.type='button';
      b.className='portfolio-print-btn';
      b.textContent='Imprimir cartera';
      b.onclick=e=>{e.stopPropagation();printPortfolio(c.id)};
      card.appendChild(b);
    });
  }

  function addGeneralOptionAndControls(){
    injectStyles();
    ensureGeneralOption();
    const select=document.getElementById('portfolioSelect');
    if(select&&!select.dataset.generalPrintBound){
      select.dataset.generalPrintBound='1';
      select.addEventListener('change',()=>setTimeout(()=>{
        if(select.value===GENERAL_ID)loadGeneralDetails();
        else hideGeneralTotals();
      },0));
    }
    const head=document.querySelector('#view-carteras .section-head');
    if(head&&!document.getElementById('printSelectedPortfolio')){
      const b=document.createElement('button');
      b.id='printSelectedPortfolio';
      b.type='button';
      b.textContent='Imprimir cartera seleccionada';
      b.onclick=()=>printPortfolio(select?.value||GENERAL_ID);
      head.querySelector('div')?.appendChild(b);
    }
    addPrintButtonsToCards();
  }

  window.addEventListener('load',()=>{
    addGeneralOptionAndControls();
    setTimeout(addGeneralOptionAndControls,300);
    setTimeout(addGeneralOptionAndControls,1000);

    const original=window.loadDetails;
    if(original&&!window.__carteraOriginalLoadDetails){
      window.__carteraOriginalLoadDetails=original;
      window.loadDetails=loadSelectedDetails;
    }

    const originalPortfolios=window.loadPortfolios;
    if(originalPortfolios&&!window.__carteraWrappedPortfolios){
      window.__carteraWrappedPortfolios=true;
      window.loadPortfolios=async function(){
        await originalPortfolios();
        addGeneralOptionAndControls();
      };
    }

    const select=document.getElementById('portfolioSelect');
    if(select){
      select.addEventListener('change',()=>{
        setTimeout(()=>{
          if(select.value===GENERAL_ID)loadGeneralDetails();
          else hideGeneralTotals();
        },30);
      });
    }

    const search=document.getElementById('filterText');
    if(search)search.addEventListener('input',()=>{
      if(select?.value===GENERAL_ID)loadGeneralDetails();
    });
    const seller=document.getElementById('sellerFilter');
    if(seller)seller.addEventListener('change',()=>{
      if(select?.value===GENERAL_ID)loadGeneralDetails();
    });
  });

  window.addEventListener('load',()=>setTimeout(addPrintButtonsToCards,1200));
})();