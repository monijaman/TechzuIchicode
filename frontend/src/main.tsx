import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
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

type Errors = Record<string, string>;
const required = (value: string, label: string) => (value.trim() ? undefined : `${label} is required`);
const emailError = (value: string) => {
  if (!value.trim()) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email address';
};
const newPasswordError = (value: string) => {
  if (!value) return 'Password is required';
  if (value.length < 12) return 'Password must be at least 12 characters';
  if (value.length > 128) return 'Password must be at most 128 characters';
};
const priceError = (value: string, label: string) => {
  if (!value.trim()) return `${label} is required`;
  if (!(Number(value) > 0)) return `${label} must be greater than 0`;
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return `${label} can have at most 2 decimal places`;
};
const quantityError = (value: string, min: 0 | 1) => {
  if (!value.trim()) return 'Quantity is required';
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < min) return min === 0 ? 'Enter a whole number, 0 or more' : 'Enter a whole number, at least 1';
};
const chosen = (value: string, message: string) => (value ? undefined : message);

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return <label className={error ? 'field invalid' : 'field'}>
    <span className="field-label">{label}</span>
    {children}
    {error ? <span className="field-error" role="alert">{error}</span> : hint && <span className="field-hint">{hint}</span>}
  </label>;
}

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
  const [errors, setErrors] = useState<Errors>({});

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

  // Replaces the errors for the checked fields only, so other forms keep theirs.
  const validate = (checks: Record<string, string | undefined>) => {
    const found = Object.entries(checks).filter((entry): entry is [string, string] => Boolean(entry[1]));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(checks)) delete next[key];
      return { ...next, ...Object.fromEntries(found) };
    });
    return found.length === 0;
  };
  const clearError = (key: string) => setErrors((current) => {
    if (!(key in current)) return current;
    const { [key]: _removed, ...rest } = current;
    return rest;
  });
  const bind = (setter: (value: string) => void, key: string) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(event.target.value);
    clearError(key);
  };

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
    setMessage('');
    const signup = mode === 'signup';
    if (!validate({
      companyName: signup ? required(companyName, 'Company name') : undefined,
      email: emailError(email),
      password: signup ? newPasswordError(password) : required(password, 'Password')
    })) return;
    setSubmitting(true);
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
    setOutletId(''); setOutlets([]); setMenuItems([]); setMessage(''); setErrors({});
  };

  if (!session) {
    const signup = mode === 'signup';
    return <main className="auth">
      <p className="brand">CliqCRM Services</p>
      <h1>{signup ? 'Create your company' : 'Welcome back'}</h1>
      <p className="subtitle">{signup ? 'Set up your company and its first HQ account.' : 'Sign in to manage your outlets.'}</p>
      {message && <p className="alert" role="alert">{message}</p>}
      <form onSubmit={authenticate} noValidate>
        {signup && <Field label="Company name" error={errors.companyName}><input value={companyName} onChange={bind(setCompanyName, 'companyName')} /></Field>}
        <Field label="Email" error={errors.email}><input type="email" autoComplete="email" value={email} onChange={bind(setEmail, 'email')} /></Field>
        <Field label="Password" error={errors.password} hint={signup ? 'At least 12 characters.' : undefined}><input type="password" autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={bind(setPassword, 'password')} /></Field>
        <button className="block" type="submit" disabled={submitting}>{submitting ? 'Please wait…' : signup ? 'Create company' : 'Sign in'}</button>
      </form>
      <p className="switch">
        {signup ? 'Already have an account?' : 'New here?'}{' '}
        <button className="link-button" type="button" onClick={() => { setMode(signup ? 'login' : 'signup'); setMessage(''); setErrors({}); }}>
          {signup ? 'Sign in' : 'Create your company'}
        </button>
      </p>
    </main>;
  }

  const isHq = session.role === 'HQ';
  const run = async (action: () => Promise<unknown>, fallback: string, done?: string) => {
    setMessage('');
    try { await action(); if (done) setMessage(done); } catch (error) { setMessage(errorText(error, fallback)); }
  };

  const createOutlet = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate({ outletName: required(outletName, 'Outlet name') })) return;
    void run(async () => {
      const outlet = await call(`/companies/${session.companyId}/outlets`, { method: 'POST', body: JSON.stringify({ name: outletName }) });
      setOutletName(''); await loadOutlets(); setOutletId(outlet.id);
    }, 'Failed to create outlet');
  };
  const createMenuItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate({ menuName: required(menuName, 'Item name'), menuPrice: priceError(menuPrice, 'Base price') })) return;
    void run(async () => {
      await call('/menu-items', { method: 'POST', body: JSON.stringify({ name: menuName, basePrice: Number(menuPrice) }) });
      setMenuName(''); setMenuPrice(''); await loadMenuItems();
    }, 'Failed to create menu item');
  };
  const updateBasePrice = () => {
    if (!validate({ masterItemId: chosen(masterItemId, 'Choose a menu item'), basePriceEdit: priceError(basePriceEdit, 'New base price') })) return;
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
    if (!validate({ outletId: chosen(outletId, 'Choose an outlet'), masterItemId: chosen(masterItemId, 'Choose a menu item') })) return;
    void run(async () => {
      await call(`/outlets/${outletId}/menu-items`, { method: 'POST', body: JSON.stringify({ menuItemId: masterItemId }) });
      await loadOutletMenu();
    }, 'Failed to assign menu item');
  };
  const unassignMenuItem = () => {
    if (!validate({ outletId: chosen(outletId, 'Choose an outlet'), masterItemId: chosen(masterItemId, 'Choose a menu item') })) return;
    void run(async () => {
      await call(`/outlets/${outletId}/menu-items/${masterItemId}`, { method: 'DELETE' });
      await loadOutletMenu(); await loadInventory();
    }, 'Failed to unassign menu item');
  };
  const setPrice = () => {
    if (!validate({ outletId: chosen(outletId, 'Choose an outlet'), masterItemId: chosen(masterItemId, 'Choose a menu item'), overridePrice: priceError(overridePrice, 'Outlet price') })) return;
    void run(async () => {
      await call(`/outlets/${outletId}/menu-items/${masterItemId}/price`, { method: 'PUT', body: JSON.stringify({ price: Number(overridePrice) }) });
      setOverridePrice(''); await loadOutletMenu();
    }, 'Failed to update price');
  };
  const setStock = () => {
    if (!validate({ outletItemId: chosen(outletItemId, 'Choose an item'), stockQuantity: quantityError(stockQuantity, 0) })) return;
    void run(async () => {
      await call(`/outlets/${outletId}/inventory/${outletItemId}`, { method: 'PUT', body: JSON.stringify({ quantity: Number(stockQuantity) }) });
      setStockQuantity(''); await loadInventory();
    }, 'Failed to set stock');
  };
  const addToCart = () => {
    const item = outletMenu.find((entry) => entry.id === outletItemId);
    if (!validate({ outletItemId: item ? undefined : 'Choose an item', cartQuantity: quantityError(cartQuantity, 1) }) || !item) return;
    const quantity = Number(cartQuantity);
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
    if (!validate({
      newUserEmail: emailError(newUserEmail),
      newUserPassword: newPasswordError(newUserPassword),
      newUserRole: newUserRole === 'OUTLET' && !outletId ? 'Choose a working outlet above for outlet users' : undefined
    })) return;
    void run(async () => {
      await call(`/companies/${session.companyId}/users`, { method: 'POST', body: JSON.stringify({ email: newUserEmail, password: newUserPassword, role: newUserRole, ...(newUserRole === 'OUTLET' && { outletId }) }) });
      setNewUserEmail(''); setNewUserPassword('');
    }, 'Failed to create user', 'User created');
  };

  const outletLabel = outlets.find((outlet) => outlet.id === outletId)?.name;

  return <main>
    <header>
      <div><p className="brand">CliqCRM Services</p><h1>{isHq ? 'HQ Management' : 'Outlet POS'}</h1></div>
      <button className="secondary" onClick={signOut}>Sign out</button>
    </header>
    {session.companyName && <p className="subtitle">Welcome to {session.companyName}.</p>}
    {message && <p className="notice" role="status">{message}</p>}

    {isHq && <section>
      <h2>Outlets</h2>
      <form onSubmit={createOutlet} noValidate><Field label="New outlet name" error={errors.outletName}><input value={outletName} onChange={bind(setOutletName, 'outletName')} /></Field><button type="submit">Create outlet</button></form>
      <Field label="Working outlet" error={errors.outletId}><select value={outletId} onChange={bind(setOutletId, 'outletId')}><option value="">Choose outlet</option>{outlets.map((outlet) => <option value={outlet.id} key={outlet.id}>{outlet.name}</option>)}</select></Field>
    </section>}

    {isHq && <section>
      <h2>Master menu</h2>
      <form onSubmit={createMenuItem} noValidate><Field label="Item name" error={errors.menuName}><input value={menuName} onChange={bind(setMenuName, 'menuName')} /></Field><Field label="Base price" error={errors.menuPrice}><input type="number" inputMode="decimal" min="0.01" step="0.01" value={menuPrice} onChange={bind(setMenuPrice, 'menuPrice')} /></Field><button type="submit">Create menu item</button></form>
      {menuItems.length > 0 && <ul>{menuItems.map((item) => <li key={item.id}>{item.name} — {item.basePrice.toFixed(2)} <button className="inline-button" onClick={() => deleteMenuItem(item.id)}>Delete</button></li>)}</ul>}
      <Field label="Menu item" error={errors.masterItemId}><select value={masterItemId} onChange={bind(setMasterItemId, 'masterItemId')}><option value="">Choose item</option>{menuItems.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
      <Field label="New base price" error={errors.basePriceEdit}><input type="number" inputMode="decimal" min="0.01" step="0.01" value={basePriceEdit} onChange={bind(setBasePriceEdit, 'basePriceEdit')} /></Field>
      <button onClick={updateBasePrice}>Update base price</button>
      <h3>For {outletLabel ?? 'the working outlet'}</h3>
      <button onClick={assignMenuItem}>Assign to outlet</button> <button onClick={unassignMenuItem}>Unassign from outlet</button>
      <Field label="Outlet price override" error={errors.overridePrice}><input type="number" inputMode="decimal" min="0.01" step="0.01" value={overridePrice} onChange={bind(setOverridePrice, 'overridePrice')} /></Field>
      <button onClick={setPrice}>Set outlet price</button>
    </section>}

    {!outletId
      ? <section><p>{isHq ? 'Choose or create an outlet to manage its menu, stock, sales, and reports.' : 'Your account is not linked to an outlet. Ask HQ to assign one.'}</p></section>
      : <>
        <section>
          <h2>Outlet menu</h2>
          {outletMenu.length ? <ul>{outletMenu.map((item) => <li key={item.id}>{item.name} — {item.price.toFixed(2)}</li>)}</ul> : <p>No items assigned yet.</p>}
          <Field label="Item" error={errors.outletItemId}><select value={outletItemId} onChange={bind(setOutletItemId, 'outletItemId')}><option value="">Choose item</option>{outletMenu.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
        </section>
        <section>
          <h2>Inventory</h2>
          {inventory.map((item) => <p key={item.menuItemId}>{item.name}: {item.quantity}</p>)}
          <Field label="Stock quantity" error={errors.stockQuantity}><input type="number" inputMode="numeric" min="0" step="1" value={stockQuantity} onChange={bind(setStockQuantity, 'stockQuantity')} /></Field>
          <button onClick={setStock}>Set stock for selected item</button>
        </section>
        <section>
          <h2>POS checkout</h2>
          <Field label="Quantity" error={errors.cartQuantity}><input type="number" inputMode="numeric" min="1" step="1" value={cartQuantity} onChange={bind(setCartQuantity, 'cartQuantity')} /></Field>
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
      <form onSubmit={createUser} noValidate><Field label="Email" error={errors.newUserEmail}><input type="email" autoComplete="off" value={newUserEmail} onChange={bind(setNewUserEmail, 'newUserEmail')} /></Field><Field label="Password" error={errors.newUserPassword}><input type="password" autoComplete="new-password" value={newUserPassword} onChange={bind(setNewUserPassword, 'newUserPassword')} /></Field><Field label="Role" error={errors.newUserRole}><select value={newUserRole} onChange={bind((value) => setNewUserRole(value as Role), 'newUserRole')}><option value="HQ">HQ</option><option value="OUTLET">Outlet (working outlet)</option></select></Field><button type="submit">Create user</button></form>
    </section>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
