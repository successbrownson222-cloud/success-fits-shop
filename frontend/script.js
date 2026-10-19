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
const VARIANT_CONFIG = {
  men_shoes: { label: "Shoe Size", options: ["40","41","42","43","44","45","46"] },
  women_shoes: { label: "Shoe Size", options: ["36","37","38","39","40","41","42"] },
  children_shoes: { label: "Kids Shoe Size", options: ["26","27","28","29","30","31","32","33","34","35"] },
  men_clothing: { label: "Size", options: ["S","M","L","XL","XXL","XXXL"] },
  women_clothing: { label: "Size", options: ["S","M","L","XL","XXL","6","8","10","12","14"] },
  children_clothing: { label: "Age", options: ["1-2yrs","2-3yrs","3-4yrs","4-5yrs","6-8yrs","9-12yrs"] },
  television: { label: "Inches", options: ['32"','43"','50"','55"','65"','75"'] },
  fridges: { label: "Capacity", options: ["100L","200L","300L","400L+","Double Door"] },
  air_conditioner: { label: "Power", options: ["1HP","1.5HP","2HP","2.5HP"] },
  gadgets: { label: "Storage", options: ["64GB","128GB","256GB","512GB"] },
  kitchen_utensils: { label: "Set", options: ["Small","Medium","Large","Full Set"] },
  furniture: { label: "Color", options: ["Black","Brown","White","Grey","Cream"] },
  cars: { label: "Condition", options: ["Brand New","Tokunbo","Used"] },
  home_appliances: { label: "Type", options: ["Single","Double","Automatic"] },
  default: { label: "Size", options: ["S","M","L","XL"] }
};
function getVariantForCategory(cat){
  if(!cat) return VARIANT_CONFIG.default;
  const key = cat.toLowerCase().replace(/ /g,'_');
  return VARIANT_CONFIG[key] || VARIANT_CONFIG.default;
}
let CATEGORIES = [];
let CATEGORY_COUNTS = {};
let IS_CHECKING_OUT=false;
function safe(id){ return document.getElementById(id) }
async function init(){
  try{
    const su=localStorage.getItem('sf_user');
    if(su){ try{ user=JSON.parse(su); }catch{} }
    const sc=localStorage.getItem('sf_cart_'+(user?.email?.toLowerCase()||'guest'));
    if(sc){ try{ CART=JSON.parse(sc)||[]; }catch{} }
    await renderCategories();
    const r = await fetch(API_BASE+'/api/products');
    const d = await r.json();
    PRODUCTS = Array.isArray(d)? d : (d.products || d.items || []);
    renderProducts(PRODUCTS);
    await updateCategoryCounts();
    updateAll();
    loadOrderCount();
    initStates();
    const dt=safe('c_date');
    if(dt) dt.min=new Date().toISOString().split('T')[0];
  }catch(e){
    console.log(e);
    renderProducts([]);
  }
}
async function renderCategories(){
  const container = safe('catFilters');
  if(!container) return;
  try{
    const r = await fetch(API_BASE+'/api/categories');
    const d = await r.json();
    CATEGORIES = d.categories || d || [];
  }catch(e){
    CATEGORIES = [{id:"all", name:"All", icon:"🛍️"}];
  }
  try{
    const rc = await fetch(API_BASE+'/api/categories/counts');
    if(rc.ok){ CATEGORY_COUNTS = await rc.json(); }
  }catch{}
  container.innerHTML = '';
  CATEGORIES.forEach(cat=>{
    const count = CATEGORY_COUNTS[cat.id] ?? 0;
    const btn = document.createElement('button');
    btn.innerHTML = `${cat.icon||''} ${cat.name} <span style="background:#1e1e1e;border:1px solid #2a2a2a;padding:2px 8px;border-radius:20px;margin-left:6px;font-size:11px;color:#ff2d55">${count}</span>`;
    if(cat.id==='all') btn.classList.add('active');
    btn.onclick = (ev)=> filterCat(cat.id, ev.currentTarget);
    container.appendChild(btn);
  });
}
async function updateCategoryCounts(){
  if(Object.keys(CATEGORY_COUNTS).length===0){
    CATEGORY_COUNTS = {all: PRODUCTS.length};
    PRODUCTS.forEach(p=>{
      const c = (p.category||'').toLowerCase();
      CATEGORY_COUNTS[c] = (CATEGORY_COUNTS[c]||0)+1;
    });
  }
  const container = safe('catFilters');
  if(!container) return;
  container.querySelectorAll('button').forEach((btn, idx)=>{
    const cat = CATEGORIES[idx];
    if(!cat) return;
    const count = CATEGORY_COUNTS[cat.id] ?? CATEGORY_COUNTS[cat.id.toLowerCase()] ?? 0;
    const totalForAll = CATEGORY_COUNTS['all'] ?? PRODUCTS.length;
    const displayCount = cat.id==='all' ? totalForAll : count;
    btn.innerHTML = `${cat.icon||''} ${cat.name} <span style="background:#1e1e1e;border:1px solid #2a2a2a;padding:2px 8px;border-radius:20px;margin-left:6px;font-size:11px;color:${displayCount>0?'#0f0':'#666'}">${displayCount}</span>`;
  });
}
function initStates(){ const s=safe('c_state'); if(!s) return; s.innerHTML='<option value="">Select State</option>'; Object.keys(STATES).forEach(st=>{ const o=document.createElement('option'); o.value=st; o.textContent=st; s.appendChild(o); }); }
function loadLGAs(){ const stEl=safe('c_state'); const lga=safe('c_lga'); if(!stEl||!lga) return; const st=stEl.value; lga.innerHTML='<option value="">Select LGA</option>'; (STATES[st]||[]).forEach(l=>{ const o=document.createElement('option'); o.value=l; o.textContent=l; lga.appendChild(o); }); }
function showToast(m){ const t=safe('toast'); if(!t) return; t.innerText=m; t.style.display='block'; setTimeout(()=>t.style.display='none',2500); }
function renderProducts(list){
  const g=safe('grid'); if(!g) return; g.innerHTML='';
  if(!list.length){ g.innerHTML='<div style="grid-column:1/3;text-align:center;color:#666;padding:30px">No products</div>'; return; }
  list.forEach(p=>{
    const variant = getVariantForCategory(p.category);
    const card=document.createElement('div'); card.className='card'; card.style.position='relative';
    const img=document.createElement('img'); img.src=p.image||PH; img.loading='lazy';
    const name=document.createElement('div'); name.style.cssText='font-weight:700;margin-top:6px;font-size:14px'; name.textContent=p.name;
    const cat=document.createElement('div'); cat.style.cssText='font-size:11px;color:#666;margin:2px 0'; cat.textContent=(p.category||'').replace(/_/g,' ').toUpperCase();
    const price=document.createElement('div'); price.style.color='#aaa'; price.textContent='₦'+Number(p.price).toLocaleString();
    const stock=document.createElement('div'); stock.style.cssText='font-size:11px;color:#0f0;margin:2px 0 6px'; stock.textContent='In Stock';
    const dropdown=document.createElement('div');
    dropdown.style.cssText='display:none;position:absolute;bottom:55px;left:10px;right:10px;background:#111;border:1px solid #ff2d55;border-radius:12px;padding:10px;z-index:5;';
    const dropTitle=document.createElement('div');
    dropTitle.style.cssText='font-size:12px;font-weight:bold;color:#fff;margin-bottom:8px;display:flex;justify-content:space-between;';
    dropTitle.innerHTML=`<span>Choose ${variant.label}</span> <span style="cursor:pointer" class="closeDrop">✕</span>`;
    const optionsWrap=document.createElement('div'); optionsWrap.style.cssText='display:flex;flex-wrap:wrap;gap:6px';
    let selectedVal = null;
    variant.options.forEach(opt=>{
      const b=document.createElement('button'); b.textContent=opt;
      b.style.cssText='padding:6px 12px;border:1px solid #333;background:#1e1e1e;color:#fff;border-radius:20px;font-size:12px;cursor:pointer';
      b.onclick=()=>{ optionsWrap.querySelectorAll('button').forEach(x=>{ x.style.background='#1e1e1e'; }); b.style.background='#ff2d55'; selectedVal=opt; };
      optionsWrap.appendChild(b);
    });
    const confirmBtn=document.createElement('button'); confirmBtn.textContent='Confirm & Add to Cart';
    confirmBtn.style.cssText='width:100%;margin-top:10px;background:#ff2d55;color:#fff;border:none;padding:10px;border-radius:8px;font-weight:bold;cursor:pointer';
    confirmBtn.onclick=()=>{ if(!selectedVal){ showToast('Choose '+variant.label); return; } dropdown.style.display='none'; addToCart(p.id, selectedVal, variant.label); };
    dropdown.append(dropTitle,optionsWrap,confirmBtn);
    dropTitle.querySelector('.closeDrop').onclick=()=> dropdown.style.display='none';
    const btn=document.createElement('button'); btn.textContent='Add to Cart'; btn.className='btn';
    btn.onclick=()=>{ dropdown.style.display = dropdown.style.display==='none' || !dropdown.style.display ? 'block' : 'none'; };
    card.append(img,name,cat,price,stock,dropdown,btn); g.appendChild(card);
  });
}
async function filterCat(c,b){
  if(b){ document.querySelectorAll('#catFilters button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); }
  if(c==='all'){ renderProducts(PRODUCTS); return; }
  const filtered = PRODUCTS.filter(x=> (x.category||'').toLowerCase().includes(c.toLowerCase()));
  renderProducts(filtered);
}
function openMenu(){ safe('menuDrawer')?.classList.add('open'); safe('overlay')?.classList.add('show'); }
function openCart(){ safe('cartDrawer')?.classList.add('open'); safe('overlay')?.classList.add('show'); }
function closeAll(){ ['menuDrawer','cartDrawer','authModal','ordersModal'].forEach(id=>{ safe(id)?.classList.remove('open','show'); }); safe('overlay')?.classList.remove('show'); }
function openAuth(){closeAll(); safe('authModal')?.classList.add('show'); safe('overlay')?.classList.add('show');}
function toggleAuth(){ authMode=authMode==='signup'?'login':'signup'; const t=safe('authTitle'); if(t) t.innerText=authMode==='signup'?'Create Account':'Welcome Back'; const nm=safe('a_name'); if(nm) nm.style.display=authMode==='signup'?'block':'none'; const sw=safe('authSwitch'); if(sw) sw.innerText=authMode==='signup'?'Have account? Login':'Need account? Create'; }
function createCartRow(p,i){
  const row=document.createElement('div'); row.style.cssText='display:flex;gap:10px;background:#151515;border:1px solid #222;padding:10px;border-radius:14px;margin-bottom:8px';
  const img=document.createElement('img'); img.src=p.image||PH; img.style.cssText='width:56px;height:56px;border-radius:10px;object-fit:cover';
  const info=document.createElement('div'); info.style.flex='1';
  const name=document.createElement('div'); name.style.fontSize='13px'; name.textContent=p.name + (p.selectedSize?` (${p.selectedSize})`:'');
  const price=document.createElement('div'); price.style.color='#888'; price.textContent=`₦${p.price} x ${p.qty}`;
  const qtyBox=document.createElement('div'); qtyBox.style.cssText='display:flex;gap:6px;margin-top:6px;';
  const dec=document.createElement('button'); dec.textContent='-'; dec.style.cssText='width:28px;height:28px;background:#222;color:#fff;border:none;border-radius:6px;'; dec.onclick=()=>changeQty(i,-1);
  const qty=document.createElement('span'); qty.textContent=p.qty;
  const inc=document.createElement('button'); inc.textContent='+'; inc.style.cssText='width:28px;height:28px;background:#222;color:#fff;border:none;border-radius:6px;'; inc.onclick=()=>changeQty(i,1);
  qtyBox.append(dec,qty,inc); info.append(name,price,qtyBox);
  const del=document.createElement('button'); del.textContent='✕'; del.style.cssText='background:#222;color:#fff;width:28px;height:28px;border:none;border-radius:8px;'; del.onclick=()=>removeItem(i);
  row.append(img,info,del); return row;
}
function updateAll(){
  try{
    const who=safe('who'); if(who){ const emailName=user?user.email.split('@')[0]:'Guest'; const displayName=user?(user.name && user.name.toLowerCase()!=='admin'?user.name:emailName):'Guest'; who.innerText=user?`Hi, ${displayName} 👋`:'Guest — Login'; }
    const qty=CART.reduce((s,c)=>s+(c.qty||0),0);
    ['count','cartCount2','cartCount','bottomCount'].forEach(id=>{ const el=safe(id); if(el) el.innerText=qty; });
    const list=safe('cartList'); if(!list) return; list.innerHTML=''; let total=0;
    CART.forEach((p,i)=>{ total+= (Number(p.price)||0)*(p.qty||1); list.appendChild(createCartRow(p,i)); });
    const ct=safe('c_total'); if(ct) ct.innerText='₦'+total.toLocaleString();
    if(CART.length===0){ list.innerHTML='<div style="text-align:center;color:#666;margin-top:40px">Cart empty</div>'; }
  }catch(e){}
}
async function syncAddToBackend(product_id, qty=1, size='M'){
  if(!user?.email) return false;
  try{
    const r=await fetch(API_BASE+'/api/cart/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ email:user.email.toLowerCase(), product_id:Number(product_id), qty:Number(qty), size:size, color:'' })});
    return r.ok;
  }catch{ return false; }
}
async function syncFullCartToBackend(){
  if(!user?.email || IS_CHECKING_OUT) return;
  try{
    await fetch(API_BASE+'/api/cart/clear',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:user.email.toLowerCase()}) });
    for(const c of CART){
      await fetch(API_BASE+'/api/cart/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ email:user.email.toLowerCase(), product_id:Number(c.id||c.product_id), qty:Number(c.qty||1), size:c.size||c.selectedSize||'M', color:'' })});
    }
  }catch{}
}
async function doAuth(){
  const name=safe('a_name')?.value.trim()||""; const email=safe('a_email')?.value.trim().toLowerCase()||""; const pass=safe('a_pass')?.value||""; const msgEl=safe('authMsg');
  if(!email||!pass) return alert('Fill email & pass');
  if(msgEl) msgEl.innerText='Checking...';
  try{
    const r=await fetch(API_BASE+'/api/auth/'+(authMode==='signup'?'signup':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass,name})});
    const d=await r.json();
    if(d.ok || d.user){
      if(authMode==='signup'){ if(msgEl) msgEl.innerText='Created! Login'; toggleAuth(); }
      else { user=d.user; localStorage.setItem('sf_user',JSON.stringify(user)); closeAll(); updateAll(); loadOrderCount(); }
    }else{ if(msgEl) msgEl.innerText=d.error||'Error'; }
  }catch(e){ if(msgEl) msgEl.innerText='API error'; }
}
function logout(){ localStorage.removeItem('sf_user'); user=null; CART=[]; updateAll(); closeAll(); }
function saveCart(){ localStorage.setItem('sf_cart_'+(user?.email?.toLowerCase()||'guest'), JSON.stringify(CART)); updateAll(); }
async function addToCart(id, selectedSize='M', sizeLabel='Size'){
  if(!user){ openAuth(); return; }
  const p=PRODUCTS.find(x=>String(x.id)===String(id)); if(!p) return;
  const e=CART.find(c=> (String(c.id)===String(id) || String(c.product_id)===String(id)) && (c.selectedSize===selectedSize || c.size===selectedSize));
  if(e) e.qty++; else CART.push({...p, product_id:p.id, qty:1, size:selectedSize, selectedSize:selectedSize, sizeLabel:sizeLabel, color:''});
  saveCart(); await syncAddToBackend(id, 1, selectedSize);
}
async function changeQty(i,d){
  if(!CART[i]) return;
  CART[i].qty=Math.max(1,(CART[i].qty||1)+d);
  saveCart();
  await syncFullCartToBackend();
}
async function removeItem(i){
  CART.splice(i,1); saveCart(); await syncFullCartToBackend();
}
function createOrderCard(o){
  const card=document.createElement('div'); card.style.cssText='background:#151515;border:1px solid #222;padding:12px;border-radius:14px;margin-bottom:10px';
  const st=(o.status||'pending').toUpperCase();
  card.innerHTML=`<b>#${o.id} • ₦${Number(o.total).toLocaleString()}</b> <span style="background:#222;color:#ffcc00;padding:2px 8px;border-radius:10px;font-size:11px;margin-left:8px">${st}</span><div style="color:#888;font-size:12px;margin-top:6px;white-space:pre-line">${o.address||''}\n${o.state||''} ${o.lga||''} • ${o.delivery_date||''}\n${o.phone||''}\nItems: ${o.items||''}</div>`;
  const delBtn=document.createElement('button'); delBtn.textContent='Delete'; delBtn.style.cssText='margin-top:8px;background:#222;color:#f55;border:1px solid #333;padding:6px 10px;border-radius:8px'; delBtn.onclick=()=>deleteOrder(o.id);
  card.appendChild(delBtn); return card;
}
async function loadOrderCount(){ if(!user) return; try{ const r=await fetch(API_BASE+'/api/orders?email='+encodeURIComponent(user.email.toLowerCase().trim())); const d=await r.json(); const el=safe('menuOrderCount'); if(Array.isArray(d)&&el) el.innerText=d.length; }catch{} }
async function viewOrders(){
  if(!user) return openAuth();
  closeAll(); safe('ordersModal')?.classList.add('show'); safe('overlay')?.classList.add('show');
  const list=safe('ordersList'); if(list) list.innerHTML='<div style="color:#666;text-align:center;padding:20px">Loading...</div>';
  try{
    const email = user.email.toLowerCase().trim();
    const r=await fetch(API_BASE+'/api/orders?email='+encodeURIComponent(email));
    let orders=await r.json();
    if(!Array.isArray(orders)) orders=[];
    if(!list) return; list.innerHTML='';
    if(!orders.length){ list.innerHTML='<div style="color:#666;text-align:center;padding:20px">No orders for<br>'+email+'</div>'; return; }
    orders.forEach(o=>list.appendChild(createOrderCard(o)));
  }catch{ if(list) list.innerHTML='<div style="color:#f55;text-align:center">Failed</div>'; }
}
async function deleteOrder(id){
  if(!confirm('Delete #'+id+'?')) return;
  try{
    const r=await fetch(API_BASE+'/api/orders?id='+id+'&email='+encodeURIComponent(user.email.toLowerCase()),{method:'DELETE'});
    const d=await r.json(); if(d.ok){ viewOrders(); loadOrderCount(); }
  }catch{}
}
async function doCheckout(){
  if(!user) return openAuth();
  const phone=safe('c_phone')?.value.trim(); const addr=safe('c_address')?.value.trim();
  const state=safe('c_state')?.value; const lga=safe('c_lga')?.value;
  const date=safe('c_date')?.value; const time=safe('c_time')?.value;
  if(!phone||!state||!lga||!addr||!date) return alert('Fill all delivery fields');
  if(CART.length===0) return alert('Cart empty');
  const total=CART.reduce((s,c)=>s+(Number(c.price)||0)*(c.qty||1),0);
  const itemsText=CART.map(c=>`${c.name} (${c.selectedSize||c.size||'M'}) x${c.qty}`).join(', ');
  const fullAddr=`${addr}, ${lga}, ${state}`;
  IS_CHECKING_OUT=true;
  localStorage.setItem('sf_just_ordered', Date.now().toString());
  const cartBackup = [...CART];
  CART=[]; 
  Object.keys(localStorage).forEach(k=>{ if(k.startsWith('sf_cart_')) localStorage.setItem(k, JSON.stringify([])); });
  localStorage.setItem('sf_cart_'+user.email.toLowerCase(), JSON.stringify([]));
  updateAll();
  ['count','cartCount2','cartCount','bottomCount'].forEach(id=>{ const el=safe(id); if(el) el.innerText='0'; });
  const list=safe('cartList'); if(list) list.innerHTML='<div style="text-align:center;color:#ffcc00;padding:20px">Placing order...</div>';
  try{
    const r=await fetch(API_BASE+'/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email.toLowerCase().trim(),items:itemsText,total:total,address:fullAddr,phone:phone,state:state,lga:lga,delivery_date:date,delivery_time:time||''})});
    const d=await r.json();
    if(d.ok){
      try{ await fetch(API_BASE+'/api/cart/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email.toLowerCase()})}); }catch{}
      if(list) list.innerHTML='<div style="text-align:center;color:#0f0;padding:30px">✅ Order #'+d.order_id+' placed! Cart cleared</div>';
      const ct=safe('c_total'); if(ct) ct.innerText='₦0';
      setTimeout(()=>{ closeAll(); loadOrderCount(); viewOrders(); IS_CHECKING_OUT=false; }, 1500);
      showToast('Order #'+d.order_id+' placed ✅');
    }else{
      CART=cartBackup; saveCart(); alert(d.error||'Failed'); IS_CHECKING_OUT=false;
      localStorage.removeItem('sf_just_ordered');
    }
  }catch(e){
    CART=cartBackup; saveCart(); alert('Error: '+e.message); IS_CHECKING_OUT=false;
    localStorage.removeItem('sf_just_ordered');
  }
}
if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', init); }else{ init(); }