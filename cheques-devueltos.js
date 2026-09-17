// Módulo Crédito: Cheques Devueltos Datapar
// Lector específico del informe "Cheques Recibidos" de Datapar.
// Solo registra la situación DEVUELTO.
(function(){
  const sb=window.supabase.createClient(CARTERA_CONFIG.supabaseUrl,CARTERA_CONFIG.supabaseKey);
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const money=(n,m='USD')=>Number(n||0).toLocaleString('es-PY',{minimumFractionDigits:m==='USD'?2:0,maximumFractionDigits:m==='USD'?2:0});
  const date=s=>{if(!s)return '';const a=String(s).split('-');return a.length===3?`${a[2]}/${a[1]}/${a[0]}`:s};
  const clean=s=>String(s??'').replace(/\s+/g,' ').trim();

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

  // Posiciones de las columnas del informe Datapar observado.
  // Se usan los encabezados/posiciones del PDF, no el texto concatenado que entrega PDF.js.
  const COLS=[
    ['responsable',0,150],
    ['titular',150,300],
    ['ruc',300,365],
    ['banco',365,430],
    ['cuenta',430,485],
    ['cheque',485,515],
    ['emision',515,548],
    ['recepcion',548,582],
    ['diferida',582,615],
    ['moneda',615,632],
    ['valor',632,700],
    ['situacion',700,755],
    ['movimiento',755,795],
    ['vendedor',795,842]
  ];

  function cellFor(items,a,b){
    return clean(items.filter(i=>i.x>=a&&i.x<b).sort((x,y)=>x.x-y.x).map(i=>i.s).join(' '));
  }

  function parseDataparRows(groups){
    const out=[];
    for(const g of groups){
      const items=g.items;
      const all=clean(items.map(i=>i.s).join(' '));
      if(!all)continue;
      // Ignorar encabezados, filtros y resúmenes.
      if(/^(Responsable|Titular|RUC\/CI|Banco|Cuenta|Cheque|Emisión|Recep\.|Diferid\.|Mon|Valor|Histórico|Situación|Movimiento|Vend\.)/i.test(all))continue;
      if(/^(Resumen|DEVUELTO\s+US\$|Archivo:|Pag:|Filtros:|Moneda\s*:|Cuenta\s*:|Fecha Base\s*:|Situación\s*:)/i.test(all))continue;
      const r={
        responsable:cellFor(items,0,150),
        titular:cellFor(items,150,300),
        ruc_ci_titular:cellFor(items,300,365),
        banco:cellFor(items,365,430),
        cuenta:cellFor(items,430,485),
        numero_cheque:cellFor(items,485,515),
        fecha_emision:parseDate(cellFor(items,515,548)),
        fecha_recepcion:parseDate(cellFor(items,548,582)),
        fecha_diferida:parseDate(cellFor(items,582,615)),
        moneda:/GS|GUARAN[IÍ]ES/i.test(cellFor(items,615,632))?'GS':'USD',
        valor:parseMoney(cellFor(items,632,700)),
        situacion:'DEVUELTO',
        movimiento:cellFor(items,755,795),
        vendedor:cellFor(items,795,842)
      };
      // Datapar puede dejar RUC/CI vacío. No se debe desplazar el resto de las columnas.
      if(r.numero_cheque && r.valor>0 && (r.fecha_emision||r.fecha_recepcion||r.fecha_diferida)){
        out.push(r);
      }
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
    if(error){
      console.error(error);
      if($('chequeStatus'))$('chequeStatus').textContent='No se pudo consultar el registro de cheques devueltos.';
      return;
    }
    const rows=data||[],usd=rows.filter(x=>x.moneda==='USD'),gs=rows.filter(x=>x.moneda==='GS');
    $('chequeCount').textContent=rows.length;
    $('chequeUSD').textContent=money(usd.reduce((a,x)=>a+Number(x.valor||0),0),'USD');
    $('chequeGS').textContent=money(gs.reduce((a,x)=>a+Number(x.valor||0),0),'GS');
    $('chequeBody').innerHTML=rows.map(x=>`<tr><td>${esc(x.responsable)}</td><td>${esc(x.titular)}</td><td>${esc(x.ruc_ci_titular||'')}</td><td>${esc(x.banco||'')}</td><td>${esc(x.numero_cheque||'')}</td><td>${date(x.fecha_emision)}</td><td>${date(x.fecha_recepcion)}</td><td>${date(x.fecha_diferida)}</td><td>${money(x.valor,x.moneda)}</td><td>${esc(x.situacion||'DEVUELTO')}</td></tr>`).join('');
    $('chequeSearch').oninput=()=>{
      const q=$('chequeSearch').value.toLowerCase();
      document.querySelectorAll('#chequeBody tr').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?'':'none');
    };
  }

  async function importPdf(file){
    $('chequeStatus').textContent='Leyendo columnas del informe Datapar…';
    try{
      const rows=await extract(file);
      if(!rows.length){
        $('chequeStatus').textContent='No se detectaron filas válidas de cheques DEVUELTO. No se guardó información.';
        return;
      }
      const h=await hash(file);
      const {data:imp,error:ie}=await sb.from('cheque_importaciones').insert({
        tipo:'DEVUELTO',nombre_archivo:file.name,fecha_base:new Date().toISOString().slice(0,10),hash_archivo:h
      }).select('id').single();
      if(ie){
        if(String(ie.message||'').toLowerCase().includes('duplicate'))throw new Error('Este PDF ya fue importado.');
        throw ie;
      }
      const payload=rows.map(r=>({...r,importacion_id:imp.id,tipo:'DEVUELTO'}));
      const {error}=await sb.from('cheque_documentos').insert(payload);
      if(error)throw error;
      $('chequeStatus').textContent=`Importación correcta: ${rows.length} cheque(s) devuelto(s).`;
      await load();
    }catch(e){
      console.error(e);
      $('chequeStatus').textContent=`No se pudo importar: ${e.message||e}`;
    }
  }

  window.initChequesDevueltos=()=>{
    if(!$('chequeFile'))return;
    $('chequeFile').onchange=e=>{const f=e.target.files[0];if(f)importPdf(f)};
    $('chequePrint').onclick=()=>window.print();
    load();
  };
})();
