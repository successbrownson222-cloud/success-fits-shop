import { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Modal, Image } from 'react-native';

const API = 'https://success-fits-shop.vercel.app';

export default function App(){
  const [pro,setPro]=useState([]);
  const [cart,setCart]=useState([]);
  const [email,setEmail]=useState('successbrownson222@gmail.com');
  const [loggedIn,setLoggedIn]=useState(false);
  const [toast,setToast]=useState('');
  const [showCart,setShowCart]=useState(false);

  const showToast=(m)=>{ setToast(m); setTimeout(()=>setToast(''),3000); };

  // THIS IS THE MAGIC ROUTE - fetches everything from site DB
  const loadProducts = async () => {
    try{
      let r = await fetch(API+'/api/products');
      let d = await r.json();
      let list = Array.isArray(d) ? d : [];
      setPro(list);
    }catch(e){}
  };

  useEffect(()=>{ loadProducts(); },[]);

  // Auto-reload products every 10 sec so new admin products appear
  useEffect(()=>{
    const id = setInterval(loadProducts, 10000);
    return ()=> clearInterval(id);
  },[]);

  const fetchCartFromServer = async (clean) => {
    try{
      let r = await fetch(API+'/api/cart?email='+encodeURIComponent(clean));
      let d = await r.json();
      if(d.items) setCart(d.items);
      return d.items || [];
    }catch{ return []; }
  };

  const login = async()=>{
    let clean = email.trim().toLowerCase();
    if(!clean.includes('@')) return showToast('Valid email');
    let items = await fetchCartFromServer(clean);
    setLoggedIn(true); setEmail(clean);
    showToast(`Synced ${items.length} items`);
  };

  useEffect(()=>{
    if(!loggedIn) return;
    const i = setInterval(()=>fetchCartFromServer(email), 3000);
    return ()=>clearInterval(i);
  },[loggedIn]);

  const add = async(item)=>{
    if(!loggedIn) return showToast('Login first');
    if(cart.find(x=>String(x.id)===String(item.id))) return showToast('Already in cart');
    setCart([...cart, item]);
    let res = await fetch(API+'/api/cart/add',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({email: email.toLowerCase(), product_id: item.id})
    });
    let d = await res.json(); if(d.items) setCart(d.items);
    showToast(item.name+' synced');
  };

  const total = cart.reduce((s,i)=>s+Number(i.price||0),0);

  return (
    <View style={{flex:1, padding:12, paddingTop:50, backgroundColor:'#fff'}}>
      <Text style={{fontSize:22,fontWeight:'bold'}}>SUCCESS FITS</Text>
      {!loggedIn ? (
        <>
          <TextInput value={email} onChangeText={setEmail} style={{borderWidth:1,padding:12,marginVertical:10,borderRadius:8}} />
          <TouchableOpacity onPress={login} style={{backgroundColor:'black',padding:14,borderRadius:8}}><Text style={{color:'#fff',textAlign:'center'}}>Login & Load Cart</Text></TouchableOpacity>
        </>
      ): <Text style={{color:'green', marginVertical:8}}>Logged as {email} • Auto-sync ON</Text>}

      <FlatList
        data={pro}
        numColumns={2}
        keyExtractor={i=>''+i.id}
        ListEmptyComponent={<Text style={{textAlign:'center', marginTop:40}}>Loading products from site...</Text>}
        renderItem={({item})=>(
          <View style={{flex:1,margin:4,borderWidth:1,borderColor:'#eee',borderRadius:12,overflow:'hidden'}}>
            <Image source={{uri: item.image}} style={{width:'100%',height:130}} />
            <View style={{padding:8}}>
              <Text style={{fontWeight:'700'}}>{item.name}</Text>
              <Text style={{color:'#ff2d55'}}>${item.price}</Text>
              <TouchableOpacity onPress={()=>add(item)} style={{backgroundColor:'black',padding:8,marginTop:6,borderRadius:8}}><Text style={{color:'#fff',textAlign:'center'}}>Add</Text></TouchableOpacity>
            </View>
          </View>
        )}
      />
      {toast? <View style={{position:'absolute',bottom:20,left:20,right:20,backgroundColor:'black',padding:12,borderRadius:20}}><Text style={{color:'#fff',textAlign:'center'}}>{toast}</Text></View>:null}
    </View>
  );
}