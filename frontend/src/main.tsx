import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';
const SESSION_KEY = 'fb-outlet-session';

type Role = 'HQ' | 'OUTLET';
type Session = { accessToken: string; refreshToken: string; role: Role; companyId: string; outletId?: string; companyName?: string };
type AuthUser = { role: Role; companyId: string; outletId?: string | null };
type AuthResponse = { user: AuthUser; company?: { name: string }; tokens: { accessToken: string; refreshToken: string } };
type MenuItem = { id: string; name: string; basePrice: number };
type OutletMenuItem = { id: string; name: string; price: number };
type ItemCount = { menuItemId: string; name: string; quantity: number };

// Storage can be unavailable (private mode, blocked site data); the app still works without it.
function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore: the session simply will not survive a reload.
  }
}

function toSession(data: AuthResponse, previous?: Session): Session {
  return {
    accessToken: data.tokens.accessToken,
    refreshToken: data.tokens.refreshToken,
    role: data.user.role,
    companyId: data.user.companyId,
    ...(data.user.outletId && { outletId: data.user.outletId }),
    companyName: data.company?.name ?? previous?.companyName
  };
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? 'Request failed');
  return data;
}

const newIdempotencyKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

function App() {
  const [session, setSession] = useState<Session | null>(loadSession);
  const sessionRef = useRef(session);
  const refreshing = useRef<Promise<Session | null> | null>(null);
  const checkoutKey = useRef<string | null>(null);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const [outletId, setOutletId] = useState(session?.outletId ?? '');
  const [outlets, setOutlets] = useState<Array<{ id: string; name: string }>>([]);
  const [outletName, setOutletName] = useState('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuName, setMenuName] = useState('');
  const [menuPrice, setMenuPrice] = useState('');
  const [masterItemId, setMasterItemId] = useState('');
  const [basePriceEdit, setBasePriceEdit] = useState('');
  const [overridePrice, setOverridePrice] = useState('');
  const [outletMenu, setOutletMenu] = useState<OutletMenuItem[]>([]);
  const [outletItemId, setOutletItemId] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [inventory, setInventory] = useState<ItemCount[]>([]);
  const [cartQuantity, setCartQuantity] = useState('1');
  const [cart, setCart] = useState<ItemCount[]>([]);
  const [receipt, setReceipt] = useState('');
  const [revenue, setRevenue] = useState<number | null>(null);
  const [topItems, setTopItems] = useState<ItemCount[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('HQ');

  const updateSession = (next: Session | null) => {
    sessionRef.current = next;
    saveSession(next);
    setSession(next);
  };

  // Refresh tokens rotate, so concurrent 401s must share one refresh request.
  const refreshSession = (current: Session) => {
    refreshing.current ??= postJson<AuthResponse>('/auth/refresh', { refreshToken: current.refreshToken })
      .then((data) => toSession(data, current))
      .catch(() => null)
      .then((next) => {
        refreshing.current = null;
        updateSession(next);
        return next;
      });
    return refreshing.current;
  };

  const call = async (path: string, options: RequestInit = {}) => {
    const send = (token: string) => fetch(`${API}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers } });
    const current = sessionRef.current;
    if (!current) throw new Error('Please sign in');
    let response = await send(current.accessToken);
    if (response.status === 401) {
      const refreshed = await refreshSession(current);
      if (!refreshed) throw new Error('Session expired, please sign in again');
      response = await send(refreshed.accessToken);
    }
    if (response.status === 204) return null;
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message ?? 'Request failed');
    return data;
  };

  const loadOutlets = async () => {
    try { setOutlets((await call(`/companies/${sessionRef.current!.companyId}/outlets`)).items); } catch (error) { setMessage(errorText(error, 'Failed to load outlets')); }
  };
  const loadMenuItems = async () => {
    try { setMenuItems((await call('/menu-items')).items); } catch (error) { setMessage(errorText(error, 'Failed to load menu')); }
  };
  const loadOutletMenu = async () => {
    if (!outletId) return;
    try { setOutletMenu((await call(`/outlets/${outletId}/menu`)).items); } catch (error) { setMessage(errorText(error, 'Failed to load outlet menu')); }
  };
  const loadInventory = async () => {
    if (!outletId) return;
    try { setInventory((await call(`/outlets/${outletId}/inventory`)).items); } catch (error) { setMessage(errorText(error, 'Failed to load inventory')); }
  };

  useEffect(() => {
    if (session?.role === 'HQ') { void loadOutlets(); void loadMenuItems(); }
  }, [session?.role, session?.companyId]);

  useEffect(() => {
    setOutletMenu([]); setInventory([]); setCart([]); setReceipt(''); setRevenue(null); setTopItems([]);
    checkoutKey.current = null;
    if (session && outletId) { void loadOutletMenu(); void loadInventory(); }
  }, [outletId, Boolean(session)]);

  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const data = mode === 'signup'
        ? await postJson<AuthResponse>('/auth/register', { companyName, email, password })
        : await postJson<AuthResponse>('/auth/login', { email, password });
      const next = toSession(data);
      updateSession(next);
      setOutletId(next.outletId ?? '');
      setPassword('');
    } catch (error) {
      setMessage(errorText(error, 'Authentication failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = () => {
    updateSession(null);
    setOutletId(''); setOutlets([]); setMenuItems([]); setMessage('');
  };

  if (!session) {
    const signup = mode === 'signup';
    return <main>
      <h1>F&amp;B Outlet Management</h1>
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

  const isHq = session.role === 'HQ';
  const run = async (action: () => Promise<unknown>, fallback: string, done?: string) => {
    setMessage('');
    try { await action(); if (done) setMessage(done); } catch (error) { setMessage(errorText(error, fallback)); }
  };

  const createOutlet = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      const outlet = await call(`/companies/${session.companyId}/outlets`, { method: 'POST', body: JSON.stringify({ name: outletName }) });
      setOutletName(''); await loadOutlets(); setOutletId(outlet.id);
    }, 'Failed to create outlet');
  };
  const createMenuItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      await call('/menu-items', { method: 'POST', body: JSON.stringify({ name: menuName, basePrice: Number(menuPrice) }) });
      setMenuName(''); setMenuPrice(''); await loadMenuItems();
    }, 'Failed to create menu item');
  };
  const updateBasePrice = () => {
    if (!masterItemId || !basePriceEdit) return setMessage('Choose a menu item and a new base price');
    void run(async () => {
      await call(`/menu-items/${masterItemId}`, { method: 'PUT', body: JSON.stringify({ basePrice: Number(basePriceEdit) }) });
      setBasePriceEdit(''); await loadMenuItems(); await loadOutletMenu();
    }, 'Failed to update menu item', 'Base price updated');
  };
  const deleteMenuItem = (id: string) => void run(async () => {
    await call(`/menu-items/${id}`, { method: 'DELETE' });
    if (masterItemId === id) setMasterItemId('');
    await loadMenuItems();
  }, 'Failed to delete menu item', 'Menu item deleted');
  const assignMenuItem = () => {
    if (!outletId || !masterItemId) return setMessage('Choose an outlet and a menu item first');
    void run(async () => {
      await call(`/outlets/${outletId}/menu-items`, { method: 'POST', body: JSON.stringify({ menuItemId: masterItemId }) });
      await loadOutletMenu();
    }, 'Failed to assign menu item');
  };
  const unassignMenuItem = () => {
    if (!outletId || !masterItemId) return setMessage('Choose an outlet and a menu item first');
    void run(async () => {
      await call(`/outlets/${outletId}/menu-items/${masterItemId}`, { method: 'DELETE' });
      await loadOutletMenu(); await loadInventory();
    }, 'Failed to unassign menu item');
  };
  const setPrice = () => {
    if (!outletId || !masterItemId || !overridePrice) return setMessage('Choose an outlet, a menu item, and a price first');
    void run(async () => {
      await call(`/outlets/${outletId}/menu-items/${masterItemId}/price`, { method: 'PUT', body: JSON.stringify({ price: Number(overridePrice) }) });
      setOverridePrice(''); await loadOutletMenu();
    }, 'Failed to update price');
  };
  const setStock = () => {
    if (!outletItemId || stockQuantity === '') return setMessage('Choose an outlet menu item and a quantity first');
    void run(async () => {
      await call(`/outlets/${outletId}/inventory/${outletItemId}`, { method: 'PUT', body: JSON.stringify({ quantity: Number(stockQuantity) }) });
      setStockQuantity(''); await loadInventory();
    }, 'Failed to set stock');
  };
  const addToCart = () => {
    const item = outletMenu.find((entry) => entry.id === outletItemId);
    const quantity = Number(cartQuantity);
    if (!item) return setMessage('Choose an outlet menu item first');
    if (!Number.isInteger(quantity) || quantity < 1) return setMessage('Quantity must be a whole number of at least 1');
    checkoutKey.current = null;
    setCart((current) => [...current.filter((line) => line.menuItemId !== item.id), { menuItemId: item.id, name: item.name, quantity }]);
  };
  const checkout = () => {
    if (!cart.length) return setMessage('Add items to the cart first');
    // The key survives a failed attempt, so retrying the same cart cannot create a duplicate sale.
    checkoutKey.current ??= newIdempotencyKey();
    void run(async () => {
      const sale = await call(`/outlets/${outletId}/sync/sales`, {
        method: 'POST',
        headers: { 'Idempotency-Key': checkoutKey.current! },
        body: JSON.stringify({ items: cart.map(({ menuItemId, quantity }) => ({ menuItemId, quantity })) })
      });
      checkoutKey.current = null;
      setReceipt(`Receipt #${sale.receiptNumber} — total ${sale.totalAmount.toFixed(2)}`);
      setCart([]); await loadInventory();
    }, 'Checkout failed');
  };
  const loadReports = () => void run(async () => {
    const [revenueReport, topItemsReport] = await Promise.all([
      call(`/reports/outlets/${outletId}/revenue`),
      call(`/reports/outlets/${outletId}/top-items?limit=5`)
    ]);
    setRevenue(revenueReport.totalRevenue); setTopItems(topItemsReport.items);
  }, 'Failed to load reports');
  const createUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newUserRole === 'OUTLET' && !outletId) return setMessage('Choose an outlet before creating an outlet user');
    void run(async () => {
      await call(`/companies/${session.companyId}/users`, { method: 'POST', body: JSON.stringify({ email: newUserEmail, password: newUserPassword, role: newUserRole, ...(newUserRole === 'OUTLET' && { outletId }) }) });
      setNewUserEmail(''); setNewUserPassword('');
    }, 'Failed to create user', 'User created');
  };

  const outletLabel = outlets.find((outlet) => outlet.id === outletId)?.name;

  return <main>
    <header><h1>{isHq ? 'HQ Management' : 'Outlet POS'}</h1><button onClick={signOut}>Sign out</button></header>
    {session.companyName && <p>Welcome to {session.companyName}.</p>}
    {message && <p role="status">{message}</p>}

    {isHq && <section>
      <h2>Outlets</h2>
      <form onSubmit={createOutlet}><label>New outlet name<input required value={outletName} onChange={(event) => setOutletName(event.target.value)} /></label><button type="submit">Create outlet</button></form>
      <label>Working outlet<select value={outletId} onChange={(event) => setOutletId(event.target.value)}><option value="">Choose outlet</option>{outlets.map((outlet) => <option value={outlet.id} key={outlet.id}>{outlet.name}</option>)}</select></label>
    </section>}

    {isHq && <section>
      <h2>Master menu</h2>
      <form onSubmit={createMenuItem}><label>Item name<input required value={menuName} onChange={(event) => setMenuName(event.target.value)} /></label><label>Base price<input required type="number" min="0.01" step="0.01" value={menuPrice} onChange={(event) => setMenuPrice(event.target.value)} /></label><button type="submit">Create menu item</button></form>
      {menuItems.length > 0 && <ul>{menuItems.map((item) => <li key={item.id}>{item.name} — {item.basePrice.toFixed(2)} <button className="inline-button" onClick={() => deleteMenuItem(item.id)}>Delete</button></li>)}</ul>}
      <label>Menu item<select value={masterItemId} onChange={(event) => setMasterItemId(event.target.value)}><option value="">Choose item</option>{menuItems.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label>New base price<input type="number" min="0.01" step="0.01" value={basePriceEdit} onChange={(event) => setBasePriceEdit(event.target.value)} /></label>
      <button onClick={updateBasePrice}>Update base price</button>
      <h3>For {outletLabel ?? 'the working outlet'}</h3>
      <button onClick={assignMenuItem}>Assign to outlet</button> <button onClick={unassignMenuItem}>Unassign from outlet</button>
      <label>Outlet price override<input type="number" min="0.01" step="0.01" value={overridePrice} onChange={(event) => setOverridePrice(event.target.value)} /></label>
      <button onClick={setPrice}>Set outlet price</button>
    </section>}

    {!outletId
      ? <section><p>{isHq ? 'Choose or create an outlet to manage its menu, stock, sales, and reports.' : 'Your account is not linked to an outlet. Ask HQ to assign one.'}</p></section>
      : <>
        <section>
          <h2>Outlet menu</h2>
          {outletMenu.length ? <ul>{outletMenu.map((item) => <li key={item.id}>{item.name} — {item.price.toFixed(2)}</li>)}</ul> : <p>No items assigned yet.</p>}
          <label>Item<select value={outletItemId} onChange={(event) => setOutletItemId(event.target.value)}><option value="">Choose item</option>{outletMenu.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        </section>
        <section>
          <h2>Inventory</h2>
          {inventory.map((item) => <p key={item.menuItemId}>{item.name}: {item.quantity}</p>)}
          <label>Stock quantity<input type="number" min="0" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} /></label>
          <button onClick={setStock}>Set stock for selected item</button>
        </section>
        <section>
          <h2>POS checkout</h2>
          <label>Quantity<input type="number" min="1" value={cartQuantity} onChange={(event) => setCartQuantity(event.target.value)} /></label>
          <button onClick={addToCart}>Add selected item</button>
          {cart.map((line) => <p key={line.menuItemId}>{line.name} × {line.quantity}</p>)}
          <button onClick={checkout} disabled={!cart.length}>Checkout</button>
          {receipt && <p>{receipt}</p>}
        </section>
        <section>
          <h2>Reports</h2>
          <button onClick={loadReports}>Load revenue and top items</button>
          {revenue !== null && <p>Total revenue: {revenue.toFixed(2)}</p>}
          {topItems.map((item) => <p key={item.menuItemId}>{item.name}: {item.quantity} sold</p>)}
        </section>
      </>}

    {isHq && <section>
      <h2>Users</h2>
      <form onSubmit={createUser}><label>Email<input required type="email" value={newUserEmail} onChange={(event) => setNewUserEmail(event.target.value)} /></label><label>Password<input required minLength={12} type="password" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} /></label><label>Role<select value={newUserRole} onChange={(event) => setNewUserRole(event.target.value as Role)}><option value="HQ">HQ</option><option value="OUTLET">Outlet (working outlet)</option></select></label><button type="submit">Create user</button></form>
    </section>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
