let PRODUCTS=[],CART=[],user=null,authMode='signup',deferredPrompt=null;
const PH='https://via.placeholder.com/400x400.png?text=SUCCESS';
const STATES={"Lagos":["Ikeja","Lekki","Yaba","Surulere","Ikorodu","Ajah","Badagry","Alimosho","Oshodi"],"Abuja FCT":["AMAC","Gwagwalada","Kuje","Bwari","Kwali"],"Oyo":["Ibadan North","Ibadan South","Ogbomosho","Oyo"],"Rivers":["Port Harcourt","Obio-Akpor","Eleme"],"Others":["Other"]};

function init(){
  let su=localStorage.getItem('sf_user');
  if(su){try{user=JSON.parse(su);}catch{}}
  let sc=localStorage.getItem('sf_cart_'+(user?.email||'guest'));
  if(sc){try{CART=JSON.parse(sc);}catch{}}
  fetch('/api/products').then(r=>r.json()).then(d=>{let a=Array.isArray(d)?d:(d.products||[]);PRODUCTS=a;render(a); if(user) loadCartFromBackend(); });
  updateAll();loadOrderCount();initStates();
  let dt=document.getElementById('c_date');if(dt)dt.min=new Date().toISOString().split('T')[0];
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;let b=document.getElementById('installBtn');if(b)b.style.display='block';});
  let ib=document.getElementById('installBtn');if(ib)ib.addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;ib.style.display='none';});
}

function initStates(){let s=document.getElementById('c_state');if(!s)return;s.innerHTML='<option value="">Select State</option>';Object.keys(STATES).forEach(st=>{let o=document.createElement('option');o.value=st;o.textContent=st;s.appendChild(o);});}
function loadLGAs(){let st=document.getElementById('c_state').value;let lga=document.getElementById('c_lga');lga.innerHTML='<option value="">Select LGA</option>';(STATES[st]||[]).forEach(l=>{let o=document.createElement('option');o.value=l;o.textContent=l;lga.appendChild(o);});}
function showToast(m){let t=document.getElementById('toast');t.innerText=m;t.style.display='block';setTimeout(()=>t.style.display='none',2500);}
function render(list){let g=document.getElementById('grid');g.innerHTML='';if(!list.length){g.innerHTML='<div style="grid-column:1/3;text-align:center;color:#666;padding:30px">No products</div>';return;}list.forEach(p=>{let img=p.image||PH;g.innerHTML+=`<div class="card"><img src="${img}" onerror="this.src='${PH}'"><div style="font-weight:700;margin-top:6px;font-size:14px">${p.name}</div><div style="color:#aaa">$${p.price}</div><button onclick="addToCart(${p.id})">Add to Cart</button></div>`;});}
function filterCat(c,b){if(b){document.querySelectorAll('.filters button').forEach(x=>x.classList.remove('active'));b.classList.add('active');}render(c==='All'?PRODUCTS:PRODUCTS.filter(x=>(x.category||'').toLowerCase().includes(c.toLowerCase())));}
function openMenu(){document.getElementById('menuDrawer').classList.add('open');document.getElementById('overlay').classList.add('show');}
function openCart(){document.getElementById('cartDrawer').classList.add('open');document.getElementById('overlay').classList.add('show');}
function closeAll(){document.getElementById('menuDrawer').classList.remove('open');document.getElementById('cartDrawer').classList.remove('open');document.getElementById('authModal').classList.remove('show');document.getElementById('ordersModal').classList.remove('show');document.getElementById('overlay').classList.remove('show');}
function openAuth(){closeAll();document.getElementById('authModal').classList.add('show');document.getElementById('overlay').classList.add('show');}
function toggleAuth(){authMode=authMode==='signup'?'login':'signup';document.getElementById('authTitle').innerText=authMode==='signup'?'Create Account':'Welcome Back';document.getElementById('a_name').style.display=authMode==='signup'?'block':'none';document.getElementById('authSwitch').innerText=authMode==='signup'?'Have account? Login':'Need account? Create';}
function updateAll(){
 let emailName=user?user.email.split('@')[0]:'Guest';
 let displayName=user?(user.name && user.name.toLowerCase()!=='admin'?user.name:emailName):'Guest';
 document.getElementById('who').innerText=user?`Hi, ${displayName} 👋`:'Guest — Login to shop';
 document.getElementById('status').innerText=user? (user.role==='admin'?'Admin • Manage store':`${CART.reduce((s,c)=>s+c.qty,0)} items • Pay on delivery`):'Secure • Pay on delivery';
 document.getElementById('avatar').innerText=user?displayName[0].toUpperCase():'S';
 document.getElementById('menuName').innerText=user?(displayName+(user.role==='admin'?' (admin)':'')):'Guest';
 document.getElementById('menuEmail').innerText=user?user.email:'Not logged in';
 document.getElementById('menuLogin').style.display=user?'none':'block';
 document.getElementById('menuLogout').style.display=user?'block':'none';
 document.getElementById('menuAdmin').style.display=(user&&user.role==='admin')?'block':'none';
 let qty=CART.reduce((s,c)=>s+c.qty,0);
 document.getElementById('count').innerText=qty;document.getElementById('cartCount2').innerText=qty;document.getElementById('bottomCount').innerText=qty;
 let list=document.getElementById('cartList');list.innerHTML='';let total=0;
 CART.forEach((p,i)=>{total+=p.price*p.qty;list.innerHTML+=`<div style="display:flex;gap:10px;background:#151515;border:1px solid #222;padding:10px;border-radius:14px;margin-bottom:8px"><img src="${p.image||PH}" style="width:56px;height:56px;border-radius:10px"><div style="flex:1"><div style="font-size:13px">${p.name}</div><div style="color:#888">$${p.price} x ${p.qty}</div><div style="display:flex;gap:6px;margin-top:6px"><button onclick="changeQty(${i},-1)" style="width:28px;height:28px;background:#222;color:#fff;border:none;border-radius:6px">-</button><span>${p.qty}</span><button onclick="changeQty(${i},1)" style="width:28px;height:28px;background:#222;color:#fff;border:none;border-radius:6px">+</button></div></div><button onclick="removeItem(${i})" style="background:#222;color:#fff;width:28px;height:28px;border:none;border-radius:8px">✕</button></div>`;});
 document.getElementById('c_total').innerText='$'+total;
 if(CART.length===0)list.innerHTML='<div style="text-align:center;color:#666;margin-top:40px">Cart empty</div>';
 let fn=document.getElementById('c_fullname');if(fn&&user&&!fn.value)fn.value=user.name||'';
}

