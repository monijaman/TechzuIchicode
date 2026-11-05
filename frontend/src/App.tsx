import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AuthPage } from './pages/AuthPage';
import { CompanyReportsPage } from './pages/CompanyReportsPage';
import { HqOverviewPage } from './pages/HqOverviewPage';
import { MenuManagementPage } from './pages/MenuManagementPage';
import { OutletsPage } from './pages/OutletsPage';
import { OutletMenuPage } from './pages/OutletMenuPage';
import { OutletSalesPage } from './pages/OutletSalesPage';
import { OutletReportsPage } from './pages/OutletReportsPage';
import { UsersPage } from './pages/UsersPage';
import { HqOperationsPage } from './pages/HqOperationsPage';
import { StatusMessage } from './components/atoms/StatusMessage';
import { HqSidebar } from './components/organisms/HqSidebar';
import { OutletSidebar } from './components/organisms/OutletSidebar';
import { WorkspaceTemplate } from './components/templates/WorkspaceTemplate';
import { ApiRequestError } from './services/apiClient';
import { useSession } from './hooks/useSession';
import { useWorkspaceData } from './hooks/useWorkspaceData';
import { useUserManagement } from './hooks/useUserManagement';
import type {
  ItemCount,
  MenuItem,
  OutletMenuItem,
  OutletSalesReport,
  Role,
} from './types';

const newIdempotencyKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);
type Outlet = { id: string; name: string };
type ItemsResponse<T> = { items: T[] };

