let PRODUCTS=[],CART=[],user=null,authMode='signup';
const PH='https://via.placeholder.com/400x400.png?text=SUCCESS';
const API_BASE = '';
const STATES={
  "Lagos":["Ikeja","Lekki","Yaba","Surulere","Ikorodu","Ajah","Badagry","Alimosho","Oshodi"],
  "Abuja FCT":["AMAC","Gwagwalada","Kuje","Bwari","Kwali"],
  "Oyo":["Ibadan North","Ibadan South","Ogbomosho","Oyo"],
  "Rivers":["Port Harcourt","Obio-Akpor","Eleme"],
  "Others":["Other"]
};

function safe(id){ return document.getElementById(id) }

async function init(){
  try{
    const su=localStorage.getItem('sf_user');
    if(su){ try{ user=JSON.parse(su); }catch{} }
    const sc=localStorage.getItem('sf_cart_'+(user?.email?.toLowerCase()||'guest'));
    if(sc){ try{ CART=JSON.parse(sc)||[]; }catch{} }

    const r = await fetch(API_BASE+'/api/products');
    const d = await r.json();
    console.log('products api:', d);
    PRODUCTS = Array.isArray(d)? d : (d.products || d.items || []);

    renderProducts(PRODUCTS);
    if(user && CART.length===0) await loadCartFromBackendOnce();

    updateAll();
    loadOrderCount();
    initStates();
    const dt=safe('c_date');
    if(dt) dt.min=new Date().toISOString().split('T')[0];
  }catch(e){
    console.log('init error',e);
    renderProducts([]);
  }
}

function initStates(){ const s=safe('c_state'); if(!s) return; s.innerHTML='<option value="">Select State</option>'; Object.keys(STATES).forEach(st=>{ const o=document.createElement('option'); o.value=st; o.textContent=st; s.appendChild(o); }); }
function loadLGAs(){ const stEl=safe('c_state'); const lga=safe('c_lga'); if(!stEl||!lga) return; const st=stEl.value; lga.innerHTML='<option value="">Select LGA</option>'; (STATES[st]||[]).forEach(l=>{ const o=document.createElement('option'); o.value=l; o.textContent=l; lga.appendChild(o); }); }
function showToast(m){ const t=safe('toast'); if(!t) return console.log(m); t.innerText=m; t.style.display='block'; setTimeout(()=>t.style.display='none',2500); }

function renderProducts(list){
  const g=safe('grid'); if(!g) return; g.innerHTML='';
  if(!list.length){
    const e=document.createElement('div');
    e.style.cssText='grid-column:1/3;text-align:center;color:#666;padding:30px';
    e.textContent='No products — go to /admin to add';
    g.appendChild(e); return;
  }
  list.forEach(p=>{
    const card=document.createElement('div'); card.className='card';
    const img=document.createElement('img'); img.src=p.image||PH; img.loading='lazy'; img.onerror=function(){this.src=PH};
    const name=document.createElement('div'); name.style.cssText='font-weight:700;margin-top:6px;font-size:14px'; name.textContent=p.name;
    const price=document.createElement('div'); price.style.color='#aaa'; price.textContent='₦'+Number(p.price).toLocaleString();
    const btn=document.createElement('button'); btn.textContent='Add to Cart'; btn.className='btn'; btn.onclick=()=>addToCart(p.id);
    card.append(img,name,price,btn); g.appendChild(card);
  });
}

