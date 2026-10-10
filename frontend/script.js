let PRODUCTS=[],CART=[],user=null,authMode='signup',deferredPrompt=null;
const PH='https://via.placeholder.com/400x400.png?text=SUCCESS';
const STATES={
  "Lagos":["Ikeja","Lekki","Yaba","Surulere","Ikorodu","Ajah","Badagry","Alimosho","Oshodi"],
  "Abuja FCT":["AMAC","Gwagwalada","Kuje","Bwari","Kwali"],
  "Oyo":["Ibadan North","Ibadan South","Ogbomosho","Oyo"],
  "Rivers":["Port Harcourt","Obio-Akpor","Eleme"],
  "Others":["Other"]
};

function init(){
  const su=localStorage.getItem('sf_user');
  if(su){try{user=JSON.parse(su);}catch{}}
  const sc=localStorage.getItem('sf_cart_'+(user?.email||'guest'));
  if(sc){try{CART=JSON.parse(sc);}catch{}}

  fetch('/api/products').then(r=>r.json()).then(d=>{
    PRODUCTS=Array.isArray(d)?d:(d.products||[]);
    renderProducts(PRODUCTS);
    if(user) {
      loadCartFromBackend();
      // auto-sync website -> DB every 5 sec
      setInterval(()=>{ if(user) loadCartFromBackend(); }, 5000);
    }
  });

  updateAll(); loadOrderCount(); initStates();
  const dt=document.getElementById('c_date');
  if(dt) dt.min=new Date().toISOString().split('T')[0];
}

function initStates(){
  const s=document.getElementById('c_state');
  if(!s) return;
  s.innerHTML='<option value="">Select State</option>';
  Object.keys(STATES).forEach(st=>{
    const o=document.createElement('option');
    o.value=st; o.textContent=st; s.appendChild(o);
  });
}
function loadLGAs(){
  const st=document.getElementById('c_state').value;
  const lga=document.getElementById('c_lga');
  lga.innerHTML='<option value="">Select LGA</option>';
  (STATES[st]||[]).forEach(l=>{
    const o=document.createElement('option');
    o.value=l; o.textContent=l; lga.appendChild(o);
  });
}
function showToast(m){
  const t=document.getElementById('toast');
  if(!t) return console.log(m);
  t.innerText=m; t.style.display='block';
  setTimeout(()=>t.style.display='none',2500);
}

function renderProducts(list){
  const g=document.getElementById('grid');
  if(!g) return;
  g.innerHTML='';
  if(!list.length){
    const empty=document.createElement('div');
    empty.style.cssText='grid-column:1/3;text-align:center;color:#666;padding:30px';
    empty.textContent='No products';
    g.appendChild(empty); return;
  }
  list.forEach(p=>{
    const card=document.createElement('div');
    card.className='card';
    const img=document.createElement('img');
    img.src=p.image||PH;
    img.onerror=function(){this.src=PH};
    const name=document.createElement('div');
    name.style.cssText='font-weight:700;margin-top:6px;font-size:14px';
    name.textContent=p.name;
    const price=document.createElement('div');
    price.style.color='#aaa';
    price.textContent='$'+p.price;
    const btn=document.createElement('button');
    btn.textContent='Add to Cart';
    btn.onclick=()=>addToCart(p.id);
    card.append(img,name,price,btn);
    g.appendChild(card);
  });
}

