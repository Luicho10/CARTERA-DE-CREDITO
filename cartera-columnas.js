/* Selector de columnas de Carteras
   La selección se identifica por el nombre de la columna y no por su posición.
   Funciona en CARTERA GENERAL y en cada cartera individual.
*/
(function(){
  const KEY='cartera_columnas_visibles_v1';

  const cols=[
    {key:'cartera',label:'Cartera'},
    {key:'cliente',label:'Cliente'},
    {key:'vendedor_actual',label:'Vendedor actual'},
    {key:'vendedor_origen',label:'Vendedor origen'},
    {key:'factura',label:'Factura / Nro. Documento'},
    {key:'venc',label:'Venc.'},
    {key:'saldo',label:'Saldo Cuenta'},
    {key:'estado',label:'Estado'}
  ];

  const normalize=s=>String(s||'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ')
    .trim()
    .toUpperCase();

  const aliases={
    cartera:['CARTERA'],
    cliente:['CLIENTE'],
    vendedor_actual:['VENDEDOR ACTUAL'],
    vendedor_origen:['VENDEDOR ORIGEN'],
    factura:['FACTURA / NRO. DOCUMENTO','FACTURA / NRO DOCUMENTO','FACTURA','NRO. DOCUMENTO','NRO DOCUMENTO'],
    venc:['VENC.','VENC','VENCIMIENTO'],
    saldo:['SALDO CUENTA','SALDO'],
    estado:['ESTADO']
  };

  function defaultState(){
    return Object.fromEntries(cols.map(c=>[c.key,true]));
  }

  function getState(){
    try{
      const saved=JSON.parse(localStorage.getItem(KEY)||'null');
      if(saved && typeof saved==='object'){
        const state=defaultState();
        cols.forEach(c=>{
          if(Object.prototype.hasOwnProperty.call(saved,c.key)){
            state[c.key]=saved[c.key]!==false;
          }
        });
        return state;
      }
    }catch(e){}
    return defaultState();
  }

  function saveState(state){
    localStorage.setItem(KEY,JSON.stringify(state));
  }

  function currentTable(){
    return document.querySelector('#view-carteras .table-wrap table');
  }

  function getColumnIndexes(table){
    const indexes={};
    if(!table)return indexes;

    const headers=[...table.querySelectorAll('thead tr:first-child > th')];

    headers.forEach((th,index)=>{
      const name=normalize(th.textContent);
      cols.forEach(col=>{
        if(indexes[col.key]!==undefined)return;
        if((aliases[col.key]||[]).some(a=>normalize(a)===name)){
          indexes[col.key]=index;
        }
      });
    });

    return indexes;
  }

  function applyColumnVisibility(table,indexes,state){
    Object.keys(indexes).forEach(key=>{
      const show=state[key]!==false;
      const index=indexes[key];

      table.querySelectorAll('tr').forEach(tr=>{
        const cell=tr.children[index];
        if(cell)cell.style.display=show?'':'none';
      });
    });
  }

  function menuSignature(indexes){
    return cols.filter(c=>indexes[c.key]!==undefined).map(c=>c.key).join('|');
  }

  function updateMenu(table,indexes,state){
    const menu=document.getElementById('columnVisibilityMenu');
    if(!menu)return;

    const available=cols.filter(c=>indexes[c.key]!==undefined);
    const signature=menuSignature(indexes);

    /*
      IMPORTANTE:
      No se reconstruye el menú cada vez que se aplica una columna.
      Reconstruirlo dentro de un MutationObserver hacía que el checkbox
      fuera reemplazado inmediatamente después del clic y quedara
      aparentemente congelado.
    */
    if(menu.dataset.signature!==signature){
      menu.innerHTML=
        '<strong>Mostrar / Ocultar columnas</strong>'+
        available.map(c=>
          '<label><input type="checkbox" data-col-key="'+c.key+'"> '+c.label+'</label>'
        ).join('');

      menu.dataset.signature=signature;

      menu.querySelectorAll('input[data-col-key]').forEach(input=>{
        input.addEventListener('change',()=>{
          const next=getState();
          next[input.dataset.colKey]=input.checked;
          saveState(next);

          const current=currentTable();
          if(current){
            const currentIndexes=getColumnIndexes(current);
            applyColumnVisibility(current,currentIndexes,next);
            updateMenu(current,currentIndexes,next);
          }
        });
      });
    }

    menu.querySelectorAll('input[data-col-key]').forEach(input=>{
      input.checked=state[input.dataset.colKey]!==false;
    });
  }

  function apply(){
    const table=currentTable();
    if(!table)return;

    const state=getState();
    const indexes=getColumnIndexes(table);

    applyColumnVisibility(table,indexes,state);
    updateMenu(table,indexes,state);
  }

  function create(){
    if(document.getElementById('columnVisibilityBtn'))return;

    const controls=document.querySelector('#view-carteras .section-head > div');
    if(!controls)return;

    const wrap=document.createElement('div');
    wrap.className='column-visibility-wrap';

    const btn=document.createElement('button');
    btn.id='columnVisibilityBtn';
    btn.type='button';
    btn.title='Mostrar / Ocultar columnas';
    btn.setAttribute('aria-label','Mostrar / Ocultar columnas');
    btn.textContent='⚙';

    const menu=document.createElement('div');
    menu.id='columnVisibilityMenu';
    menu.className='column-visibility-menu';

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    controls.appendChild(wrap);

    btn.addEventListener('click',e=>{
      e.stopPropagation();
      apply();
      menu.classList.toggle('open');
    });

    menu.addEventListener('click',e=>e.stopPropagation());

    document.addEventListener('click',()=>{
      menu.classList.remove('open');
    });

    apply();
  }

  function init(){
    create();
    apply();
  }

  window.addEventListener('load',()=>{
    setTimeout(init,300);
    setTimeout(init,800);
    setTimeout(init,1500);
    setTimeout(init,2500);
  });

  /*
    Se observa solamente la tabla.
    Antes se observaba todo #view-carteras, incluido el propio menú.
    Cada actualización del menú generaba otra mutación y podía reemplazar
    los checkboxes continuamente, impidiendo marcarlos/desmarcarlos.
  */
  window.addEventListener('load',()=>{
    const tableWrap=document.querySelector('#view-carteras .table-wrap');
    if(!tableWrap)return;

    const observer=new MutationObserver(()=>{
      clearTimeout(observer._timer);
      observer._timer=setTimeout(apply,30);
    });

    observer.observe(tableWrap,{childList:true,subtree:true});
  });

  window.addEventListener('click',e=>{
    if(e.target.closest('#view-carteras')){
      setTimeout(init,80);
    }
  });
})();