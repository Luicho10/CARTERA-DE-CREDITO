// Módulo Crédito: Cheques Devueltos Datapar
// Lector orientado al formato tabular de Datapar. Solo registra DEVUELTO.
(function(){
  const sb=window.supabase.createClient(CARTERA_CONFIG.supabaseUrl,CARTERA_CONFIG.supabaseKey);
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const money=(n,m='USD')=>Number(n||0).toLocaleString('es-PY',{minimumFractionDigits:m==='USD'?2:0,maximumFractionDigits:m==='USD'?2:0});
  const date=s=>{if(!s)return '';const a=String(s).split('-');return a.length===3?`${a[2]}/${a[1]}/${a[0]}`:s};
  const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
  function parseMoney(s){if(!s)return 0;let x=clean(s).replace(/[^0-9,.-]/g,'');if(x.includes(',')&&x.includes('.'))x=x.replace(/\./g,'').replace(',','.');else if(x.includes(','))x=x.replace(',','.');return Number(x)||0}
  function parseDate(s){const m=clean(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(!m)return null;const y=m[3].length===2?'20'+m[3]:m[3];return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`}
  const dateRe=/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;
  const moneyRe=/[-+]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[-+]?\d+(?:,\d+)?/g;
  const chequeRe=/^(?:\d{4,12}|\d{3}-\d{3}-\d{4,8})$/;
  const isDate=s=>/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s);
  const isMoney=s=>/^[-+]?\d[\d.]*,\d+$/.test(s)||/^[-+]?\d{1,3}(?:\.\d{3})+$/.test(s);
  function stripPrefix(s){return clean(s).replace(/^(?:TITULAR|ENTIDAD|CLIENTE)\s*:\s*/i,'').replace(/^\(\d+\)\s*/,'').trim()}

  async function extract(file){
    const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
    const all=[];
    for(let p=1;p<=pdf.numPages;p++){
      const page=await pdf.getPage(p),c=await page.getTextContent();
      const items=c.items.map(i=>({s:clean(i.str),x:i.transform[4],y:i.transform[5]})).filter(i=>i.s);
      const groups=[];
      for(const it of items){let g=groups.find(a=>Math.abs(a.y-it.y)<3);if(!g){g={y:it.y,items:[]};groups.push(g)}g.items.push(it)}
      for(const g of groups.sort((a,b)=>b.y-a.y)) all.push(g.items.sort((a,b)=>a.x-b.x).map(i=>i.s).join(' '));
    }
    return parse(all);
  }

  function parse(lines){
    let responsable='SIN INFORMAR',titular='',banco='',ruc='',pending=null,out=[];
    const setField=(key,val)=>{val=clean(val);if(!val)return;if(key==='responsable')responsable=val;if(key==='titular')titular=stripPrefix(val);if(key==='banco')banco=val;if(key==='ruc')ruc=val};
    for(let i=0;i<lines.length;i++){
      const raw=clean(lines[i]);
      if(!raw)continue;
      if(/^(?:P[ÁA]GINA|TOTAL|TOTAL GENERAL|ARCHIVO|CUENTA|MONEDA|SITUACI[ÓO]N\s*:)/i.test(raw)&&!/DEVUELTO/i.test(raw))continue;
      let m=raw.match(/^(?:RESPONSABLE|VENDEDOR|COBRADOR)\s*:\s*(.+)$/i);if(m){setField('responsable',m[1]);continue}
      m=raw.match(/^(?:TITULAR|ENTIDAD|CLIENTE)\s*:\s*(.+)$/i);if(m){setField('titular',m[1]);pending={titular:stripPrefix(m[1])};continue}
      m=raw.match(/^BANCO\s*:\s*(.+)$/i);if(m){setField('banco',m[1]);continue}
      m=raw.match(/^(?:RUC|CI|RUC\/CI)\s*:\s*(.+)$/i);if(m){setField('ruc',m[1]);continue}

      // Caso principal Datapar: una línea contiene titular/banco, cheque, fechas, valor y situación/movimiento.
      const dates=[...raw.matchAll(dateRe)].map(x=>x[0]);
      if(dates.length>=1){
        const tokens=raw.split(/\s+/);let ci=-1;
        for(let k=0;k<tokens.length;k++){if(chequeRe.test(tokens[k])&&!isDate(tokens[k])&&!isMoney(tokens[k])){ci=k;break}}
        if(ci>=0){
          const before=tokens.slice(0,ci).join(' ');const after=tokens.slice(ci+1).join(' ');
          const ds=[...after.matchAll(dateRe)].map(x=>x[0]);
          if(ds.length){
            const afterDates=after.replace(dateRe,' ').replace(/\s+/g,' ').trim();
            const nums=[...afterDates.matchAll(/[-+]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[-+]?\d+(?:,\d+)?/g)].map(x=>x[0]);
            if(nums.length){
              const valor=parseMoney(nums[nums.length-1]);
              const cheque=tokens[ci];
              const name=stripPrefix(before);
              if(name&&!/^\d/.test(name))titular=name;
              const tail=afterDates.replace(nums[nums.length-1],'').trim();
              const situacion=/DEVUELTO|RECHAZ|DEVOLV/i.test(raw)?(raw.match(/DEVUELTO|RECHAZADO|RECHAZADA|DEVOLUCION|DEVOLUCI[ÓO]N/i)||['DEVUELTO'])[0].toUpperCase():'DEVUELTO';
              out.push({responsable,titular:titular||name||'SIN INFORMAR',ruc_ci_titular:ruc,banco,numero_cheque:cheque,fecha_emision:parseDate(ds[0]),fecha_recepcion:parseDate(ds[1]||ds[0]),fecha_diferida:parseDate(ds[2]||ds[1]||ds[0]),valor,moneda:/\bGS\b|GUARAN[IÍ]ES/i.test(raw)?'GS':'USD',situacion,movimiento:tail});
              pending=null;continue;
            }
          }
        }
      }

      // Caso alternativo: Datapar puede separar columnas en varios renglones.
      const cheque=raw.match(/(?:N[°º.]?\s*)?(\d{4,12})/);
      if(cheque&&dates.length){
        const rest=raw.replace(cheque[1],'').replace(dateRe,' ').trim();
        const nums=[...rest.matchAll(/[-+]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[-+]?\d+(?:,\d+)?/g)].map(x=>x[0]);
        if(nums.length){out.push({responsable,titular:titular||'SIN INFORMAR',ruc_ci_titular:ruc,banco,numero_cheque:cheque[1],fecha_emision:parseDate(dates[0]),fecha_recepcion:parseDate(dates[1]||dates[0]),fecha_diferida:parseDate(dates[2]||dates[1]||dates[0]),valor:parseMoney(nums[nums.length-1]),moneda:'USD',situacion:'DEVUELTO',movimiento:rest});pending=null;continue}
      }
    }
    // Seguridad: solo aceptar registros que realmente tengan cheque + importe + fecha.
    return out.filter(r=>r.numero_cheque&&r.valor>0&&(r.fecha_emision||r.fecha_recepcion||r.fecha_diferida)).map(r=>({...r,situacion:'DEVUELTO'}));
  }

  async function hash(file){const b=await file.arrayBuffer(),h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}
  async function load(){
    const {data,error}=await sb.from('cheque_documentos').select('*').eq('tipo','DEVUELTO').order('created_at',{ascending:false});
    if(error){console.error(error);if($('chequeStatus'))$('chequeStatus').textContent='No se pudo consultar el registro de cheques devueltos.';return}
    const rows=data||[],usd=rows.filter(x=>x.moneda==='USD'),gs=rows.filter(x=>x.moneda==='GS');
    $('chequeCount').textContent=rows.length;$('chequeUSD').textContent=money(usd.reduce((a,x)=>a+Number(x.valor||0),0),'USD');$('chequeGS').textContent=money(gs.reduce((a,x)=>a+Number(x.valor||0),0),'GS');
    $('chequeBody').innerHTML=rows.map(x=>`<tr><td>${esc(x.responsable)}</td><td>${esc(x.titular)}</td><td>${esc(x.ruc_ci_titular||'')}</td><td>${esc(x.banco||'')}</td><td>${esc(x.numero_cheque||'')}</td><td>${date(x.fecha_emision)}</td><td>${date(x.fecha_recepcion)}</td><td>${date(x.fecha_diferida)}</td><td>${money(x.valor,x.moneda)}</td><td>${esc(x.situacion||'DEVUELTO')}</td></tr>`).join('');
    $('chequeSearch').oninput=()=>{const q=$('chequeSearch').value.toLowerCase();document.querySelectorAll('#chequeBody tr').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?'':'none')};
  }
  async function importPdf(file){
    $('chequeStatus').textContent='Leyendo estructura del PDF Datapar…';
    try{
      const rows=await extract(file);
      if(!rows.length){$('chequeStatus').textContent='No se detectaron filas válidas de cheques DEVUELTO. No se guardó información.';return}
      const h=await hash(file);const {data:imp,error:ie}=await sb.from('cheque_importaciones').insert({tipo:'DEVUELTO',nombre_archivo:file.name,fecha_base:new Date().toISOString().slice(0,10),hash_archivo:h}).select('id').single();
      if(ie){if(String(ie.message||'').toLowerCase().includes('duplicate'))throw new Error('Este PDF ya fue importado.');throw ie}
      const payload=rows.map(r=>({...r,importacion_id:imp.id,tipo:'DEVUELTO'}));const {error}=await sb.from('cheque_documentos').insert(payload);if(error)throw error;
      $('chequeStatus').textContent=`Importación correcta: ${rows.length} cheque(s) devuelto(s).`;await load();
    }catch(e){console.error(e);$('chequeStatus').textContent=`No se pudo importar: ${e.message||e}`}
  }
  window.initChequesDevueltos=()=>{if(!$('chequeFile'))return;$('chequeFile').onchange=e=>{const f=e.target.files[0];if(f)importPdf(f)};$('chequePrint').onclick=()=>window.print();load()};
})();
