import { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Modal } from 'react-native';

const API = 'https://success-fits-shop.vercel.app';

const FALLBACK = [
  {id:1,name:"Running Shoes",price:89},
  {id:2,name:"Denim Jacket",price:120},
  {id:3,name:"Gold Necklace",price:250},
  {id:4,name:"Leather Bag",price:75},
  {id:5,name:"White Sneakers",price:95},
  {id:6,name:"Black T-Shirt",price:35},
];

export default function App(){
  const [pro,setPro]=useState([]);
  const [cart,setCart]=useState([]);
  const [email,setEmail]=useState('successbrownson222@gmail.com');
  const [loggedIn,setLoggedIn]=useState(false);
  const [toast,setToast]=useState('');
  const [showCart,setShowCart]=useState(false);

  const showToast=(msg)=>{ setToast(msg); setTimeout(()=>setToast(''),3500); };

  useEffect(()=>{
    fetch(API+'/api/products').then(r=>r.json()).then(d=>{
      let list = Array.isArray(d)? d : (d.products || []);
      if(list.length) setPro(list);
    }).catch(()=>{});
  },[]);

  const getAllProducts = () => pro.length ? pro : FALLBACK;

  // CENTRAL SYNC FUNCTION - used by login + auto-sync
  const fetchCartFromServer = async (cleanEmail) => {
    try{
      let r = await fetch(API+'/api/cart?email='+encodeURIComponent(cleanEmail));
      let d = await r.json();
      console.log('SYNCED CART:', d);
      // New API returns {items: [full products]}
      if(d.items && d.items.length > 0){
        setCart(d.items);
        return d.items;
      }
      // Old fallback: map IDs to products
      if(d.cart && d.cart.length > 0){
        let mapped = d.cart.map(id => {
          let pid = typeof id === 'object' ? (id.product_id || id.id) : id;
          return getAllProducts().find(p=> String(p.id)===String(pid)) || {id: pid, name:'Item '+pid, price:0};
        });
        setCart(mapped);
        return mapped;
      }
      setCart([]);
      return [];
    }catch(e){
      console.log('fetch error', e);
      return [];
    }
  };

  const login=async()=>{
    let clean = email.trim().toLowerCase();
    if(!clean.includes('@')){ showToast('Enter valid email'); return; }
    showToast('Syncing '+clean+'...');
    let items = await fetchCartFromServer(clean);
    setLoggedIn(true);
    setEmail(clean);
    showToast(`Welcome! Synced ${items.length} items from site`);
  };

  // AUTO SYNC every 3 seconds when logged in - this is the key fix!
  useEffect(()=>{
    if(!loggedIn) return;
    let clean = email.trim().toLowerCase();
    const interval = setInterval(()=> fetchCartFromServer(clean), 3000);
    return ()=> clearInterval(interval);
  },[loggedIn, email, pro]);

  const logout=()=>{
    setLoggedIn(false); setCart([]); setEmail(''); setShowCart(false);
    showToast('Logged out');
  };

  const add=async(item)=>{
    if(!loggedIn){ showToast('Login first'); return; }
    if(cart.find(x=>String(x.id)===String(item.id))){ showToast('Already in cart'); return; }
    
    // Optimistic update
    setCart([...cart, item]);
    
    try{
      let res = await fetch(API+'/api/cart/add',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email: email.trim().toLowerCase(), product_id: item.id})
      });
      let data = await res.json();
      // Server returns the truth - use it
      if(data.items) setCart(data.items);
      showToast(item.name+' synced to site ✓');
    }catch{
      showToast('Added locally, will sync next');
    }
  };

  const total = cart.reduce((s,i)=>s+(Number(i.price)||0),0);

  return (
    <View style={{flex:1, padding:20,paddingTop:50, backgroundColor:'#fff'}}>
      <View style={{flexDirection:'row', justifyContent:'space-between'}}>
        <Text style={{fontSize:22,fontWeight:'bold'}}>SUCCESS FITS</Text>
        {loggedIn && <TouchableOpacity onPress={logout} style={{backgroundColor:'#ff2d55', padding:6, paddingHorizontal:12, borderRadius:10}}><Text style={{color:'white', fontWeight:'700'}}>Logout</Text></TouchableOpacity>}
      </View>

      {!loggedIn? (
        <>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Enter email same as site" style={{borderWidth:1,padding:12,marginVertical:10, borderRadius:8}} />
          <TouchableOpacity onPress={login} style={{backgroundColor:'black',padding:12, borderRadius:8}}><Text style={{color:'white',textAlign:'center', fontWeight:'700'}}>Login & Load Cart</Text></TouchableOpacity>
        </>
      ) : <Text style={{marginVertical:10, color:'green', fontWeight:'700'}}>Logged as: {email} (auto-sync on)</Text>}

      <View style={{flexDirection:'row', justifyContent:'space-between', marginVertical:12}}>
        <Text style={{fontWeight:'800'}}>Cart: {cart.length} - ${total}</Text>
        <TouchableOpacity onPress={()=>setShowCart(true)} style={{backgroundColor:'black', padding:6, paddingHorizontal:12, borderRadius:15}}><Text style={{color:'white', fontWeight:'700'}}>View Cart ({cart.length})</Text></TouchableOpacity>
      </View>

      <FlatList data={getAllProducts()} numColumns={2} keyExtractor={i=>''+i.id} renderItem={({item})=>
        <View style={{flex:1,margin:5,borderWidth:1,padding:10, borderRadius:10}}>
          <Text style={{fontWeight:'700'}}>{item.name}</Text><Text style={{color:'#ff2d55'}}>${item.price}</Text>
          <TouchableOpacity onPress={()=>add(item)} style={{backgroundColor:'black',padding:6,marginTop:6, borderRadius:6}}><Text style={{color:'white',textAlign:'center'}}>Add</Text></TouchableOpacity>
        </View>
      } />

      {toast? <View style={{position:'absolute',bottom:30,left:20,right:20,backgroundColor:'black',padding:12, borderRadius:20, zIndex:999}}><Text style={{color:'white',textAlign:'center'}}>{toast}</Text></View> : null}

      <Modal visible={showCart} animationType="slide">
        <View style={{flex:1, padding:20,paddingTop:60}}>
          <View style={{flexDirection:'row', justifyContent:'space-between'}}><Text style={{fontSize:20,fontWeight:'bold'}}>Your Cart ${total} ({cart.length})</Text><TouchableOpacity onPress={()=>setShowCart(false)} style={{backgroundColor:'black', padding:8, paddingHorizontal:14, borderRadius:20}}><Text style={{color:'white'}}>X CLOSE</Text></TouchableOpacity></View>
          <FlatList style={{marginTop:15}} data={cart} keyExtractor={i=>''+i.id} renderItem={({item})=><View style={{flexDirection:'row',justifyContent:'space-between',padding:12, borderBottomWidth:1}}><Text>{item.name}</Text><Text>${item.price}</Text></View>} />
          <Text style={{marginTop:10, textAlign:'center', color:'gray'}}>Auto-syncs every 3s from website</Text>
        </View>
      </Modal>
    </View>
  );
}