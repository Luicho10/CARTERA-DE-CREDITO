// Módulo Crédito: Cheques Devueltos Datapar
// Solo registra cheques devueltos. No administra cheques en cartera ni cheques en banco.
(function(){
  const sb=window.supabase.createClient(CARTERA_CONFIG.supabaseUrl,CARTERA_CONFIG.supabaseKey);
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const money=(n,m='USD')=>Number(n||0).toLocaleString('es-PY',{minimumFractionDigits:m==='USD'?2:0,maximumFractionDigits:m==='USD'?2:0});
  const date=s=>{if(!s)return '';const a=String(s).split('-');return a.length===3?`${a[2]}/${a[1]}/${a[0]}`:s};
  function parseMoney(s){if(!s)return 0;let x=String(s).replace(/\s/g,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,'');return Number(x)||0}
  function parseDate(s){const m=String(s||'').match(/(\d{2})\/(\d{2})\/(\d{2,4})/);if(!m)return null;const y=m[3].length===2?'20'+m[3]:m[3];return `${y}-${m[2]}-${m[1]}`}
  async function extract(file){
    const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;let pages=[];
    for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p),c=await page.getTextContent(),items=c.items.map(i=>({s:i.str,x:i.transform[4],y:i.transform[5]})),groups=[];
      for(const it of items){let g=groups.find(a=>Math.abs(a.y-it.y)<3);if(!g){g={y:it.y,items:[]};groups.push(g)}g.items.push(it)}
      pages.push(groups.sort((a,b)=>b.y-a.y).map(g=>g.items.sort((a,b)=>a.x-b.x).map(i=>i.s).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean).join('\n'))}
    return parse(pages.join('\n'));
  }
  function parse(text){
    const lines=text.split(/\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);let responsable='SIN INFORMAR',out=[];
    // Parser flexible: conserva líneas completas si el diseño de Datapar cambia.
    for(let i=0;i<lines.length;i++){
      const l=lines[i];const rm=l.match(/^RESPONSABLE:\s*(.*)$/i);if(rm){responsable=rm[1].trim()||'SIN INFORMAR';continue}
      const vm=l.match(/^VENDEDOR:\s*(.*)$/i);if(vm){responsable=vm[1].trim()||'SIN INFORMAR';continue}
      const m=l.match(/^(.*?)\s+(\d{3}-\d{3}-\d{7}|\d{4,})\s+(\d{2}\/\d{2}\/\d{2,4})\s+([\d.,-]+)$/);
      if(m)out.push({responsable,titular:m[1].trim(),numero_cheque:m[2],fecha_diferida:parseDate(m[3]),valor:parseMoney(m[4]),moneda:'USD'});
    }
    return out;
  }
  async function hash(file){const b=await file.arrayBuffer(),h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}
  async function load(){
    const {data,error}=await sb.from('cheque_documentos').select('*').eq('tipo','DEVUELTO').order('created_at',{ascending:false});
    if(error){console.error(error);return}
    const rows=data||[];let usd=rows.filter(x=>x.moneda==='USD'),gs=rows.filter(x=>x.moneda!=='USD');
    $('chequeCount').textContent=rows.length;$('chequeUSD').textContent=money(usd.reduce((a,x)=>a+Number(x.valor||0),0),'USD');$('chequeGS').textContent=money(gs.reduce((a,x)=>a+Number(x.valor||0),0),'GS');
    $('chequeBody').innerHTML=rows.map(x=>`<tr><td>${esc(x.responsable)}</td><td>${esc(x.titular)}</td><td>${esc(x.ruc_ci_titular||'')}</td><td>${esc(x.banco||'')}</td><td>${esc(x.numero_cheque||'')}</td><td>${date(x.fecha_emision)}</td><td>${date(x.fecha_recepcion)}</td><td>${date(x.fecha_diferida)}</td><td>${money(x.valor,x.moneda)}</td><td>${esc(x.situacion||'DEVUELTO')}</td></tr>`).join('');
    $('chequeSearch').oninput=()=>{const q=$('chequeSearch').value.toLowerCase();document.querySelectorAll('#chequeBody tr').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?'':'none')};
  }
  async function importPdf(file){
    $('chequeStatus').textContent='Leyendo informe de cheques devueltos…';
    try{const rows=await extract(file);if(!rows.length){$('chequeStatus').textContent='No se detectaron registros. Revisar el formato del PDF Datapar.';return}
      const h=await hash(file);const {data:imp,error:ie}=await sb.from('cheque_importaciones').insert({tipo:'DEVUELTO',nombre_archivo:file.name,fecha_base:new Date().toISOString().slice(0,10),hash_archivo:h}).select('id').single();
      if(ie){if(String(ie.message||'').toLowerCase().includes('duplicate'))throw new Error('Este PDF ya fue importado.');throw ie}
      const payload=rows.map(r=>({...r,importacion_id:imp.id,tipo:'DEVUELTO'}));const {error}=await sb.from('cheque_documentos').insert(payload);if(error)throw error;
      $('chequeStatus').textContent=`Importación correcta: ${rows.length} cheque(s) devuelto(s).`;await load();
    }catch(e){console.error(e);$('chequeStatus').textContent=`No se pudo importar: ${e.message||e}`}
  }
  window.initChequesDevueltos=()=>{if(!$('chequeFile'))return;$('chequeFile').onchange=e=>{const f=e.target.files[0];if(f)importPdf(f)};$('chequePrint').onclick=()=>window.print();load()};
})();