// === NEW SYNC FUNCTIONS FOR MOBILE APP ===
async function loadCartFromBackend(){
  if(!user?.email) return;
  try{
    let r = await fetch('/api/cart?email='+encodeURIComponent(user.email.toLowerCase()));
    let d = await r.json();
    if(d.items && d.items.length){
      // Rebuild CART from backend items
      CART = d.items.map(it=>{
        let prod = PRODUCTS.find(p=>p.id==it.id) || it;
        return {...prod, qty:1, id:it.id, name:it.name||prod.name, price:it.price||prod.price, image:it.image||prod.image};
      });
      localStorage.setItem('sf_cart_'+user.email, JSON.stringify(CART));
      updateAll();
      console.log('Loaded cart from backend:', CART.length);
    }
  }catch(e){ console.log('load backend error',e) }
}

async function syncAddToBackend(product_id){
  if(!user?.email) return;
  try{
    await fetch('/api/cart/add',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({email:user.email.toLowerCase(), product_id:product_id})
    });
    console.log('Synced product',product_id,'for',user.email);
  }catch(e){ console.log('sync add failed',e) }
}

async function syncRemoveFromBackend(){
  // Re-sync whole cart after remove/qty change by clearing and re-adding
  if(!user?.email) return;
  try{
    // clear backend
    await fetch('/api/cart/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email.toLowerCase()})});
    // add all remaining
    for(let c of CART){
      for(let q=0;q<c.qty;q++){
        await fetch('/api/cart/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email.toLowerCase(), product_id:c.id})});
      }
    }
  }catch(e){ console.log('sync remove failed',e) }
}

async function doAuth(){let name=document.getElementById('a_name').value.trim();let email=document.getElementById('a_email').value.trim().toLowerCase();let pass=document.getElementById('a_pass').value;if(!email||!pass)return alert('Fill email & pass');document.getElementById('authMsg').innerText='Checking...';let url=authMode==='signup'?'/api/auth/signup':'/api/auth/login';let r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass,name})});let d=await r.json();if(d.ok){if(authMode==='signup'){document.getElementById('authMsg').innerText='Created! Now login';toggleAuth();showToast('Now login');}else{user=d.user;localStorage.setItem('sf_user',JSON.stringify(user));closeAll();updateAll();loadOrderCount();await loadCartFromBackend();showToast('Welcome');}}else{document.getElementById('authMsg').innerText=d.error||'Error';}}
function logout(){localStorage.removeItem('sf_user');user=null;CART=[];updateAll();closeAll();showToast('Logged out');setTimeout(()=>openAuth(),500);}
function saveCart(){localStorage.setItem('sf_cart_'+(user?.email||'guest'),JSON.stringify(CART));updateAll();}

