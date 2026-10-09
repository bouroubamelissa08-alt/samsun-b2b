"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// --- CONFIGURATION SUPABASE ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const translations = {
  fr: { welcome: "Bonjour", newOrder: "Nouvelle commande", myOrders: "Mes commandes", cart: "Panier", total: "Total TTC", search: "Rechercher...", admin: "Admin" },
  en: { welcome: "Hello", newOrder: "New Order", myOrders: "My Orders", cart: "Cart", total: "Total Inc. Tax", search: "Search...", admin: "Admin" },
  kr: { welcome: "안녕하세요", newOrder: "새 주문", myOrders: "내 주문", cart: "장바구니", total: "총 합계", search: "검색...", admin: "관리자" }
};

export default function SamSunApp() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [lang, setLang] = useState('fr');
  const [view, setView] = useState('login'); 
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const t = translations[lang];

  useEffect(() => {
    checkUser();
    fetchProducts();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) handleLoginSuccess(session.user);
  }

  async function handleLogin(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert(error.message);
    handleLoginSuccess(data.user);
  }

  async function handleLoginSuccess(user) {
    setUser(user);
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(profileData);
    setView('home');
  }

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*, b2b_prices(*)').eq('actif', true);
    setProducts(data);
  }

  const addToCart = (p) => {
    const price = p.b2b_prices[0];
    setCart([...cart, { ...p, ...price, qty: 1 }]);
  };

  const submitOrder = async () => {
    const orderNum = `CMD-${Date.now()}`;
    const total = cart.reduce((acc, item) => acc + (item.prix_ttc * item.qty), 0);

    const { data: order, error } = await supabase.from('orders').insert([
      { num_commande: orderNum, restaurant_id: profile.restaurant_id, user_id: user.id, total_ttc: total }
    ]).select().single();

    if (error) return alert("Erreur");

    const items = cart.map(item => ({
      order_id: order.id,
      product_id: item.id,
      quantite: item.qty,
      prix_unitaire_ht_fixe: item.prix_ht,
      tva_fixe: item.tva
    }));

    await supabase.from('order_items').insert(items);
    setCart([]);
    alert("Commande envoyée !");
    setView('orders');
  };

  const downloadPDF = (order) => {
    const doc = new jsPDF();
    doc.text("SAM SUN B2B - FACTURE", 10, 10);
    doc.text(`Commande: ${order.num_commande}`, 10, 20);
    doc.autoTable({
      startY: 30,
      head: [['Produit', 'Qté', 'Prix HT', 'Total']],
      body: order.items.map(i => [i.nom, i.quantite, i.prix_ht, i.quantite * i.prix_ht]),
    });
    doc.save(`facture_${order.num_commande}.pdf`);
  };

  if (view === 'login') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
        <h1 className="text-4xl font-black text-blue-900 mb-2">SAM SUN</h1>
        <p className="text-gray-500 mb-8">Gestion B2B</p>
        <input id="email" type="email" placeholder="Email" className="w-full p-3 mb-4 border rounded-lg" />
        <input id="pass" type="password" placeholder="Mot de passe" className="w-full p-3 mb-6 border rounded-lg" />
        <button onClick={() => handleLogin(document.getElementById('email').value, document.getElementById('pass').value)} 
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">SE CONNECTER</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      <header className="bg-blue-900 text-white p-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
        <h1 className="text-xl font-bold cursor-pointer" onClick={() => setView('home')}>SAM SUN B2B</h1>
        <div className="flex gap-1">
          {['fr', 'en', 'kr'].map(l => (
            <button key={l} onClick={() => setLang(l)} className={`px-2 py-1 text-xs rounded ${lang === l ? 'bg-white text-blue-900 font-bold' : 'bg-blue-800'}`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <main className="p-4 max-w-4xl mx-auto">
        {view === 'home' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
              <h2 className="text-3xl font-bold text-slate-800">{t.welcome}, {profile?.nom}</h2>
              <p className="text-blue-600 font-medium">Restaurant: {profile?.restaurant_id ? 'Connecté' : 'Admin'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setView('catalog')} className="bg-white p-8 rounded-2xl shadow-sm border text-center text-2xl hover:bg-blue-50 transition">🛒<br/><span className="text-sm font-bold">{t.newOrder}</span></button>
              <button onClick={() => setView('orders')} className="bg-white p-8 rounded-2xl shadow-sm border text-center text-2xl hover:bg-blue-50 transition">📋<br/><span className="text-sm font-bold">{t.myOrders}</span></button>
            </div>
          </div>
        )}

        {view === 'catalog' && (
          <div className="space-y-4">
            <input type="text" placeholder={t.search} className="w-full p-4 border rounded-xl shadow-sm bg-white" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map(p => (
                <div key={p.id} className="bg-white p-4 rounded-xl border flex justify-between items-center shadow-sm">
                  <div>
                    <h3 className="font-bold text-slate-800">{lang === 'fr' ? p.nom_fr : lang === 'en' ? p.nom_en : p.nom_kr}</h3>
                    <p className="text-xs text-gray-400">{p.unite} | {p.b2b_prices?.[0]?.prix_ttc}€</p>
                  </div>
                  <button onClick={() => addToCart(p)} className="bg-blue-600 text-white w-10 h-10 rounded-full font-bold">+</button>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="fixed bottom-24 left-4 right-4 bg-blue-900 text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center animate-bounce">
                <span className="font-bold">{cart.length} articles - {cart.reduce((a, b) => a + (b.prix_ttc * b.qty), 0)}€</span>
                <button onClick={submitOrder} className="bg-green-500 px-6 py-2 rounded-xl font-bold">ENVOYER</button>
              </div>
            )}
          </div>
        )}

        {view === 'orders' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">{t.myOrders}</h2>
            <div className="bg-white rounded-xl border divide-y">
              <div className="p-4 flex justify-between items-center">
                <div><p className="font-bold text-blue-900">CMD-2026-0001</p><p className="text-xs text-gray-400">Aujourd'hui</p></div>
                <span className="px-3 py-1 bg-orange-100 text-orange-600 text-xs rounded-full font-bold">NOUVELLE</span>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around p-4 text-slate-400 shadow-lg">
        <button onClick={() => setView('home')} className="flex flex-col items-center text-xs">🏠<span>Accueil</span></button>
        <button onClick={() => setView('catalog')} className="flex flex-col items-center text-xs">🛒<span>{t.newOrder}</span></button>
        <button onClick={() => setView('orders')} className="flex flex-col items-center text-xs">📋<span>{t.myOrders}</span></button>
      </nav>
    </div>
  );
}
