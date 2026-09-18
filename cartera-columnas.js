/* Selector de columnas para la pantalla de Carteras */
(function(){
  const KEY='cartera_columnas_visibles_v1';
  const cols=[
    {i:1,n:'Cartera'},
    {i:2,n:'Cliente'},
    {i:3,n:'Vendedor actual'},
    {i:4,n:'Vendedor origen'},
    {i:5,n:'Factura / Nro. Documento'},
    {i:6,n:'Venc.'},
    {i:7,n:'Saldo Cuenta'},
    {i:8,n:'Estado'}
  ];
  function getState(){
    try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&typeof s==='object')return s}catch(e){}
    return Object.fromEntries(cols.map(c=>[c.i,true]));
  }
  function apply(){
    const state=getState(),table=document.querySelector('#view-carteras .table-wrap table');
    if(!table)return;
    cols.forEach(c=>{
      const show=state[c.i]!==false;
      table.querySelectorAll('tr').forEach(tr=>{
        const cell=tr.children[c.i-1];
        if(cell)cell.style.display=show?'':'none';
      });
    });
    document.querySelectorAll('#columnVisibilityMenu input[data-col]').forEach(x=>x.checked=state[Number(x.dataset.col)]!==false);
  }
  function create(){
    if(document.getElementById('columnVisibilityBtn'))return;
    const controls=document.querySelector('#view-carteras .section-head > div');
    if(!controls)return;
    const wrap=document.createElement('div');wrap.className='column-visibility-wrap';
    const btn=document.createElement('button');btn.id='columnVisibilityBtn';btn.type='button';btn.title='Mostrar / Ocultar columnas';btn.setAttribute('aria-label','Mostrar / Ocultar columnas');btn.textContent='⚙';
    const menu=document.createElement('div');menu.id='columnVisibilityMenu';menu.className='column-visibility-menu';
    menu.innerHTML='<strong>Mostrar / Ocultar columnas</strong>'+cols.map(c=>'<label><input type="checkbox" data-col="'+c.i+'" checked> '+c.n+'</label>').join('');
    btn.onclick=e=>{e.stopPropagation();menu.classList.toggle('open')};
    menu.onclick=e=>e.stopPropagation();
    menu.querySelectorAll('input[data-col]').forEach(input=>input.onchange=()=>{
      const state=getState();state[Number(input.dataset.col)]=input.checked;localStorage.setItem(KEY,JSON.stringify(state));apply();
    });
    wrap.appendChild(btn);wrap.appendChild(menu);controls.appendChild(wrap);
    document.addEventListener('click',()=>menu.classList.remove('open'));
    apply();
  }
  function init(){create();apply()}
  window.addEventListener('load',()=>{setTimeout(init,300);setTimeout(init,1200);setTimeout(init,2500)});
  window.addEventListener('click',e=>{if(e.target.closest('#view-carteras'))setTimeout(apply,50)});
})();