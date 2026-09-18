/* Fix de carga visible de CARTERA GENERAL.
   Fuerza la misma carga de detalle que utiliza la impresion,
   sin modificar las seis carteras individuales. */
(function(){
  const GENERAL_ID='__GENERAL__';
  function cargarGeneralSiCorresponde(){
    const sel=document.getElementById('portfolioSelect');
    if(!sel || sel.value!==GENERAL_ID) return;
    if(typeof window.loadGeneralDetails==='function'){
      window.loadGeneralDetails();
    }
  }
  function bind(){
    const sel=document.getElementById('portfolioSelect');
    if(!sel) return;
    if(!sel.dataset.generalVisibleFix){
      sel.dataset.generalVisibleFix='1';
      sel.addEventListener('change',()=>setTimeout(cargarGeneralSiCorresponde,0));
    }
    setTimeout(cargarGeneralSiCorresponde,0);
  }
  window.addEventListener('load',()=>{
    bind();
    setTimeout(bind,300);
    setTimeout(bind,1000);
    setTimeout(bind,2000);
  });
})();
