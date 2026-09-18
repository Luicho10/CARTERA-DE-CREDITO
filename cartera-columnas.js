/* Selector de columnas de Carteras
   La selección se identifica por el nombre de la columna y NO por su posición.
   Así funciona correctamente tanto en CARTERA GENERAL como en cada cartera individual.
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

  function getState(){
    try{
      const s=JSON.parse(localStorage.getItem(KEY)||'null');
      if(s && typeof s==='object') return s;
    }catch(e){}
    return Object.fromEntries(cols.map(c=>[c.key,true]));
  }

  function saveState(state){
    localStorage.setItem(KEY,JSON.stringify(state));
  }

  function currentTable(){
    return document.querySelector('#view-carteras .table-wrap table');
  }

  function getColumnIndexes(table){
    const indexes={};
    if(!table) return indexes;

    const headers=[...table.querySelectorAll('thead tr:first-child > th')];
    headers.forEach((th,index)=>{
      const name=normalize(th.textContent);
      for(const col of cols){
        if(indexes[col.key]!==undefined) continue;
        if((aliases[col.key]||[]).some(a=>normalize(a)===name)){
          indexes[col.key]=index;
        }
      }
    });
    return indexes;
  }

  function apply(){
    const table=currentTable();
    if(!table) return;

    const state=getState();
    const indexes=getColumnIndexes(table);

    Object.keys(indexes).forEach(key=>{
      const show=state[key]!==false;
      const index=indexes[key];

      table.querySelectorAll('tr').forEach(tr=>{
        const cell=tr.children[index];
        if(cell) cell.style.display=show?'':'none';
      });
    });

    updateMenu(table,indexes,state);
  }

  function updateMenu(table,indexes,state){
    const menu=document.getElementById('columnVisibilityMenu');
    if(!menu) return;

    const available=cols.filter(c=>indexes[c.key]!==undefined);

    menu.innerHTML=
      '<strong>Mostrar / Ocultar columnas</strong>'+
      available.map(c=>
        '<label><input type="checkbox" data-col-key="'+c.key+'" '+
        (state[c.key]!==false?'checked':'')+
        '> '+c.label+'</label>'
      ).join('');

    menu.querySelectorAll('input[data-col-key]').forEach(input=>{
      input.onchange=()=>{
        const next=getState();
        next[input.dataset.colKey]=input.checked;
        saveState(next);
        apply();
      };
    });
  }

  function create(){
    if(document.getElementById('columnVisibilityBtn')) return;

    const controls=document.querySelector('#view-carteras .section-head > div');
    if(!controls) return;

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

    btn.onclick=e=>{
      e.stopPropagation();
      apply();
      menu.classList.toggle('open');
    };

    menu.onclick=e=>e.stopPropagation();

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

  /* Cada vez que cambia la cartera, la tabla puede cambiar de estructura.
     Se vuelve a identificar por encabezado antes de aplicar la configuración. */
  window.addEventListener('click',e=>{
    if(e.target.closest('#view-carteras')){
      setTimeout(init,50);
      setTimeout(apply,250);
    }
  });

  const observer=new MutationObserver(()=>{
    if(document.querySelector('#view-carteras .table-wrap table')){
      setTimeout(apply,20);
    }
  });

  window.addEventListener('load',()=>{
    const target=document.getElementById('view-carteras');
    if(target) observer.observe(target,{childList:true,subtree:true});
  });
})();
