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
  const [email,setEmail]=useState('successbrownson222@gmail.com');
  const [toast,setToast]=useState('');
  const [showCart,setShowCart]=useState(false);

  const showToast=(msg)=>{ setToast(msg); setTimeout(()=>setToast(''),3000); };

  useEffect(()=>{
    fetch(API+'/api/products').then(r=>r.json()).then(d=>{
      if(Array.isArray(d) && d.length) setPro(d);
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
      let ids = data.cart || [];
      let mapped = ids.map(id => MAP[id]).filter(Boolean);
      setCart(mapped);
      showToast('Cart loaded: '+mapped.length+' items');
    }catch(e){
      showToast('Error: '+e.message);
    }
  };

  const add=async(item)=>{
    let clean = email.trim().toLowerCase();
    if(!clean.includes('@')){ showToast('Login first!'); return; }
    if(cart.find(x=>x.id===item.id)){ showToast('Already in cart'); return; }
    setCart(prev=>[...prev, item]);
    try{
      let r = await fetch(API+'/api/cart/add',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email: clean, product_id: item.id})
      });
      let d = await r.json();
      let mapped = (d.cart||[]).map(id=>MAP[id]).filter(Boolean);
      setCart(mapped);
      showToast(item.name+' synced! ('+mapped.length+')');
    }catch(e){
      showToast('Added locally');
    }
  };

  const remove=async(id)=>{
    let newCart = cart.filter(x=>x.id!==id);
    setCart(newCart);
    try{
      let clean = email.trim().toLowerCase();
      await fetch(API+'/api/cart/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email: clean})});
      for(let it of newCart){
        await fetch(API+'/api/cart/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email: clean, product_id: it.id})});
      }
    }catch{}
    showToast('Removed');
  };

  const checkout=async()=>{
    if(!cart.length){ showToast('Cart empty'); return; }
    try{
      await fetch(API+'/api/cart/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email: email.trim().toLowerCase()})});
    }catch{}
    showToast('Order Success $'+total);
    setCart([]);
    setShowCart(false);
  };

  const total = cart.reduce((s,i)=>s+i.price,0);

  return (
    <View style={{flex:1, padding:20,paddingTop:50, backgroundColor:'#f5f5f5'}}>
      <Text style={{fontSize:22,fontWeight:'bold'}}>SUCCESS FITS</Text>
      <Text style={{color:'#666', marginBottom:5}}>{email.trim().toLowerCase()}</Text>

      <TextInput placeholder="Enter email to sync" value={email} onChangeText={setEmail} style={{borderWidth:1,padding:10,marginVertical:10, backgroundColor:'#fff', borderRadius:8}} />
      <TouchableOpacity onPress={login} style={{backgroundColor:'black',padding:12, borderRadius:8}}><Text style={{color:'white',textAlign:'center', fontWeight:'700'}}>Login & Load Cart</Text></TouchableOpacity>

      <View style={{flexDirection:'row', justifyContent:'space-between', marginVertical:12}}>
        <Text style={{fontWeight:'800', color:'green'}}>Cart: {cart.length} - ${total}</Text>
        <TouchableOpacity onPress={()=>setShowCart(true)} style={{backgroundColor:'#ff2d55', padding:6, paddingHorizontal:12, borderRadius:15}}>
          <Text style={{color:'white', fontWeight:'700'}}>View Cart ({cart.length})</Text>
        </TouchableOpacity>
      </View>

      <FlatList data={pro} numColumns={2} keyExtractor={i=>''+i.id} renderItem={({item})=>
        <View style={{flex:1,margin:5,borderWidth:1,padding:10, backgroundColor:'#fff', borderRadius:10, borderColor:'#ddd'}}>
          <Text style={{fontWeight:'700'}}>{item.name}</Text>
          <Text style={{color:'#ff2d55'}}>${item.price}</Text>
          <TouchableOpacity onPress={()=>add(item)} style={{backgroundColor:'black',padding:6,marginTop:6, borderRadius:6}}>
            <Text style={{color:'white',textAlign:'center'}}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      } />

      {toast? <View style={{position:'absolute',bottom:30,left:20,right:20,backgroundColor:'black',padding:12, borderRadius:20}}><Text style={{color:'white',textAlign:'center'}}>{toast}</Text></View> : null}

      {/* FIXED CART MODAL WITH CLOSE BUTTON */}
      <Modal visible={showCart} animationType="slide">
        <View style={{flex:1, padding:20,paddingTop:60, backgroundColor:'#fff'}}>
          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
            <Text style={{fontSize:20,fontWeight:'bold'}}>Your Cart ${total} ({cart.length})</Text>
            <TouchableOpacity onPress={()=>setShowCart(false)} style={{backgroundColor:'black', padding:8, paddingHorizontal:14, borderRadius:20}}>
              <Text style={{color:'white', fontWeight:'800'}}>X</Text>
            </TouchableOpacity>
          </View>

          {cart.length===0? (
            <Text style={{textAlign:'center', marginTop:60, color:'#888'}}>Cart is empty</Text>
          ) : (
            <FlatList style={{marginTop:15}} data={cart} keyExtractor={i=>''+i.id} renderItem={({item})=>
              <View style={{flexDirection:'row',justifyContent:'space-between',padding:14, borderBottomWidth:1, borderColor:'#eee'}}>
                <Text>{item.name} - ${item.price}</Text>
                <TouchableOpacity onPress={()=>remove(item.id)}><Text style={{color:'red', fontWeight:'800'}}>Remove</Text></TouchableOpacity>
              </View>
            } />
          )}

          <TouchableOpacity onPress={checkout} style={{backgroundColor:'black',padding:15,marginTop:20, borderRadius:10}}>
            <Text style={{color:'white',textAlign:'center', fontWeight:'700'}}>Checkout ${total}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={async()=>{
            setCart([]);
            try{ await fetch(API+'/api/cart/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email: email.trim().toLowerCase()})}); }catch{}
            showToast('Cart cleared');
            setShowCart(false);
          }} style={{backgroundColor:'#ff2d55',padding:14,marginTop:10, borderRadius:10}}>
            <Text style={{color:'white',textAlign:'center', fontWeight:'700'}}>Clear Cart</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={()=>setShowCart(false)} style={{padding:15, borderWidth:1, borderColor:'#ccc', borderRadius:10, marginTop:10}}>
            <Text style={{textAlign:'center', fontWeight:'700'}}>← Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}