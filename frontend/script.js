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

// === VARIANT CHOICES PER CATEGORY ===
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
    if(user?.email){
      await loadCartFromBackend(false);
      setInterval(()=> { if(!IS_CHECKING_OUT) loadCartFromBackend(true) }, 5000);
    }
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

async function renderCategories(){
  const container = safe('catFilters');
  if(!container) return;
  try{
    const r = await fetch(API_BASE+'/api/categories');
    const d = await r.json();
    CATEGORIES = d.categories || d || [];
  }catch(e){
    CATEGORIES = [
      {id:"all", name:"All", icon:"🛍️"},
      {id:"men_clothing", name:"Men Clothing", icon:"👕"},
      {id:"gadgets", name:"Gadgets", icon:"📱"}
    ];
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
    if(cat.id==='all'){
      btn.classList.add('active');
      if(!CATEGORY_COUNTS['all']) btn.innerHTML = `${cat.icon||''} ${cat.name} <span style="background:#1e1e1e;border:1px solid #2a2a2a;padding:2px 8px;border-radius:20px;margin-left:6px;font-size:11px;color:#ff2d55">${PRODUCTS.length || count}</span>`;
    }
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
function showToast(m){ const t=safe('toast'); if(!t) return console.log(m); t.innerText=m; t.style.display='block'; setTimeout(()=>t.style.display='none',2500); }

function renderProducts(list){
  const g=safe('grid'); if(!g) return; g.innerHTML='';
  if(!list.length){
    const e=document.createElement('div');
    e.style.cssText='grid-column:1/3;text-align:center;color:#666;padding:30px';
    e.textContent='No products in this category — go to /admin to add';
    g.appendChild(e); return;
  }
  list.forEach(p=>{
    const variant = getVariantForCategory(p.category);
    const card=document.createElement('div'); card.className='card';
    const img=document.createElement('img'); img.src=p.image||PH; img.loading='lazy'; img.onerror=function(){this.src=PH};
    const name=document.createElement('div'); name.style.cssText='font-weight:700;margin-top:6px;font-size:14px'; name.textContent=p.name;
    const cat=document.createElement('div'); cat.style.cssText='font-size:11px;color:#666;margin:2px 0'; cat.textContent=(p.category||'').replace(/_/g,' ').toUpperCase();
    const price=document.createElement('div'); price.style.color='#aaa'; price.textContent='₦'+Number(p.price).toLocaleString();
    const stock=document.createElement('div'); stock.style.cssText='font-size:11px;color:#0f0;margin:2px 0'; stock.textContent='In Stock';

    const selWrap=document.createElement('div'); selWrap.style.cssText='margin:8px 0;display:flex;flex-wrap:wrap;gap:4px';
    const selLabel=document.createElement('div'); selLabel.style.cssText='font-size:11px;color:#ff2d55;width:100%'; selLabel.textContent=variant.label+':';
    selWrap.appendChild(selLabel);
    let selectedVal = variant.options[0];
    variant.options.forEach(opt=>{
      const b=document.createElement('button');
      b.textContent=opt;
      b.style.cssText='padding:4px 8px;border:1px solid #333;background:#151515;color:#fff;border-radius:6px;font-size:11px;cursor:pointer';
      if(opt===selectedVal){ b.style.background='#ff2d55'; b.style.borderColor='#ff2d55'; }
      b.onclick=()=>{
        selWrap.querySelectorAll('button').forEach(x=>{ x.style.background='#151515'; x.style.borderColor='#333'; });
        b.style.background='#ff2d55'; b.style.borderColor='#ff2d55';
        selectedVal=opt;
      };
      selWrap.appendChild(b);
    });

    const btn=document.createElement('button'); btn.textContent='Add to Cart'; btn.className='btn'; 
    btn.onclick=()=>addToCart(p.id, selectedVal, variant.label);
    
    card.append(img,name,cat,price,stock,selWrap,btn); g.appendChild(card);
  });
}

async function filterCat(c,b){
  if(b){
    document.querySelectorAll('#catFilters button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
  }
  if(c==='All' || c==='all'){
    renderProducts(PRODUCTS);
    return;
  }
  const filtered = PRODUCTS.filter(x=>{
    const cat = (x.category||'').toLowerCase();
    return cat === c.toLowerCase() || cat.includes(c.toLowerCase());
  });
  if(filtered.length>0){
    renderProducts(filtered);
  } else {
    try{
      showToast('Loading '+c.replace(/_/g,' ')+'...');
      const r = await fetch(`${API_BASE}/api/products?category=${encodeURIComponent(c)}`);
      const d = await r.json();
      const list = Array.isArray(d)? d : (d.products||[]);
      renderProducts(list);
    }catch(e){
      renderProducts([]);
    }
  }
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
  const price=document.createElement('div'); price.style.color='#888'; price.textContent=`₦${p.price} x ${p.qty} ${p.sizeLabel||''}:${p.selectedSize||p.size||''}`;
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
  if(CART.length===0){ const empty=document.createElement('div'); empty.style.cssText='text-align:center;color:#666;margin-top:40px'; empty.textContent='Cart empty - add items, they will show in mobile app too'; list.appendChild(empty); }
  const fn=safe('c_fullname'); if(fn&&user&&!fn.value) fn.value=user.name||'';
}catch(e){console.log('updateAll',e)}}

async function loadCartFromBackend(silent=false){
  if(!user?.email) return;
  if(IS_CHECKING_OUT) return;
  try{
    const r=await fetch(API_BASE+'/api/cart?email='+encodeURIComponent(user.email.toLowerCase()));
    const d=await r.json();
    if(d.items && Array.isArray(d.items)){
      const backendCart = d.items.map(it=>({
        id: it.product_id || it.id,
        product_id: it.product_id || it.id,
        name: it.name,
        price: it.price,
        image: it.image,
        category: it.category,
        qty: it.qty||1,
        size: it.size||'M',
        selectedSize: it.size||'M',
        color: it.color||'',
        sizeLabel: getVariantForCategory(it.category).label
      }));
      if(CART.length===0){
        localStorage.setItem('sf_cart_'+user.email.toLowerCase(), JSON.stringify([]));
        localStorage.setItem('sf_cart_guest', JSON.stringify([]));
        updateAll();
        return;
      }
      if(backendCart.length===0 && CART.length>0 && !silent){ return; }
      if(backendCart.length>0 && JSON.stringify(backendCart)!== JSON.stringify(CART)){
        CART = backendCart;
        localStorage.setItem('sf_cart_'+user.email.toLowerCase(), JSON.stringify(CART));
        updateAll();
        if(!silent) showToast(`${backendCart.length} items synced from app ✅`);
      }
    }
  }catch(e){ console.log('loadCartFromBackend error',e) }
}

async function syncAddToBackend(product_id, qty=1, size='M'){
  if(!user?.email) return false;
  try{
    const r=await fetch(API_BASE+'/api/cart/add',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ email:user.email.toLowerCase(), product_id:Number(product_id), qty:Number(qty), size:size, color:'' })
    });
    const d=await r.json();
    return r.ok && (d.ok||d.items!==undefined);
  }catch(e){ console.log('syncAdd error',e); return false; }
}