function filterCat(c,b){ if(b){ document.querySelectorAll('.filters button,.cat button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); } renderProducts(c==='All'?PRODUCTS:PRODUCTS.filter(x=>(x.category||'').toLowerCase().includes(c.toLowerCase()))); }
function openMenu(){ safe('menuDrawer')?.classList.add('open'); safe('overlay')?.classList.add('show'); }
function openCart(){ safe('cartDrawer')?.classList.add('open'); safe('overlay')?.classList.add('show'); }
function closeAll(){ ['menuDrawer','cartDrawer','authModal','ordersModal'].forEach(id=>{ safe(id)?.classList.remove('open','show'); }); safe('overlay')?.classList.remove('show'); }
function openAuth(){closeAll(); safe('authModal')?.classList.add('show'); safe('overlay')?.classList.add('show');}
function toggleAuth(){ authMode=authMode==='signup'?'login':'signup'; const t=safe('authTitle'); if(t) t.innerText=authMode==='signup'?'Create Account':'Welcome Back'; const nm=safe('a_name'); if(nm) nm.style.display=authMode==='signup'?'block':'none'; const sw=safe('authSwitch'); if(sw) sw.innerText=authMode==='signup'?'Have account? Login':'Need account? Create'; }

function createCartRow(p,i){
  const row=document.createElement('div'); row.style.cssText='display:flex;gap:10px;background:#151515;border:1px solid #222;padding:10px;border-radius:14px;margin-bottom:8px';
  const img=document.createElement('img'); img.src=p.image||PH; img.style.cssText='width:56px;height:56px;border-radius:10px;object-fit:cover';
  const info=document.createElement('div'); info.style.flex='1';
  const name=document.createElement('div'); name.style.fontSize='13px'; name.textContent=p.name;
  const price=document.createElement('div'); price.style.color='#888'; price.textContent=`₦${p.price} x ${p.qty}`;
  const qtyBox=document.createElement('div'); qtyBox.style.cssText='display:flex;gap:6px;margin-top:6px;align-items:center';
  const dec=document.createElement('button'); dec.textContent='-'; dec.style.cssText='width:28px;height:28px;background:#222;color:#fff;border:none;border-radius:6px;cursor:pointer'; dec.onclick=()=>changeQty(i,-1);
  const qty=document.createElement('span'); qty.textContent=p.qty;
  const inc=document.createElement('button'); inc.textContent='+'; inc.style.cssText='width:28px;height:28px;background:#222;color:#fff;border:none;border-radius:6px;cursor:pointer'; inc.onclick=()=>changeQty(i,1);
  qtyBox.append(dec,qty,inc); info.append(name,price,qtyBox);
  const del=document.createElement('button'); del.textContent='✕'; del.style.cssText='background:#222;color:#fff;width:28px;height:28px;border:none;border-radius:8px;cursor:pointer'; del.onclick=()=>removeItem(i);
  row.append(img,info,del); return row;
}

function updateAll(){ try{
  const who=safe('who'); const status=safe('status'); const avatar=safe('avatar');
  if(who){ const emailName=user?user.email.split('@')[0]:'Guest'; const displayName=user?(user.name && user.name.toLowerCase()!=='admin'?user.name:emailName):'Guest'; who.innerText=user?`Hi, ${displayName} 👋`:'Guest — Login to shop'; }
  if(status) status.innerText=user? (user.role==='admin'?'Admin • Manage store':`${CART.reduce((s,c)=>s+c.qty,0)} items • Pay on delivery`):'Secure • Pay on delivery';
  if(avatar){ const dn=user?(user.name||user.email):'S'; avatar.innerText=dn[0].toUpperCase(); }
  const mn=safe('menuName'); if(mn){ const dn=user?(user.name||user.email.split('@')[0]):'Guest'; mn.innerText=user?(dn+(user.role==='admin'?' (admin)':'')):'Guest'; }
  const me=safe('menuEmail'); if(me) me.innerText=user?user.email:'Not logged in';
  const ml=safe('menuLogin'); if(ml) ml.style.display=user?'none':'block';
  const mlo=safe('menuLogout'); if(mlo) mlo.style.display=user?'block':'none';
  const ma=safe('menuAdmin'); if(ma) ma.style.display=(user&&user.role==='admin')?'block':'none';
  const qty=CART.reduce((s,c)=>s+(c.qty||0),0);
  ['count','cartCount2','cartCount','bottomCount'].forEach(id=>{ const el=safe(id); if(el) el.innerText=qty; });
  const list=safe('cartList'); if(!list) return; list.innerHTML=''; let total=0;
  CART.forEach((p,i)=>{ total+= (Number(p.price)||0)*(p.qty||1); list.appendChild(createCartRow(p,i)); });
  const ct=safe('c_total'); if(ct) ct.innerText='₦'+total.toLocaleString();
  if(CART.length===0){ const empty=document.createElement('div'); empty.style.cssText='text-align:center;color:#666;margin-top:40px'; empty.textContent='Cart empty'; list.appendChild(empty); }
  const fn=safe('c_fullname'); if(fn&&user&&!fn.value) fn.value=user.name||'';
}catch(e){console.log('updateAll',e)}}

async function loadCartFromBackendOnce(){
  if(!user?.email) return;
  try{
    const r=await fetch(API_BASE+'/api/cart?email='+encodeURIComponent(user.email.toLowerCase()));
    const d=await r.json();
    if(d.items?.length>0 && CART.length===0){
      CART = d.items.map(it=>({...it, qty: it.qty||1}));
      localStorage.setItem('sf_cart_'+user.email.toLowerCase(), JSON.stringify(CART));
      updateAll();
    }
  }catch(e){ console.log('restore error',e) }
}

async function syncAddToBackend(product_id){
  if(!user?.email) return false;
  try{
    const r=await fetch(API_BASE+'/api/cart/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email.toLowerCase(), product_id:Number(product_id)})});
    const d=await r.json();
    return r.ok && (d.ok||d.items!==undefined);
  }catch(e){ return false; }
}

async function syncFullCartToBackend(){
  if(!user?.email) return;
  try{
    // FIX: single clear, not per qty
    await fetch(API_BASE+'/api/cart/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email.toLowerCase()})});
    for(const c of CART){
      // add with qty handling on backend (your backend increments, so we send once per product)
      await fetch(API_BASE+'/api/cart/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email.toLowerCase(), product_id:Number(c.id)})});
      // if qty > 1, update via extra calls is okay but limited - now we send only 1 extra if needed
      if(c.qty > 1){
        for(let q=1; q<c.qty; q++){
          await fetch(API_BASE+'/api/cart/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email.toLowerCase(), product_id:Number(c.id)})});
        }
      }
    }
  }catch(e){ console.log('full sync error',e) }
}

async function doAuth(){
  const name=safe('a_name')?.value.trim()||"";
  const email=safe('a_email')?.value.trim().toLowerCase()||"";
  const pass=safe('a_pass')?.value||"";
  const msgEl=safe('authMsg');
  if(!email||!pass) return alert('Fill email & pass');
  if(msgEl) msgEl.innerText='Checking...';
  const url=API_BASE+'/api/auth/'+(authMode==='signup'?'signup':'login');
  try{
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass,name})});
    const d=await r.json();
    if(d.ok || d.user){
      if(authMode==='signup'){
        if(msgEl) msgEl.innerText='Created! Now login';
        toggleAuth(); showToast('Account created - now login');
      } else {
        user=d.user;
        localStorage.setItem('sf_user',JSON.stringify(user));
        if(CART.length===0) await loadCartFromBackendOnce();
        else await syncFullCartToBackend();
        closeAll(); updateAll(); loadOrderCount(); showToast('Welcome '+user.email);
        if(msgEl) msgEl.innerText='';
      }
    }else{
      if(msgEl) msgEl.innerText=d.error||'Error';
    }
  }catch(e){ if(msgEl) msgEl.innerText='API error: '+e.message }
}

function logout(){ localStorage.removeItem('sf_user'); user=null; CART=[]; updateAll(); closeAll(); showToast('Logged out'); setTimeout(()=>openAuth(),500); }
function saveCart(){ localStorage.setItem('sf_cart_'+(user?.email?.toLowerCase()||'guest'), JSON.stringify(CART)); updateAll(); }

async function addToCart(id){
  if(!user){ openAuth(); return showToast('Login first'); }
  const p=PRODUCTS.find(x=>String(x.id)===String(id));
  if(!p){ return showToast('Product not loaded yet'); }
  const e=CART.find(c=>String(c.id)===String(id));
  if(e) e.qty++;
  else CART.push({...p,qty:1});
  saveCart();
  const ok=await syncAddToBackend(id);
  showToast(ok?'Added to cart ✅':'Added locally');
}

function changeQty(i,d){ if(!CART[i]) return; CART[i].qty=Math.max(1,(CART[i].qty||1)+d); saveCart(); syncFullCartToBackend(); }
function removeItem(i){ CART.splice(i,1); saveCart(); syncFullCartToBackend(); }

function createOrderCard(o){
  const card=document.createElement('div'); card.className='orderCard';
  const title=document.createElement('b'); title.textContent=`#${o.id} • ₦${Number(o.total).toLocaleString()}`;
  const details=document.createElement('div'); details.style.cssText='color:#888;font-size:12px;margin-top:6px;white-space:pre-line';
  details.textContent=`${o.address||''}\n${o.state||''} ${o.lga||''} • ${o.delivery_date||''} ${o.delivery_time||''}\n${o.phone||''}\nItems: ${o.items||''}`;
  const btnWrap=document.createElement('div'); btnWrap.style.marginTop='8px';
  const delBtn=document.createElement('button'); delBtn.textContent='Delete'; delBtn.style.cssText='background:#222;color:#f55;border:1px solid #333;padding:8px 12px;border-radius:10px;cursor:pointer'; delBtn.onclick=()=>deleteOrder(o.id);
  btnWrap.appendChild(delBtn); card.append(title,details,btnWrap); return card;
}

async function loadOrderCount(){ if(!user) return; try{ const r=await fetch(API_BASE+'/api/orders?email='+encodeURIComponent(user.email)); const d=await r.json(); const el=safe('menuOrderCount'); if(Array.isArray(d)&&el) el.innerText=d.length; }catch{} }

async function viewOrders(){ if(!user) return openAuth(); closeAll(); safe('ordersModal')?.classList.add('show'); safe('overlay')?.classList.add('show'); try{ const r=await fetch(API_BASE+'/api/orders?email='+encodeURIComponent(user.email)); const orders=await r.json(); const list=safe('ordersList'); if(!list) return; list.innerHTML=''; if(!Array.isArray(orders)||!orders.length){ const empty=document.createElement('div'); empty.style.cssText='color:#666;text-align:center'; empty.textContent='No orders yet'; list.appendChild(empty); return; } orders.forEach(o=>list.appendChild(createOrderCard(o))); }catch(e){} }

async function deleteOrder(id){ if(!confirm('Delete #'+id+'?')) return; try{ const r=await fetch(API_BASE+'/api/orders?id='+id+'&email='+encodeURIComponent(user.email),{method:'DELETE'}); const d=await r.json(); if(d.ok){ showToast('Deleted'); viewOrders(); loadOrderCount(); } else showToast('Delete failed'); }catch{ showToast('Delete error'); } }

async function doCheckout(){
  if(!user) return openAuth();
  const phone=safe('c_phone')?.value.trim();
  const addr=safe('c_address')?.value.trim();
  const state=safe('c_state')?.value;
  const lga=safe('c_lga')?.value;
  const date=safe('c_date')?.value;
  const time=safe('c_time')?.value;
  if(!phone) return alert('Enter phone');
  if(!state) return alert('Select state');
  if(!lga) return alert('Select LGA');
  if(!addr) return alert('Enter address');
  if(!date) return alert('Select date');
  if(CART.length===0) return alert('Cart empty');
  const total=CART.reduce((s,c)=>s+(Number(c.price)||0)*(c.qty||1),0);
  const itemsText=CART.map(c=>`${c.name} x${c.qty}`).join(', ');
  const fullAddr=`${addr}, ${lga}, ${state}`;

  try{
    const r=await fetch(API_BASE+'/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,items:itemsText,total,address:fullAddr,phone,state,lga,delivery_date:date,delivery_time:time||''})});
    const d=await r.json();
    if(d.ok){
      showToast('Order #'+d.order_id+' placed');
      CART=[]; saveCart();
      try{ await fetch(API_BASE+'/api/cart/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email.toLowerCase()})}); }catch{}
      closeAll(); loadOrderCount();
    }else alert(d.error||'Failed');
  }catch(e){ alert('Checkout error: '+e.message) }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', init);
}else{
  init();
}