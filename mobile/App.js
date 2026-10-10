import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native';

const API = 'https://success-fits-shop.vercel.app'; // your vercel URL

export default function App(){
  const [products, setProducts]=useState([]);
  const [cart, setCart]=useState([]);
  const [email] = useState('brownsonsuccess033@gmail.com');
  const [toast, setToast]=useState('');

  const showToast=(m)=>{ setToast(m); setTimeout(()=>setToast(''),3000) };

  // LOAD PRODUCTS
  const loadProducts = async () => {
    try{
      const r = await fetch(API+'/api/products');
      const d = await r.json();
      if(Array.isArray(d)) setProducts(d);
    }catch(e){ console.log(e) }
  };

  // LOAD CART - FIXED FOR NEW API
  const loadCart = async () => {
    try{
      const r = await fetch(API+`/api/cart?email=${email.toLowerCase()}`);
      const d = await r.json();
      // NEW API returns {cart:[ids], items:[full objects]}
      if(d.items && Array.isArray(d.items)){
        setCart(d.items);
      } else if(Array.isArray(d.cart)){
        setCart(d.cart);
      }
    }catch(e){ console.log('cart error', e) }
  };

  const addToCart = async (id) => {
    try{
      const r = await fetch(API+'/api/cart/add',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({email: email.toLowerCase(), product_id: id})
      });
      const d = await r.json();
      if(d.items) setCart(d.items);
      showToast('Added to cart ✅');
      // auto reload to sync with website
      loadCart();
    }catch(e){ showToast('Failed'); }
  };

  useEffect(()=>{
    loadProducts();
    loadCart();
    // Auto-sync every 10 sec so site ↔ app sync
    const iv = setInterval(()=>{
      loadProducts();
      loadCart();
    },10000);
    return ()=>clearInterval(iv);
  },[]);

  return (
    <View style={s.container}>
      <Text style={s.title}>SUCCESS FITS</Text>
      <Text style={s.sub}>Logged as {email} • Auto-sync ON • Cart: {cart.length}</Text>
      {toast? <Text style={s.toast}>{toast}</Text> : null}

      <FlatList
        data={products}
        numColumns={2}
        keyExtractor={i=>String(i.id)}
        renderItem={({item})=>(
          <View style={s.card}>
            <Image source={{uri: item.image}} style={s.img}/>
            <Text style={s.name}>{item.name}</Text>
            <Text style={s.price}>${item.price}</Text>
            <TouchableOpacity style={s.btn} onPress={()=>addToCart(item.id)}>
              <Text style={s.btnT}>Add</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  )
}

const s=StyleSheet.create({
  container:{flex:1,backgroundColor:'#070707',padding:10,paddingTop:40},
  title:{color:'#fff',fontWeight:'900',fontSize:22},
  sub:{color:'#0f0',fontSize:11,marginBottom:10},
  toast:{backgroundColor:'#fff',color:'#000',padding:8,borderRadius:20,textAlign:'center',marginBottom:8,fontWeight:'800'},
  card:{flex:1,backgroundColor:'#111',margin:5,borderRadius:16,padding:8,borderWidth:1,borderColor:'#222'},
  img:{width:'100%',height:120,borderRadius:12,backgroundColor:'#222'},
  name:{color:'#fff',fontSize:12,marginTop:6,fontWeight:'700'},
  price:{color:'#ff2d55',fontSize:12},
  btn:{backgroundColor:'#fff',padding:10,borderRadius:10,marginTop:6,alignItems:'center'},
  btnT:{color:'#000',fontWeight:'900'}
});