export default function App() {
  const { session, updateSession, request, signIn } = useSession();
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

  const [hqSection, setHqSection] = useState<'overview' | 'outlets' | 'menu' | 'operations' | 'reports' | 'users'>('overview');
  const [menuSection, setMenuSection] = useState<'catalog' | 'base-pricing' | 'outlet-assignment'>('catalog');
  const [operationSection, setOperationSection] = useState<'menu' | 'inventory' | 'sales'>('menu');
  const [outletSection, setOutletSection] = useState<'menu' | 'sales' | 'reports'>('menu');
  const [outletId, setOutletId] = useState(session?.outletId ?? '');
  const [assignmentOutletId, setAssignmentOutletId] = useState(session?.outletId ?? '');
  const [outletName, setOutletName] = useState('');
  const [menuName, setMenuName] = useState('');
  const [menuPrice, setMenuPrice] = useState('');
  const [editingMenuItemId, setEditingMenuItemId] = useState('');
  const [editingMenuItemName, setEditingMenuItemName] = useState('');
  const [masterItemId, setMasterItemId] = useState('');
  const [basePriceEdit, setBasePriceEdit] = useState('');
  const [overridePrice, setOverridePrice] = useState('');
  const [outletItemId, setOutletItemId] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [cartQuantity, setCartQuantity] = useState('1');
  const [cart, setCart] = useState<ItemCount[]>([]);
  const [addingAnotherSaleItem, setAddingAnotherSaleItem] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [revenue, setRevenue] = useState<number | null>(null);
  const [topItems, setTopItems] = useState<ItemCount[]>([]);
  const [companyReports, setCompanyReports] = useState<OutletSalesReport[] | null>(null);
  const [reportOutletFilter, setReportOutletFilter] = useState('');
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
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

  const call = request;
  const workspaceData = useWorkspaceData({
    request,
    role: session?.role,
    companyId: session?.companyId,
    outletId,
    assignmentOutletId,
    setMessage,
    setMessageIsError
  });
  const {
    outlets,
    companyUsers,
    menuItems,
    menuItemOutlets,
    assignmentOutletMenu,
    outletMenu,
    inventory,
    loadOutlets,
    loadCompanyUsers,
    loadMenuItems,
    loadMenuItemOutlets,
    loadOutletMenu,
    loadAssignmentOutletMenu,
    loadInventory
  } = workspaceData;
  const userManagement = useUserManagement({
    companyId: session?.companyId,
    workingOutletId: outletId,
    outlets,
    users: companyUsers,
    request,
    reloadUsers: loadCompanyUsers
  });

  useEffect(() => {
    setCart([]);
    setReceipt('');
    setRevenue(null);
    setTopItems([]);
    checkoutKey.current = null;
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
      const next = await signIn(
        mode === 'signup' ? '/auth/register' : '/auth/login',
        mode === 'signup' ? { companyName, email, password } : { email, password }
      );
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
    setOutletId(''); setAssignmentOutletId(''); setMessage('');
    setSignedOut(true);
  };

  if (!session) {
    return <AuthPage
      mode={mode}
      setMode={setMode}
      companyName={companyName}
      setCompanyName={setCompanyName}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      submitting={submitting}
      signedOut={signedOut}
      message={message}
      setMessage={setMessage}
      setSignedOut={setSignedOut}
      authErrors={authErrors}
      setAuthErrors={setAuthErrors}
      onSubmit={authenticate}
    />;
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
      const outlet = await call<Outlet>(`/companies/${session.companyId}/outlets`, { method: 'POST', body: JSON.stringify({ name: outletName }) });
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
      const sale = await call<{ receiptNumber: number; totalAmount: number }>(`/outlets/${outletId}/sync/sales`, {
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
      call<{ totalRevenue: number }>(`/reports/outlets/${outletId}/revenue`),
      call<ItemsResponse<ItemCount>>(`/reports/outlets/${outletId}/top-items?limit=5`)
    ]);
    setRevenue(revenueReport.totalRevenue); setTopItems(topItemsReport.items);
  }, 'Failed to load reports');
  const loadCompanyReports = () => void run(async () => {
    const params = new URLSearchParams();
    if (reportOutletFilter) params.set('outletId', reportOutletFilter);
    if (reportFrom) params.set('from', reportFrom);
    if (reportTo) params.set('to', reportTo);
    const queryString = params.toString();
    const query = queryString ? `?${queryString}` : '';
    const result = await call<{ outlets: OutletSalesReport[] }>(`/reports/company${query}`);
    setCompanyReports(result.outlets);
  }, 'Failed to load company reports');
  const outletLabel = outlets.find((outlet) => outlet.id === outletId)?.name;
  const selectedMenuItemAssigned = assignmentOutletMenu.some((item) => item.id === masterItemId);
  const assignmentOutletLabel = outlets.find((outlet) => outlet.id === assignmentOutletId)?.name;
  const selectedBasePriceItem = menuItems.find((item) => item.id === masterItemId);
  return <WorkspaceTemplate companyName={session.companyName} isHq={isHq} onSignOut={signOut}>
    {isHq
      ? <div className="workspace">
        <HqSidebar
          section={hqSection}
          setSection={setHqSection}
          outlets={outlets}
          workingOutletId={outletId}
          onWorkingOutletChange={(id) => {
            setOutletId(id);
            setAssignmentOutletId(id);
            if (id) userManagement.onWorkingOutletAvailable();
          }}
          onStartSale={() => { setHqSection('operations'); setOperationSection('sales'); }}
        />

        <div className="workspace-content">
          <StatusMessage message={message} isError={messageIsError} />

          {hqSection === 'overview' && <HqOverviewPage
            outletCount={outlets.length}
            menuItemCount={menuItems.length}
            outletLabel={outletLabel}
            onNavigate={setHqSection}
            onStartSale={() => { setHqSection('operations'); setOperationSection('sales'); }}
          />}

          {hqSection === 'outlets' && <OutletsPage
            outlets={outlets}
            workingOutletId={outletId}
            outletName={outletName}
            fieldErrors={fieldErrors}
            onOutletNameChange={setOutletName}
            onOutletNameBlur={() => setFieldError('outletName', outletName.trim() ? undefined : 'Enter an outlet name.')}
            onCreateOutlet={createOutlet}
            onFieldError={setFieldError}
            onSetWorkingOutlet={(id) => { setOutletId(id); setAssignmentOutletId(id); }}
          />}

          {hqSection === 'menu' && <MenuManagementPage
            section={menuSection}
            onSectionChange={setMenuSection}
            catalog={{
              items: menuItems,
              name: menuName,
              setName: setMenuName,
              price: menuPrice,
              setPrice: setMenuPrice,
              editingId: editingMenuItemId,
              editingName: editingMenuItemName,
              setEditingName: setEditingMenuItemName,
              onCreate: createMenuItem,
              onUpdateName: updateMenuItemName,
              onDelete: deleteMenuItem,
              setEditing: (id, name) => { setEditingMenuItemId(id); setEditingMenuItemName(name); setFieldError('editingMenuItemName'); },
              onCancelEdit: () => { setEditingMenuItemId(''); setEditingMenuItemName(''); setFieldError('editingMenuItemName'); },
              fieldErrors,
              setFieldError,
              priceError
            }}
            pricing={{
              items: menuItems,
              selectedItemId: masterItemId,
              setSelectedItemId: setMasterItemId,
              selectedItem: selectedBasePriceItem,
              newPrice: basePriceEdit,
              setNewPrice: setBasePriceEdit,
              onUpdate: updateBasePrice,
              fieldErrors,
              setFieldError,
              priceError
            }}
            assignment={{
              outlets,
              workingOutletId: outletId,
              outletId: assignmentOutletId,
              setOutletId: setAssignmentOutletId,
              outletLabel: assignmentOutletLabel,
              assignedItems: assignmentOutletMenu,
              menuItems,
              selectedItemId: masterItemId,
              setSelectedItemId: setMasterItemId,
              selectedItemAssigned: selectedMenuItemAssigned,
              overridePrice,
              setOverridePrice,
              itemOutlets: menuItemOutlets,
              onLoadItemOutlets: (id) => void loadMenuItemOutlets(id),
              onAssign: assignMenuItem,
              onUnassign: unassignMenuItem,
              onSetPrice: setPrice,
              fieldErrors,
              setFieldError,
              priceError
            }}
          />}

          {hqSection === 'reports' && <CompanyReportsPage
            outlets={outlets}
            outletFilter={reportOutletFilter}
            from={reportFrom}
            to={reportTo}
            reports={companyReports}
            onOutletFilterChange={setReportOutletFilter}
            onFromChange={setReportFrom}
            onToChange={setReportTo}
            onLoad={loadCompanyReports}
          />}

          {hqSection === 'operations' && <HqOperationsPage
            outletId={outletId}
            outletLabel={outletLabel}
            section={operationSection}
            onSectionChange={(section) => { setOperationSection(section); setFieldError('outletItemId'); }}
            onOpenAssignment={() => { setMenuSection('outlet-assignment'); setHqSection('menu'); }}
            outletMenu={outletMenu}
            inventory={inventory}
            itemId={outletItemId}
            stockQuantity={stockQuantity}
            selectedStock={selectedSaleStock}
            cartQuantity={cartQuantity}
            cart={cart}
            cartTotal={cartTotal}
            receipt={receipt}
            fieldErrors={fieldErrors}
            setFieldError={setFieldError}
            onInventoryItemChange={(id) => { setOutletItemId(id); setFieldError('outletItemId'); }}
            onStockQuantityChange={(value) => {
              setStockQuantity(value);
              if (fieldErrors.stockQuantity) {
                const quantity = Number(value);
                setFieldError('stockQuantity', value === '' ? undefined : Number.isInteger(quantity) && quantity >= 0 && quantity <= 2147483647 ? undefined : 'Stock must be a whole number from 0 to 2,147,483,647.');
              }
            }}
            onStockQuantityBlur={() => {
              const quantity = Number(stockQuantity);
              setFieldError('stockQuantity', stockQuantity === '' ? undefined : Number.isInteger(quantity) && quantity >= 0 && quantity <= 2147483647 ? undefined : 'Stock must be a whole number from 0 to 2,147,483,647.');
            }}
            onSaleItemChange={(id) => {
              setOutletItemId(id);
              setFieldError('outletItemId', id ? undefined : 'Choose a menu item.');
            }}
            onSaleQuantityChange={(value) => {
              setCartQuantity(value);
              if (fieldErrors.cartQuantity) {
                const quantity = Number(value);
                setFieldError('cartQuantity', value.trim() && (!Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647) ? 'Quantity must be a whole number from 1 to 2,147,483,647.' : undefined);
              }
            }}
            onSaleQuantityBlur={() => {
              const quantity = Number(cartQuantity);
              setFieldError('cartQuantity', cartQuantity.trim() && (!Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647) ? 'Quantity must be a whole number from 1 to 2,147,483,647.' : undefined);
            }}
            onSetStock={setStock}
            onAddToCart={addToCart}
            onRemoveFromCart={removeFromCart}
            onClearCart={clearCart}
            onCheckout={checkout}
          />}

          {hqSection === 'users' && <UsersPage {...userManagement} />}
        </div>
      </div>
      : <div className="outlet-workspace">
        <OutletSidebar
          companyName={session.companyName}
          hasOutlet={Boolean(outletId)}
          section={outletSection}
          setSection={setOutletSection}
        />
        <div className="outlet-content">
          {session.companyName && <p className="muted">Welcome to {session.companyName}.</p>}
          <StatusMessage message={message} isError={messageIsError} />
          {!outletId
            ? <section className="content-card"><p>Your account is not linked to an outlet. Ask HQ to assign one.</p></section>
            : <>
              {outletSection === 'menu' && <OutletMenuPage
                outletMenu={outletMenu}
                inventory={inventory}
                itemId={outletItemId}
                stockQuantity={stockQuantity}
                fieldErrors={fieldErrors}
                onItemChange={setOutletItemId}
                onStockQuantityChange={(value) => {
                  setStockQuantity(value);
                  if (fieldErrors.stockQuantity) {
                    const quantity = Number(value);
                    setFieldError('stockQuantity', value === '' ? 'Enter a stock quantity.' : Number.isInteger(quantity) && quantity >= 0 && quantity <= 2147483647 ? undefined : 'Stock must be a whole number from 0 to 2,147,483,647.');
                  }
                }}
                onSetFieldError={setFieldError}
                onSaveStock={setStock}
              />}
              {outletSection === 'sales' && <OutletSalesPage
                outletMenu={outletMenu}
                itemId={outletItemId}
                quantity={cartQuantity}
                cart={cart}
                cartTotal={cartTotal}
                receipt={receipt}
                addingAnotherItem={addingAnotherSaleItem}
                selectedItem={selectedSaleItem}
                selectedStock={selectedSaleStock}
                fieldErrors={fieldErrors}
                quantityError={saleQuantityError}
                onItemChange={setOutletItemId}
                onQuantityChange={setCartQuantity}
                onSetFieldError={setFieldError}
                onAddToCart={addToCart}
                onRemoveFromCart={removeFromCart}
                onClearCart={clearCart}
                onCheckout={checkout}
                onAddAnotherItem={() => setAddingAnotherSaleItem(true)}
              />}
              {outletSection === 'reports' && <OutletReportsPage revenue={revenue} topItems={topItems} onLoad={loadReports} />}
            </>}
        </div>
      </div>}
  </WorkspaceTemplate>;
}
