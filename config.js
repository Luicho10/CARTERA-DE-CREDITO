window.CARTERA_CONFIG={supabaseUrl:'https://layqqdkatatutmexoqrl.supabase.co',supabaseKey:'sb_publishable_mob6Bya5CJ5AyzBNJd_TvA_VFIGyWc8'};

(function(){
  const start=()=>{
    const client=window.supabase.createClient(window.CARTERA_CONFIG.supabaseUrl,window.CARTERA_CONFIG.supabaseKey);
    const app=document.getElementById('app');
    if(!app)return;
    app.style.display='none';
    const gate=document.createElement('div');
    gate.id='authGate';
    gate.innerHTML='<div class="auth-box"><div class="auth-brand">CARTERA DE CRÉDITO</div><div class="auth-sub">Acceso restringido</div><form id="authForm"><input id="authEmail" type="email" autocomplete="username" placeholder="Correo electrónico" required><input id="authPassword" type="password" autocomplete="current-password" placeholder="Contraseña" required><button type="submit">INGRESAR</button><div id="authMsg"></div></form></div>';
    const style=document.createElement('style');
    style.textContent='#authGate{position:fixed;inset:0;z-index:99999;background:#f5f8f4;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}.auth-box{width:360px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #dbe6d7;border-radius:12px;padding:32px;box-shadow:0 8px 30px rgba(0,0,0,.08)}.auth-brand{font-size:24px;font-weight:800;color:#176b3a}.auth-sub{margin:6px 0 24px;color:#68746b;font-size:14px}.auth-box input{box-sizing:border-box;width:100%;padding:12px 13px;margin:0 0 12px;border:1px solid #cfd8cf;border-radius:7px;font-size:14px}.auth-box button{width:100%;padding:12px;border:0;border-radius:7px;background:#176b3a;color:#fff;font-weight:700;cursor:pointer}.auth-box button:disabled{opacity:.6}.auth-box #authMsg{min-height:20px;margin-top:12px;text-align:center;color:#b42318;font-size:13px}';
    document.head.appendChild(style);document.body.appendChild(gate);
    const msg=document.getElementById('authMsg');const form=document.getElementById('authForm');const btn=form.querySelector('button');
    const open=()=>{gate.style.display='flex';app.style.display='none'};
    const close=()=>{gate.style.display='none';app.style.display=''};
    async function ensureAccess(){const {data}=await client.auth.getSession();if(!data.session){open();return;}if(!sessionStorage.getItem('cartera-auth-ready')){sessionStorage.setItem('cartera-auth-ready','1');location.reload();return;}close();}
    form.addEventListener('submit',async e=>{e.preventDefault();btn.disabled=true;msg.textContent='Verificando acceso…';const email=document.getElementById('authEmail').value.trim();const password=document.getElementById('authPassword').value;const {error}=await client.auth.signInWithPassword({email,password});if(error){msg.textContent='Correo o contraseña incorrectos.';btn.disabled=false;return}sessionStorage.setItem('cartera-auth-ready','1');location.reload()});
    client.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){sessionStorage.removeItem('cartera-auth-ready');open()}});
    ensureAccess();
    window.CARTERA_AUTH={client,logout:async()=>{await client.auth.signOut();sessionStorage.removeItem('cartera-auth-ready');location.reload()}};
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
