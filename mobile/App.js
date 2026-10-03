import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, Alert, StyleSheet } from 'react-native';

const API = 'https://success-fits-shop.vercel.app';

export default function App() {
  const [email, setEmail] = useState('successbrownson222@gmail.com');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [cat, setCat] = useState('All');

  useEffect(() => {
    fetch(`${API}/api/products`)
      .then(r => r.json())
      .then(data => { if(Array.isArray(data) && data.length>0) setProducts(data); })
      .catch(() => {
        setProducts([
          {id:1,name:"Running Shoes",category:"Shoes",price:89,image:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500"},
          {id:2,name:"Denim Jacket",category:"Clothes",price:120,image:"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=500"},
          {id:5,name:"White Sneakers",category:"Shoes",price:95,image:"https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=500"},
          {id:6,name:"Black T-Shirt",category:"Clothes",price:35,image:"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500"},
        ]);
      });
  }, []);

  const login = async () => {
    try{
      const r = await fetch(`${API}/api/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
      const j = await r.json();
      setCart(j.cart||[]);
      Alert.alert('✅ Logged in', `Cart synced: ${j.cart.length} items`);
    }catch(e){ Alert.alert('Error', e.message); }
  };

  const addToCart = async (id, name) => {
    setCart(prev=>[...prev, id]);
    try{
      const r = await fetch(`${API}/api/cart/add`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,product_id:id})});
      const j = await r.json(); setCart(j.cart);
    }catch{}
    Alert.alert('Added', `${name} added`);
  };

  const clearCart = async () => {
    setCart([]);
    try{ await fetch(`${API}/api/cart/clear`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})}); }catch{}
  };

  const filtered = cat==='All'?products:products.filter(p=>p.category===cat);

  return (
    <View style={s.container}>
      <Text style={s.title}>SUCCESS FITS.</Text>
      <Text style={s.sub}>Mobile • {API}</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="same email as web" placeholderTextColor="#777" style={s.input}/>
      <View style={{flexDirection:'row', gap:8}}>
        <TouchableOpacity onPress={login} style={[s.btn,{backgroundColor:'#ff2d55',flex:1}]}><Text style={s.btnText}>Login & Sync</Text></TouchableOpacity>
        <TouchableOpacity onPress={clearCart} style={[s.btn,{backgroundColor:'#333'}]}><Text style={s.btnText}>Clear</Text></TouchableOpacity>
      </View>
      <Text style={s.cartText}>🛒 Cart: {cart.length} items</Text>
      <View style={s.filters}>
        {['All','Shoes','Clothes','Jewelry','Accessories'].map(c=>(
          <TouchableOpacity key={c} onPress={()=>setCat(c)} style={[s.filterBtn, cat===c && s.filterActive]}><Text style={[s.filterText, cat===c && {color:'#000'}]}>{c}</Text></TouchableOpacity>
        ))}
      </View>
      <FlatList data={filtered} numColumns={2} keyExtractor={i=>i.id.toString()} renderItem={({item})=>(
        <View style={s.card}>
          <Image source={{uri:item.image}} style={s.img}/>
          <Text style={s.name}>{item.name}</Text>
          <Text style={s.price}>${item.price}</Text>
          <TouchableOpacity onPress={()=>addToCart(item.id,item.name)} style={s.addBtn}><Text style={{fontWeight:'700'}}>Add to Cart</Text></TouchableOpacity>
        </View>
      )}/>
    </View>
  );
}
const s = StyleSheet.create({
  container:{flex:1,backgroundColor:'#000',padding:16,paddingTop:50},
  title:{color:'#fff',fontSize:26,fontWeight:'900'},
  sub:{color:'#666',fontSize:11,marginBottom:10},
  input:{backgroundColor:'#222',color:'#fff',padding:12,borderRadius:8,marginBottom:8},
  btn:{padding:14,borderRadius:8,alignItems:'center'},
  btnText:{color:'#fff',fontWeight:'800'},
  cartText:{color:'#0f0',marginTop:12,fontWeight:'700'},
  filters:{flexDirection:'row',gap:6,marginTop:10,marginBottom:6},
  filterBtn:{paddingHorizontal:10,paddingVertical:6,borderRadius:20,backgroundColor:'#111',borderWidth:1,borderColor:'#333'},
  filterActive:{backgroundColor:'#fff'},
  filterText:{color:'#888',fontSize:12},
  card:{flex:1,backgroundColor:'#111',margin:4,borderRadius:10,padding:8},
  img:{height:100,borderRadius:8},
  name:{color:'#fff',fontSize:12,marginTop:6},
  price:{color:'#ff2d55',fontWeight:'800'},
  addBtn:{backgroundColor:'#fff',padding:8,borderRadius:6,marginTop:6,alignItems:'center'}
});