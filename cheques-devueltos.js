// Cheques Devueltos - lector Datapar
(function(){
  const {createClient}=window.supabase;
  const sb=createClient(CARTERA_CONFIG.supabaseUrl,CARTERA_CONFIG.supabaseKey);
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fmt=(n,m='USD')=>Number(n||0).toLocaleString('es-PY',{minimumFractionDigits:m==='USD'?2:0,maximumFractionDigits:m==='USD'?2:0});
  const showDate=s=>{if(!s)return '';const a=String(s).split('-');return a.length===3?`${a[2]}/${a[1]}/${a[0]}`:s};
  const parseDate=s=>{const m=String(s||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(!m)return null;const y=m[3].length===2?'20'+m[3]:m[3];return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`};
  const parseMoney=s=>Number(String(s||'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,''))||0;
  const hashFile=async file=>{const b=await file.arrayBuffer(),h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')};

  async function extractPdf(file){
    $('chequeStatus').textContent='Leyendo PDF Datapar…';
    const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
    const lines=[];
    for(let p=1;p<=pdf.numPages;p++){
      const page=await pdf.getPage(p),c=await page.getTextContent(),items=c.items.map(i=>({s:String(i.str||''),x:Number(i.transform?.[4]||0),y:Number(i.transform?.[5]||0)})),groups=[];
      for(const it of items){let g=groups.find(a=>Math.abs(a.y-it.y)<3);if(!g){g={y:it.y,items:[]};groups.push(g)}g.items.push(it)}
      for(const g of groups){g.items.sort((a,b)=>a.x-b.x);const row=g.items.map(i=>i.s).join(' ').replace(/\s+/g,' ').trim();if(row)lines.push(row)}
    }
    return parseDatapar(lines);
  }

  function parseDatapar(lines){
    // Se analiza la FILA del detalle, no el encabezado ni los resúmenes.
    // Esta es la estructura que entrega el PDF real:
    // 961496 SUR AGRO E.A.S. (01) UENO BANK 7879 05/01/2026 05/01/2026 30/06/2026 US$ 47.209,80 CHEQUE RECHAZADO SUR AGRO DEVOLVIDO C00002905002 6
    for(const line of lines){
      if(!/CHEQUE\s+RECHAZADO/i.test(line)||!/DEVUELTO/i.test(line))continue;
      const m=line.match(/^(\d{5,8})\s+(.+?)\s+\((\d+)\)\s*([A-ZÁÉÍÓÚÑ0-9 .&'\-]*?BANK)\s+(\d+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(US\$|USD|GS\$|GS)\s+([\d.]+,\d{2})\s+CHEQUE\s+RECHAZADO\s+(.+?)\s+DEVUELTO/i);
      if(!m)continue;
      const titular=m[2].trim();
      const valor=parseMoney(m[10]);
      if(!titular||!valor)continue;
      return [{
        responsable:titular,
        titular,
        ruc_ci_titular:'',
        banco:m[4].replace(/\s+/g,' ').trim(),
        cuenta:m[5],
        numero_cheque:m[1],
        fecha_emision:parseDate(m[6]),
        fecha_recepcion:parseDate(m[7]),
        fecha_diferida:parseDate(m[8]),
        moneda:/US\$|USD/i.test(m[9])?'USD':'GS',
        valor,
        valor_historico:valor,
        situacion:'DEVUELTO',
        movimiento:'DEVUELTO'
      }];
    }
    return [];
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
      if(!rows.length){$('chequeStatus').textContent='El PDF fue leído, pero no se encontró la fila de cheque devuelto. No se guardó información.';return}
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
