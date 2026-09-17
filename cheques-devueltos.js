// Lector Datapar - Cheques Recibidos / Situación DEVUELTO
(function(){
  const sb=window.supabase.createClient(CARTERA_CONFIG.supabaseUrl,CARTERA_CONFIG.supabaseKey);
  const $=id=>document.getElementById(id);
  const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const money=(n,m)=>Number(n||0).toLocaleString('es-PY',{minimumFractionDigits:m==='USD'?2:0,maximumFractionDigits:m==='USD'?2:0});
  const date=s=>{if(!s)return '';const a=String(s).split('-');return a.length===3?`${a[2]}/${a[1]}/${a[0]}`:s};
  const dateRe=/\d{1,2}\/\d{1,2}\/\d{2,4}/g;
  const amountRe=/\d{1,3}(?:\.\d{3})*,\d{2}/;
  function parseDate(s){const m=String(s||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(!m)return null;const y=m[3].length===2?'20'+m[3]:m[3];return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`}
  function parseMoney(s){const m=String(s||'').match(amountRe);return m?Number(m[0].replace(/\./g,'').replace(',','.')):0}

  function parseRow(all){
    const text=clean(all);
    if(!/CHEQUE\s*RECHAZADO/i.test(text)||!/DEVOLVIDO/i.test(text))return null;
    const valor=parseMoney(text);if(!valor)return null;
    const dates=[...text.matchAll(dateRe)].map(x=>x[0]);if(dates.length<2)return null;

    // En Datapar el primer bloque numérico de 4-12 dígitos es el cheque.
    // En el PDF probado: 961496 SUR AGRO E.A.S. (01) UENO BANK 7879 ...
    const mCheque=text.match(/^(\d{4,12})(.*)$/);if(!mCheque)return null;
    const cheque=mCheque[1],rest=mCheque[2];
    const bankPos=rest.search(/\(\d+\)/);
    let titular='SIN INFORMAR',banco='',cuenta='';
    if(bankPos>=0){
      titular=clean(rest.slice(0,bankPos));
      const tail=rest.slice(bankPos);
      const bankMatch=tail.match(/^\((\d+)\)\s*([A-ZÁÉÍÓÚÑ0-9 .&'-]+?)(?=\d{4,12}\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if(bankMatch){banco=clean(`(${bankMatch[1]}) ${bankMatch[2]}`);const after=tail.slice(bankMatch[0].length);const cm=after.match(/\d{4,12}/);if(cm)cuenta=cm[0];}
    }
    // Extraemos las fechas por su orden real en la fila.
    const moneda=/\bGS\b|GUARAN[IÍ]ES/i.test(text)?'GS':'USD';
    const vendorMatch=text.match(/DEVOLVIDO([A-ZÁÉÍÓÚÑ .&'-]+?)C\d/i);
    return {responsable:titular,titular,ruc_ci_titular:'',banco,cuenta,numero_cheque:cheque,fecha_emision:parseDate(dates[0]),fecha_recepcion:parseDate(dates[1]),fecha_diferida:parseDate(dates[2]||dates[1]),moneda,valor,valor_historico:valor,situacion:'DEVUELTO',movimiento:'DEVOLVIDO',vendedor:vendorMatch?clean(vendorMatch[1]):''};
  }

  async function extract(file){
    const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise,groups=[];
    for(let p=1;p<=pdf.numPages;p++){
      const page=await pdf.getPage(p),c=await page.getTextContent(),items=c.items.map(i=>({s:clean(i.str),x:i.transform[4],y:i.transform[5]})).filter(i=>i.s),pg=[];
      for(const it of items){let g=pg.find(z=>Math.abs(z.y-it.y)<6);if(!g){g={y:it.y,items:[]};pg.push(g)}g.items.push(it)}
      pg.sort((a,b)=>b.y-a.y);
      for(const g of pg){g.items.sort((a,b)=>a.x-b.x);const row=parseRow(g.items.map(i=>i.s).join(' '));if(row)groups.push(row)}
    }
    const seen=new Set();return groups.filter(r=>{const k=`${r.numero_cheque}|${r.valor}|${r.fecha_diferida}`;if(seen.has(k))return false;seen.add(k);return true});
  }
  async function hash(file){const h=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}
  async function load(){
    const {data,error}=await sb.from('cheque_documentos').select('*').eq('tipo','DEVUELTO').order('created_at',{ascending:false});
    if(error){console.error(error);$('chequeStatus').textContent='No se pudo consultar el registro de cheques devueltos.';return}
    const rows=data||[],usd=rows.filter(x=>x.moneda==='USD'),gs=rows.filter(x=>x.moneda==='GS');
    $('chequeCount').textContent=rows.length;$('chequeUSD').textContent=money(usd.reduce((a,x)=>a+Number(x.valor||0),0),'USD');$('chequeGS').textContent=money(gs.reduce((a,x)=>a+Number(x.valor||0),0),'GS');
    $('chequeBody').innerHTML=rows.map(x=>`<tr><td>${esc(x.responsable)}</td><td>${esc(x.titular)}</td><td>${esc(x.ruc_ci_titular||'')}</td><td>${esc(x.banco||'')}</td><td>${esc(x.numero_cheque||'')}</td><td>${date(x.fecha_emision)}</td><td>${date(x.fecha_recepcion)}</td><td>${date(x.fecha_diferida)}</td><td>${money(x.valor,x.moneda)}</td><td>${esc(x.situacion||'DEVUELTO')}</td></tr>`).join('');
    $('chequeSearch').oninput=()=>{const q=$('chequeSearch').value.toLowerCase();document.querySelectorAll('#chequeBody tr').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?'':'none')};
  }
  async function importPdf(file){
    $('chequeStatus').textContent='Leyendo PDF Datapar…';
    try{const rows=await extract(file);if(!rows.length){$('chequeStatus').textContent='No se detectó una fila DEVUELTO válida en este PDF.';return}
      const h=await hash(file);const {data:imp,error:ie}=await sb.from('cheque_importaciones').insert({tipo:'DEVUELTO',nombre_archivo:file.name,fecha_base:new Date().toISOString().slice(0,10),hash_archivo:h}).select('id').single();
      if(ie){if(String(ie.message||'').toLowerCase().includes('duplicate'))throw new Error('Este PDF ya fue importado.');throw ie}
      const {error}=await sb.from('cheque_documentos').insert(rows.map(r=>({...r,importacion_id:imp.id,tipo:'DEVUELTO'})));if(error)throw error;
      $('chequeStatus').textContent=`Importación correcta: ${rows.length} cheque(s) devuelto(s).`;await load();
    }catch(e){console.error(e);$('chequeStatus').textContent=`No se pudo importar: ${e.message||e}`}
  }
  window.initChequesDevueltos=()=>{if(!$('chequeFile'))return;$('chequeFile').onchange=e=>{const f=e.target.files[0];if(f)importPdf(f)};$('chequePrint').onclick=()=>window.print();load()};
})();
