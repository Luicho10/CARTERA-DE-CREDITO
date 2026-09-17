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

  // IMPORTANTE: en el PDF real de Datapar las coordenadas X están invertidas
  // respecto del orden visual de las columnas. Estas bandas fueron tomadas del
  // PDF real CHEQUE DEVUELTO.pdf cargado para la prueba.
  const BANDS={
    vendedor:[20,47],
    movimiento:[47,90],
    situacion:[90,128],
    historico:[128,178],
    valor:[178,210],
    moneda:[210,230],
    diferida:[225,265],
    recepcion:[258,295],
    emision:[292,330],
    cheque:[325,360],
    cuenta:[375,410],
    banco:[410,480],
    ruc:[480,535],
    titular:[610,710],
    responsable:[750,842]
  };
  function band(items,key){
    const [a,b]=BANDS[key];
    return clean(items.filter(i=>i.x>=a&&i.x<b).sort((u,v)=>u.x-v.x).map(i=>i.s).join(' '));
  }

  function parseRows(groups){
    const out=[];
    for(const g of groups){
      const items=g.items;
      const all=clean(items.map(i=>i.s).join(' '));
      if(!all)continue;
      const n=norm(all);
      if(/^(pag:|filtros:|resumen|archivo:|total$)/.test(n))continue;
      if(/^(moneda|cuenta|fecha base|situacion)\s*:/.test(n))continue;
      if(/titular.*banco.*cuenta.*cheque.*emision/i.test(n))continue;

      // La fila de detalle del Datapar tiene el número de cheque en su columna
      // y al menos una fecha + importe. Los resúmenes no tienen número de cheque.
      const cheque=band(items,'cheque').match(/\d{4,12}/)?.[0]||'';
      const dates=[...all.matchAll(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g)].map(m=>m[0]);
      const valor= parseMoney(band(items,'valor')) || parseMoney(band(items,'historico').match(/\d[\d.]*,\d{2}/)?.[0]||'');
      if(!cheque||!dates.length||valor<=0)continue;

      let titular=band(items,'titular');
      let responsable=band(items,'responsable');
      const ruc=band(items,'ruc');
      const banco=band(items,'banco');
      const cuenta=band(items,'cuenta');
      const emision=band(items,'emision')||dates[0];
      const recepcion=band(items,'recepcion')||dates[1]||dates[0];
      const diferida=band(items,'diferida')||dates[2]||dates[1]||dates[0];
      const moneda=/GS|GUARAN[IÍ]ES/i.test(band(items,'moneda'))?'GS':'USD';
      const situacion=clean(band(items,'situacion'))||'DEVUELTO';
      const movimiento=clean(`${band(items,'movimiento')} ${band(items,'historico').replace(/\d[\d.]*,\d{2}/,'')}`).trim()||'DEVOLVIDO';
      const vendedor=band(items,'vendedor');

      // En el formato real probado, Titular y Responsable son campos separados.
      // Si Datapar deja uno vacío, se conserva vacío; no se inventa información.
      if(!titular)titular='SIN INFORMAR';
      if(!responsable)responsable='SIN INFORMAR';

      out.push({
        responsable,
        titular,
        ruc_ci_titular:ruc,
        banco,
        cuenta,
        numero_cheque:cheque,
        fecha_emision:parseDate(emision),
        fecha_recepcion:parseDate(recepcion),
        fecha_diferida:parseDate(diferida),
        moneda,
        valor,
        valor_historico:valor,
        situacion:/DEVUELTO|DEVOLV|RECHAZ/i.test(`${situacion} ${movimiento}`)?'DEVUELTO':'DEVUELTO',
        movimiento:movementText(movimiento),
        vendedor
      });
    }
    return out;
  }

  function movementText(s){
    const t=clean(s);
    if(/CHEQUE\s+RECHAZADO/i.test(t))return 'CHEQUE RECHAZADO';
    if(/DEVOLVIDO/i.test(t))return 'DEVOLVIDO';
    return t||'DEVOLVIDO';
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
    return parseRows(groups);
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
    $('chequeStatus').textContent='Leyendo columnas del informe Datapar…';
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
