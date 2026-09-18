/* FIX DEFINITIVO: selectores de Carteras y Vendedores */
(function(){
  async function poblarSelectores(){
    const carteraSelect=document.getElementById('portfolioSelect');
    const sellerSelect=document.getElementById('sellerFilter');
    if(!carteraSelect)return;

    try{
      const [cRes,vRes]=await Promise.all([
        sb.from('carteras').select('id,nombre,tipo,moneda,orden').order('orden'),
        sb.from('cartera_vendedores').select('id,nombre,activo').eq('activo',true).order('nombre')
      ]);

      if(cRes.error) throw cRes.error;

      const carteras=cRes.data||[];
      const vendedores=vRes.data||[];

      window.carteras=carteras;
      window.vendedores=vendedores;

      const anterior=carteraSelect.value;
      carteraSelect.innerHTML=
        '<option value="__GENERAL__">CARTERA GENERAL</option>'+
        carteras.map(c=>'<option value="'+c.id+'">'+esc(c.nombre)+'</option>').join('');

      if(anterior && [...carteraSelect.options].some(o=>o.value===anterior)){
        carteraSelect.value=anterior;
      }else{
        carteraSelect.value='__GENERAL__';
      }

      if(sellerSelect){
        const vendedorAnterior=sellerSelect.value;
        sellerSelect.innerHTML=
          '<option value="">Todos los vendedores</option>'+
          vendedores.map(v=>'<option value="'+v.id+'">'+esc(v.nombre)+'</option>').join('');
        if(vendedorAnterior && [...sellerSelect.options].some(o=>o.value===vendedorAnterior)){
          sellerSelect.value=vendedorAnterior;
        }
      }

      carteraSelect.onchange=function(){
        if(typeof window.loadDetails==='function')window.loadDetails();
      };
      if(sellerSelect)sellerSelect.onchange=function(){
        if(typeof window.loadDetails==='function')window.loadDetails();
      };

      if(typeof window.loadDetails==='function')window.loadDetails();

    }catch(error){
      console.error('Error cargando selectores de cartera:',error);
      toast('No se pudieron cargar las carteras: '+(error.message||error));
    }
  }

  window.addEventListener('load',function(){
    setTimeout(poblarSelectores,500);
    setTimeout(poblarSelectores,1500);
  });
})();