function filterCat(c,b){
  if(b){
    document.querySelectorAll('.filters button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
  }
  renderProducts(c==='All'?PRODUCTS:PRODUCTS.filter(x=>(x.category||'').toLowerCase().includes(c.toLowerCase())));
}
function openMenu(){document.getElementById('menuDrawer').classList.add('open');document.getElementById('overlay').classList.add('show');}
function openCart(){document.getElementById('cartDrawer').classList.add('open');document.getElementById('overlay').classList.add('show');}
function closeAll(){
  ['menuDrawer','cartDrawer','authModal','ordersModal'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.classList.remove('open','show');
  });
  const ov=document.getElementById('overlay');
  if(ov) ov.classList.remove('show');
}
function openAuth(){closeAll();document.getElementById('authModal').classList.add('show');document.getElementById('overlay').classList.add('show');}
function toggleAuth(){
  authMode=authMode==='signup'?'login':'signup';
  document.getElementById('authTitle').innerText=authMode==='signup'?'Create Account':'Welcome Back';
  document.getElementById('a_name').style.display=authMode==='signup'?'block':'none';
  document.getElementById('authSwitch').innerText=authMode==='signup'?'Have account? Login':'Need account? Create';
}
function createCartRow(p,i){
  const row=document.createElement('div');
  row.style.cssText='display:flex;gap:10px;background:#151515;border:1px solid #222;padding:10px;border-radius:14px;margin-bottom:8px';
  const img=document.createElement('img');
  img.src=p.image||PH; img.style.cssText='width:56px;height:56px;border-radius:10px';
  const info=document.createElement('div'); info.style.flex='1';
  const name=document.createElement('div'); name.style.fontSize='13px'; name.textContent=p.name;
  const price=document.createElement('div'); price.style.color='#888'; price.textContent=`$${p.price} x ${p.qty}`;
  const qtyBox=document.createElement('div'); qtyBox.style.cssText='display:flex;gap:6px;margin-top:6px';
  const dec=document.createElement('button'); dec.textContent='-'; dec.style.cssText='width:28px;height:28px;background:#222;color:#fff;border:none;border-radius:6px'; dec.onclick=()=>changeQty(i,-1);
  const qty=document.createElement('span'); qty.textContent=p.qty;
  const inc=document.createElement('button'); inc.textContent='+'; inc.style.cssText='width:28px;height:28px;background:#222;color:#fff;border:none;border-radius:6px'; inc.onclick=()=>changeQty(i,1);
  qtyBox.append(dec,qty,inc);
  info.append(name,price,qtyBox);
  const del=document.createElement('button'); del.textContent='✕'; del.style.cssText='background:#222;color:#fff;width:28px;height:28px;border:none;border-radius:8px'; del.onclick=()=>removeItem(i);
  row.append(img,info,del);
  return row;
}
function updateAll(){
  const who=document.getElementById('who');
  const status=document.getElementById('status');
  const avatar=document.getElementById('avatar');
  if(!who) return;
  const emailName=user?user.email.split('@')[0]:'Guest';
  const displayName=user?(user.name && user.name.toLowerCase()!=='admin'?user.name:emailName):'Guest';
  who.innerText=user?`Hi, ${displayName} 👋`:'Guest — Login to shop';
  if(status) status.innerText=user? (user.role==='admin'?'Admin • Manage store':`${CART.reduce((s,c)=>s+c.qty,0)} items • Pay on delivery`):'Secure • Pay on delivery';
  if(avatar) avatar.innerText=user?displayName[0].toUpperCase():'S';
  const mn=document.getElementById('menuName'); if(mn) mn.innerText=user?(displayName+(user.role==='admin'?' (admin)':'')):'Guest';
  const me=document.getElementById('menuEmail'); if(me) me.innerText=user?user.email:'Not logged in';
  const ml=document.getElementById('menuLogin'); if(ml) ml.style.display=user?'none':'block';
  const mlo=document.getElementById('menuLogout'); if(mlo) mlo.style.display=user?'block':'none';
  const ma=document.getElementById('menuAdmin'); if(ma) ma.style.display=(user&&user.role==='admin')?'block':'none';
  const qty=CART.reduce((s,c)=>s+c.qty,0);
  const c1=document.getElementById('count'); if(c1) c1.innerText=qty;
  const c2=document.getElementById('cartCount2'); if(c2) c2.innerText=qty;
  const bc=document.getElementById('bottomCount'); if(bc) bc.innerText=qty;
  const list=document.getElementById('cartList');
  if(!list) return;
  list.innerHTML=''; let total=0;
  CART.forEach((p,i)=>{ total+=p.price*p.qty; list.appendChild(createCartRow(p,i)); });
  const ct=document.getElementById('c_total'); if(ct) ct.innerText='$'+total;
  if(CART.length===0){
    const empty=document.createElement('div');
    empty.style.cssText='text-align:center;color:#666;margin-top:40px';
    empty.textContent='Cart empty';
    list.appendChild(empty);
  }
  const fn=document.getElementById('c_fullname');
  if(fn&&user&&!fn.value) fn.value=user.name||'';
}

