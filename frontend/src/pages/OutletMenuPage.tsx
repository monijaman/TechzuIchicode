import type { ItemCount, OutletMenuItem } from '../types';
import { PageHeading } from '../components/molecules/PageHeading';
import { Button } from '../components/atoms/Button';

type FieldErrors = Record<string, string>;

type OutletMenuPageProps = {
  outletMenu: OutletMenuItem[];
  inventory: ItemCount[];
  itemId: string;
  stockQuantity: string;
  fieldErrors: FieldErrors;
  onItemChange: (value: string) => void;
  onStockQuantityChange: (value: string) => void;
  onSetFieldError: (field: string, error?: string) => void;
  onSaveStock: () => void;
};

export function OutletMenuPage({
  outletMenu,
  inventory,
  itemId,
  stockQuantity,
  fieldErrors,
  onItemChange,
  onStockQuantityChange,
  onSetFieldError,
  onSaveStock
}: OutletMenuPageProps) {
  return <div className="page-content">
    <PageHeading eyebrow="Outlet workspace" title="Menu &amp; stock" />
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
          <label>Menu item<select value={itemId} aria-invalid={Boolean(fieldErrors.outletItemId)} aria-describedby={fieldErrors.outletItemId ? 'outlet-stock-item-error' : undefined} onChange={(event) => {
            onItemChange(event.target.value);
            onSetFieldError('outletItemId', event.target.value ? undefined : 'Choose a menu item.');
          }}><option value="">Choose item</option>{outletMenu.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{fieldErrors.outletItemId && <span className="field-error" id="outlet-stock-item-error">{fieldErrors.outletItemId}</span>}</label>
          <label>New stock quantity<input type="number" min="0" max="2147483647" step="1" value={stockQuantity} aria-invalid={Boolean(fieldErrors.stockQuantity)} aria-describedby={fieldErrors.stockQuantity ? 'outlet-stock-quantity-error' : undefined} onChange={(event) => onStockQuantityChange(event.target.value)} />{fieldErrors.stockQuantity && <span className="field-error" id="outlet-stock-quantity-error">{fieldErrors.stockQuantity}</span>}</label>
          <Button onClick={onSaveStock}>Save stock level</Button>
        </div>
      </div>}
    </section>
  </div>;
}
