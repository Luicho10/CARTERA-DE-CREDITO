// Módulo Crédito: Cheques Devueltos Datapar
// Lector específico del informe "Cheques Recibidos" de Datapar.
// Importa únicamente registros cuya situación sea DEVUELTO.
(function(){
  const sb=window.supabase.createClient(CARTERA_CONFIG.supabaseUrl,CARTERA_CONFIG.supabaseKey);
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const money=(n,m='USD')=>Number(n||0).toLocaleString('es-PY',{minimumFractionDigits:m==='USD'?2:0,maximumFractionDigits:m==='USD'?2:0});
  const date=s=>{if(!s)return '';const a=String(s).split('-');return a.length===3?`${a[2]}/${a[1]}/${a[0]}`:s};
  const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
  const norm=s=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

  function parseMoney(s){
    if(!s)return 0;
    let x=clean(s).replace(/[^0-9,.-]/g,'');
    if(x.includes(',')&&x.includes('.'))x=x.replace(/\./g,'').replace(',','.');
    else if(x.includes(','))x=x.replace(',','.');
    return Number(x)||0;
  }
  function parseDate(s){
    const m=clean(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if(!m)return null;
    const y=m[3].length===2?'20'+m[3]:m[3];
    return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }
  function dateIn(s){return /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(s)}
  function valueIn(s){return /\d[\d.]*,\d{2}\b/.test(s)}

  // Datapar entrega el PDF como objetos de texto con coordenadas X/Y.
  // En vez de asumir coordenadas fijas, primero localizamos los encabezados reales
  // del propio PDF y calculamos automáticamente los límites de cada columna.
  const HEADER_KEYS=[
    ['responsable',['responsable']],
    ['titular',['titular']],
    ['ruc',['ruc/ci','ruc','ci']],
    ['banco',['banco']],
    ['cuenta',['cuenta']],
    ['cheque',['cheque']],
    ['emision',['emision']],
    ['recepcion',['recep','recepcion']],
    ['diferida',['diferid','diferida']],
    ['moneda',['mon']],
    ['valor',['valor']],
    ['situacion',['situacion']],
    ['movimiento',['movimiento']],
    ['vendedor',['vend.','vend']]
  ];

  function headerAnchors(groups){
    const anchors={};
    // El encabezado de Datapar puede ocupar dos renglones. Buscamos etiquetas
    // individualmente dentro de los primeros grupos del informe.
    for(const g of groups.slice(0,30)){
      for(const item of g.items){
        const t=norm(item.s);
        for(const [key,variants] of HEADER_KEYS){
          if(anchors[key]!=null)continue;
          if(variants.some(v=>t===v||t.startsWith(v)||t.includes(v))){anchors[key]=item.x;break}
        }
      }
    }
    return anchors;
  }

  function columnBounds(anchors){
    const entries=Object.entries(anchors).filter(([,x])=>Number.isFinite(x)).sort((a,b)=>a[1]-b[1]);
    const bounds=[];
    for(let i=0;i<entries.length;i++){
      const [key,x]=entries[i];
      const prev=entries[i-1]?.[1];
      const next=entries[i+1]?.[1];
      bounds.push({key,left:prev==null?x-40:(prev+x)/2,right:next==null?x+120:(x+next)/2});
    }
    return bounds;
  }

  function assignItems(items,bounds){
    const cells={};
    for(const it of items){
      let b=bounds.find(z=>it.x>=z.left&&it.x<z.right);
      if(!b){
        let best=null,dist=Infinity;
        for(const z of bounds){const d=Math.abs(it.x-(z.left+z.right)/2);if(d<dist){dist=d;best=z}}
        b=best;
      }
      if(!b)continue;
      cells[b.key]=clean(`${cells[b.key]||''} ${it.s}`);
    }
    return cells;
  }

  function parseDataparRows(groups){
    const anchors=headerAnchors(groups);
    const bounds=columnBounds(anchors);
    const out=[];
    for(const g of groups){
      const items=g.items;
      const all=clean(items.map(i=>i.s).join(' '));
      if(!all)continue;
      if(/^(pag:|filtros:|resumen|archivo:|total$|devuelto\s+us\$)/i.test(norm(all)))continue;
      if(/^(moneda|cuenta|fecha base|situacion)\s*:/i.test(norm(all)))continue;
      if(/titular.*banco.*cuenta.*cheque.*emisi/i.test(norm(all)))continue;

      // Una fila real debe contener fechas y un importe. Los resúmenes también
      // contienen importe, pero no contienen un número de cheque identificable.
      const cells=assignItems(items,bounds);
      const dates=[...all.matchAll(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g)].map(m=>m[0]);
      if(!dates.length||!valueIn(all))continue;

      let cheque=clean(cells.cheque||'');
      let titular=clean(cells.titular||'');
      let responsable=clean(cells.responsable||'');
      let ruc=clean(cells.ruc||'');
      let banco=clean(cells.banco||'');
      let cuenta=clean(cells.cuenta||'');
      let valor=parseMoney(cells.valor||'');

      // Fallback por texto cuando una celda PDF fue concatenada por PDF.js.
      if(!valor){
        const vm=all.match(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:US\$|USD|GS)?/i);
        if(vm)valor=parseMoney(vm[1]);
      }
      if(!cheque){
        // El cheque suele ser numérico y está entre Cuenta y Emisión. Si PDF.js
        // concatenó Cuenta+Cheque+Fecha, tomamos el bloque inmediatamente previo
        // a la primera fecha, excluyendo el código de cuenta.
        const firstDate=all.search(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);
        const pre=firstDate>=0?all.slice(0,firstDate):'';
        const nums=[...pre.matchAll(/\b\d{4,12}\b/g)].map(m=>m[0]);
        if(nums.length)cheque=nums[nums.length-1];
      }
      if(!titular){
        const dm=all.match(/(?:^|\d{3,12})([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .,&()'-]{3,})(?=\s+\(\d+\)|\s+[A-Z]+\s+BANK)/i);
        if(dm)titular=clean(dm[1]);
      }
      if(!responsable)responsable=titular||'SIN INFORMAR';

      const r={
        responsable,
        titular:titular||'SIN INFORMAR',
        ruc_ci_titular:ruc,
        banco,
        cuenta,
        numero_cheque:cheque,
        fecha_emision:parseDate(cells.emision||dates[0]),
        fecha_recepcion:parseDate(cells.recepcion||dates[1]||dates[0]),
        fecha_diferida:parseDate(cells.diferida||dates[2]||dates[1]||dates[0]),
        moneda:/GS|GUARAN[IÍ]ES/i.test(cells.moneda||all)?'GS':'USD',
        valor,
        valor_historico:parseMoney(cells.valor||''),
        situacion:'DEVUELTO',
        movimiento:clean(cells.movimiento||'DEVOLVIDO'),
        vendedor:clean(cells.vendedor||'')
      };
      if(r.numero_cheque&&r.valor>0&&(r.fecha_emision||r.fecha_recepcion||r.fecha_diferida))out.push(r);
    }
    return out;
  }

  async function extract(file){
    const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
    const groups=[];
    for(let p=1;p<=pdf.numPages;p++){
      const page=await pdf.getPage(p),c=await page.getTextContent();
      const items=c.items.map(i=>({s:clean(i.str),x:i.transform[4],y:i.transform[5]})).filter(i=>i.s);
      const pageGroups=[];
      for(const it of items){
        let g=pageGroups.find(a=>Math.abs(a.y-it.y)<3);
        if(!g){g={y:it.y,items:[]};pageGroups.push(g)}
        g.items.push(it);
      }
      pageGroups.sort((a,b)=>b.y-a.y).forEach(g=>groups.push(g));
    }
    return parseDataparRows(groups);
  }

  async function hash(file){
    const b=await file.arrayBuffer(),h=await crypto.subtle.digest('SHA-256',b);
    return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }

  async function load(){
    const {data,error}=await sb.from('cheque_documentos').select('*').eq('tipo','DEVUELTO').order('created_at',{ascending:false});
    if(error){console.error(error);if($('chequeStatus'))$('chequeStatus').textContent='No se pudo consultar el registro de cheques devueltos.';return}
    const rows=data||[],usd=rows.filter(x=>x.moneda==='USD'),gs=rows.filter(x=>x.moneda==='GS');
    $('chequeCount').textContent=rows.length;
    $('chequeUSD').textContent=money(usd.reduce((a,x)=>a+Number(x.valor||0),0),'USD');
    $('chequeGS').textContent=money(gs.reduce((a,x)=>a+Number(x.valor||0),0),'GS');
    $('chequeBody').innerHTML=rows.map(x=>`<tr><td>${esc(x.responsable)}</td><td>${esc(x.titular)}</td><td>${esc(x.ruc_ci_titular||'')}</td><td>${esc(x.banco||'')}</td><td>${esc(x.numero_cheque||'')}</td><td>${date(x.fecha_emision)}</td><td>${date(x.fecha_recepcion)}</td><td>${date(x.fecha_diferida)}</td><td>${money(x.valor,x.moneda)}</td><td>${esc(x.situacion||'DEVUELTO')}</td></tr>`).join('');
    $('chequeSearch').oninput=()=>{const q=$('chequeSearch').value.toLowerCase();document.querySelectorAll('#chequeBody tr').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?'':'none')};
  }

  async function importPdf(file){
    $('chequeStatus').textContent='Leyendo estructura y columnas del informe Datapar…';
    try{
      const rows=await extract(file);
      if(!rows.length){$('chequeStatus').textContent='No se detectaron filas válidas de cheques DEVUELTO. No se guardó información.';return}
      const h=await hash(file);
      const {data:imp,error:ie}=await sb.from('cheque_importaciones').insert({tipo:'DEVUELTO',nombre_archivo:file.name,fecha_base:new Date().toISOString().slice(0,10),hash_archivo:h}).select('id').single();
      if(ie){if(String(ie.message||'').toLowerCase().includes('duplicate'))throw new Error('Este PDF ya fue importado.');throw ie}
      const payload=rows.map(r=>({...r,importacion_id:imp.id,tipo:'DEVUELTO'}));
      const {error}=await sb.from('cheque_documentos').insert(payload);if(error)throw error;
      $('chequeStatus').textContent=`Importación correcta: ${rows.length} cheque(s) devuelto(s).`;
      await load();
    }catch(e){console.error(e);$('chequeStatus').textContent=`No se pudo importar: ${e.message||e}`}
  }

  window.initChequesDevueltos=()=>{if(!$('chequeFile'))return;$('chequeFile').onchange=e=>{const f=e.target.files[0];if(f)importPdf(f)};$('chequePrint').onclick=()=>window.print();load()};
})();