async function syncFullCartToBackend(){
  if(!user?.email) return;
  if(IS_CHECKING_OUT) return;
  try{
    await fetch(API_BASE+'/api/cart/clear',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:user.email.toLowerCase()}) });
    for(const c of CART){
      await fetch(API_BASE+'/api/cart/add',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ email:user.email.toLowerCase(), product_id:Number(c.id||c.product_id), qty:Number(c.qty||1), size:c.size||c.selectedSize||'M', color:c.color||'' })
      });
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
        await loadCartFromBackend(false);
        const guestCart = localStorage.getItem('sf_cart_guest');
        if(guestCart){
          try{
            const gItems = JSON.parse(guestCart);
            if(gItems.length>0){
              CART = [...CART,...gItems];
              await syncFullCartToBackend();
              localStorage.removeItem('sf_cart_guest');
              saveCart();
            }
          }catch{}
        }
        closeAll(); updateAll(); loadOrderCount(); showToast('Welcome '+user.email);
        if(msgEl) msgEl.innerText='';
        setInterval(()=> { if(!IS_CHECKING_OUT) loadCartFromBackend(true) }, 5000);
      }
    }else{
      if(msgEl) msgEl.innerText=d.error||'Error';
    }
  }catch(e){ if(msgEl) msgEl.innerText='API error: '+e.message }
}

function logout(){ localStorage.removeItem('sf_user'); user=null; CART=[]; updateAll(); closeAll(); showToast('Logged out'); setTimeout(()=>openAuth(),500); }
function saveCart(){ localStorage.setItem('sf_cart_'+(user?.email?.toLowerCase()||'guest'), JSON.stringify(CART)); updateAll(); }

async function addToCart(id, selectedSize='M', sizeLabel='Size'){
  if(!user){ openAuth(); return showToast('Login first to sync cart to app'); }
  const p=PRODUCTS.find(x=>String(x.id)===String(id));
  if(!p){ return showToast('Product not loaded yet'); }
  const e=CART.find(c=> (String(c.id)===String(id) || String(c.product_id)===String(id)) && (c.selectedSize===selectedSize || c.size===selectedSize));
  if(e) e.qty++;
  else CART.push({...p, product_id:p.id, qty:1, size:selectedSize, selectedSize:selectedSize, sizeLabel:sizeLabel, color:''});
  saveCart();
  showToast(`${sizeLabel}: ${selectedSize} - Adding...`);
  const ok=await syncAddToBackend(id, 1, selectedSize);
  if(ok){ showToast(`Added ${selectedSize} ✅ - check app`); }
  else { showToast('Added locally, retrying sync...'); setTimeout(()=> syncFullCartToBackend(), 1500); }
}

