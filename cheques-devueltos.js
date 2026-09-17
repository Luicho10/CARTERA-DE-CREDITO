// Lector Datapar - Cheques Recibidos / Situación DEVUELTO
// Parser por fila de texto: no depende de coordenadas de columnas ni de la rotación A4 del PDF.
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
    // Fila válida de Datapar: contiene simultáneamente el rechazo y el movimiento DEVOLVIDO.
    if(!/CHEQUE\s*RECHAZADO/i.test(text)||!/DEVOLVIDO/i.test(text))return null;

    const valor=parseMoney(text);
    const dates=[...text.matchAll(dateRe)].map(x=>x[0]);
    if(!valor||dates.length<2)return null;

    // No asumir que el cheque es el primer elemento. La extracción PDF.js puede
    // ordenar los objetos de texto por coordenada y dejarlo en medio de la fila.
    const nums=[...text.matchAll(/(?:^|\D)(\d{5,8})(?=\D|$)/g)].map(m=>m[1]);
    const cheque=nums.find(n=>n.length>=6)||nums[0]||'';
    if(!cheque)return null;

    // Titular: en el informe real aparece dos veces como SUR AGRO E.A.S.;
    // tomamos el primer nombre que precede al banco.
    const bankMatch=text.match(/(\(\d+\)\s*[A-ZÁÉÍÓÚÑ0-9 .&'-]*BANK)/i);
    const banco=bankMatch?clean(bankMatch[1]):'';
    let titular='SIN INFORMAR';
    if(bankMatch){
      const pre=clean(text.slice(0,bankMatch.index));
      const mTit=pre.match(/([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .&'-]{2,})/i);
      if(mTit)titular=clean(mTit[1]);
    }
    if(titular==='SIN INFORMAR'){
      const m=text.match(/([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .&'-]+?\s+(?:S\.A\.|S\.R\.L\.|E\.A\.S\.|S\.A\.E\.))/i);
      if(m)titular=clean(m[1]);
    }

    // Cuenta: normalmente es el número de 4-12 dígitos inmediatamente después del banco.
    let cuenta='';
    if(bankMatch){
      const after=text.slice(bankMatch.index+bankMatch[0].length);
      const cm=after.match(/(?:^|\s)(\d{4,12})(?=\s|\d{1,2}\/)/);
      if(cm)cuenta=cm[1];
    }

    // El informe de prueba tiene tres fechas en este orden: emisión, recepción y diferido.
    const moneda=/\bGS\b|GUARAN[IÍ]ES/i.test(text)?'GS':'USD';
    const situacion=/CHEQUE\s*RECHAZADO/i.test(text)?'DEVUELTO':'DEVUELTO';
    const movimiento='DEVOLVIDO';

    return {
      responsable:titular,
      titular,
      ruc_ci_titular:'',
      banco,
      cuenta,
      numero_cheque:cheque,
      fecha_emision:parseDate(dates[0]),
      fecha_recepcion:parseDate(dates[1]),
      fecha_diferida:parseDate(dates[2]||dates[1]),
      moneda,
      valor,
      valor_historico:valor,
      situacion,
      movimiento,
      vendedor:''
    };
  }

  async function extract(file){
    const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
    const result=[];

    for(let p=1;p<=pdf.numPages;p++){
      const page=await pdf.getPage(p);
      const c=await page.getTextContent();
      const items=c.items.map(i=>({s:clean(i.str),x:i.transform[4],y:i.transform[5]})).filter(i=>i.s);

      // Agrupación tolerante de una misma fila. No se usa x para decidir qué columna es qué.
      const rows=[];
      for(const it of items){
        let row=rows.find(r=>Math.abs(r.y-it.y)<8);
        if(!row){row={y:it.y,items:[]};rows.push(row)}
        row.items.push(it);
      }
      for(const row of rows){
        const text=row.items.sort((a,b)=>a.x-b.x).map(i=>i.s).join(' ');
        const parsed=parseRow(text);
        if(parsed)result.push(parsed);
      }
    }

    const seen=new Set();
    return result.filter(r=>{
      const k=`${r.numero_cheque}|${r.valor}|${r.fecha_diferida}`;
      if(seen.has(k))return false;
      seen.add(k);return true;
    });
  }

  async function hash(file){const h=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}

  async function load(){
    const {data,error}=await sb.from('cheque_documentos').select('*').eq('tipo','DEVUELTO').order('created_at',{ascending:false});
    if(error){console.error(error);$('chequeStatus').textContent='No se pudo consultar el registro de cheques devueltos.';return}
    const rows=data||[],usd=rows.filter(x=>x.moneda==='USD'),gs=rows.filter(x=>x.moneda==='GS');
    $('chequeCount').textContent=rows.length;
    $('chequeUSD').textContent=money(usd.reduce((a,x)=>a+Number(x.valor||0),0),'USD');
    $('chequeGS').textContent=money(gs.reduce((a,x)=>a+Number(x.valor||0),0),'GS');
    $('chequeBody').innerHTML=rows.map(x=>`<tr><td>${esc(x.responsable)}</td><td>${esc(x.titular)}</td><td>${esc(x.ruc_ci_titular||'')}</td><td>${esc(x.banco||'')}</td><td>${esc(x.numero_cheque||'')}</td><td>${date(x.fecha_emision)}</td><td>${date(x.fecha_recepcion)}</td><td>${date(x.fecha_diferida)}</td><td>${money(x.valor,x.moneda)}</td><td>${esc(x.situacion||'DEVUELTO')}</td></tr>`).join('');
    $('chequeSearch').oninput=()=>{const q=$('chequeSearch').value.toLowerCase();document.querySelectorAll('#chequeBody tr').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?'':'none')};
  }

  async function importPdf(file){
    $('chequeStatus').textContent='Leyendo PDF Datapar…';
    try{
      const rows=await extract(file);
      if(!rows.length){$('chequeStatus').textContent='No se detectó una fila DEVUELTO válida en este PDF.';return}
      const h=await hash(file);
      const {data:imp,error:ie}=await sb.from('cheque_importaciones').insert({tipo:'DEVUELTO',nombre_archivo:file.name,fecha_base:new Date().toISOString().slice(0,10),hash_archivo:h}).select('id').single();
      if(ie){if(String(ie.message||'').toLowerCase().includes('duplicate'))throw new Error('Este PDF ya fue importado.');throw ie}
      const {error}=await sb.from('cheque_documentos').insert(rows.map(r=>({...r,importacion_id:imp.id,tipo:'DEVUELTO'})));
      if(error)throw error;
      $('chequeStatus').textContent=`Importación correcta: ${rows.length} cheque(s) devuelto(s).`;
      await load();
    }catch(e){console.error(e);$('chequeStatus').textContent=`No se pudo importar: ${e.message||e}`}
  }

  window.initChequesDevueltos=()=>{
    if(!$('chequeFile'))return;
    $('chequeFile').onchange=e=>{const f=e.target.files[0];if(f)importPdf(f)};
    $('chequePrint').onclick=()=>window.print();
    load();
  };
})();