// === SYNC FIXED FOR MOBILE APP ===
async function loadCartFromBackend(){
  if(!user?.email) return;
  try{
    const r=await fetch('/api/cart?email='+encodeURIComponent(user.email.toLowerCase()));
    const d=await r.json();
    if(d.items && d.items.length){
      // Backend -> Website (if backend has more items)
      const backendIds = new Set(d.items.map(it=>it.id));
      // Merge: keep website cart but add backend items not in website
      d.items.forEach(it=>{
        if(!CART.find(c=>c.id==it.id)){
          const prod=PRODUCTS.find(p=>p.id==it.id)||it;
          CART.push({...prod, qty: it.qty || 1, id:it.id});
        }
      });
      localStorage.setItem('sf_cart_'+user.email, JSON.stringify(CART));
      updateAll();
    }
  }catch(e){ console.log('load backend error',e) }
}
async function syncAddToBackend(product_id){
  if(!user?.email) return;
  try{
    await fetch('/api/cart/add',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:user.email.toLowerCase(), product_id})
    });
    console.log('Synced to app DB');
  }catch{}
}
async function syncFullCartToBackend(){
  if(!user?.email) return;
  try{
    await fetch('/api/cart/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email.toLowerCase()})});
    for(const c of CART){
      for(let q=0;q<c.qty;q++){
        await fetch('/api/cart/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email.toLowerCase(), product_id:c.id})});
      }
    }
  }catch{}
}

async function doAuth(){
  const nameEl=document.getElementById('a_name');
  const emailEl=document.getElementById('a_email');
  const passEl=document.getElementById('a_pass');
  const msgEl=document.getElementById('authMsg');
  const name=nameEl? nameEl.value.trim() : "";
  const email=emailEl? emailEl.value.trim().toLowerCase() : "";
  const pass=passEl? passEl.value : "";
  if(!email||!pass) return alert('Fill email & pass');
  if(msgEl) msgEl.innerText='Checking...';
  const url=authMode==='signup'?'/api/auth/signup':'/api/auth/login';
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass,name})});
  const d=await r.json();
  if(d.ok){
    if(authMode==='signup'){if(msgEl) msgEl.innerText='Created! Now login';toggleAuth();showToast('Now login');}
    else{
      user=d.user;
      localStorage.setItem('sf_user',JSON.stringify(user));
      closeAll();updateAll();loadOrderCount();
      // FIXED: First push local guest cart to backend, then load backend
      const guestCart=localStorage.getItem('sf_cart_guest');
      if(guestCart){
        try{
          const gc=JSON.parse(guestCart);
          for(const it of gc){
            for(let i=0;i<it.qty;i++) await syncAddToBackend(it.id);
          }
        }catch{}
      }
      await loadCartFromBackend();
      showToast('Welcome '+user.email);
    }
  }else{if(msgEl) msgEl.innerText=d.error||'Error';}
}
function logout(){localStorage.removeItem('sf_user');user=null;CART=[];updateAll();closeAll();showToast('Logged out');setTimeout(()=>openAuth(),500);}
function saveCart(){localStorage.setItem('sf_cart_'+(user?.email||'guest'),JSON.stringify(CART));updateAll();}
function addToCart(id){
  if(!user){openAuth();return showToast('Login first');}
  const p=PRODUCTS.find(x=>x.id==id); if(!p) return;
  const e=CART.find(c=>c.id==id); if(e) e.qty++; else CART.push({...p,qty:1});
  saveCart(); syncAddToBackend(id); showToast('Added ✅ synced to app');
}
function changeQty(i,d){CART[i].qty=Math.max(1,CART[i].qty+d);saveCart();syncFullCartToBackend();}
function removeItem(i){CART.splice(i,1);saveCart();syncFullCartToBackend();}

