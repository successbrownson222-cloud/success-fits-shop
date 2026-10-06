import { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Modal, Image, ScrollView } from 'react-native';

const API = 'https://success-fits-shop.vercel.app';

const FALLBACK = [
  {id:1,name:"White sneakers",price:150,image:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600"},
  {id:2,name:"Black T-shirt",price:85,image:"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600"},
  {id:3,name:"Leather bag",price:100,image:"https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600"},
  {id:4,name:"Gold necklace",price:190,image:"https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600"},
  {id:5,name:"Denim Jacket",price:80,image:"https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=600"},
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
    fetch(API+'/api/products')
      .then(r=>r.json())
      .then(d=>{
        let list = Array.isArray(d)? d : (d.products || []);
        if(list.length) setPro(list);
        console.log('PRODUCTS:', list.length);
      }).catch(()=>{});
  },[]);

  const getAllProducts = () => pro.length ? pro : FALLBACK;

  const fetchCartFromServer = async (cleanEmail) => {
    try{
      let r = await fetch(API+'/api/cart?email='+encodeURIComponent(cleanEmail));
      let d = await r.json();
      if(d.items && d.items.length >=0){
        setCart(d.items);
        return d.items;
      }
      if(d.cart){
        let mapped = d.cart.map(id => {
          let pid = typeof id === 'object' ? (id.product_id || id.id) : id;
          return getAllProducts().find(p=> String(p.id)===String(pid)) || null;
        }).filter(Boolean);
        setCart(mapped);
        return mapped;
      }
    }catch(e){ console.log(e); }
    return [];
  };

  const login=async()=>{
    let clean = email.trim().toLowerCase();
    if(!clean.includes('@')){ showToast('Enter valid email'); return; }
    showToast('Syncing '+clean+'...');
    let items = await fetchCartFromServer(clean);
    setLoggedIn(true);
    setEmail(clean);
    showToast(`Welcome! Synced ${items.length} items`);
  };

  useEffect(()=>{
    if(!loggedIn) return;
    const interval = setInterval(()=> fetchCartFromServer(email.trim().toLowerCase()), 3000);
    return ()=> clearInterval(interval);
  },[loggedIn, email, pro]);

  const logout=()=>{
    setLoggedIn(false); setCart([]); setEmail(''); setShowCart(false);
    showToast('Logged out');
  };

  const add=async(item)=>{
    if(!loggedIn){ showToast('Login first'); return; }
    if(cart.find(x=>String(x.id)===String(item.id))){ showToast('Already in cart'); return; }
    setCart([...cart, item]);
    try{
      let res = await fetch(API+'/api/cart/add',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email: email.trim().toLowerCase(), product_id: item.id})
      });
      let data = await res.json();
      if(data.items) setCart(data.items);
      showToast(item.name+' synced ✓');
    }catch{}
  };

  const total = cart.reduce((s,i)=>s+(Number(i.price)||0),0);

  return (
    <View style={{flex:1, padding:12,paddingTop:50, backgroundColor:'#fff'}}>
      <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
        <Text style={{fontSize:22,fontWeight:'bold'}}>SUCCESS FITS</Text>
        {loggedIn && <TouchableOpacity onPress={logout} style={{backgroundColor:'#ff2d55', padding:8, paddingHorizontal:12, borderRadius:10}}><Text style={{color:'white', fontWeight:'700'}}>Logout</Text></TouchableOpacity>}
      </View>

      {!loggedIn? (
        <>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email same as site" style={{borderWidth:1,padding:12,marginVertical:10, borderRadius:8}} />
          <TouchableOpacity onPress={login} style={{backgroundColor:'black',padding:14, borderRadius:8}}><Text style={{color:'white',textAlign:'center', fontWeight:'700'}}>Login & Load Cart</Text></TouchableOpacity>
        </>
      ) : <Text style={{marginVertical:10, color:'green', fontWeight:'700'}}>Logged as: {email} • Auto-sync ON • Cart: {cart.length}</Text>}

      <View style={{flexDirection:'row', justifyContent:'space-between', marginVertical:12, alignItems:'center'}}>
        <Text style={{fontWeight:'800'}}>Shop • ${total}</Text>
        <TouchableOpacity onPress={()=>setShowCart(true)} style={{backgroundColor:'black', padding:8, paddingHorizontal:14, borderRadius:20}}><Text style={{color:'white', fontWeight:'700'}}>View Cart ({cart.length})</Text></TouchableOpacity>
      </View>

      <FlatList 
        data={getAllProducts()} 
        numColumns={2} 
        keyExtractor={i=>''+i.id} 
        columnWrapperStyle={{gap:8}}
        contentContainerStyle={{gap:8, paddingBottom:100}}
        renderItem={({item})=>
          <View style={{flex:1,borderWidth:1,borderColor:'#eee', borderRadius:12, overflow:'hidden', backgroundColor:'#fff'}}>
            <Image source={{uri: item.image}} style={{width:'100%', height:130}} resizeMode="cover" />
            <View style={{padding:8}}>
              <Text style={{fontWeight:'700'}} numberOfLines={1}>{item.name}</Text>
              <Text style={{color:'#ff2d55', fontWeight:'800'}}>${item.price}</Text>
              <TouchableOpacity onPress={()=>add(item)} style={{backgroundColor:'black',padding:8,marginTop:6, borderRadius:8}}>
                <Text style={{color:'white',textAlign:'center', fontWeight:'600'}}>Add to Cart</Text>
              </TouchableOpacity>
            </View>
          </View>
        } 
      />

      {toast? <View style={{position:'absolute',bottom:30,left:20,right:20,backgroundColor:'black',padding:14, borderRadius:20, zIndex:999}}><Text style={{color:'white',textAlign:'center', fontWeight:'600'}}>{toast}</Text></View> : null}

      <Modal visible={showCart} animationType="slide">
        <View style={{flex:1, padding:16,paddingTop:60, backgroundColor:'#fff'}}>
          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
            <Text style={{fontSize:20,fontWeight:'bold'}}>Your Cart ${total} ({cart.length})</Text>
            <TouchableOpacity onPress={()=>setShowCart(false)} style={{backgroundColor:'black', padding:10, paddingHorizontal:14, borderRadius:20}}><Text style={{color:'white', fontWeight:'700'}}>X CLOSE</Text></TouchableOpacity>
          </View>
          <FlatList 
            style={{marginTop:15}} 
            data={cart} 
            keyExtractor={i=>''+i.id} 
            renderItem={({item})=>(
              <View style={{flexDirection:'row', gap:12, padding:12, borderBottomWidth:1, borderColor:'#eee', alignItems:'center'}}>
                <Image source={{uri: item.image}} style={{width:60, height:60, borderRadius:8}} />
                <View style={{flex:1}}><Text style={{fontWeight:'600'}}>{item.name}</Text><Text style={{color:'#666'}}>${item.price}</Text></View>
              </View>
            )} 
          />
          <TouchableOpacity onPress={()=>setShowCart(false)} style={{padding:15, marginTop:20, borderWidth:1, borderRadius:12}}><Text style={{textAlign:'center', fontWeight:'700'}}>← Continue Shopping</Text></TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}