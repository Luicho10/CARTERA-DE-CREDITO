// Lector específico Datapar - Cheques Recibidos / Situación DEVUELTO
(function(){
  const sb=window.supabase.createClient(CARTERA_CONFIG.supabaseUrl,CARTERA_CONFIG.supabaseKey);
  const $=id=>document.getElementById(id);
  const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
  const norm=s=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const money=(n,m)=>Number(n||0).toLocaleString('es-PY',{minimumFractionDigits:m==='USD'?2:0,maximumFractionDigits:m==='USD'?2:0});
  const date=s=>{if(!s)return '';const a=String(s).split('-');return a.length===3?`${a[2]}/${a[1]}/${a[0]}`:s};
  const dateRe=/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;
  // Importante: el PDF concatena "47.209,80CHEQUE", por eso no hay \b al final.
  const amountRe=/\b\d{1,3}(?:\.\d{3})*,\d{2}/;
  function parseDate(s){const m=String(s||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(!m)return null;const y=m[3].length===2?'20'+m[3]:m[3];return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`}
  function parseMoney(s){const m=String(s||'').match(amountRe);if(!m)return 0;return Number(m[0].replace(/\./g,'').replace(',','.'))||0}

  // Coordenadas verificadas contra el PDF real de 842 x 595 puntos.
  const B={responsable:[20,100],titular:[155,235],ruc:[295,365],banco:[365,435],cuenta:[435,485],cheque:[485,520],emision:[512,549],recepcion:[549,583],diferida:[583,632],valor:[632,721],situacion:[721,758],movimiento:[758,798],vendedor:[798,830]};
  function band(items,k){const [a,b]=B[k];return clean(items.filter(i=>i.x>=a&&i.x<b).sort((u,v)=>u.x-v.x).map(i=>i.s).join(' '))}

  function parseRows(groups){
    const out=[];
    for(const g of groups){
      const items=g.items, all=clean(items.map(i=>i.s).join(' ')), n=norm(all);
      if(!all)continue;
      if(/^(pag:|filtros:|resumen|archivo:|total$)/.test(n)||/^(moneda|cuenta|fecha base|situacion)\s*:/.test(n))continue;
      if(/responsable.*titular.*ruc\/ci.*banco.*cuenta.*cheque/i.test(n))continue;
      const cheque=(band(items,'cheque').match(/\d{4,12}/)||[])[0]||'';
      const dates=[...all.matchAll(dateRe)].map(m=>m[0]);
      const valor=parseMoney(all);
      if(!cheque||!dates.length||!valor)continue;

      const titular=band(items,'titular')||'SIN INFORMAR';
      const responsable=band(items,'responsable')||titular;
      const banco=band(items,'banco');
      const cuenta=band(items,'cuenta');
      const ruc=band(items,'ruc');
      const emision=band(items,'emision')||dates[0];
      const recepcion=band(items,'recepcion')||dates[1]||dates[0];
      const difCell=band(items,'diferida');
      const difDates=[...difCell.matchAll(dateRe)].map(m=>m[0]);
      const diferida=difDates[0]||dates[2]||dates[1]||dates[0];
      const moneda=/\bGS\b|GUARAN[IÍ]ES/i.test(all)?'GS':'USD';
      const movimiento=/DEVOLVIDO/i.test(all)?'DEVOLVIDO':'DEVUELTO';

      out.push({responsable,titular,ruc_ci_titular:ruc,banco,cuenta,numero_cheque:cheque,fecha_emision:parseDate(emision),fecha_recepcion:parseDate(recepcion),fecha_diferida:parseDate(diferida),moneda,valor,valor_historico:valor,situacion:'DEVUELTO',movimiento,vendedor:band(items,'vendedor')});
    }
    const seen=new Set();
    return out.filter(r=>{const k=`${r.numero_cheque}|${r.valor}|${r.fecha_diferida}`;if(seen.has(k))return false;seen.add(k);return true});
  }

  async function extract(file){
    const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise,groups=[];
    for(let p=1;p<=pdf.numPages;p++){
      const page=await pdf.getPage(p),c=await page.getTextContent(),pg=[];
      for(const i of c.items){const s=clean(i.str);if(!s)continue;const x=i.transform[4],y=i.transform[5];let g=pg.find(z=>Math.abs(z.y-y)<3);if(!g){g={y,items:[]};pg.push(g)}g.items.push({s,x,y})}
      pg.sort((a,b)=>b.y-a.y).forEach(g=>{g.items.sort((a,b)=>a.x-b.x);groups.push(g)});
    }
    return parseRows(groups);
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
    try{
      const rows=await extract(file);
      if(!rows.length){$('chequeStatus').textContent='No se detectó el registro de cheque devuelto en este PDF.';return}
      const h=await hash(file);
      const {data:imp,error:ie}=await sb.from('cheque_importaciones').insert({tipo:'DEVUELTO',nombre_archivo:file.name,fecha_base:new Date().toISOString().slice(0,10),hash_archivo:h}).select('id').single();
      if(ie){if(String(ie.message||'').toLowerCase().includes('duplicate'))throw new Error('Este PDF ya fue importado.');throw ie}
      const {error}=await sb.from('cheque_documentos').insert(rows.map(r=>({...r,importacion_id:imp.id,tipo:'DEVUELTO'})));if(error)throw error;
      $('chequeStatus').textContent=`Importación correcta: ${rows.length} cheque(s) devuelto(s).`;await load();
    }catch(e){console.error(e);$('chequeStatus').textContent=`No se pudo importar: ${e.message||e}`}
  }
  window.initChequesDevueltos=()=>{if(!$('chequeFile'))return;$('chequeFile').onchange=e=>{const f=e.target.files[0];if(f)importPdf(f)};$('chequePrint').onclick=()=>window.print();load()};
})();
