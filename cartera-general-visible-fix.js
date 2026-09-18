/* FIX DEFINITIVO: selectores de Carteras y Vendedores */
(function(){
  async function poblarSelectores(){
    const carteraSelect=document.getElementById('portfolioSelect');
    const sellerSelect=document.getElementById('sellerFilter');
    if(!carteraSelect || typeof sb==='undefined')return;

    try{
      /* Usamos resumen_cartera como respaldo porque es la misma fuente
         que ya está demostrando cargar correctamente las 6 carteras. */
      const [cRes,sRes,vRes]=await Promise.all([
        sb.from('carteras').select('id,nombre,tipo,moneda,orden').order('orden'),
        sb.from('resumen_cartera').select('cartera_id,nombre,tipo,moneda').order('cartera_id'),
        sb.from('cartera_vendedores').select('id,nombre,activo').eq('activo',true).order('nombre')
      ]);

      const mapa=new Map();
      (cRes.data||[]).forEach(c=>mapa.set(String(c.id),c));
      (sRes.data||[]).forEach(c=>{
        if(!mapa.has(String(c.cartera_id))){
          mapa.set(String(c.cartera_id),{
            id:c.cartera_id,nombre:c.nombre,tipo:c.tipo,moneda:c.moneda,
            orden:0
          });
        }
      });

      const carteras=[...mapa.values()].sort((a,b)=>
        (Number(a.orden)||99)-(Number(b.orden)||99)
      );

      if(!carteras.length){
        throw new Error('No se encontraron las 6 carteras en la base de datos');
      }

      const vendedores=vRes.data||[];
      window.carteras=carteras;
      window.vendedores=vendedores;

      const carteraAnterior=carteraSelect.value;
      carteraSelect.innerHTML=
        '<option value="__GENERAL__">CARTERA GENERAL</option>'+
        carteras.map(c=>'<option value="'+c.id+'">'+esc(c.nombre)+'</option>').join('');

      carteraSelect.value=
        [...carteraSelect.options].some(o=>o.value===carteraAnterior)
          ? carteraAnterior
          : '__GENERAL__';

      if(sellerSelect){
        const vendedorAnterior=sellerSelect.value;
        sellerSelect.innerHTML=
          '<option value="">Todos los vendedores</option>'+
          vendedores.map(v=>'<option value="'+v.id+'">'+esc(v.nombre)+'</option>').join('');

        if(vendedorAnterior &&
           [...sellerSelect.options].some(o=>o.value===vendedorAnterior)){
          sellerSelect.value=vendedorAnterior;
        }
      }

      carteraSelect.onchange=()=>window.loadDetails&&window.loadDetails();
      if(sellerSelect)sellerSelect.onchange=()=>window.loadDetails&&window.loadDetails();

      if(window.loadDetails)window.loadDetails();

    }catch(error){
      console.error('ERROR SELECTORES:',error);
      toast('Error cargando carteras y vendedores: '+(error.message||error));
    }
  }

  window.addEventListener('load',()=>{
    setTimeout(poblarSelectores,800);
    setTimeout(poblarSelectores,2000);
  });
})();