function addToCart(id){
  if(!user){openAuth();return showToast('Login first');}
  let p=PRODUCTS.find(x=>x.id==id);if(!p)return;
  let e=CART.find(c=>c.id==id);if(e)e.qty++;else CART.push({...p,qty:1});
  saveCart();
  syncAddToBackend(id); // <-- THIS FIXES SYNC TO MOBILE APP
  showToast('Added ✅ synced to app');
}
function changeQty(i,d){CART[i].qty=Math.max(1,CART[i].qty+d);saveCart(); syncRemoveFromBackend();}
function removeItem(i){CART.splice(i,1);saveCart(); syncRemoveFromBackend();}

async function loadOrderCount(){if(!user)return;try{let r=await fetch('/api/orders?email='+encodeURIComponent(user.email));let d=await r.json();if(Array.isArray(d))document.getElementById('menuOrderCount').innerText=d.length;}catch{}}
async function viewOrders(){if(!user)return openAuth();closeAll();document.getElementById('ordersModal').classList.add('show');document.getElementById('overlay').classList.add('show');let r=await fetch('/api/orders?email='+encodeURIComponent(user.email));let orders=await r.json();let list=document.getElementById('ordersList');if(!Array.isArray(orders)||!orders.length){list.innerHTML='<div style="color:#666;text-align:center">No orders yet</div>';return;}list.innerHTML=orders.map(o=>`<div class="orderCard"><b>#${o.id} • $${o.total}</b><div style="color:#888;font-size:12px">${o.address||''}<br>${o.state||''} ${o.lga||''} • ${o.delivery_date||''} ${o.delivery_time||''}<br>${o.phone||''}</div><div style="margin-top:8px"><button onclick="deleteOrder(${o.id})" style="background:#222;color:#f55;border:1px solid #333;padding:8px 12px;border-radius:10px">Delete</button></div></div>`).join('');}
async function deleteOrder(id){if(!confirm('Delete #'+id+'?'))return;let r=await fetch('/api/orders?id='+id+'&email='+encodeURIComponent(user.email),{method:'DELETE'});let d=await r.json();if(d.ok){showToast('Deleted');viewOrders();loadOrderCount();}}
async function doCheckout(){if(!user)return openAuth();let phone=document.getElementById('c_phone').value.trim();let addr=document.getElementById('c_address').value.trim();let state=document.getElementById('c_state').value;let lga=document.getElementById('c_lga').value;let date=document.getElementById('c_date').value;let time=document.getElementById('c_time').value;if(!phone)return alert('Enter phone');if(!state)return alert('Select state');if(!lga)return alert('Select LGA');if(!addr)return alert('Enter address');if(!date)return alert('Select date');if(CART.length===0)return alert('Cart empty');let total=CART.reduce((s,c)=>s+c.price*c.qty,0);let items=JSON.stringify(CART.map(c=>c.name+' x'+c.qty).join(', '));let fullAddr=addr+', '+lga+', '+state;let r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,items,total,address:fullAddr,phone,state,lga,delivery_date:date,delivery_time:time})});let d=await r.json();if(d.ok){showToast('Order #'+d.order_id+' placed');CART=[];saveCart();await fetch('/api/cart/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email.toLowerCase()})});closeAll();loadOrderCount();}else alert(d.error||'Failed');}
init();