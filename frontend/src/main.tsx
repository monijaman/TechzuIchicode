import { useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';
type Session = { accessToken: string; role: 'HQ' | 'OUTLET'; companyId: string; companyName?: string };
type AuthResponse = { user: { role: 'HQ' | 'OUTLET'; companyId: string }; company?: { name: string }; tokens: { accessToken: string } };

async function requestAuth(path: '/auth/login' | '/auth/register', body: Record<string, string>): Promise<AuthResponse> {
  const response = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? 'Request failed');
  return data;
}

async function call(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers } });
  if (!response.ok) throw new Error((await response.json()).error?.message ?? 'Request failed');
  return response.json();
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [outletId, setOutletId] = useState('');
  const [outletName, setOutletName] = useState('');
  const [outlets, setOutlets] = useState<Array<{ id: string; name: string }>>([]);
  const [menuName, setMenuName] = useState('');
  const [menuPrice, setMenuPrice] = useState('');
  const [menuItems, setMenuItems] = useState<Array<{ id: string; name: string; basePrice: number }>>([]);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [overridePrice, setOverridePrice] = useState('');
  const [outletMenu, setOutletMenu] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const data = mode === 'signup'
        ? await requestAuth('/auth/register', { companyName, email, password })
        : await requestAuth('/auth/login', { email, password });
      setSession({ accessToken: data.tokens.accessToken, role: data.user.role, companyId: data.user.companyId, companyName: data.company?.name });
      setPassword('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) {
    const signup = mode === 'signup';
    return <main>
      <h1>Microservices  </h1>
      <p>{signup ? 'Create your company and first HQ account.' : 'Sign in to manage operations.'}</p>
      <form onSubmit={authenticate}>
        {signup && <label>Company name<input required value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></label>}
        <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input required type="password" minLength={signup ? 12 : 1} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {signup && <small>Password must contain at least 12 characters.</small>}
        <button type="submit" disabled={submitting}>{submitting ? 'Please wait…' : signup ? 'Create company' : 'Sign in'}</button>
      </form>
      <button className="link-button" type="button" onClick={() => { setMode(signup ? 'login' : 'signup'); setMessage(''); }}>
        {signup ? 'Already have an account? Sign in' : 'New here? Create your company'}
      </button>
      {message && <p role="alert">{message}</p>}
    </main>;
  }

  const loadMenu = async () => {
    try {
      const data = await call(`/outlets/${outletId}/menu`, session.accessToken);
      setMessage(`${data.items.length} assigned items loaded`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed');
    }
  };

  const loadOutlets = async () => {
    try {
      const data = await call(`/companies/${session.companyId}/outlets`, session.accessToken);
      setOutlets(data.items);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Failed to load outlets'); }
  };

  const createOutlet = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await call(`/companies/${session.companyId}/outlets`, session.accessToken, { method: 'POST', body: JSON.stringify({ name: outletName }) });
      setOutletName('');
      await loadOutlets();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Failed to create outlet'); }
  };

  const loadMenuItems = async () => {
    try { setMenuItems((await call('/menu-items', session.accessToken)).items); } catch (error) { setMessage(error instanceof Error ? error.message : 'Failed to load menu'); }
  };

  const createMenuItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await call('/menu-items', session.accessToken, { method: 'POST', body: JSON.stringify({ name: menuName, basePrice: Number(menuPrice) }) });
      setMenuName(''); setMenuPrice(''); await loadMenuItems();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Failed to create menu item'); }
  };

  const loadOutletMenu = async () => {
    if (!outletId) return setMessage('Select an outlet first');
    try { setOutletMenu((await call(`/outlets/${outletId}/menu`, session.accessToken)).items); } catch (error) { setMessage(error instanceof Error ? error.message : 'Failed to load outlet menu'); }
  };
  const assignMenuItem = async () => {
    if (!outletId || !selectedMenuItemId) return setMessage('Select an outlet and menu item first');
    try { await call(`/outlets/${outletId}/menu-items`, session.accessToken, { method: 'POST', body: JSON.stringify({ menuItemId: selectedMenuItemId }) }); await loadOutletMenu(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Failed to assign menu item'); }
  };
  const setPrice = async () => {
    if (!outletId || !selectedMenuItemId || !overridePrice) return setMessage('Select an outlet, item, and price first');
    try { await call(`/outlets/${outletId}/menu-items/${selectedMenuItemId}/price`, session.accessToken, { method: 'PUT', body: JSON.stringify({ price: Number(overridePrice) }) }); await loadOutletMenu(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Failed to update price'); }
  };

  return <main>
    <header><h1>{session.role === 'HQ' ? 'HQ Management' : 'Outlet POS'}</h1><button onClick={() => setSession(null)}>Sign out</button></header>
    {session.companyName && <p>Welcome to {session.companyName}.</p>}
    <label>Outlet ID<input value={outletId} onChange={(event) => setOutletId(event.target.value)} placeholder="UUID" /></label>
    <button onClick={loadMenu}>Load outlet menu</button>
    {session.role === 'HQ'
      ? <section><h2>Outlets</h2><form onSubmit={createOutlet}><label>New outlet name<input required value={outletName} onChange={(event) => setOutletName(event.target.value)} /></label><button type="submit">Create outlet</button></form><button onClick={loadOutlets}>Load outlets</button>{outlets.length > 0 && <ul>{outlets.map((outlet) => <li key={outlet.id}><button className="link-button" onClick={() => setOutletId(outlet.id)}>{outlet.name}</button></li>)}</ul>}<h2>Master menu</h2><form onSubmit={createMenuItem}><label>Item name<input required value={menuName} onChange={(event) => setMenuName(event.target.value)} /></label><label>Base price<input required type="number" min="0.01" step="0.01" value={menuPrice} onChange={(event) => setMenuPrice(event.target.value)} /></label><button type="submit">Create menu item</button></form><button onClick={loadMenuItems}>Load menu items</button>{menuItems.length > 0 && <ul>{menuItems.map((item) => <li key={item.id}>{item.name} — {item.basePrice.toFixed(2)}</li>)}</ul>}<h2>Outlet menu</h2><label>Menu item<select value={selectedMenuItemId} onChange={(event) => setSelectedMenuItemId(event.target.value)}><option value="">Choose item</option>{menuItems.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><button onClick={assignMenuItem}>Assign to selected outlet</button><label>Override price<input type="number" min="0.01" step="0.01" value={overridePrice} onChange={(event) => setOverridePrice(event.target.value)} /></label><button onClick={setPrice}>Set outlet price</button><button onClick={loadOutletMenu}>Load outlet menu</button>{outletMenu.length > 0 && <ul>{outletMenu.map((item) => <li key={item.id}>{item.name} — {item.price.toFixed(2)}</li>)}</ul>}<h2>Reporting</h2><p>Revenue and top-item reports are the next feature.</p></section>
      : <section><h2>Point of sale</h2><p>Load assigned menu, build a cart, and submit a sale using an idempotency key.</p></section>}
    {message && <p role="status">{message}</p>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
