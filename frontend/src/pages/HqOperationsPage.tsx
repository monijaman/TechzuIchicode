import type { ItemCount, OutletMenuItem } from '../types';
import { PageHeading } from '../components/molecules/PageHeading';
import { Button } from '../components/atoms/Button';

type OperationSection = 'menu' | 'inventory' | 'sales';
type FieldErrors = Record<string, string>;
type SetFieldError = (field: string, error?: string) => void;

type HqOperationsPageProps = {
  outletId: string;
  outletLabel?: string;
  section: OperationSection;
  onSectionChange: (section: OperationSection) => void;
  onOpenAssignment: () => void;
  outletMenu: OutletMenuItem[];
  inventory: ItemCount[];
  itemId: string;
  stockQuantity: string;
  selectedStock?: ItemCount;
  cartQuantity: string;
  cart: ItemCount[];
  cartTotal: number;
  receipt: string;
  fieldErrors: FieldErrors;
  setFieldError: SetFieldError;
  onInventoryItemChange: (value: string) => void;
  onStockQuantityChange: (value: string) => void;
  onStockQuantityBlur: () => void;
  onSaleItemChange: (value: string) => void;
  onSaleQuantityChange: (value: string) => void;
  onSaleQuantityBlur: () => void;
  onSetStock: () => void;
  onAddToCart: () => void;
  onRemoveFromCart: (itemId: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
};

export function HqOperationsPage({
  outletId,
  outletLabel,
  section,
  onSectionChange,
  onOpenAssignment,
  outletMenu,
  inventory,
  itemId,
  stockQuantity,
  selectedStock,
  cartQuantity,
  cart,
  cartTotal,
  receipt,
  fieldErrors,
  setFieldError,
  onInventoryItemChange,
  onStockQuantityChange,
  onStockQuantityBlur,
  onSaleItemChange,
  onSaleQuantityChange,
  onSaleQuantityBlur,
  onSetStock,
  onAddToCart,
  onRemoveFromCart,
  onClearCart,
  onCheckout
}: HqOperationsPageProps) {
  return <div className="page-content">
    <PageHeading eyebrow={outletLabel ?? 'Select a working outlet to begin'} title="Operations" />
    {!outletId
      ? <section className="content-card empty-state"><h3>No outlet selected</h3><p>Choose an outlet from the sidebar to manage its menu, inventory, and sales.</p></section>
      : <>
        <nav className="section-nav" aria-label="Outlet operations">
          {(['menu', 'inventory', 'sales'] as const).map((item) => <Button
            key={item}
            type="button"
            className={section === item ? 'section-nav-item active' : 'section-nav-item'}
            aria-pressed={section === item}
            onClick={() => onSectionChange(item)}
          >{item === 'sales' ? 'POS checkout' : item[0].toUpperCase() + item.slice(1)}</Button>)}
        </nav>
        {section === 'menu' && <section className="content-card">
          <h3>Outlet menu</h3>
          {outletMenu.length
            ? <ul className="item-list">{outletMenu.map((item) => <li key={item.id}><span>{item.name}</span><strong>{item.price.toFixed(2)}</strong></li>)}</ul>
            : <div className="empty-state">
              <p>No items are assigned to {outletLabel ?? 'this outlet'} yet.</p>
              <p>Choose menu items from the company catalog to make them available here.</p>
              <Button type="button" onClick={onOpenAssignment}>Assign menu items to {outletLabel ?? 'outlet'}</Button>
            </div>}
        </section>}
        {section === 'inventory' && <section className="content-card">
          <h3>Inventory</h3>
          {inventory.length
            ? <ul className="item-list">{inventory.map((item) => <li key={item.menuItemId}><span>{item.name}</span><strong>{item.quantity} in stock</strong></li>)}</ul>
            : <p className="empty-state">{outletMenu.length
              ? 'No stock levels are set for this outlet yet. Choose an assigned menu item below to set its opening stock.'
              : 'No items are assigned to this outlet yet. Assign items from Menu → Outlet assignment before setting stock.'}</p>}
          {outletMenu.length > 0 && <div className="form-grid">
            <label>Assigned menu item<select value={itemId} aria-invalid={Boolean(fieldErrors.outletItemId)} aria-describedby={fieldErrors.outletItemId ? 'inventory-item-error' : undefined} onChange={(event) => onInventoryItemChange(event.target.value)}><option value="">Choose assigned item</option>{outletMenu.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{fieldErrors.outletItemId && <span className="field-error" id="inventory-item-error">{fieldErrors.outletItemId}</span>}</label>
            <label>Stock quantity<input type="number" min="0" max="2147483647" step="1" value={stockQuantity} aria-invalid={Boolean(fieldErrors.stockQuantity)} aria-describedby={fieldErrors.stockQuantity ? 'stock-quantity-error' : undefined} onBlur={onStockQuantityBlur} onChange={(event) => onStockQuantityChange(event.target.value)} />{fieldErrors.stockQuantity && <span className="field-error" id="stock-quantity-error">{fieldErrors.stockQuantity}</span>}</label>
            {itemId && <p className="inventory-current-stock">Current stock: <strong>{selectedStock ? selectedStock.quantity : 'Not set yet'}</strong></p>}
            <Button onClick={onSetStock}>Update stock</Button>
          </div>}
        </section>}
        {section === 'sales' && <section className="content-card">
          <h3>Create a sale</h3>
          <p className="muted">Add one or more items. Select an item and add it to the sale; repeat for each item.</p>
          {outletMenu.length > 0 ? <div className="form-grid">
            <label>Menu item<select value={itemId} aria-invalid={Boolean(fieldErrors.outletItemId)} aria-describedby={fieldErrors.outletItemId ? 'sale-item-error' : undefined} onBlur={() => setFieldError('outletItemId', itemId ? undefined : 'Choose a menu item.')} onChange={(event) => onSaleItemChange(event.target.value)}><option value="">Choose item</option>{outletMenu.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{fieldErrors.outletItemId && <span className="field-error" id="sale-item-error">{fieldErrors.outletItemId}</span>}</label>
            <label>Quantity<input type="number" min="1" max="2147483647" step="1" value={cartQuantity} aria-invalid={Boolean(fieldErrors.cartQuantity)} aria-describedby={fieldErrors.cartQuantity ? 'sale-quantity-error' : undefined} onBlur={onSaleQuantityBlur} onChange={(event) => onSaleQuantityChange(event.target.value)} />{fieldErrors.cartQuantity && <span className="field-error" id="sale-quantity-error">{fieldErrors.cartQuantity}</span>}</label>
            <Button onClick={onAddToCart}>Add item to sale</Button>
          </div> : <p className="empty-state">No menu items are assigned to this outlet. Ask HQ to assign menu items before creating a sale.</p>}
          <div className="cart-panel">
            <div className="cart-heading"><h4>Items in this sale <span className="count-badge">{cart.length}</span></h4>{cart.length > 0 && <Button variant="text" onClick={onClearCart}>Clear sale</Button>}</div>
            {cart.length > 0 && <ul className="item-list">{cart.map((line) => {
              const item = outletMenu.find((entry) => entry.id === line.menuItemId);
              return <li key={line.menuItemId}>
                <span>{line.name} <small>× {line.quantity}</small></span>
                <span className="cart-line-actions"><strong>{((item?.price ?? 0) * line.quantity).toFixed(2)}</strong><Button variant="text" onClick={() => onRemoveFromCart(line.menuItemId)}>Remove</Button></span>
              </li>;
            })}</ul>}
            {cart.length > 0 && <>
              <p className="cart-total">Sale total <strong>{cartTotal.toFixed(2)}</strong></p>
              <Button onClick={onCheckout}>Complete sale</Button>
            </>}
            {receipt && <p className="success-message">{receipt}</p>}
          </div>
        </section>}
      </>}
  </div>;
}
