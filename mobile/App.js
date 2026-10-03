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

  const showToast=(msg)=>{ console.log(msg); setToast(msg); setTimeout(()=>setToast(''),4000); };

  useEffect(()=>{
    fetch(API+'/api/products').then(r=>r.json()).then(d=>{
      if(Array.isArray(d) && d.length>0) setPro(d);
    }).catch(()=>{});
  },[]);

  const login=async()=>{
    let clean = email.trim().toLowerCase(); // FIX CAPS ISSUE
    if(!clean.includes('@')){ showToast('Enter valid email'); return; }
    showToast('Syncing '+clean+'...');
    try{
      let res = await fetch(API+'/api/login',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email: clean})
      });
      let data = await res.json();
      console.log('LOGIN RES:', JSON.stringify(data));
      let ids = data.cart || [];
      if(ids.length===0) showToast('Login OK but cart empty on server for '+clean);
      let mapped = ids.map(id=> MAP[id] || pro.find(p=>p.id==id)).filter(Boolean);
      setCart(mapped);
      showToast('Cart loaded: '+mapped.length);
    }catch(e){
      showToast('Network error: '+e.message);
    }
  };

  const add=async(item)=>{
    let clean = email.trim().toLowerCase();
    if(!clean.includes('@')){ showToast('Login first'); return; }
    setCart(prev=> prev.find(x=>x.id===item.id) ? prev : [...prev, item]);
    try{
      let r = await fetch(API+'/api/cart/add',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email: clean, product_id: item.id})
      });
      let d = await r.json();
      console.log('ADD RES:', d);
      setCart((d.cart||[]).map(id=>MAP[id]).filter(Boolean));
      showToast('Added! Total: '+(d.cart||[]).length);
    }catch{}
  };

  const checkout=async()=>{
    if(!cart.length){ showToast('Cart empty'); return; }
    try{ await fetch(API+'/api/cart/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email: email.trim().toLowerCase()})}); }catch{}
    setCart([]); setShowCart(false); showToast('Order Success!');
  };

  const total = cart.reduce((s,i)=>s+i.price,0);

  return (
    <View style={{flex:1, padding:20,paddingTop:50, backgroundColor:'#fff'}}>
      <Text style={{fontSize:22,fontWeight:'bold'}}>SUCCESS FITS</Text>
      {/* FIX: no caps, email keyboard */}
      <TextInput 
        value={email} 
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="Enter email to sync" 
        style={{borderWidth:1,padding:12,marginVertical:10, borderRadius:8}} 
      />
      <TouchableOpacity onPress={login} style={{backgroundColor:'black',padding:12, borderRadius:8}}>
        <Text style={{color:'white',textAlign:'center', fontWeight:'700'}}>Login & Load Cart</Text>
      </TouchableOpacity>

      <View style={{flexDirection:'row', justifyContent:'space-between', marginVertical:12}}>
        <Text style={{fontWeight:'800'}}>Cart: {cart.length} - ${total}</Text>
        <TouchableOpacity onPress={()=>setShowCart(true)} style={{backgroundColor:'#ff2d55', padding:6, paddingHorizontal:12, borderRadius:15}}>
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
            <TouchableOpacity onPress={()=>setShowCart(false)} style={{backgroundColor:'black', padding:8, paddingHorizontal:14, borderRadius:20}}><Text style={{color:'white'}}>X CLOSE</Text></TouchableOpacity>
          </View>
          <FlatList data={cart} keyExtractor={i=>''+i.id} renderItem={({item})=><View style={{flexDirection:'row',justifyContent:'space-between',padding:12, borderBottomWidth:1}}><Text>{item.name}</Text><Text>${item.price}</Text></View>} />
          <TouchableOpacity onPress={checkout} style={{backgroundColor:'black',padding:15,marginTop:20, borderRadius:10}}><Text style={{color:'white',textAlign:'center'}}>Checkout ${total}</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>setShowCart(false)} style={{padding:15, marginTop:10, borderWidth:1, borderRadius:10}}><Text style={{textAlign:'center'}}>← Continue Shopping</Text></TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}