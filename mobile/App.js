import { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Modal } from 'react-native';

const D1='https://success-fits-';
const D2='shop.vercel.app';
const API=D1+D2;

export default function App(){
  const [pro,setPro]=useState([]);
  const [cart,setCart]=useState([]);
  const [cat,setCat]=useState('All');
  const [email,setEmail]=useState('');
  const [toast,setToast]=useState('');
  const [showCart,setShowCart]=useState(false);

  const showToast=(msg)=>{
    setToast(msg);
    setTimeout(()=>setToast(''),2500);
  };

  useEffect(()=>{
    fetch(API+'/api/products')
     .then(r=>r.json())
     .then(d=>{
        if(d && d.length>0){
          const fixed=d.map(p=>({...p, category: p.category || 'Clothes'}));
          setPro(fixed);
        } else { throw new Error('empty'); }
      })
     .catch(()=>setPro([
        {id:1,name:"Running Shoes",category:"Shoes",price:89},
        {id:2,name:"Denim Jacket",category:"Clothes",price:120},
        {id:3,name:"Gold Necklace",category:"Jewelry",price:250},
        {id:4,name:"Leather Bag",category:"Accessories",price:75},
        {id:5,name:"White Sneakers",category:"Shoes",price:95},
        {id:6,name:"Black T-Shirt",category:"Clothes",price:35},
      ]));
  },[]);

  const login=async()=>{
    if(!email.includes('@')){ showToast('Enter valid email'); return; }
    try{
      await fetch(API+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
      const cartRes=await fetch(API+'/api/cart/'+email);
      const cartData=await cartRes.json();
      const ids=cartData.cart || [];
      const map={
        1:{id:1,name:"Running Shoes",price:89},
        2:{id:2,name:"Denim Jacket",price:120},
        3:{id:3,name:"Gold Necklace",price:250},
        4:{id:4,name:"Leather Bag",price:75},
        5:{id:5,name:"White Sneakers",price:95},
        6:{id:6,name:"Black T-Shirt",price:35},
      };
      const mapped=ids.map(id=> pro.find(p=>p.id==id) || map[id]).filter(Boolean);
      setCart(mapped);
      showToast('Cart loaded: '+mapped.length);
    }catch(e){
      showToast('Login failed');
    }
  };

  const total=cart.reduce((s,i)=>s+i.price,0);
  const list=cat==='All'?pro:pro.filter(p=>p.category===cat);

  const add=async(item)=>{
    if(!email.includes('@')){
      showToast('Enter email first to save forever!');
      setCart(pr=> pr.find(x=>x.id===item.id)? pr : [...pr, item]);
      return;
    }
    try{
      const r=await fetch(API+'/api/cart/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email, product_id:item.id})});
      const d=await r.json();
      const map={1:{id:1,name:"Running Shoes",price:89},2:{id:2,name:"Denim Jacket",price:120},3:{id:3,name:"Gold Necklace",price:250},4:{id:4,name:"Leather Bag",price:75},5:{id:5,name:"White Sneakers",price:95},6:{id:6,name:"Black T-Shirt",price:35}};
      const mapped=d.cart.map(id=> pro.find(p=>p.id==id) || map[id]).filter(Boolean);
      setCart(mapped);
      showToast(item.name+' added!');
    }catch(e){
      setCart(pr=> pr.find(x=>x.id===item.id)? pr : [...pr, item]);
      showToast(item.name+' added locally');
    }
  };

  const remove=(id)=>{ setCart(pr=>pr.filter(x=>x.id!==id)); showToast('Removed'); };
  const checkout=async()=>{
    if(!cart.length){ showToast('Cart empty'); return; }
    try{
      await fetch(API+'/api/cart/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
    }catch{}
    showToast('Order Success $'+total);
    setCart([]);
  };

  return (
    <View style={{padding:20,paddingTop:50}}>
      <Text style={{fontSize:20,fontWeight:'bold'}}>SUCCESS FITS - {email||'Guest'}</Text>
      <TextInput placeholder="Enter email to sync cart" value={email} onChangeText={setEmail} style={{borderWidth:1,padding:8,marginVertical:10}} />
      <TouchableOpacity onPress={login} style={{backgroundColor:'black',padding:10}}><Text style={{color:'white',textAlign:'center'}}>Login & Load Cart</Text></TouchableOpacity>
      <View style={{flexDirection:'row',marginVertical:10,justifyContent:'space-between'}}>
        <Text>Cart:{cart.length} ${total}</Text>
        <TouchableOpacity onPress={()=>setShowCart(true)}><Text style={{fontWeight:'bold'}}>View Cart</Text></TouchableOpacity>
      </View>
      <FlatList data={list} numColumns={2} keyExtractor={i=>''+i.id} renderItem={({item})=><View style={{flex:1,margin:5,borderWidth:1,padding:10}}><Text>{item.name}</Text><Text>${item.price}</Text><TouchableOpacity onPress={()=>add(item)} style={{backgroundColor:'black',padding:5,marginTop:5}}><Text style={{color:'white',textAlign:'center'}}>Add to Cart</Text></TouchableOpacity></View>} />
      {toast? <View style={{position:'absolute',bottom:20,left:20,right:20,backgroundColor:'black',padding:10}}><Text style={{color:'white',textAlign:'center'}}>{toast}</Text></View> : null}
      <Modal visible={showCart} animationType="slide"><View style={{padding:20,paddingTop:50}}><Text style={{fontSize:20,fontWeight:'bold'}}>Cart ${total}</Text><FlatList data={cart} keyExtractor={i=>''+i.id} renderItem={({item})=><View style={{flexDirection:'row',justifyContent:'space-between',padding:10}}><Text>{item.name}</Text><TouchableOpacity onPress={()=>remove(item.id)}><Text>X</Text></TouchableOpacity></View>} /><TouchableOpacity onPress={checkout} style={{backgroundColor:'black',padding:15,marginTop:20}}><Text style={{color:'white',textAlign:'center'}}>Checkout ${total}</Text></TouchableOpacity><TouchableOpacity onPress={()=>setShowCart(false)} style={{padding:15}}><Text style={{textAlign:'center'}}>Close</Text></TouchableOpacity></View></Modal>
    </View>
  );
}