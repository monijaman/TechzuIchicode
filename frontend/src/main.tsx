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
type CompanyUser = { id: string; email: string; role: Role; outletId: string | null; isActive: boolean; createdAt: string; outlet: { name: string } | null };
type ApiErrorDetails = Array<{ path: string; message: string }>;

class ApiRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly details?: ApiErrorDetails) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

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
const validateUserEmail = (value: string) => {
  if (!value.trim()) return 'Enter the user’s email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email address.';
  return undefined;
};
const validateUserPassword = (value: string) => {
  if (!value) return 'Enter a temporary password.';
  if (value.length < 12) return 'Use at least 12 characters.';
  if (value.length > 128) return 'Use no more than 128 characters.';
  return undefined;
};
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
  const [messageIsError, setMessageIsError] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [authErrors, setAuthErrors] = useState<{ companyName?: string; email?: string; password?: string }>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [hqSection, setHqSection] = useState<'overview' | 'outlets' | 'menu' | 'operations' | 'users'>('overview');
  const [menuSection, setMenuSection] = useState<'catalog' | 'base-pricing' | 'outlet-assignment'>('catalog');
  const [operationSection, setOperationSection] = useState<'menu' | 'inventory' | 'sales' | 'reports'>('menu');
  const [outletSection, setOutletSection] = useState<'menu' | 'sales' | 'reports'>('menu');
  const [outletId, setOutletId] = useState(session?.outletId ?? '');
  const [assignmentOutletId, setAssignmentOutletId] = useState(session?.outletId ?? '');
  const [assignmentOutletMenu, setAssignmentOutletMenu] = useState<OutletMenuItem[]>([]);
  const assignmentMenuRequest = useRef(0);
  const [outlets, setOutlets] = useState<Array<{ id: string; name: string }>>([]);
  const [outletName, setOutletName] = useState('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuName, setMenuName] = useState('');
  const [menuPrice, setMenuPrice] = useState('');
  const [editingMenuItemId, setEditingMenuItemId] = useState('');
  const [editingMenuItemName, setEditingMenuItemName] = useState('');
  const [masterItemId, setMasterItemId] = useState('');
  const [menuItemOutlets, setMenuItemOutlets] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const menuItemOutletsRequest = useRef(0);
  const [basePriceEdit, setBasePriceEdit] = useState('');
  const [overridePrice, setOverridePrice] = useState('');
  const [outletMenu, setOutletMenu] = useState<OutletMenuItem[]>([]);
  const [outletItemId, setOutletItemId] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [inventory, setInventory] = useState<ItemCount[]>([]);
  const [cartQuantity, setCartQuantity] = useState('1');
  const [cart, setCart] = useState<ItemCount[]>([]);
  const [addingAnotherSaleItem, setAddingAnotherSaleItem] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [revenue, setRevenue] = useState<number | null>(null);
  const [topItems, setTopItems] = useState<ItemCount[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('HQ');
  const [userSuccess, setUserSuccess] = useState('');
  const [userErrors, setUserErrors] = useState<{ email?: string; password?: string; role?: string }>({});
  const [userError, setUserError] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | Role>('ALL');
  const [userOutletFilter, setUserOutletFilter] = useState('ALL');
  const [userSearch, setUserSearch] = useState('');

  // Replaces the errors for the checked fields only, so other forms keep theirs.
  const validate = (checks: Record<string, string | undefined>) => {
    const found = Object.entries(checks).filter((entry): entry is [string, string] => Boolean(entry[1]));
    setFieldErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(checks)) delete next[key];
      return { ...next, ...Object.fromEntries(found) };
    });
    return found.length === 0;
  };
  const clearError = (key: string) => setFieldErrors((current) => {
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

  const setFieldError = (field: string, error?: string) => {
    setFieldErrors((current) => {
      const next = { ...current };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  };
  const priceError = (value: string, label: string) => {
    if (!value.trim()) return `Enter ${label}.`;
    const price = Number(value);
    if (!Number.isFinite(price) || price <= 0) return `${label[0].toUpperCase()}${label.slice(1)} must be greater than zero.`;
    if (price > 9999999999.99) return `${label[0].toUpperCase()}${label.slice(1)} is too large.`;
    if (Math.round(price * 100) !== price * 100) return `${label[0].toUpperCase()}${label.slice(1)} can have at most 2 decimal places.`;
    return undefined;
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
    if (!response.ok) throw new ApiRequestError(data.error?.message ?? 'Request failed', response.status, data.error?.code, data.error?.details);
    return data;
  };

  const loadOutlets = async () => {
    try { setOutlets((await call(`/companies/${sessionRef.current!.companyId}/outlets`)).items); } catch (error) { setMessage(errorText(error, 'Failed to load outlets')); }
  };
  const loadCompanyUsers = async () => {
    try { setCompanyUsers((await call(`/companies/${sessionRef.current!.companyId}/users`)).items); } catch (error) { setMessage(errorText(error, 'Failed to load users')); }
  };
  const loadMenuItems = async () => {
    try { setMenuItems((await call('/menu-items')).items); } catch (error) { setMessage(errorText(error, 'Failed to load menu')); }
  };
  const loadMenuItemOutlets = async (menuItemId: string) => {
    const requestId = ++menuItemOutletsRequest.current;
    if (!menuItemId) {
      setMenuItemOutlets([]);
      return;
    }
    try {
      const { items } = await call(`/menu-items/${menuItemId}/outlets`);
      if (requestId === menuItemOutletsRequest.current) setMenuItemOutlets(items);
    } catch (error) {
      if (requestId === menuItemOutletsRequest.current) {
        setMenuItemOutlets([]);
        setMessage(errorText(error, 'Failed to load outlet assignments'));
        setMessageIsError(true);
      }
    }
  };
  const loadOutletMenu = async () => {
    if (!outletId) return;
    try { setOutletMenu((await call(`/outlets/${outletId}/menu`)).items); } catch (error) { setMessage(errorText(error, 'Failed to load outlet menu')); }
  };
  const loadAssignmentOutletMenu = async () => {
    const requestId = ++assignmentMenuRequest.current;
    if (!assignmentOutletId) {
      setAssignmentOutletMenu([]);
      return;
    }
    try {
      const { items } = await call(`/outlets/${assignmentOutletId}/menu`);
      if (requestId === assignmentMenuRequest.current) setAssignmentOutletMenu(items);
    } catch (error) {
      if (requestId === assignmentMenuRequest.current) {
        setAssignmentOutletMenu([]);
        setMessage(errorText(error, 'Failed to load outlet menu'));
        setMessageIsError(true);
      }
    }
  };
  const loadInventory = async () => {
    if (!outletId) return;
    try { setInventory((await call(`/outlets/${outletId}/inventory`)).items); } catch (error) { setMessage(errorText(error, 'Failed to load inventory')); }
  };

  useEffect(() => {
    if (session?.role === 'HQ') { void loadOutlets(); void loadMenuItems(); void loadCompanyUsers(); }
  }, [session?.role, session?.companyId]);

  useEffect(() => {
    if (session?.role === 'HQ') void loadAssignmentOutletMenu();
    else setAssignmentOutletMenu([]);
  }, [assignmentOutletId, session?.role, session?.companyId]);

  useEffect(() => {
    setOutletMenu([]); setInventory([]); setCart([]); setReceipt(''); setRevenue(null); setTopItems([]);
    checkoutKey.current = null;
    if (session && outletId) { void loadOutletMenu(); void loadInventory(); }
  }, [outletId, Boolean(session)]);

  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors: typeof authErrors = {};
    if (mode === 'signup' && !companyName.trim()) errors.companyName = 'Enter your company name.';
    if (!email.trim()) errors.email = 'Enter your work email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address.';
    if (!password) errors.password = 'Enter your password.';
    else if (mode === 'signup' && password.length < 12) errors.password = 'Use at least 12 characters for your password.';
    setAuthErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSubmitting(true);
    setMessage('');
    setSignedOut(false);
    try {
      const data = mode === 'signup'
        ? await postJson<AuthResponse>('/auth/register', { companyName, email, password })
        : await postJson<AuthResponse>('/auth/login', { email, password });
      const next = toSession(data);
      updateSession(next);
      setOutletId(next.outletId ?? '');
      setAssignmentOutletId(next.outletId ?? '');
      setPassword('');
    } catch (error) {
      setMessage(errorText(error, 'Authentication failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = () => {
    updateSession(null);
    setOutletId(''); setAssignmentOutletId(''); setAssignmentOutletMenu([]); setOutlets([]); setMenuItems([]); setMessage('');
    setSignedOut(true);
  };

  if (!session) {
    const signup = mode === 'signup';
    return <main className="auth-page">
      <section className="auth-showcase">
        <div className="auth-brand"><span className="auth-brand-mark" aria-hidden="true">F</span><span>FIELDNOTES <small>OUTLET MANAGEMENT</small></span></div>
        <div className="showcase-copy">
          <p className="showcase-kicker">One clear view of your business</p>
          <h1>Good service starts with a well-run team.</h1>
          <p>Bring your menu, outlets, inventory, and sales together in one simple workspace.</p>
          <div className="showcase-points">
            <div><span className="point-icon">01</span><span><strong>Stay in sync</strong><small>Manage every outlet from HQ.</small></span></div>
            <div><span className="point-icon">02</span><span><strong>Know your numbers</strong><small>Keep an eye on sales and stock.</small></span></div>
          </div>
        </div>
        <div className="showcase-footer"><span>Made for the people behind the counter.</span><span>F&amp;B OPERATIONS</span></div>
      </section>

      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="mobile-auth-brand"><span className="auth-brand-mark" aria-hidden="true">F</span><span>FIELDNOTES</span></div>
          <p className="eyebrow">{signup ? 'Get your workspace started' : 'Welcome back'}</p>
          <h2>{signup ? 'Create your account' : 'Sign in to your workspace'}</h2>
          <p className="auth-subtitle">{signup ? 'Set up your company and invite your team when you’re ready.' : 'Enter your details to pick up where you left off.'}</p>
          {signedOut && <p className="signed-out-message" role="status"><span aria-hidden="true">✓</span> You’re signed out. Sign in again whenever you’re ready.</p>}
          {message && <p className="auth-error" role="alert">{message}</p>}
          <form className="auth-form" noValidate onSubmit={authenticate}>
            {signup && <label htmlFor="auth-company">Company name<input id="auth-company" name="organization" autoComplete="organization" placeholder="Your restaurant group" required value={companyName} aria-invalid={Boolean(authErrors.companyName)} aria-describedby={authErrors.companyName ? 'auth-company-error' : undefined} onChange={(event) => { setCompanyName(event.target.value); setAuthErrors((current) => ({ ...current, companyName: undefined })); }} />{authErrors.companyName && <span className="field-error" id="auth-company-error">{authErrors.companyName}</span>}</label>}
            <label htmlFor="auth-email">Work email<input id="auth-email" name="email" autoComplete="email" placeholder="you@company.com" required type="email" value={email} aria-invalid={Boolean(authErrors.email)} aria-describedby={authErrors.email ? 'auth-email-error' : undefined} onChange={(event) => { setEmail(event.target.value); setAuthErrors((current) => ({ ...current, email: undefined })); }} />{authErrors.email && <span className="field-error" id="auth-email-error">{authErrors.email}</span>}</label>
            <label htmlFor="auth-password">Password<input id="auth-password" name="password" autoComplete={signup ? 'new-password' : 'current-password'} placeholder="Enter your password" required type="password" minLength={signup ? 12 : 1} value={password} aria-invalid={Boolean(authErrors.password)} aria-describedby={authErrors.password ? 'auth-password-error' : undefined} onChange={(event) => { setPassword(event.target.value); setAuthErrors((current) => ({ ...current, password: undefined })); }} />{authErrors.password && <span className="field-error" id="auth-password-error">{authErrors.password}</span>}</label>
            {signup && <small className="password-hint">Use at least 12 characters for a secure password.</small>}
            <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? 'Please wait…' : signup ? 'Create workspace' : 'Sign in'}<span aria-hidden="true">→</span></button>
          </form>
          <p className="auth-switch">
            {signup ? 'Already have an account?' : 'New to Fieldnotes?'}
            <button type="button" onClick={() => { setMode(signup ? 'login' : 'signup'); setMessage(''); setSignedOut(false); setAuthErrors({}); }}>
              {signup ? 'Sign in' : 'Create a workspace'}
            </button>
          </p>
          <p className="auth-privacy">Your workspace is private to your company.</p>
        </div>
      </section>
    </main>;
  }

  const isHq = session.role === 'HQ';
  const run = async (action: () => Promise<unknown>, fallback: string, done?: string) => {
    setMessage('');
    setMessageIsError(false);
    try { await action(); if (done) setMessage(done); } catch (error) { setMessage(errorText(error, fallback)); setMessageIsError(true); }
  };

  const createOutlet = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nameError = outletName.trim() ? undefined : 'Enter an outlet name.';
    setFieldError('outletName', nameError);
    if (nameError) return;
    void run(async () => {
      const outlet = await call(`/companies/${session.companyId}/outlets`, { method: 'POST', body: JSON.stringify({ name: outletName }) });
      setOutletName(''); setFieldError('outletName'); await loadOutlets(); setOutletId(outlet.id); setAssignmentOutletId(outlet.id);
    }, 'Failed to create outlet');
  };
  const createMenuItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nameError = menuName.trim() ? undefined : 'Enter a menu item name.';
    const priceValidationError = priceError(menuPrice, 'base price');
    setFieldError('menuName', nameError);
    setFieldError('menuPrice', priceValidationError);
    if (nameError || priceValidationError) return;
    void run(async () => {
      await call('/menu-items', { method: 'POST', body: JSON.stringify({ name: menuName, basePrice: Number(menuPrice) }) });
      setMenuName(''); setMenuPrice(''); setFieldError('menuName'); setFieldError('menuPrice'); await loadMenuItems();
    }, 'Failed to create menu item');
  };
  const updateBasePrice = () => {
    const itemError = masterItemId ? undefined : 'Choose a menu item.';
    const priceValidationError = priceError(basePriceEdit, 'new base price');
    setFieldError('masterItemId', itemError);
    setFieldError('basePriceEdit', priceValidationError);
    if (itemError || priceValidationError) return;
    void run(async () => {
      await call(`/menu-items/${masterItemId}`, { method: 'PUT', body: JSON.stringify({ basePrice: Number(basePriceEdit) }) });
      setBasePriceEdit(''); setFieldError('basePriceEdit'); await loadMenuItems(); await loadOutletMenu();
    }, 'Failed to update menu item', 'Base price updated');
  };
  const updateMenuItemName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nameError = editingMenuItemName.trim() ? undefined : 'Enter a menu item name.';
    setFieldError('editingMenuItemName', nameError);
    if (!editingMenuItemId || nameError) return;
    void run(async () => {
      await call(`/menu-items/${editingMenuItemId}`, { method: 'PUT', body: JSON.stringify({ name: editingMenuItemName.trim() }) });
      setEditingMenuItemId('');
      setEditingMenuItemName('');
      setFieldError('editingMenuItemName');
      await Promise.all([loadMenuItems(), loadOutletMenu(), loadInventory()]);
    }, 'Failed to update menu item name', 'Menu item name updated');
  };
  const deleteMenuItem = (id: string) => void run(async () => {
    await call(`/menu-items/${id}`, { method: 'DELETE' });
    if (masterItemId === id) setMasterItemId('');
    if (editingMenuItemId === id) setEditingMenuItemId('');
    await loadMenuItems();
  }, 'Failed to delete menu item', 'Menu item deleted');
  const assignMenuItem = () => {
    const itemError = masterItemId ? undefined : 'Choose a menu item.';
    setFieldError('masterItemId', itemError);
    if (!assignmentOutletId || itemError) return setMessage(!assignmentOutletId ? 'Choose an outlet first.' : itemError!);
    void run(async () => {
      await call(`/outlets/${assignmentOutletId}/menu-items`, { method: 'POST', body: JSON.stringify({ menuItemId: masterItemId }) });
      await Promise.all([loadAssignmentOutletMenu(), loadOutletMenu(), loadMenuItemOutlets(masterItemId)]);
    }, 'Failed to assign menu item');
  };
  const unassignMenuItem = () => {
    const itemError = masterItemId ? undefined : 'Choose a menu item.';
    setFieldError('masterItemId', itemError);
    if (!assignmentOutletId || itemError) return setMessage(!assignmentOutletId ? 'Choose an outlet first.' : itemError!);
    void run(async () => {
      await call(`/outlets/${assignmentOutletId}/menu-items/${masterItemId}`, { method: 'DELETE' });
      await Promise.all([loadAssignmentOutletMenu(), loadOutletMenu(), loadInventory(), loadMenuItemOutlets(masterItemId)]);
    }, 'Failed to unassign menu item');
  };
  const setPrice = () => {
    const itemError = masterItemId ? undefined : 'Choose a menu item.';
    const priceValidationError = priceError(overridePrice, 'outlet price');
    setFieldError('masterItemId', itemError);
    setFieldError('overridePrice', priceValidationError);
    if (!assignmentOutletId || itemError || priceValidationError) return setMessage(!assignmentOutletId ? 'Choose an outlet first.' : 'Fix the highlighted fields.');
    void run(async () => {
      await call(`/outlets/${assignmentOutletId}/menu-items/${masterItemId}/price`, { method: 'PUT', body: JSON.stringify({ price: Number(overridePrice) }) });
      setOverridePrice(''); setFieldError('overridePrice'); await Promise.all([loadAssignmentOutletMenu(), loadOutletMenu(), loadMenuItemOutlets(masterItemId)]);
    }, 'Failed to update price');
  };
  const setStock = () => {
    const itemError = outletItemId ? undefined : 'Choose a menu item.';
    const quantity = Number(stockQuantity);
    const quantityError = stockQuantity === '' ? 'Enter a stock quantity.' : !Number.isInteger(quantity) || quantity < 0 || quantity > 2147483647 ? 'Stock must be a whole number from 0 to 2,147,483,647.' : undefined;
    setFieldError('outletItemId', itemError);
    setFieldError('stockQuantity', quantityError);
    if (!outletItemId || quantityError) return setMessage('Fix the highlighted fields.');
    void run(async () => {
      await call(`/outlets/${outletId}/inventory/${outletItemId}`, { method: 'PUT', body: JSON.stringify({ quantity }) });
      setStockQuantity(''); setFieldError('stockQuantity'); await loadInventory();
    }, 'Failed to set stock');
  };
  const saleQuantityError = (value: string, menuItemId: string) => {
    const quantity = Number(value);
    if (!value.trim()) return 'Enter a quantity.';
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647) {
      return 'Quantity must be a whole number from 1 to 2,147,483,647.';
    }

    const item = outletMenu.find((entry) => entry.id === menuItemId);
    if (!item) return undefined;
    const stock = inventory.find((entry) => entry.menuItemId === menuItemId);
    if (!stock) return 'Stock is not set for this item.';
    const alreadyInCart = cart.find((line) => line.menuItemId === menuItemId)?.quantity ?? 0;
    const remaining = stock.quantity - alreadyInCart;
    if (quantity > remaining) {
      return `Only ${Math.max(remaining, 0)} more ${item.name} ${remaining === 1 ? 'unit is' : 'units are'} available for this sale.`;
    }
    return undefined;
  };
  const addToCart = () => {
    const item = outletMenu.find((entry) => entry.id === outletItemId);
    if (!validate({ outletItemId: item ? undefined : 'Choose an item', cartQuantity: saleQuantityError(cartQuantity, outletItemId) }) || !item) return;
    const quantity = Number(cartQuantity);
    const itemError = item ? undefined : 'Choose a menu item.';
    const cartQuantityError = saleQuantityError(cartQuantity, outletItemId);
    setFieldError('outletItemId', itemError);
    setFieldError('cartQuantity', cartQuantityError);
    if (!item || cartQuantityError) return setMessage('Fix the highlighted fields.');
    checkoutKey.current = null;
    setMessage(`Added ${item.name} × ${quantity} to the sale.`);
    setAddingAnotherSaleItem(false);
    setFieldError('outletItemId');
    setFieldError('cartQuantity');
    setCart((current) => {
      const existing = current.find((line) => line.menuItemId === item.id);
      if (existing) {
        return current.map((line) => line.menuItemId === item.id ? { ...line, quantity: line.quantity + quantity } : line);
      }
      return [...current, { menuItemId: item.id, name: item.name, quantity }];
    });
  };
  const removeFromCart = (menuItemId: string) => {
    checkoutKey.current = null;
    setCart((current) => current.filter((line) => line.menuItemId !== menuItemId));
  };
  const clearCart = () => {
    checkoutKey.current = null;
    setCart([]);
  };
  const cartTotal = cart.reduce((total, line) => {
    const item = outletMenu.find((entry) => entry.id === line.menuItemId);
    return total + (item?.price ?? 0) * line.quantity;
  }, 0);
  const selectedSaleItem = outletMenu.find((item) => item.id === outletItemId);
  const selectedSaleStock = inventory.find((item) => item.menuItemId === outletItemId);
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
      setCart([]); setAddingAnotherSaleItem(false); await loadInventory();
    }, 'Checkout failed');
  };
  const loadReports = () => void run(async () => {
    const [revenueReport, topItemsReport] = await Promise.all([
      call(`/reports/outlets/${outletId}/revenue`),
      call(`/reports/outlets/${outletId}/top-items?limit=5`)
    ]);
    setRevenue(revenueReport.totalRevenue); setTopItems(topItemsReport.items);
  }, 'Failed to load reports');
  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUserSuccess('');
    setUserError('');
    const errors: typeof userErrors = {};
    const emailError = validateUserEmail(newUserEmail);
    const passwordError = validateUserPassword(newUserPassword);
    if (emailError) errors.email = emailError;
    if (passwordError) errors.password = passwordError;
    if (newUserRole === 'OUTLET' && !outletId) errors.role = 'Choose a working outlet before creating an outlet user.';
    setUserErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setCreatingUser(true);
    try {
      await call(`/companies/${session.companyId}/users`, { signal: AbortSignal.timeout(20000), method: 'POST', body: JSON.stringify({ email: newUserEmail, password: newUserPassword, role: newUserRole, ...(newUserRole === 'OUTLET' && { outletId }) }) });
      setNewUserEmail(''); setNewUserPassword('');
      setUserErrors({});
      setUserSuccess('User created successfully.');
      await loadCompanyUsers();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        const emailValidation = error.details?.find((detail) => detail.path === 'email');
        if (error.code === 'EMAIL_ALREADY_EXISTS') {
          setUserErrors((current) => ({ ...current, email: 'An account with this email already exists.' }));
        } else if (emailValidation) {
          setUserErrors((current) => ({ ...current, email: emailValidation.message }));
        } else {
          setUserError(error.message);
        }
      } else if (error instanceof DOMException && error.name === 'TimeoutError') {
        setUserError('The request took too long. Check your connection and try again.');
      } else if (error instanceof TypeError) {
        setUserError('Could not reach the server. Check your connection and try again.');
      } else {
        setUserError(errorText(error, 'Failed to create user.'));
      }
    } finally {
      setCreatingUser(false);
    }
  };

  const outletLabel = outlets.find((outlet) => outlet.id === outletId)?.name;
  const selectedMenuItemAssigned = assignmentOutletMenu.some((item) => item.id === masterItemId);
  const assignmentOutletLabel = outlets.find((outlet) => outlet.id === assignmentOutletId)?.name;
  const selectedBasePriceItem = menuItems.find((item) => item.id === masterItemId);
  const filteredCompanyUsers = companyUsers.filter((user) => {
    const matchesRole = userRoleFilter === 'ALL' || user.role === userRoleFilter;
    const matchesOutlet = userOutletFilter === 'ALL' || user.outletId === userOutletFilter;
    const matchesSearch = user.email.toLowerCase().includes(userSearch.trim().toLowerCase());
    return matchesRole && matchesOutlet && matchesSearch;
  });
  const hqNavigation = [
    { id: 'overview', label: 'Overview' },
    { id: 'outlets', label: 'Outlets' },
    { id: 'menu', label: 'Menu' },
    { id: 'operations', label: 'Operations' },
    { id: 'users', label: 'Users' }
  ] as const;

  return <main className={`app-shell ${isHq ? 'hq-app' : 'outlet-app'}`}>
    <header className="app-header">
      <div>
        <p className="eyebrow">{session.companyName ?? (isHq ? 'Head office' : 'Outlet')}</p>
        <h1>{isHq ? 'HQ Management' : 'Outlet POS'}</h1>
      </div>
      <button className="secondary-button" onClick={signOut}>Sign out</button>
    </header>

    {isHq
      ? <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <span className="brand-mark" aria-hidden="true">F</span>
            <div><strong>Workspace</strong><small>Head office</small></div>
          </div>
          <nav className="sidebar-nav" aria-label="HQ sections">
            {hqNavigation.map((item) => <button
              key={item.id}
              type="button"
              className={hqSection === item.id ? 'nav-item active' : 'nav-item'}
              aria-current={hqSection === item.id ? 'page' : undefined}
              onClick={() => setHqSection(item.id)}
            >{item.label}</button>)}
            <button type="button" className="nav-item" onClick={() => { setHqSection('operations'); setOperationSection('sales'); }}>POS checkout</button>
          </nav>
          <div className="sidebar-outlet">
            <label htmlFor="working-outlet">Working outlet</label>
            <select id="working-outlet" value={outletId} onChange={(event) => {
              setOutletId(event.target.value);
          setAssignmentOutletId(event.target.value);
          if (event.target.value) setUserErrors((current) => ({ ...current, role: undefined }));
            }}>
              <option value="">Choose outlet</option>
              {outlets.map((outlet) => <option value={outlet.id} key={outlet.id}>{outlet.name}</option>)}
            </select>
            <small>Outlet selection applies to menu and operations.</small>
          </div>
        </aside>

        <div className="workspace-content">
          {message && <p className={messageIsError ? 'status-message error' : 'status-message'} role={messageIsError ? 'alert' : 'status'}>{message}</p>}

          {hqSection === 'overview' && <div className="page-content">
            <div className="page-heading"><div><p className="eyebrow">Your business at a glance</p><h2>Overview</h2></div></div>
            <div className="summary-grid">
              <button className="summary-card" onClick={() => setHqSection('outlets')}><span>Outlets</span><strong>{outlets.length}</strong><small>Manage your locations</small></button>
              <button className="summary-card" onClick={() => setHqSection('menu')}><span>Master menu items</span><strong>{menuItems.length}</strong><small>Manage shared menu and pricing</small></button>
              <button className="summary-card" onClick={() => setHqSection('operations')}><span>Working outlet</span><strong className="summary-outlet">{outletLabel ?? 'None selected'}</strong><small>View outlet operations</small></button>
            </div>
            <section className="content-card welcome-card">
              <h3>Get started</h3>
              <p>Set up your outlets and menu, then choose an outlet to manage its inventory and reports.</p>
              <div className="quick-actions">
                <button onClick={() => setHqSection('outlets')}>Manage outlets</button>
                <button className="secondary-button" onClick={() => setHqSection('menu')}>Manage menu</button>
                <button onClick={() => { setHqSection('operations'); setOperationSection('sales'); }}>Start a sale</button>
              </div>
            </section>
          </div>}

          {hqSection === 'outlets' && <div className="page-content">
            <div className="page-heading"><div><p className="eyebrow">Locations</p><h2>Outlets</h2></div></div>
            <section className="content-card">
              <h3>Add an outlet</h3>
              <p className="muted">Create a location for your team to manage.</p>
              <form noValidate onSubmit={createOutlet}>
                <label>Outlet name<input required value={outletName} aria-invalid={Boolean(fieldErrors.outletName)} aria-describedby={fieldErrors.outletName ? 'outlet-name-error' : undefined} onBlur={() => setFieldError('outletName', outletName.trim() ? undefined : 'Enter an outlet name.')} onChange={(event) => { setOutletName(event.target.value); if (fieldErrors.outletName) setFieldError('outletName', event.target.value.trim() ? undefined : 'Enter an outlet name.'); }} />{fieldErrors.outletName && <span className="field-error" id="outlet-name-error">{fieldErrors.outletName}</span>}</label>
                <button type="submit">Create outlet</button>
              </form>
            </section>
            <section className="content-card">
              <h3>Your outlets <span className="count-badge">{outlets.length}</span></h3>
              {outlets.length
                ? <ul className="item-list">{outlets.map((outlet) => <li key={outlet.id}>
                  <span>{outlet.name}</span>
                  {outletId === outlet.id
                    ? <span className="selected-badge">Working outlet</span>
                    : <button className="text-button" onClick={() => { setOutletId(outlet.id); setAssignmentOutletId(outlet.id); }}>Set as working outlet</button>}
                </li>)}</ul>
                : <p className="empty-state">No outlets yet. Create your first outlet above.</p>}
            </section>
          </div>}

          {hqSection === 'menu' && <div className="page-content">
            <div className="page-heading"><div><p className="eyebrow">Catalog and pricing</p><h2>Menu</h2></div></div>
            <nav className="section-nav" aria-label="Menu management tabs" role="tablist">
              {([
                { id: 'catalog', label: 'Master menu' },
                { id: 'base-pricing', label: 'Base pricing' },
                { id: 'outlet-assignment', label: 'Outlet assignment' }
              ] as const).map((tab) => <button
                key={tab.id}
                type="button"
                role="tab"
                id={`menu-tab-${tab.id}`}
                aria-selected={menuSection === tab.id}
                aria-controls={`menu-panel-${tab.id}`}
                className={menuSection === tab.id ? 'section-nav-item active' : 'section-nav-item'}
                onClick={() => setMenuSection(tab.id)}
              >{tab.label}</button>)}
            </nav>
            {menuSection === 'catalog' && <section className="content-card" role="tabpanel" id="menu-panel-catalog" aria-labelledby="menu-tab-catalog">
              <h3>Master menu</h3>
              <p className="muted">Add items and set their standard prices for your company.</p>
              <form noValidate onSubmit={createMenuItem} className="form-grid">
                <label>Item name<input required value={menuName} aria-invalid={Boolean(fieldErrors.menuName)} aria-describedby={fieldErrors.menuName ? 'menu-name-error' : undefined} onBlur={() => setFieldError('menuName', menuName.trim() ? undefined : 'Enter a menu item name.')} onChange={(event) => { setMenuName(event.target.value); if (fieldErrors.menuName) setFieldError('menuName', event.target.value.trim() ? undefined : 'Enter a menu item name.'); }} />{fieldErrors.menuName && <span className="field-error" id="menu-name-error">{fieldErrors.menuName}</span>}</label>
                <label>Base price<input required type="number" min="0.01" step="0.01" value={menuPrice} aria-invalid={Boolean(fieldErrors.menuPrice)} aria-describedby={fieldErrors.menuPrice ? 'menu-price-error' : undefined} onBlur={() => setFieldError('menuPrice', priceError(menuPrice, 'base price'))} onChange={(event) => { setMenuPrice(event.target.value); if (fieldErrors.menuPrice) setFieldError('menuPrice', priceError(event.target.value, 'base price')); }} />{fieldErrors.menuPrice && <span className="field-error" id="menu-price-error">{fieldErrors.menuPrice}</span>}</label>
                <button type="submit">Add menu item</button>
              </form>
              {menuItems.length
                ? <ul className="item-list">{menuItems.map((item) => <li key={item.id}>
                  {editingMenuItemId === item.id
                    ? <form className="menu-item-edit-form" noValidate onSubmit={updateMenuItemName}>
                      <label htmlFor={`edit-menu-name-${item.id}`}>Menu item name<input id={`edit-menu-name-${item.id}`} autoFocus value={editingMenuItemName} aria-invalid={Boolean(fieldErrors.editingMenuItemName)} aria-describedby={fieldErrors.editingMenuItemName ? `edit-menu-name-error-${item.id}` : undefined} onChange={(event) => { setEditingMenuItemName(event.target.value); if (fieldErrors.editingMenuItemName) setFieldError('editingMenuItemName', event.target.value.trim() ? undefined : 'Enter a menu item name.'); }} /></label>
                      {fieldErrors.editingMenuItemName && <span className="field-error" id={`edit-menu-name-error-${item.id}`}>{fieldErrors.editingMenuItemName}</span>}
                      <div className="menu-item-actions">
                        <button type="submit">Save name</button>
                        <button type="button" className="secondary-button" onClick={() => { setEditingMenuItemId(''); setEditingMenuItemName(''); setFieldError('editingMenuItemName'); }}>Cancel</button>
                      </div>
                    </form>
                    : <>
                      <span>{item.name} <small>{item.basePrice.toFixed(2)}</small></span>
                      <div className="menu-item-actions">
                        <button className="secondary-button" onClick={() => { setEditingMenuItemId(item.id); setEditingMenuItemName(item.name); setFieldError('editingMenuItemName'); }}>Edit</button>
                        <button className="danger-button" onClick={() => deleteMenuItem(item.id)}>Delete</button>
                      </div>
                    </>}
                </li>)}</ul>
                : <p className="empty-state">No menu items yet. Add your first item above.</p>}
            </section>}
            {menuSection === 'base-pricing' && <section className="content-card" role="tabpanel" id="menu-panel-base-pricing" aria-labelledby="menu-tab-base-pricing">
              <h3>Update base price</h3>
              <p className="muted">Change the standard price used by outlets unless they have an outlet-specific override.</p>
              <div className="form-grid">
                <label>Menu item<select value={masterItemId} aria-invalid={Boolean(fieldErrors.masterItemId)} aria-describedby={fieldErrors.masterItemId ? 'base-item-error' : undefined} onBlur={() => setFieldError('masterItemId', masterItemId ? undefined : 'Choose a menu item.')} onChange={(event) => { setMasterItemId(event.target.value); setFieldError('masterItemId', event.target.value ? undefined : 'Choose a menu item.'); }}><option value="">Choose item</option>{menuItems.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{fieldErrors.masterItemId && <span className="field-error" id="base-item-error">{fieldErrors.masterItemId}</span>}</label>
                {selectedBasePriceItem && <p className="current-price">Current base price: <strong>{selectedBasePriceItem.basePrice.toFixed(2)}</strong></p>}
                <label>New base price<input type="number" min="0.01" step="0.01" value={basePriceEdit} aria-invalid={Boolean(fieldErrors.basePriceEdit)} aria-describedby={fieldErrors.basePriceEdit ? 'base-price-error' : undefined} onBlur={() => setFieldError('basePriceEdit', priceError(basePriceEdit, 'new base price'))} onChange={(event) => { setBasePriceEdit(event.target.value); if (fieldErrors.basePriceEdit) setFieldError('basePriceEdit', priceError(event.target.value, 'new base price')); }} />{fieldErrors.basePriceEdit && <span className="field-error" id="base-price-error">{fieldErrors.basePriceEdit}</span>}</label>
                <button onClick={updateBasePrice}>Update base price</button>
              </div>
            </section>}
            {menuSection === 'outlet-assignment' && <section className="content-card" role="tabpanel" id="menu-panel-outlet-assignment" aria-labelledby="menu-tab-outlet-assignment">
              <div className="outlet-card-heading">
                <div><h3>Assign menu to an outlet</h3><p className="muted">{assignmentOutletLabel ? `Selected outlet: ${assignmentOutletLabel}` : 'Choose an outlet below to manage its menu assignments.'}</p></div>
                <span className="count-badge">{assignmentOutletMenu.length} assigned</span>
              </div>
              <label htmlFor="assignment-outlet">Outlet<select id="assignment-outlet" value={assignmentOutletId} onChange={(event) => setAssignmentOutletId(event.target.value)}>
                <option value="">Choose outlet</option>
                {outlets.map((outlet) => <option value={outlet.id} key={outlet.id}>{outlet.name}{outlet.id === outletId ? ' (Working outlet)' : ''}</option>)}
              </select></label>
              <div className="form-grid">
                <label>Menu item<select value={masterItemId} aria-invalid={Boolean(fieldErrors.masterItemId)} aria-describedby={fieldErrors.masterItemId ? 'assign-item-error' : undefined} onBlur={() => setFieldError('masterItemId', masterItemId ? undefined : 'Choose a menu item.')} onChange={(event) => { setMasterItemId(event.target.value); setFieldError('masterItemId', event.target.value ? undefined : 'Choose a menu item.'); void loadMenuItemOutlets(event.target.value); }}><option value="">Choose item</option>{menuItems.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{fieldErrors.masterItemId && <span className="field-error" id="assign-item-error">{fieldErrors.masterItemId}</span>}</label>
                <label>Outlet price override<input type="number" min="0.01" step="0.01" value={overridePrice} aria-invalid={Boolean(fieldErrors.overridePrice)} aria-describedby={fieldErrors.overridePrice ? 'outlet-price-error' : undefined} onBlur={() => setFieldError('overridePrice', overridePrice ? priceError(overridePrice, 'outlet price') : undefined)} onChange={(event) => { setOverridePrice(event.target.value); if (fieldErrors.overridePrice) setFieldError('overridePrice', event.target.value ? priceError(event.target.value, 'outlet price') : undefined); }} />{fieldErrors.overridePrice && <span className="field-error" id="outlet-price-error">{fieldErrors.overridePrice}</span>}</label>
                <div className="button-row">
                  <button onClick={assignMenuItem} disabled={!assignmentOutletId || selectedMenuItemAssigned}>{selectedMenuItemAssigned ? 'Already assigned' : 'Assign to outlet'}</button>
                  {selectedMenuItemAssigned && <button className="secondary-button" onClick={unassignMenuItem}>Unassign</button>}
                  <button className="secondary-button" onClick={setPrice} disabled={!assignmentOutletId || !selectedMenuItemAssigned}>Set outlet price</button>
                </div>
              </div>
              {masterItemId && <div className="assigned-menu-list">
                <strong>Outlets with this menu item <span className="count-badge">{menuItemOutlets.length}</span></strong>
                {menuItemOutlets.length > 0
                  ? <ul className="item-list">{menuItemOutlets.map((outlet) => <li key={outlet.id}><span>{outlet.name}</span><strong>{outlet.price.toFixed(2)}</strong></li>)}</ul>
                  : <p className="empty-state">This menu item is not assigned to any outlet yet.</p>}
              </div>}
              {assignmentOutletMenu.length > 0
                ? <div className="assigned-menu-list">
                  <strong>Items assigned to {assignmentOutletLabel}</strong>
                  <ul className="item-list">{assignmentOutletMenu.map((item) => <li key={item.id}><span>{item.name}</span><strong>{item.price.toFixed(2)}</strong></li>)}</ul>
                </div>
                : assignmentOutletId && <p className="empty-state">No menu items are assigned to this outlet yet.</p>}
            </section>}
          </div>}

          {hqSection === 'operations' && <div className="page-content">
            <div className="page-heading"><div><p className="eyebrow">{outletLabel ?? 'Select a working outlet to begin'}</p><h2>Operations</h2></div></div>
            {!outletId
              ? <section className="content-card empty-state"><h3>No outlet selected</h3><p>Choose an outlet from the sidebar to manage its menu, inventory, sales, and reports.</p></section>
              : <>
                <nav className="section-nav" aria-label="Outlet operations">
                  {(['menu', 'inventory', 'sales', 'reports'] as const).map((item) => <button
                    key={item}
                    type="button"
                    className={operationSection === item ? 'section-nav-item active' : 'section-nav-item'}
                    aria-pressed={operationSection === item}
                    onClick={() => { setOperationSection(item); setFieldError('outletItemId'); }}
                  >{item === 'sales' ? 'POS checkout' : item[0].toUpperCase() + item.slice(1)}</button>)}
                </nav>
                {operationSection === 'menu' && <section className="content-card">
                  <h3>Outlet menu</h3>
                  {outletMenu.length
                    ? <ul className="item-list">{outletMenu.map((item) => <li key={item.id}><span>{item.name}</span><strong>{item.price.toFixed(2)}</strong></li>)}</ul>
                    : <div className="empty-state">
                      <p>No items are assigned to {outletLabel ?? 'this outlet'} yet.</p>
                      <p>Choose menu items from the company catalog to make them available here.</p>
                      <button type="button" onClick={() => { setMenuSection('outlet-assignment'); setHqSection('menu'); }}>Assign menu items to {outletLabel ?? 'outlet'}</button>
                    </div>}
                </section>}
                {operationSection === 'inventory' && <section className="content-card">
                  <h3>Inventory</h3>
                  {inventory.length
                    ? <ul className="item-list">{inventory.map((item) => <li key={item.menuItemId}><span>{item.name}</span><strong>{item.quantity} in stock</strong></li>)}</ul>
                    : <p className="empty-state">{outletMenu.length
                      ? 'No stock levels are set for this outlet yet. Choose an assigned menu item below to set its opening stock.'
                      : 'No items are assigned to this outlet yet. Assign items from Menu → Outlet assignment before setting stock.'}</p>}
                  {outletMenu.length > 0 && <div className="form-grid">
                    <label>Assigned menu item<select value={outletItemId} aria-invalid={Boolean(fieldErrors.outletItemId)} aria-describedby={fieldErrors.outletItemId ? 'inventory-item-error' : undefined} onChange={(event) => { setOutletItemId(event.target.value); setFieldError('outletItemId'); }}><option value="">Choose assigned item</option>{outletMenu.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{fieldErrors.outletItemId && <span className="field-error" id="inventory-item-error">{fieldErrors.outletItemId}</span>}</label>
                    <label>Stock quantity<input type="number" min="0" max="2147483647" step="1" value={stockQuantity} aria-invalid={Boolean(fieldErrors.stockQuantity)} aria-describedby={fieldErrors.stockQuantity ? 'stock-quantity-error' : undefined} onBlur={() => { const quantity = Number(stockQuantity); setFieldError('stockQuantity', stockQuantity === '' ? undefined : Number.isInteger(quantity) && quantity >= 0 && quantity <= 2147483647 ? undefined : 'Stock must be a whole number from 0 to 2,147,483,647.'); }} onChange={(event) => { setStockQuantity(event.target.value); if (fieldErrors.stockQuantity) { const quantity = Number(event.target.value); setFieldError('stockQuantity', event.target.value === '' ? undefined : Number.isInteger(quantity) && quantity >= 0 && quantity <= 2147483647 ? undefined : 'Stock must be a whole number from 0 to 2,147,483,647.'); } }} />{fieldErrors.stockQuantity && <span className="field-error" id="stock-quantity-error">{fieldErrors.stockQuantity}</span>}</label>
                    {outletItemId && <p className="inventory-current-stock">Current stock: <strong>{selectedSaleStock ? selectedSaleStock.quantity : 'Not set yet'}</strong></p>}
                    <button onClick={setStock}>Update stock</button>
                  </div>}
                </section>}
                {operationSection === 'sales' && <section className="content-card">
                  <h3>Create a sale</h3>
                  <p className="muted">Add one or more items. Select an item and add it to the sale; repeat for each item.</p>
                  <div className="form-grid">
                    <label>Menu item<select value={outletItemId} aria-invalid={Boolean(fieldErrors.outletItemId)} aria-describedby={fieldErrors.outletItemId ? 'sale-item-error' : undefined} onBlur={() => setFieldError('outletItemId', outletItemId ? undefined : 'Choose a menu item.')} onChange={(event) => { setOutletItemId(event.target.value); setFieldError('outletItemId', event.target.value ? undefined : 'Choose a menu item.'); }}><option value="">Choose item</option>{outletMenu.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{fieldErrors.outletItemId && <span className="field-error" id="sale-item-error">{fieldErrors.outletItemId}</span>}</label>
                    <label>Quantity<input type="number" min="1" max="2147483647" step="1" value={cartQuantity} aria-invalid={Boolean(fieldErrors.cartQuantity)} aria-describedby={fieldErrors.cartQuantity ? 'sale-quantity-error' : undefined} onBlur={() => { const quantity = Number(cartQuantity); setFieldError('cartQuantity', cartQuantity.trim() && (!Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647) ? 'Quantity must be a whole number from 1 to 2,147,483,647.' : undefined); }} onChange={(event) => { setCartQuantity(event.target.value); if (fieldErrors.cartQuantity) { const quantity = Number(event.target.value); setFieldError('cartQuantity', event.target.value.trim() && (!Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647) ? 'Quantity must be a whole number from 1 to 2,147,483,647.' : undefined); } }} />{fieldErrors.cartQuantity && <span className="field-error" id="sale-quantity-error">{fieldErrors.cartQuantity}</span>}</label>
                    <button onClick={addToCart}>Add item to sale</button>
                  </div>
                  <div className="cart-panel">
                    <div className="cart-heading"><h4>Items in this sale <span className="count-badge">{cart.length}</span></h4>{cart.length > 0 && <button className="text-button" onClick={clearCart}>Clear sale</button>}</div>
                    {cart.length > 0
                      ? <ul className="item-list">{cart.map((line) => {
                        const item = outletMenu.find((entry) => entry.id === line.menuItemId);
                        return <li key={line.menuItemId}>
                          <span>{line.name} <small>× {line.quantity}</small></span>
                          <span className="cart-line-actions"><strong>{((item?.price ?? 0) * line.quantity).toFixed(2)}</strong><button className="text-button" onClick={() => removeFromCart(line.menuItemId)}>Remove</button></span>
                        </li>;
                      })}</ul>
                      : null}
                    {cart.length > 0 && <>
                      <p className="cart-total">Sale total <strong>{cartTotal.toFixed(2)}</strong></p>
                      <button onClick={checkout}>Complete sale</button>
                    </>}
                    {receipt && <p className="success-message">{receipt}</p>}
                  </div>
                </section>}
                {operationSection === 'reports' && <section className="content-card">
                  <h3>Reports</h3>
                  <p className="muted">Review revenue and top-selling items for {outletLabel ?? 'this outlet'}.</p>
                  <button onClick={loadReports}>Load reports</button>
                  {revenue !== null && <p className="report-total">Total revenue: {revenue.toFixed(2)}</p>}
                  {topItems.length > 0 && <ul className="item-list">{topItems.map((item) => <li key={item.menuItemId}><span>{item.name}</span><strong>{item.quantity} sold</strong></li>)}</ul>}
                </section>}
              </>}
          </div>}

          {hqSection === 'users' && <div className="page-content">
            <div className="page-heading"><div><p className="eyebrow">Team access</p><h2>Users</h2></div></div>
            <section className="content-card">
              <h3>Create a user</h3>
              <p className="muted">Add a head office user or give an outlet team member access to the working outlet.</p>
              {userSuccess && <p className="success-message" role="status">{userSuccess}</p>}
              {userError && <p className="auth-error" role="alert">{userError}</p>}
              <form noValidate onSubmit={createUser}>
                <label htmlFor="new-user-email">Email<input id="new-user-email" name="email" autoComplete="email" required type="email" value={newUserEmail} aria-invalid={Boolean(userErrors.email)} aria-describedby={userErrors.email ? 'new-user-email-error' : undefined} onBlur={() => setUserErrors((current) => ({ ...current, email: validateUserEmail(newUserEmail) }))} onChange={(event) => { const value = event.target.value; setNewUserEmail(value); setUserErrors((current) => ({ ...current, email: current.email ? validateUserEmail(value) : undefined })); setUserError(''); setUserSuccess(''); }} />{userErrors.email && <span className="field-error" id="new-user-email-error">{userErrors.email}</span>}</label>
                <label htmlFor="new-user-password">Temporary password<input id="new-user-password" name="new-password" autoComplete="new-password" required minLength={12} maxLength={128} type="password" value={newUserPassword} aria-invalid={Boolean(userErrors.password)} aria-describedby={userErrors.password ? 'new-user-password-error' : undefined} onBlur={() => setUserErrors((current) => ({ ...current, password: validateUserPassword(newUserPassword) }))} onChange={(event) => { const value = event.target.value; setNewUserPassword(value); setUserErrors((current) => ({ ...current, password: current.password ? validateUserPassword(value) : undefined })); setUserError(''); setUserSuccess(''); }} />{userErrors.password && <span className="field-error" id="new-user-password-error">{userErrors.password}</span>}</label>
                <label htmlFor="new-user-role">Role<select id="new-user-role" value={newUserRole} aria-invalid={Boolean(userErrors.role && !outletId)} aria-describedby={userErrors.role && !outletId ? 'new-user-role-error' : undefined} onBlur={() => setUserErrors((current) => ({ ...current, role: newUserRole === 'OUTLET' && !outletId ? 'Choose a working outlet before creating an outlet user.' : undefined }))} onChange={(event) => { setNewUserRole(event.target.value as Role); setUserErrors((current) => ({ ...current, role: undefined })); setUserError(''); setUserSuccess(''); }}><option value="HQ">HQ</option><option value="OUTLET">Outlet (working outlet)</option></select>{userErrors.role && !outletId && <span className="field-error" id="new-user-role-error">{userErrors.role}</span>}</label>
                <button type="submit" disabled={creatingUser}>{creatingUser ? 'Creating user…' : 'Create user'}</button>
              </form>
            </section>
            <section className="content-card">
              <div className="outlet-card-heading">
                <div><h3>Team directory</h3><p className="muted">All users in your company.</p></div>
                <span className="count-badge">{filteredCompanyUsers.length} of {companyUsers.length}</span>
              </div>
              <div className="form-grid user-filters">
                <label htmlFor="user-search">Search by email<input id="user-search" type="search" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search users" /></label>
                <label htmlFor="user-role-filter">Role<select id="user-role-filter" value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value as 'ALL' | Role)}>
                  <option value="ALL">All roles</option>
                  <option value="HQ">HQ</option>
                  <option value="OUTLET">Outlet</option>
                </select></label>
                <label htmlFor="user-outlet-filter">Outlet<select id="user-outlet-filter" value={userOutletFilter} onChange={(event) => setUserOutletFilter(event.target.value)}>
                  <option value="ALL">All outlets</option>
                  {outlets.map((outlet) => <option value={outlet.id} key={outlet.id}>{outlet.name}</option>)}
                </select></label>
              </div>
              {filteredCompanyUsers.length > 0
                ? <ul className="item-list user-directory">{filteredCompanyUsers.map((user) => <li key={user.id}>
                  <span><strong>{user.email}</strong><small>{user.role === 'HQ' ? 'Head office' : user.outlet?.name ?? 'Outlet not assigned'} · {user.isActive ? 'Active' : 'Inactive'}</small></span>
                  <small>Added {new Date(user.createdAt).toLocaleDateString()}</small>
                </li>)}</ul>
                : <p className="empty-state">{companyUsers.length ? 'No users match these filters.' : 'No users found.'}</p>}
            </section>
          </div>}
        </div>
      </div>
      : <div className="outlet-workspace">
        <aside className="sidebar outlet-sidebar">
          <div className="sidebar-heading">
            <span className="brand-mark" aria-hidden="true">F</span>
            <div><strong>Outlet workspace</strong><small>{session.companyName ?? 'Outlet team'}</small></div>
          </div>
          {outletId && <nav className="sidebar-nav" aria-label="Outlet sections">
            {([
              { id: 'menu', label: 'Menu & stock' },
              { id: 'sales', label: 'Sales' },
              { id: 'reports', label: 'Reports' }
            ] as const).map((item) => <button
              key={item.id}
              type="button"
              className={outletSection === item.id ? 'nav-item active' : 'nav-item'}
              aria-current={outletSection === item.id ? 'page' : undefined}
              onClick={() => setOutletSection(item.id)}
            >{item.label}</button>)}
          </nav>}
          {outletId && <div className="sidebar-outlet">
            <small>Stock is tracked for this outlet. Completed sales automatically deduct the sold quantity.</small>
          </div>}
        </aside>
        <div className="outlet-content">
          {session.companyName && <p className="muted">Welcome to {session.companyName}.</p>}
          {message && <p className={messageIsError ? 'status-message error' : 'status-message'} role={messageIsError ? 'alert' : 'status'}>{message}</p>}
          {!outletId
            ? <section className="content-card"><p>Your account is not linked to an outlet. Ask HQ to assign one.</p></section>
            : <>
              {outletSection === 'menu' && <div className="page-content">
                <div className="page-heading"><div><p className="eyebrow">Outlet workspace</p><h2>Menu &amp; stock</h2></div></div>
                <section className="content-card outlet-guide" aria-label="How menu, stock, and sales work together">
                  <h3>How it works</h3>
                  <p>HQ assigns the menu items. You set the stock available at this outlet. When you complete a sale, the sold quantity is deducted from stock automatically.</p>
                </section>
                <section className="content-card">
                  <div className="outlet-card-heading"><div><h2>Menu &amp; current stock</h2><p className="muted">Prices come from your outlet menu; stock is tracked separately for each item.</p></div><span className="count-badge">{outletMenu.length} items</span></div>
                  {outletMenu.length
                    ? <ul className="item-list outlet-menu-list">{outletMenu.map((item) => {
                      const stock = inventory.find((entry) => entry.menuItemId === item.id);
                      return <li key={item.id}>
                        <span><strong>{item.name}</strong><small>{item.price.toFixed(2)}</small></span>
                        <span className={stock ? 'stock-badge' : 'stock-badge stock-unset'}>{stock ? `${stock.quantity} in stock` : 'Stock not set'}</span>
                      </li>;
                    })}</ul>
                    : <p className="empty-state">No items have been assigned to this outlet yet. Ask HQ to assign items to the outlet menu.</p>}
                  {outletMenu.length > 0 && <div className="stock-editor">
                    <h3>Update stock level</h3>
                    <p className="muted">Enter the new total quantity on hand. This replaces the current stock count.</p>
                    <div className="form-grid">
                      <label>Menu item<select value={outletItemId} aria-invalid={Boolean(fieldErrors.outletItemId)} aria-describedby={fieldErrors.outletItemId ? 'outlet-stock-item-error' : undefined} onChange={(event) => { setOutletItemId(event.target.value); setFieldError('outletItemId', event.target.value ? undefined : 'Choose a menu item.'); }}><option value="">Choose item</option>{outletMenu.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{fieldErrors.outletItemId && <span className="field-error" id="outlet-stock-item-error">{fieldErrors.outletItemId}</span>}</label>
                      <label>New stock quantity<input type="number" min="0" max="2147483647" step="1" value={stockQuantity} aria-invalid={Boolean(fieldErrors.stockQuantity)} aria-describedby={fieldErrors.stockQuantity ? 'outlet-stock-quantity-error' : undefined} onChange={(event) => { const value = event.target.value; setStockQuantity(value); if (fieldErrors.stockQuantity) { const quantity = Number(value); setFieldError('stockQuantity', value === '' ? 'Enter a stock quantity.' : Number.isInteger(quantity) && quantity >= 0 && quantity <= 2147483647 ? undefined : 'Stock must be a whole number from 0 to 2,147,483,647.'); } }} />{fieldErrors.stockQuantity && <span className="field-error" id="outlet-stock-quantity-error">{fieldErrors.stockQuantity}</span>}</label>
                      <button onClick={setStock}>Save stock level</button>
                    </div>
                  </div>}
                </section>
              </div>}
              {outletSection === 'sales' && <div className="page-content">
                <div className="page-heading"><div><p className="eyebrow">Point of sale</p><h2>Create a sale</h2></div></div>
                <section className="content-card">
                  <p className="muted">Choose from the outlet menu and add one or more items. Stock is deducted when the sale is completed.</p>
                  {(cart.length === 0 || addingAnotherSaleItem) ? <>
                  <label>Menu item<select value={outletItemId} aria-invalid={Boolean(fieldErrors.outletItemId)} aria-describedby={fieldErrors.outletItemId ? 'outlet-sale-item-error' : undefined} onChange={(event) => { setOutletItemId(event.target.value); setFieldError('outletItemId', event.target.value ? undefined : 'Choose a menu item.'); setFieldError('cartQuantity', saleQuantityError(cartQuantity, event.target.value)); }}><option value="">Choose item</option>{outletMenu.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{fieldErrors.outletItemId && <span className="field-error" id="outlet-sale-item-error">{fieldErrors.outletItemId}</span>}</label>
                  {selectedSaleItem && <p className="sale-stock-status" role="status">
                    Available stock for <strong>{selectedSaleItem.name}</strong>:{' '}
                    <strong>{selectedSaleStock ? selectedSaleStock.quantity : 'Not set'}</strong>
                    {!selectedSaleStock && <span> — ask your outlet manager to set the stock level.</span>}
                  </p>}
                  <label>Quantity<input type="number" min="1" max="2147483647" step="1" value={cartQuantity} aria-invalid={Boolean(fieldErrors.cartQuantity)} aria-describedby={fieldErrors.cartQuantity ? 'outlet-sale-quantity-error' : undefined} onBlur={() => setFieldError('cartQuantity', saleQuantityError(cartQuantity, outletItemId))} onChange={(event) => { const value = event.target.value; setCartQuantity(value); setFieldError('cartQuantity', saleQuantityError(value, outletItemId)); }} />{fieldErrors.cartQuantity && <span className="field-error" id="outlet-sale-quantity-error">{fieldErrors.cartQuantity}</span>}</label>
                  <button className="sale-add-button" type="button" onClick={addToCart}>Add item to sale</button>
                  </> : <button className="secondary-button" type="button" onClick={() => setAddingAnotherSaleItem(true)}>Add another item</button>}
                  {cart.length > 0 && <div className="cart-panel">
                    <div className="cart-heading"><h3>Items in this sale <span className="count-badge">{cart.length}</span></h3><button className="text-button" onClick={clearCart}>Clear sale</button></div>
                    <ul className="item-list">{cart.map((line) => {
                        const item = outletMenu.find((entry) => entry.id === line.menuItemId);
                        return <li key={line.menuItemId}>
                          <span>{line.name} <small>× {line.quantity}</small></span>
                          <span className="cart-line-actions"><strong>{((item?.price ?? 0) * line.quantity).toFixed(2)}</strong><button className="text-button" onClick={() => removeFromCart(line.menuItemId)}>Remove</button></span>
                        </li>;
                    })}</ul>
                    <p className="cart-total">Sale total <strong>{cartTotal.toFixed(2)}</strong></p>
                    <button onClick={checkout}>Complete sale</button>
                  </div>}
                  {receipt && <p className="success-message">{receipt}</p>}
                </section>
              </div>}
              {outletSection === 'reports' && <div className="page-content">
                <div className="page-heading"><div><p className="eyebrow">Performance</p><h2>Reports</h2></div></div>
                <section className="content-card">
                  <p className="muted">View total revenue and the top-selling items for this outlet.</p>
                  <button onClick={loadReports}>Load reports</button>
                  {revenue !== null && <p className="report-total">Total revenue: {revenue.toFixed(2)}</p>}
                  {topItems.length > 0 && <ul className="item-list">{topItems.map((item) => <li key={item.menuItemId}><span>{item.name}</span><strong>{item.quantity} sold</strong></li>)}</ul>}
                </section>
              </div>}
            </>}
        </div>
      </div>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
