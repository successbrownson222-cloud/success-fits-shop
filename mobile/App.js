import { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Modal } from 'react-native';

const API = 'https://success-fits-shop.vercel.app';
const MAP = {
  1:{id:1,name:"Running Shoes",price:89},
  2:{id:2,name:"Denim Jacket",price:120},
  3:{id:3,name:"Gold Necklace",price:250},
  4:{id:4,name:"Leather Bag",price:75},
  5:{id:5,name:"White Sneakers",price:95},
  6:{id:6,name:"Black T-Shirt",price:35},
};

export default function App(){
  const [pro,setPro]=useState(Object.values(MAP));
  const [cart,setCart]=useState([]);
  const [email,setEmail]=useState('');
  const [loggedIn,setLoggedIn]=useState(false);
  const [toast,setToast]=useState('');
  const [showCart,setShowCart]=useState(false);

  const showToast=(msg)=>{ setToast(msg); setTimeout(()=>setToast(''),3000); };

  useEffect(()=>{
    fetch(API+'/api/products').then(r=>r.json()).then(d=>{
      if(Array.isArray(d) && d.length>0) setPro(d);
    }).catch(()=>{});
  },[]);

  const login=async()=>{
    let clean = email.trim().toLowerCase();
    if(!clean.includes('@')){ showToast('Enter valid email'); return; }
    showToast('Syncing...');
    try{
      let res = await fetch(API+'/api/login',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email: clean})
      });
      let data = await res.json();
      console.log('LOGIN:', data);
      let ids = data.cart || [];
      let mapped = ids.map(id=> MAP[id] || pro.find(p=>p.id==id)).filter(Boolean);
      setCart(mapped);
      setLoggedIn(true);
      setEmail(clean);
      showToast('Welcome! Cart: '+mapped.length);
    }catch(e){ showToast('Login failed: '+e.message); }
  };

  const logout=()=>{
    setLoggedIn(false);
    setCart([]);
    setEmail('');
    showToast('Logged out - cart cleared locally');
  };

  const add=async(item)=>{
    if(!loggedIn){
      showToast('Login first to save forever!');
      return;
    }
    if(cart.find(x=>x.id===item.id)){ showToast('Already in cart'); return; }
    
    // 1. Update locally FIRST so it stays
    let newCart = [...cart, item];
    setCart(newCart);

    // 2. Then sync to server, but DON'T reset if server fails
    try{
      let res = await fetch(API+'/api/cart/add',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email: email.trim().toLowerCase(), product_id: Number(item.id) }) // Number() FIX
      });
      let d = await res.json();
      console.log('ADD RES:', d);
      if(d.cart && d.cart.length > 0){
        // only use server cart if server actually has items
        let mapped = d.cart.map(id=> MAP[id] || pro.find(p=>p.id==id)).filter(Boolean);
        if(mapped.length >= newCart.length){
          setCart(mapped);
        }
      }
      showToast(item.name+' added!');
    }catch(e){
      console.log('Add offline', e);
      showToast(item.name+' added locally');
    }
  };

  const remove=async(id)=>{
    let newCart = cart.filter(x=>x.id!==id);
    setCart(newCart);
    if(!loggedIn) return;
    try{
      await fetch(API+'/api/cart/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email: email})});
      for(let it of newCart){
        await fetch(API+'/api/cart/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email: email, product_id: Number(it.id)})});
      }
    }catch{}
  };

  const checkout=async()=>{
    if(!cart.length){ showToast('Cart empty'); return; }
    if(loggedIn){
      try{ await fetch(API+'/api/cart/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email: email})}); }catch{}
    }
    showToast('Order Success $'+total);
    setCart([]); setShowCart(false);
  };

  const total = cart.reduce((s,i)=>s+i.price,0);

  return (
    <View style={{flex:1, padding:20,paddingTop:50, backgroundColor:'#fff'}}>
      <View style={{flexDirection:'row', justifyContent:'space-between'}}>
        <Text style={{fontSize:22,fontWeight:'bold'}}>SUCCESS FITS</Text>
        {loggedIn && (
          <TouchableOpacity onPress={logout} style={{backgroundColor:'#ff2d55', padding:6, paddingHorizontal:12, borderRadius:10}}>
            <Text style={{color:'white', fontWeight:'700'}}>Logout</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {!loggedIn ? (
        <>
          <TextInput 
            value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address"
            placeholder="Enter email to sync" 
            style={{borderWidth:1,padding:12,marginVertical:10, borderRadius:8}} 
          />
          <TouchableOpacity onPress={login} style={{backgroundColor:'black',padding:12, borderRadius:8}}>
            <Text style={{color:'white',textAlign:'center', fontWeight:'700'}}>Login & Load Cart</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={{marginVertical:10, color:'green', fontWeight:'700'}}>Logged in as: {email}</Text>
      )}

      <View style={{flexDirection:'row', justifyContent:'space-between', marginVertical:12}}>
        <Text style={{fontWeight:'800'}}>Cart: {cart.length} - ${total}</Text>
        <TouchableOpacity onPress={()=>setShowCart(true)} style={{backgroundColor:'black', padding:6, paddingHorizontal:12, borderRadius:15}}>
          <Text style={{color:'white', fontWeight:'700'}}>View Cart ({cart.length})</Text>
        </TouchableOpacity>
      </View>

      <FlatList data={pro} numColumns={2} keyExtractor={i=>''+i.id} renderItem={({item})=>
        <View style={{flex:1,margin:5,borderWidth:1,padding:10, borderRadius:10}}>
          <Text style={{fontWeight:'700'}}>{item.name}</Text>
          <Text style={{color:'#ff2d55'}}>${item.price}</Text>
          <TouchableOpacity onPress={()=>add(item)} style={{backgroundColor:'black',padding:6,marginTop:6, borderRadius:6}}>
            <Text style={{color:'white',textAlign:'center'}}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      } />

      {toast? <View style={{position:'absolute',bottom:30,left:20,right:20,backgroundColor:'black',padding:12, borderRadius:20, zIndex:999}}><Text style={{color:'white',textAlign:'center'}}>{toast}</Text></View> : null}

      <Modal visible={showCart} animationType="slide">
        <View style={{flex:1, padding:20,paddingTop:60}}>
          <View style={{flexDirection:'row', justifyContent:'space-between'}}>
            <Text style={{fontSize:20,fontWeight:'bold'}}>Cart ${total} ({cart.length})</Text>
            <TouchableOpacity onPress={()=>setShowCart(false)} style={{backgroundColor:'black', padding:8, paddingHorizontal:14, borderRadius:20}}>
              <Text style={{color:'white', fontWeight:'800'}}>X CLOSE</Text>
            </TouchableOpacity>
          </View>
          <FlatList style={{marginTop:15}} data={cart} keyExtractor={i=>''+i.id} renderItem={({item})=>
            <View style={{flexDirection:'row',justifyContent:'space-between',padding:12, borderBottomWidth:1}}>
              <Text>{item.name} - ${item.price}</Text>
              <TouchableOpacity onPress={()=>remove(item.id)}><Text style={{color:'red', fontWeight:'800'}}>Remove</Text></TouchableOpacity>
            </View>
          } />
          <TouchableOpacity onPress={checkout} style={{backgroundColor:'black',padding:15,marginTop:20, borderRadius:10}}>
            <Text style={{color:'white',textAlign:'center'}}>Checkout ${total}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>setShowCart(false)} style={{padding:15, marginTop:10, borderWidth:1, borderRadius:10}}>
            <Text style={{textAlign:'center'}}>← Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}