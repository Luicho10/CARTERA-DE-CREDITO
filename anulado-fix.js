(function(){
  function normalizarAnulados(){
    try{
      if(typeof rows==='undefined'||!Array.isArray(rows)||!rows.length)return false;
      let changed=false;
      rows=rows.map(r=>{
        if(String(r?.vendedor_origen||'').trim().toUpperCase()==='ANULADO'||String(r?.estado||'').trim().toUpperCase()==='ANULADO'){
          changed=true;
          return {...r,vendedor_origen:'',estado:'VIGENTE'};
        }
        return r;
      });
      if(changed&&typeof renderPreview==='function')renderPreview();
      return changed;
    }catch(e){console.error('ANULADO fix',e);return false}
  }
  const f=document.getElementById('pdfFile');
  if(f)f.addEventListener('change',()=>{let n=0;const t=setInterval(()=>{n++;if(normalizarAnulados()||n>120)clearInterval(t)},100)},false);
})();
