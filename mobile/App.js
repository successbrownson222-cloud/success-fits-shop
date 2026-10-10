import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, TextInput, Modal } from 'react-native';

const API = 'https://success-fits-shop.vercel.app'; // change to your vercel url if different

export default function App(){
  const [products, setProducts]=useState([]);
  const [cart, setCart]=useState([]);
  const [email, setEmail]=useState(''); // NO hardcoded email
  const [loggedIn, setLoggedIn]=useState(false);
  const [showAuth, setShowAuth]=useState(false);
  const [inputEmail, setInputEmail]=useState('');
  const [toast, setToast]=useState('');

  const showToast=(m)=>{ setToast(m); setTimeout(()=>setToast(''),3000) };

  const loadProducts = async () => {
    try{
      const r = await fetch(API+'/api/products');
      const d = await r.json();
      if(Array.isArray(d)) setProducts(d);
    }catch(e){ console.log(e) }
  };

  const loadCart = async (userEmail) => {
    if(!userEmail) return;
    try{
      const r = await fetch(API+`/api/cart?email=${userEmail.toLowerCase().trim()}`);
      const d = await r.json();
      if(d.items) setCart(d.items);
      else if(Array.isArray(d.cart)) setCart(d.cart);
    }catch(e){ console.log('cart error', e) }
  };

  const doLogin = async () => {
    const clean = inputEmail.toLowerCase().trim();
    if(!clean.includes('@')) return showToast('Enter valid email');
    try{
      const r = await fetch(API+'/api/login',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({email: clean})
      });
      const d = await r.json();
      setEmail(clean);
      setLoggedIn(true);
      setShowAuth(false);
      if(d.items) setCart(d.items);
      else loadCart(clean);
      showToast('Logged in as '+clean);
    }catch(e){ showToast('Login failed'); }
  };

  const doLogout = () => {
    setEmail('');
    setLoggedIn(false);
    setCart([]);
    setInputEmail('');
    showToast('Logged out');
  };

  const addToCart = async (id) => {
    if(!loggedIn){
      setShowAuth(true);
      return showToast('Login first to sync cart');
    }
    try{
      const r = await fetch(API+'/api/cart/add',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({email: email.toLowerCase(), product_id: id})
      });
      const d = await r.json();
      if(d.items) setCart(d.items);
      showToast('Added ✅ - synced to website');
    }catch(e){ showToast('Failed'); }
  };

  useEffect(()=>{
    loadProducts();
    if(loggedIn) loadCart(email);
    const iv = setInterval(()=>{
      loadProducts();
      if(loggedIn && email) loadCart(email);
    },10000);
    return ()=>clearInterval(iv);
  },[loggedIn, email]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>SUCCESS FITS</Text>
        <TouchableOpacity style={s.loginBtn} onPress={()=> loggedIn ? doLogout() : setShowAuth(true)}>
          <Text style={s.loginTxt}>{loggedIn ? 'Logout' : 'Login'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.sub}>
        {loggedIn ? `Logged as ${email} • Cart: ${cart.length} • Auto-sync ON` : 'Not logged in • Login to sync cart with website'}
      </Text>
      {toast? <Text style={s.toast}>{toast}</Text> : null}

      <FlatList
        data={products}
        numColumns={2}
        keyExtractor={i=>String(i.id)}
        renderItem={({item})=>(
          <View style={s.card}>
            <Image source={{uri: item.image}} style={s.img}/>
            <Text style={s.name} numberOfLines={1}>{item.name}</Text>
            <Text style={s.price}>${item.price}</Text>
            <TouchableOpacity style={s.btn} onPress={()=>addToCart(item.id)}>
              <Text style={s.btnT}>Add</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={showAuth} transparent animationType="slide">
        <View style={s.modalBg}>
          <View style={s.modalBox}>
            <Text style={{color:'#fff',fontWeight:'900',fontSize:18,marginBottom:12}}>Login to sync</Text>
            <TextInput
              placeholder="Enter your email"
              placeholderTextColor="#888"
              value={inputEmail}
              onChangeText={setInputEmail}
              style={s.input}
              autoCapitalize="none"
            />
            <TouchableOpacity style={s.modalBtn} onPress={doLogin}>
              <Text style={s.btnT}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>setShowAuth(false)} style={{marginTop:10}}>
              <Text style={{color:'#888',textAlign:'center'}}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s=StyleSheet.create({
  container:{flex:1,backgroundColor:'#070707',padding:10,paddingTop:40},
  header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  title:{color:'#fff',fontWeight:'900',fontSize:22},
  loginBtn:{backgroundColor:'#fff',paddingHorizontal:14,paddingVertical:7,borderRadius:20},
  loginTxt:{color:'#000',fontWeight:'900',fontSize:12},
  sub:{color:'#0f0',fontSize:11,marginBottom:10,marginTop:6},
  toast:{backgroundColor:'#fff',color:'#000',padding:8,borderRadius:20,textAlign:'center',marginBottom:8,fontWeight:'800'},
  card:{flex:1,backgroundColor:'#111',margin:5,borderRadius:16,padding:8,borderWidth:1,borderColor:'#222'},
  img:{width:'100%',height:110,borderRadius:12,backgroundColor:'#222'},
  name:{color:'#fff',fontSize:11,marginTop:6,fontWeight:'700'},
  price:{color:'#ff2d55',fontSize:11},
  btn:{backgroundColor:'#fff',padding:9,borderRadius:10,marginTop:6,alignItems:'center'},
  btnT:{color:'#000',fontWeight:'900'},
  modalBg:{flex:1,backgroundColor:'rgba(0,0,0,0.8)',justifyContent:'center',alignItems:'center',padding:20},
  modalBox:{backgroundColor:'#111',width:'90%',padding:20,borderRadius:20,borderWidth:1,borderColor:'#222'},
  input:{backgroundColor:'#1e1e1e',color:'#fff',padding:12,borderRadius:12,borderWidth:1,borderColor:'#2a2a2a',marginBottom:10},
  modalBtn:{backgroundColor:'#ff2d55',padding:14,borderRadius:12,alignItems:'center'}
});