async function changeQty(i,d){
  if(!CART[i]) return;
  CART[i].qty=Math.max(1,(CART[i].qty||1)+d);
  saveCart();
  await syncFullCartToBackend();
  showToast('Qty updated');
}
async function removeItem(i){
  const item = CART[i];
  CART.splice(i,1);
  saveCart();
  if(item && user?.email){
    try{ await fetch(`${API_BASE}/api/cart?email=${encodeURIComponent(user.email)}&product_id=${item.id||item.product_id}`, {method:'DELETE'}); }catch{}
  }
  await syncFullCartToBackend();
  showToast('Removed');
}

function createOrderCard(o){
  const card=document.createElement('div'); card.className='orderCard';
  const st=(o.status||'pending').toUpperCase();
  const col=o.status==='delivered'?'#0f0':'#ffcc00';
  const title=document.createElement('div'); 
  title.innerHTML=`<b>#${o.id} • ₦${Number(o.total).toLocaleString()}</b> <span style="background:#222;color:${col};padding:2px 8px;border-radius:10px;font-size:11px;margin-left:8px">${st}</span>`;
  const details=document.createElement('div'); details.style.cssText='color:#888;font-size:12px;margin-top:6px;white-space:pre-line';
  details.textContent=`${o.address||''}\n${o.state||''} ${o.lga||''} • ${o.delivery_date||''} ${o.delivery_time||''}\n${o.phone||''}\nItems: ${o.items||''}`;
  const btnWrap=document.createElement('div'); btnWrap.style.marginTop='8px';
  const delBtn=document.createElement('button'); delBtn.textContent='Delete'; delBtn.style.cssText='background:#222;color:#f55;border:1px solid #333;padding:8px 12px;border-radius:10px;cursor:pointer'; delBtn.onclick=()=>deleteOrder(o.id);
  btnWrap.appendChild(delBtn); card.append(title,details,btnWrap); return card;
}

async function loadOrderCount(){ if(!user) return; try{ const r=await fetch(API_BASE+'/api/orders?email='+encodeURIComponent(user.email)); const d=await r.json(); const el=safe('menuOrderCount'); if(Array.isArray(d)&&el) el.innerText=d.length; }catch{} }

async function viewOrders(){ 
  if(!user) return openAuth(); 
  closeAll(); 
  safe('ordersModal')?.classList.add('show'); 
  safe('overlay')?.classList.add('show'); 
  try{ 
    const r=await fetch(API_BASE+'/api/orders?email='+encodeURIComponent(user.email)); 
    const orders=await r.json(); 
    const list=safe('ordersList'); 
    if(!list) return; 
    list.innerHTML=''; 
    if(!Array.isArray(orders)||!orders.length){ 
      const empty=document.createElement('div'); 
      empty.style.cssText='color:#666;text-align:center'; 
      empty.textContent='No orders yet'; 
      list.appendChild(empty); 
      return; 
    } 
    orders.forEach(o=>list.appendChild(createOrderCard(o))); 
  }catch(e){} 
}

async function deleteOrder(id){ 
  if(!confirm('Delete #'+id+'?')) return; 
  try{ 
    const r=await fetch(API_BASE+'/api/orders?id='+id+'&email='+encodeURIComponent(user.email),{method:'DELETE'}); 
    const d=await r.json(); 
    if(d.ok){ 
      showToast('Deleted'); 
      viewOrders(); 
      loadOrderCount(); 
    } else showToast('Delete failed'); 
  }catch{ 
    showToast('Delete error'); 
  } 
}

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
  const itemsText=CART.map(c=>`${c.name} (${c.selectedSize||c.size||'M'}) x${c.qty}`).join(', ');
  const fullAddr=`${addr}, ${lga}, ${state}`;
  IS_CHECKING_OUT=true;
  try{
    const r=await fetch(API_BASE+'/api/orders',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        email:user.email,
        items:itemsText,
        total:total,
        address:fullAddr,
        phone:phone,
        state:state,
        lga:lga,
        delivery_date:date,
        delivery_time:time||''
      })
    });
    const d=await r.json();
    if(d.ok){
      showToast('Order #'+d.order_id+' placed');
      CART=[];
      localStorage.setItem('sf_cart_'+user.email.toLowerCase(), JSON.stringify([]));
      localStorage.setItem('sf_cart_guest', JSON.stringify([]));
      updateAll();
      try{ 
        await fetch(API_BASE+'/api/cart/clear',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({email:user.email.toLowerCase()})
        }); 
      }catch{}
      ['count','cartCount2','cartCount','bottomCount'].forEach(id=>{ const el=safe(id); if(el) el.innerText='0'; });
      const list=safe('cartList');
      if(list) list.innerHTML='<div style="text-align:center;color:#0f0;padding:20px">✅ Order placed! Cart cleared</div>';
      const ct=safe('c_total'); if(ct) ct.innerText='₦0';
      closeAll(); 
      loadOrderCount();
    }else{
      alert(d.error||'Failed');
    }
  }catch(e){ 
    alert('Checkout error: '+e.message);
  }
  finally{
    setTimeout(()=>{ IS_CHECKING_OUT=false; }, 3000);
  }
}