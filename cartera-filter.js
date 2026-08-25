(()=>{
  const init=()=>{
    const seller=document.getElementById('sellerFilter');
    const portfolio=document.getElementById('portfolioSelect');
    const search=document.getElementById('filterText');
    if(!seller||!portfolio)return false;
    const client=window.supabase.createClient(window.CARTERA_CONFIG.supabaseUrl,window.CARTERA_CONFIG.supabaseKey);
    const apply=()=>{
      const wanted=seller.value;
      document.querySelectorAll('#detailBody tr').forEach(tr=>{
        const sel=tr.querySelector('select.seller-select');
        const ok=!wanted||(wanted==='__none__'&&!sel?.value)||(wanted!=='__none__'&&sel?.value===wanted);
        tr.style.display=ok?'':'none';
      });
    };
    const fill=async()=>{
      try{
        const {data,error}=await client.from('cartera_vendedores').select('id,nombre,activo').eq('activo',true).order('nombre');
        if(error)throw error;
        seller.innerHTML='<option value="">Todos los vendedores</option><option value="__none__">SIN VENDEDOR</option>'+(data||[]).map(v=>`<option value="${v.id}">${String(v.nombre).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</option>`).join('');
        seller.onchange=()=>{
          if(typeof window.loadDetails==='function')window.loadDetails().then(apply).catch(()=>apply());
          else apply();
        };
        portfolio.addEventListener('change',()=>setTimeout(apply,50));
        if(search)search.addEventListener('input',()=>setTimeout(apply,50));
        apply();
      }catch(e){console.error('Filtro de vendedores:',e);}
    };
    fill();
    return true;
  };
  if(!init())document.addEventListener('DOMContentLoaded',init,{once:true});
})();
