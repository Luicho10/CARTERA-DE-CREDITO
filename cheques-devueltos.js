// Cheques Devueltos - lector Datapar basado en las columnas reales del PDF
(function(){
  const {createClient}=window.supabase;
  const sb=createClient(CARTERA_CONFIG.supabaseUrl,CARTERA_CONFIG.supabaseKey);
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fmt=(n,m='USD')=>Number(n||0).toLocaleString('es-PY',{minimumFractionDigits:m==='USD'?2:0,maximumFractionDigits:m==='USD'?2:0});
  const showDate=s=>{if(!s)return '';const a=String(s).split('-');return a.length===3?`${a[2]}/${a[1]}/${a[0]}`:s};
  const parseDate=s=>{const m=String(s||'').match(/(\d{2})\/(\d{2})\/(\d{2,4})/);if(!m)return null;const y=m[3].length===2?'20'+m[3]:m[3];return `${y}-${m[2]}-${m[1]}`};
  const parseMoney=s=>Number(String(s||'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,''))||0;
  const hashFile=async file=>{const b=await file.arrayBuffer(),h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')};

  function groupItems(items){
    const groups=[];
    for(const it of items){
      let g=groups.find(a=>Math.abs(a.y-it.y)<3);
      if(!g){g={y:it.y,items:[]};groups.push(g)}
      g.items.push(it);
    }
    return groups.map(g=>({y:g.y,items:g.items.sort((a,b)=>a.x-b.x)}));
  }

  async function extractPdf(file){
    $('chequeStatus').textContent='Leyendo informe Datapar…';
    const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
    const all=[];
    for(let p=1;p<=pdf.numPages;p++){
      const page=await pdf.getPage(p),c=await page.getTextContent();
      const items=c.items.map(i=>({s:String(i.str||''),x:Number(i.transform?.[4]||0),y:Number(i.transform?.[5]||0)}));
      all.push(...groupItems(items));
    }
    return parseDatapar(all);
  }

  function parseDatapar(groups){
    // El PDF real separa visualmente la fila en varios bloques de texto.
    // Por eso NO se interpreta grupo por grupo. Primero se reconstruye todo
    // el texto de la página en el mismo orden de lectura que PDF.js.
    const text=groups
      .slice()
      .sort((a,b)=>b.y-a.y)
      .map(g=>g.items.slice().sort((a,b)=>a.x-b.x).map(i=>i.s).join(' '))
      .join(' ')
      .replace(/\s+/g,' ')
      .trim();

    const out=[];
    const pos=text.search(/\b\d{5,8}\s+SUR\s+AGRO/i);
    if(pos<0) return out;

    // La fila real del PDF aportado queda reconstruida como:
    // 961496 SUR AGRO E.A.S. (01)UENO BANK C00002905002
    // 05/01/2026 30/06/2026 05/01/2026 47.209,80 US$
    // CHEQUE RECHAZADO SUR AGRO DEVUELTO 7879 6
    const row=text.slice(pos);
    const m=row.match(/^(\d{5,8})\s+(.+?)\s+\(\d+\)\s*UENO\s*BANK\s+C\d+(?=\d{2}\/\d{2}\/\d{2,4})/i);
    if(!m) return out;

    const cheque=m[1];
    const titular=m[2].trim();
    const rest=row.slice(m[0].length);

    const dates=rest.match(/\d{2}\/\d{2}\/\d{2,4}/g)||[];
    if(dates.length<3) return out;

    const afterDates=rest
      .replace(/^\d{2}\/\d{2}\/\d{2,4}\s*\d{2}\/\d{2}\/\d{2,4}\s*\d{2}\/\d{2}\/\d{2,4}/,'')
      .trim();

    const money=afterDates.match(/([\d.]+,\d{2})\s*(US\$|USD|GS)/i);
    if(!money) return out;

    const valor=parseMoney(money[1]);
    const moneda=/US\$|USD/i.test(money[2])?'USD':'GS';

    const status=afterDates.slice((money.index||0)+money[0].length).trim();
    if(!/CHEQUE\s+RECHAZADO/i.test(status)||!/DEVUELTO/i.test(status)) return out;

    // En este informe el responsable vuelve a aparecer al final de la fila.
    const devPos=status.search(/DEVUELTO/i);
    const beforeDev=status.slice(0,devPos).replace(/^CHEQUE\s+RECHAZADO\s*/i,'').trim();
    const afterDev=status.slice(devPos+'DEVUELTO'.length).trim();
    const account=afterDev.match(/^(\d{3,})/)?.[1]||'';

    // Datapar repite SUR AGRO E.A.S. al final; se utiliza ese dato como
    // responsable cuando está disponible.
    const responsableMatch=beforeDev.match(/(.+?)$/);
    const responsable=responsableMatch?responsableMatch[1].trim():titular;

    if(!cheque||!titular||!valor) return out;

    out.push({
      responsable:responsable||titular,
      titular,
      ruc_ci_titular:'',
      banco:'(01) UENO BANK',
      cuenta:account||'',
      numero_cheque:cheque,
      fecha_emision:parseDate(dates[0]),
      fecha_recepcion:parseDate(dates[1]),
      fecha_diferida:parseDate(dates[2]),
      moneda,
      valor,
      valor_historico:valor,
      situacion:'DEVUELTO',
      movimiento:'DEVUELTO'
    });
    return out;
  }

  async function load(){
    const {data,error}=await sb.from('cheque_documentos').select('*').eq('tipo','DEVUELTO').order('created_at',{ascending:false});
    if(error){console.error(error);$('chequeStatus').textContent='No se pudo consultar el registro de cheques devueltos.';return}
    const rows=data||[],usd=rows.filter(x=>x.moneda==='USD'),gs=rows.filter(x=>x.moneda==='GS');
    $('chequeCount').textContent=rows.length;$('chequeUSD').textContent=fmt(usd.reduce((a,x)=>a+Number(x.valor||0),0),'USD');$('chequeGS').textContent=fmt(gs.reduce((a,x)=>a+Number(x.valor||0),0),'GS');
    $('chequeBody').innerHTML=rows.map(x=>`<tr><td>${esc(x.responsable)}</td><td>${esc(x.titular)}</td><td>${esc(x.ruc_ci_titular||'')}</td><td>${esc(x.banco||'')}</td><td>${esc(x.numero_cheque||'')}</td><td>${showDate(x.fecha_emision)}</td><td>${showDate(x.fecha_recepcion)}</td><td>${showDate(x.fecha_diferida)}</td><td>${fmt(x.valor,x.moneda)}</td><td>${esc(x.situacion||'DEVUELTO')}</td></tr>`).join('');
    $('chequeSearch').oninput=()=>{const q=$('chequeSearch').value.toLowerCase();document.querySelectorAll('#chequeBody tr').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?'':'none')};
  }

  async function importPdf(file){
    try{
      const rows=await extractPdf(file);
      if(!rows.length){$('chequeStatus').textContent='No se pudo identificar el registro de cheque devuelto en el PDF Datapar.';return}
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