function createOrderCard(o){
  const card=document.createElement('div'); card.className='orderCard';
  const title=document.createElement('b'); title.textContent=`#${o.id} • $${o.total}`;
  const details=document.createElement('div'); details.style.cssText='color:#888;font-size:12px';
  details.innerHTML=`${o.address||''}<br>${o.state||''} ${o.lga||''} • ${o.delivery_date||''} ${o.delivery_time||''}<br>${o.phone||''}`;
  const btnWrap=document.createElement('div'); btnWrap.style.marginTop='8px';
  const delBtn=document.createElement('button'); delBtn.textContent='Delete'; delBtn.style.cssText='background:#222;color:#f55;border:1px solid #333;padding:8px 12px;border-radius:10px';
  delBtn.onclick=()=>deleteOrder(o.id);
  btnWrap.appendChild(delBtn);
  card.append(title,details,btnWrap);
  return card;
}
async function loadOrderCount(){if(!user)return;try{const r=await fetch('/api/orders?email='+encodeURIComponent(user.email));const d=await r.json();if(Array.isArray(d)) document.getElementById('menuOrderCount').innerText=d.length;}catch{}}
async function viewOrders(){
  if(!user) return openAuth();
  closeAll();
  document.getElementById('ordersModal').classList.add('show');
  document.getElementById('overlay').classList.add('show');
  const r=await fetch('/api/orders?email='+encodeURIComponent(user.email));
  const orders=await r.json();
  const list=document.getElementById('ordersList'); list.innerHTML='';
  if(!Array.isArray(orders)||!orders.length){
    const empty=document.createElement('div'); empty.style.cssText='color:#666;text-align:center'; empty.textContent='No orders yet'; list.appendChild(empty); return;
  }
  orders.forEach(o=>list.appendChild(createOrderCard(o)));
}
async function deleteOrder(id){
  if(!confirm('Delete #'+id+'?')) return;
  const r=await fetch('/api/orders?id='+id+'&email='+encodeURIComponent(user.email),{method:'DELETE'});
  const d=await r.json();
  if(d.ok){showToast('Deleted');viewOrders();loadOrderCount();}
}
async function doCheckout(){
  if(!user) return openAuth();
  const phone=document.getElementById('c_phone').value.trim();
  const addr=document.getElementById('c_address').value.trim();
  const state=document.getElementById('c_state').value;
  const lga=document.getElementById('c_lga').value;
  const date=document.getElementById('c_date').value;
  const time=document.getElementById('c_time').value;
  if(!phone) return alert('Enter phone');
  if(!state) return alert('Select state');
  if(!lga) return alert('Select LGA');
  if(!addr) return alert('Enter address');
  if(!date) return alert('Select date');
  if(CART.length===0) return alert('Cart empty');
  const total=CART.reduce((s,c)=>s+c.price*c.qty,0);
  const items=JSON.stringify(CART.map(c=>c.name+' x'+c.qty).join(', '));
  const fullAddr=addr+', '+lga+', '+state;
  const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,items,total,address:fullAddr,phone,state,lga,delivery_date:date,delivery_time:time})});
  const d=await r.json();
  if(d.ok){
    showToast('Order #'+d.order_id+' placed'); CART=[]; saveCart();
    await fetch('/api/cart/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email.toLowerCase()})});
    closeAll(); loadOrderCount();
  }else alert(d.error||'Failed');
}
init();