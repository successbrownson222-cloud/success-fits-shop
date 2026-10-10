import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';

const API_URL = 'https://success-its-shop.vercel.app';

export default function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [email, setEmail] = useState('brownsonsuccess033@gmail.com');
  const [loggedIn, setLoggedIn] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [inputEmail, setInputEmail] = useState('brownsonsuccess033@gmail.com');

  const loadProducts = async () => {
    try {
      let r = await fetch(`${API_URL}/api/products`);
      let j = await r.json();
      setProducts(Array.isArray(j) ? j : j.products || []);
    } catch {}
  };

  const loadCart = async (e) => {
    const clean = (e || email).toLowerCase().trim();
    if (!clean) return;
    try {
      let r = await fetch(`${API_URL}/api/cart?email=${encodeURIComponent(clean)}`);
      let d = await r.json();
      console.log('Cart from backend:', d);
      if (d.items) setCart(d.items);
    } catch (err) {
      console.log('loadCart err', err);
    }
  };

  const addToCart = async (product_id) => {
    const clean = email.toLowerCase().trim();
    if (!loggedIn) { setShowAuth(true); return; }
    try {
      await fetch(`${API_URL}/api/cart/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean, product_id })
      });
      await loadCart(clean);
    } catch {}
  };

  const doLogin = () => {
    const clean = inputEmail.toLowerCase().trim();
    if (!clean.includes('@')) { Alert.alert('Enter valid email'); return; }
    setEmail(clean);
    setLoggedIn(true);
    setShowAuth(false);
    // THIS WAS MISSING - LOAD CART AFTER LOGIN
    setTimeout(() => loadCart(clean), 500);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Auto-sync every 5 seconds when logged in - website -> app live sync
  useEffect(() => {
    if (!loggedIn) return;
    loadCart(email);
    const interval = setInterval(() => loadCart(email), 5000);
    return () => clearInterval(interval);
  }, [loggedIn, email]);

  return (
    <View style={{ flex: 1, backgroundColor: '#070707', paddingTop: 40 }}>
      <View style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>SUCCESS FITS</Text>
        <TouchableOpacity onPress={() => setLoggedIn(!loggedIn ? false : false)}>
          <Text style={{ color: '#fff', backgroundColor: '#222', padding: 8, borderRadius: 8 }}>
            {loggedIn ? 'Logout' : 'Login'} {loggedIn ? `(${cart.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {!loggedIn && showAuth && (
        <View style={{ backgroundColor: '#111', padding: 16, margin: 14, borderRadius: 16, borderWidth: 1, borderColor: '#222' }}>
          <Text style={{ color: '#fff', marginBottom: 8 }}>Login to sync cart</Text>
          <Text style={{ color: '#888', fontSize: 12 }}>Use same email as website (brownsonsuccess033@gmail.com)</Text>
          <TextInput
            value={inputEmail}
            onChangeText={setInputEmail}
            placeholder="email"
            placeholderTextColor="#666"
            style={{ backgroundColor: '#1e1e1e', color: '#fff', padding: 12, borderRadius: 12, marginTop: 10 }}
          />
          <TouchableOpacity onPress={doLogin} style={{ backgroundColor: '#ff2d55', padding: 14, borderRadius: 12, marginTop: 10 }}>
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '800' }}>Continue</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAuth(false)}><Text style={{ color: '#666', textAlign: 'center', marginTop: 10 }}>Close</Text></TouchableOpacity>
        </View>
      )}

      <Text style={{ color: '#888', paddingHorizontal: 14, marginBottom: 6 }}>
        {loggedIn ? `Logged as ${email} - ${cart.length} items synced from website` : 'Logged out'}
      </Text>

      <FlatList
        data={products}
        numColumns={2}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 8 }}
        renderItem={({ item }) => (
          <View style={{ flex: 1, backgroundColor: '#111', margin: 6, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: '#1c1c1c' }}>
            <Image source={{ uri: item.image }} style={{ width: '100%', height: 110, borderRadius: 12 }} />
            <Text style={{ color: '#fff', fontSize: 12, marginTop: 6 }} numberOfLines={1}>{item.name}</Text>
            <Text style={{ color: '#aaa' }}>${item.price}</Text>
            <TouchableOpacity onPress={() => addToCart(item.id)} style={{ backgroundColor: '#fff', padding: 10, borderRadius: 10, marginTop: 6 }}>
              <Text style={{ textAlign: 'center', fontWeight: '800' }}>Add</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}