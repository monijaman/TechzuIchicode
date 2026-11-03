import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';
type Session = { accessToken: string; role: 'HQ' | 'OUTLET' };
async function call(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers } });
  if (!response.ok) throw new Error((await response.json()).error?.message ?? 'Request failed');
  return response.json();
}
function App() {
  const [session, setSession] = useState<Session | null>(null); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [outletId, setOutletId] = useState(''); const [message, setMessage] = useState('');
  const login = async () => { try { const data = await fetch(`${API}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,password}) }).then(async r => { if (!r.ok) throw new Error((await r.json()).error?.message); return r.json(); }); setSession({accessToken:data.tokens.accessToken,role:data.user.role}); setMessage('Signed in'); } catch(e) { setMessage(e instanceof Error ? e.message : 'Login failed'); } };
  if (!session) return <main><h1>F&B Outlet</h1><p>Sign in to manage operations.</p><input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/><input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/><button onClick={login}>Sign in</button><p>{message}</p></main>;
  const loadMenu = async () => { try { const data=await call(`/outlets/${outletId}/menu`,session.accessToken); setMessage(`${data.items.length} assigned items loaded`); } catch(e) { setMessage(e instanceof Error?e.message:'Failed'); } };
  return <main><header><h1>{session.role === 'HQ' ? 'HQ Management' : 'Outlet POS'}</h1><button onClick={()=>setSession(null)}>Sign out</button></header><label>Outlet ID<input value={outletId} onChange={e=>setOutletId(e.target.value)} placeholder="UUID"/></label><button onClick={loadMenu}>Load outlet menu</button>{session.role==='HQ' ? <section><h2>Catalog & reporting</h2><p>Create master items, assign them to outlets, set local prices, and review revenue/top-item reports.</p></section> : <section><h2>Point of sale</h2><p>Load assigned menu, build a cart, and submit a sale using an idempotency key.</p></section>}<p>{message}</p></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
