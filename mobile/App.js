import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, TextInput, Modal, ScrollView } from 'react-native';

const API = 'https://success-fits-shop.vercel.app';

export default function App(){
  const [products, setProducts]=useState([]);
  const [cart, setCart]=useState([]);
  const [email, setEmail]=useState('');
  const [loggedIn, setLoggedIn]=useState(false);
  const [showAuth, setShowAuth]=useState(false);
  const [showCart, setShowCart]=useState(false);
  const [inputEmail, setInputEmail]=useState('');
  const [toast, setToast]=useState('');

  const showToast=(m)=>{ setToast(m); setTimeout(()=>setToast(''),3000) };

  const loadProducts = async () => {
    try{
      const r = await fetch(API+'/api/products');
      const d = await r.json();
      setProducts(Array.isArray(d)? d : (d.products || []));
    }catch(e){ console.log('products err', e) }
  };

  const loadCart = async (e, silent=false) => {
    const clean = (e || email || '').toLowerCase().trim();
    if(!clean) return;
    try{
      const r = await fetch(`${API}/api/cart?email=${encodeURIComponent(clean)}`);
      const d = await r.json();
      setCart(d.items || []);
      if(!silent && d.items?.length) showToast(`${d.items.length} items synced ✅`);
    }catch(err){ console.log('loadCart err', err); }
  };

  const addToCart = async (product) => {
    const clean = email.toLowerCase().trim();
    if(!loggedIn ||!clean){
      setShowAuth(true);
      return showToast('Login first with SAME email as website');
    }
    try{
      await fetch(`${API}/api/cart`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email: clean, product_id: product.id, qty: 1, size:'M', color:'' })
      });
      await loadCart(clean, true);
      showToast(`${product.name} added ✅ - check website!`);
    }catch(e){ showToast('Add failed'); }
  };

  const removeFromCart = async (item) => {
    try{
      await fetch(`${API}/api/cart?email=${encodeURIComponent(email)}&product_id=${item.product_id}&size=${encodeURIComponent(item.size||'M')}&color=${encodeURIComponent(item.color||'')}`, {method:'DELETE'});
      await loadCart(email, true);
      showToast('Removed');
    }catch(e){ showToast('Remove failed'); }
  };

  const doLogin = async () => {
    const clean = inputEmail.toLowerCase().trim();
    if(!clean.includes('@')) return showToast('Enter valid email');
    setEmail(clean);
    setLoggedIn(true);
    setShowAuth(false);
    showToast(`Welcome ${clean} - syncing...`);
    await loadCart(clean, false);
  };

  const doLogout = () => {
    setEmail(''); setLoggedIn(false); setCart([]); setInputEmail(''); showToast('Logged out');
  };

  useEffect(()=>{ loadProducts(); },[]);

  useEffect(()=>{
    if(!loggedIn ||!email) return;
    const iv=setInterval(()=> loadCart(email, true), 5000);
    return ()=>clearInterval(iv);
  },[loggedIn, email]);

  const total = cart.reduce((s,i)=> s + (Number(i.price)||0) * (Number(i.qty)||1),0);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>SUCCESS FITS</Text>
        <View style={{flexDirection:'row',gap:8}}>
          <TouchableOpacity style={s.cartBtn} onPress={()=>setShowCart(true)}><Text style={s.cartTxt}>🛒 {cart.length}</Text></TouchableOpacity>
          <TouchableOpacity style={s.loginBtn} onPress={()=> loggedIn? doLogout() : setShowAuth(true)}>
            <Text style={s.loginTxt}>{loggedIn? 'Logout' : 'Login'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={s.sub}>
        {loggedIn? `${email} • ${cart.length} items • Live 2-way sync` : 'Login with SAME email as website to sync cart'}
      </Text>

      {toast? <Text style={s.toast}>{toast}</Text> : null}

      <FlatList
        data={products}
        numColumns={2}
        keyExtractor={i=>String(i.id)}
        contentContainerStyle={{paddingBottom:20}}
        renderItem={({item})=>(
          <View style={s.card}>
            <Image source={{uri:item.image}} style={s.img}/>
            <Text style={s.name} numberOfLines={1}>{item.name}</Text>
            <Text style={s.price}>${item.price}</Text>
            <TouchableOpacity style={s.btn} onPress={()=> addToCart(item)}>
              <Text style={s.btnT}>+ Add to Cart</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={showCart} animationType="slide">
        <View style={s.container}>
          <View style={s.header}>
            <Text style={s.title}>Cart ({cart.length}) - ${total.toFixed(2)}</Text>
            <TouchableOpacity onPress={()=>setShowCart(false)}>
              <Text style={{color:'#fff',fontWeight:'900'}}>✕ Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            {cart.map((it,idx)=>(
              <View key={idx} style={s.cartRow}>
                <Image source={{uri:it.image}} style={{width:50,height:50,borderRadius:8}}/>
                <View style={{marginLeft:10,flex:1}}>
                  <Text style={{color:'#fff'}}>{it.name} x{it.qty||1} {it.size}</Text>
                  <Text style={{color:'#ff2d55'}}>${it.price}</Text>
                </View>
                <TouchableOpacity onPress={()=>removeFromCart(it)}><Text style={{color:'#ff2d55',fontWeight:'900'}}>Remove</Text></TouchableOpacity>
              </View>
            ))}
            {cart.length===0 && (
              <Text style={{color:'#666',textAlign:'center',marginTop:40}}>
                Cart empty{"\n"}Login with SAME email as website{"\n"}Add items anywhere, see everywhere
              </Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showAuth} transparent animationType="fade">
        <View style={s.modalBg}>
          <View style={s.modalBox}>
            <Text style={{color:'#fff',fontWeight:'900',fontSize:18,marginBottom:12}}>Login to sync cart</Text>
            <Text style={{color:'#888',fontSize:12,marginBottom:8}}>MUST be SAME email as website</Text>
            <TextInput
              placeholder="your email used on website"
              placeholderTextColor="#888"
              value={inputEmail}
              onChangeText={setInputEmail}
              style={s.input}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity style={s.modalBtn} onPress={doLogin}>
              <Text style={s.btnT}>Sync My Cart</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>setShowAuth(false)} style={{marginTop:12}}>
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
  header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:6},
  title:{color:'#fff',fontWeight:'900',fontSize:20},
  loginBtn:{backgroundColor:'#fff',paddingHorizontal:12,paddingVertical:6,borderRadius:20},
  loginTxt:{color:'#000',fontWeight:'900',fontSize:12},
  cartBtn:{backgroundColor:'#111',borderWidth:1,borderColor:'#222',paddingHorizontal:12,paddingVertical:6,borderRadius:20},
  cartTxt:{color:'#fff',fontWeight:'800',fontSize:12},
  sub:{color:'#0f0',fontSize:10,marginBottom:8},
  toast:{backgroundColor:'#fff',color:'#000',padding:8,borderRadius:20,textAlign:'center',marginBottom:8,fontWeight:'800'},
  card:{flex:1,backgroundColor:'#111',margin:4,borderRadius:14,padding:7,borderWidth:1,borderColor:'#222'},
  img:{width:'100%',height:100,borderRadius:10,backgroundColor:'#222'},
  name:{color:'#fff',fontSize:10,marginTop:5,fontWeight:'700'},
  price:{color:'#ff2d55',fontSize:11},
  btn:{backgroundColor:'#fff',padding:8,borderRadius:9,marginTop:5,alignItems:'center'},
  btnT:{color:'#000',fontWeight:'900',fontSize:12},
  cartRow:{flexDirection:'row',backgroundColor:'#111',margin:5,padding:10,borderRadius:12,alignItems:'center',borderWidth:1,borderColor:'#1a1a1a'},
  modalBg:{flex:1,backgroundColor:'rgba(0,0,0,0.85)',justifyContent:'center',alignItems:'center',padding:20},
  modalBox:{backgroundColor:'#111',width:'92%',padding:20,borderRadius:20,borderWidth:1,borderColor:'#222'},
  input:{backgroundColor:'#1e1e1e',color:'#fff',padding:12,borderRadius:12,borderWidth:1,borderColor:'#2a2a2a',marginBottom:10},
  modalBtn:{backgroundColor:'#ff2d55',padding:14,borderRadius:12,alignItems:'center'}
});