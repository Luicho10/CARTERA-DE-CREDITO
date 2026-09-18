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
    /*
      Se usa la posición X de las columnas del informe real de Datapar.
      En el PDF probado las columnas están en:
      Responsable 30 | Titular 172 | Banco 376 | Cuenta 440 |
      Cheque 494 | Emisión 525 | Recepción 562 | Diferido 590 |
      Valor 647 | Situación 722 | Movimiento 758 | Vend. 798.
      Esto evita interpretar C00002905002 como cuenta: en realidad aparece
      en la columna Movimiento. La cuenta real del registro es 7879.
    */
    const out=[];
    for(const g of groups){
      const its=g.items;
      const rowText=its.map(i=>i.s).join(' ').replace(/\s+/g,' ').trim();
      if(!/\d{5,8}/.test(rowText))continue;
      // Datapar superpone parte de Situación/Movimiento sobre Valor en este informe.
      // La fila sigue siendo válida cuando contiene CHEQUE RECHAZADO; el encabezado
      // del PDF ya fue validado como informe de Situación DEVUELTO.

      const inRange=(a,b)=>its.filter(i=>i.x>=a&&i.x<b);
      const textRange=(a,b)=>inRange(a,b).map(i=>i.s).join(' ').replace(/\s+/g,' ').trim();
      const responsable=textRange(20,150);
      const titular=textRange(150,300);
      const banco=textRange(365,420);
      const cuenta=textRange(420,480).match(/\d{3,}/)?.[0]||'';
      const cheque=textRange(480,515).match(/^\d{5,8}$/)?.[0]||textRange(480,515).match(/\d{5,8}/)?.[0]||'';
      const dateText=textRange(510,615);
      const dates=dateText.match(/\d{2}\/\d{2}\/\d{2,4}/g)||[];
      const valueText=textRange(615,710);
      const amount=valueText.match(/[\d.]+,\d{2}/)?.[0]||'';
      const valor=parseMoney(amount);
      const currency=/US\$|USD/i.test(dateText+' '+valueText)?'USD':'GS';
      const rejected=/RECHAZADO/i.test(rowText);
      if(!responsable||!titular||!banco||!cuenta||!cheque||dates.length<3||!valor||!rejected)continue;

      out.push({
        responsable,
        titular,
        ruc_ci_titular:'',
        banco,
        cuenta,
        numero_cheque:cheque,
        fecha_emision:parseDate(dates[0]),
        fecha_recepcion:parseDate(dates[1]),
        fecha_diferida:parseDate(dates[2]),
        moneda:currency,
        valor,
        valor_historico:valor,
        situacion:'DEVUELTO',
        movimiento:'DEVUELTO'
      });
    }
    const seen=new Set();
    return out.filter(r=>{const k=`${r.numero_cheque}|${r.valor}|${r.fecha_diferida}`;if(seen.has(k))return false;seen.add(k);return true});
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
