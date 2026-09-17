// Cheques Devueltos - lector basado en el mismo motor PDF utilizado por "1. Importar PDF"
(function(){
  const {createClient}=window.supabase;
  const sb=createClient(CARTERA_CONFIG.supabaseUrl,CARTERA_CONFIG.supabaseKey);
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fmt=(n,m='USD')=>Number(n||0).toLocaleString('es-PY',{minimumFractionDigits:m==='USD'?2:0,maximumFractionDigits:m==='USD'?2:0});
  const showDate=s=>{if(!s)return '';const a=String(s).split('-');return a.length===3?`${a[2]}/${a[1]}/${a[0]}`:s};
  const parseDate=s=>{const m=String(s||'').match(/(\d{2})\/(\d{2})\/(\d{2,4})/);if(!m)return null;const y=m[3].length===2?'20'+m[3]:m[3];return `${y}-${m[2]}-${m[1]}`};
  const parseMoney=s=>{if(!s)return 0;let x=String(s).replace(/\s/g,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,'');return Number(x)||0};
  const hashFile=async file=>{const b=await file.arrayBuffer(),h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')};

  // MISMO EXTRACTOR DE "1. IMPORTAR PDF": PDF.js -> items -> grupos por Y -> orden X.
  async function extractPdf(file){
    $('chequeStatus').textContent='Leyendo PDF y reconstruyendo filas…';
    const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
    let pages=[];
    for(let p=1;p<=pdf.numPages;p++){
      const page=await pdf.getPage(p),c=await page.getTextContent();
      const items=c.items.map(i=>({s:i.str,x:i.transform[4],y:i.transform[5]})),groups=[];
      for(const it of items){
        let g=groups.find(a=>Math.abs(a.y-it.y)<3);
        if(!g){g={y:it.y,items:[]};groups.push(g)}
        g.items.push(it);
      }
      pages.push(groups.sort((a,b)=>b.y-a.y).map(g=>g.items.sort((a,b)=>a.x-b.x).map(i=>i.s).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean).join('\n'));
    }
    return parseDataparCheques(pages.join('\n'));
  }

  // El PDF real entregado por Datapar tiene los campos del cheque concatenados.
  // Se trabaja sobre la misma línea que produce el lector de cartera y se ancla
  // la identificación en CHEQUE RECHAZADO + DEVOLVIDO + importe.
  function parseDataparCheques(text){
    const lines=text.split(/\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
    const out=[];
    for(const line of lines){
      if(!/CHEQUE\s*RECHAZADO/i.test(line)||!/DEVOLVIDO/i.test(line))continue;
      const amounts=line.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g)||[];
      const valor=amounts.length?parseMoney(amounts[amounts.length-1]):0;
      if(!valor)continue;
      const dates=[...line.matchAll(/\d{2}\/\d{2}\/\d{2,4}/g)].map(m=>m[0]);
      if(dates.length<2)continue;

      // Número de cheque: en el informe de prueba aparece al inicio de la fila.
      const first=line.match(/^(\d{5,8})/);
      const numero_cheque=first?first[1]:'';
      if(!numero_cheque)continue;

      // Titular y banco: conservar exactamente el nombre que Datapar imprime.
      let titular='';
      const tm=line.match(/^\d{5,8}\s+(.+?)\s+\(\d+\)\s*UENO\s+BANK/i);
      if(tm)titular=tm[1].trim();
      if(!titular){
        const tm2=line.match(/([A-ZÁÉÍÓÚÑ0-9 .&'-]+?\s+(?:S\.A\.|S\.R\.L\.|E\.A\.S\.|S\.A\.E\.))\s*\(\d+\)/i);
        if(tm2)titular=tm2[1].trim();
      }
      if(!titular)titular='SIN INFORMAR';

      const bm=line.match(/(\(\d+\)\s*[A-ZÁÉÍÓÚÑ0-9 .&'-]*BANK)/i);
      const banco=bm?bm[1].replace(/\s+/g,' ').trim():'';
      const cuentaMatch=line.match(/BANK\s+(C\d+)/i);
      const cuenta=cuentaMatch?cuentaMatch[1]:'';

      // En este reporte Datapar imprime Emisión / Recepción / Diferido.
      // Para el PDF entregado: 05/01/2026, 30/06/2026, 05/01/2026.
      // Conservamos el orden físico de las fechas que entrega el extractor.
      const fecha_emision=parseDate(dates[0]);
      const fecha_recepcion=parseDate(dates[1]);
      const fecha_diferida=parseDate(dates[2]||dates[1]);

      out.push({responsable:titular,titular,ruc_ci_titular:'',banco,cuenta,numero_cheque,fecha_emision,fecha_recepcion,fecha_diferida,moneda:/\bUS\$|\bUSD\b/i.test(line)?'USD':'GS',valor,valor_historico:valor,situacion:'DEVUELTO',movimiento:'DEVOLVIDO'});
    }
    const seen=new Set();
    return out.filter(r=>{const k=`${r.numero_cheque}|${r.valor}|${r.fecha_diferida}`;if(seen.has(k))return false;seen.add(k);return true});
  }

  async function load(){
    const {data,error}=await sb.from('cheque_documentos').select('*').eq('tipo','DEVUELTO').order('created_at',{ascending:false});
    if(error){console.error(error);$('chequeStatus').textContent='No se pudo consultar el registro de cheques devueltos.';return}
    const rows=data||[],usd=rows.filter(x=>x.moneda==='USD'),gs=rows.filter(x=>x.moneda==='GS');
    $('chequeCount').textContent=rows.length;
    $('chequeUSD').textContent=fmt(usd.reduce((a,x)=>a+Number(x.valor||0),0),'USD');
    $('chequeGS').textContent=fmt(gs.reduce((a,x)=>a+Number(x.valor||0),0),'GS');
    $('chequeBody').innerHTML=rows.map(x=>`<tr><td>${esc(x.responsable)}</td><td>${esc(x.titular)}</td><td>${esc(x.ruc_ci_titular||'')}</td><td>${esc(x.banco||'')}</td><td>${esc(x.numero_cheque||'')}</td><td>${showDate(x.fecha_emision)}</td><td>${showDate(x.fecha_recepcion)}</td><td>${showDate(x.fecha_diferida)}</td><td>${fmt(x.valor,x.moneda)}</td><td>${esc(x.situacion||'DEVUELTO')}</td></tr>`).join('');
    $('chequeSearch').oninput=()=>{const q=$('chequeSearch').value.toLowerCase();document.querySelectorAll('#chequeBody tr').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?'':'none')};
  }

  async function importPdf(file){
    try{
      const rows=await extractPdf(file);
      if(!rows.length){$('chequeStatus').textContent='El PDF fue leído, pero no se encontró una fila con CHEQUE RECHAZADO + DEVOLVIDO. No se guardó información.';return}
      const h=await hashFile(file);
      let {data:imp,error}=await sb.from('cheque_importaciones').select('id').eq('hash_archivo',h).maybeSingle();
      if(error)throw error;
      if(!imp){const r=await sb.from('cheque_importaciones').insert({tipo:'DEVUELTO',nombre_archivo:file.name,fecha_base:new Date().toISOString().slice(0,10),hash_archivo:h}).select('id').single();if(r.error)throw r.error;imp=r.data}
      const ex=await sb.from('cheque_documentos').select('numero_cheque,valor,fecha_diferida').eq('importacion_id',imp.id).eq('tipo','DEVUELTO');
      if(ex.error)throw ex.error;
      const keys=new Set((ex.data||[]).map(x=>`${x.numero_cheque}|${Number(x.valor||0)}|${x.fecha_diferida||''}`));
      const nuevos=rows.filter(r=>!keys.has(`${r.numero_cheque}|${Number(r.valor||0)}|${r.fecha_diferida||''}`));
      if(nuevos.length){const r=await sb.from('cheque_documentos').insert(nuevos.map(x=>({...x,importacion_id:imp.id,tipo:'DEVUELTO'})));if(r.error)throw r.error}
      $('chequeStatus').textContent=`Importación correcta: ${nuevos.length||rows.length} cheque(s) devuelto(s).`;
      await load();
    }catch(e){console.error(e);$('chequeStatus').textContent=`No se pudo importar: ${e.message||e}`}
  }
  window.initChequesDevueltos=()=>{if(!$('chequeFile'))return;$('chequeFile').onchange=e=>{const f=e.target.files[0];if(f)importPdf(f)};$('chequePrint').onclick=()=>window.print();load()};
})();
