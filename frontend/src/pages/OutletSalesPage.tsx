import type { ItemCount, OutletMenuItem } from '../types';
import { PageHeading } from '../components/molecules/PageHeading';
import { Button } from '../components/atoms/Button';

type FieldErrors = Record<string, string>;

type OutletSalesPageProps = {
  outletMenu: OutletMenuItem[];
  itemId: string;
  quantity: string;
  cart: ItemCount[];
  cartTotal: number;
  receipt: string;
  addingAnotherItem: boolean;
  selectedItem?: OutletMenuItem;
  selectedStock?: ItemCount;
  fieldErrors: FieldErrors;
  quantityError: (value: string, menuItemId: string) => string | undefined;
  onItemChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onSetFieldError: (field: string, error?: string) => void;
  onAddToCart: () => void;
  onRemoveFromCart: (menuItemId: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  onAddAnotherItem: () => void;
};

export function OutletSalesPage({
  outletMenu,
  itemId,
  quantity,
  cart,
  cartTotal,
  receipt,
  addingAnotherItem,
  selectedItem,
  selectedStock,
  fieldErrors,
  quantityError,
  onItemChange,
  onQuantityChange,
  onSetFieldError,
  onAddToCart,
  onRemoveFromCart,
  onClearCart,
  onCheckout,
  onAddAnotherItem
}: OutletSalesPageProps) {
  return <div className="page-content">
    <PageHeading eyebrow="Point of sale" title="Create a sale" />
    <section className="content-card">
      <p className="muted">Choose from the outlet menu and add one or more items. Stock is deducted when the sale is completed.</p>
      {outletMenu.length === 0
        ? <p className="empty-state">No menu items are assigned to this outlet. Ask HQ to assign menu items before creating a sale.</p>
        : (cart.length === 0 || addingAnotherItem) ? <>
          <label>Menu item<select value={itemId} aria-invalid={Boolean(fieldErrors.outletItemId)} aria-describedby={fieldErrors.outletItemId ? 'outlet-sale-item-error' : undefined} onChange={(event) => {
            onItemChange(event.target.value);
            onSetFieldError('outletItemId', event.target.value ? undefined : 'Choose a menu item.');
            onSetFieldError('cartQuantity', quantityError(quantity, event.target.value));
          }}><option value="">Choose item</option>{outletMenu.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{fieldErrors.outletItemId && <span className="field-error" id="outlet-sale-item-error">{fieldErrors.outletItemId}</span>}</label>
          {selectedItem && <p className="sale-stock-status" role="status">
            Available stock for <strong>{selectedItem.name}</strong>:{' '}
            <strong>{selectedStock ? selectedStock.quantity : 'Not set'}</strong>
            {!selectedStock && <span> — ask your outlet manager to set the stock level.</span>}
          </p>}
          <label>Quantity<input type="number" min="1" max="2147483647" step="1" value={quantity} aria-invalid={Boolean(fieldErrors.cartQuantity)} aria-describedby={fieldErrors.cartQuantity ? 'outlet-sale-quantity-error' : undefined} onBlur={() => onSetFieldError('cartQuantity', quantityError(quantity, itemId))} onChange={(event) => {
            onQuantityChange(event.target.value);
            onSetFieldError('cartQuantity', quantityError(event.target.value, itemId));
          }} />{fieldErrors.cartQuantity && <span className="field-error" id="outlet-sale-quantity-error">{fieldErrors.cartQuantity}</span>}</label>
          <Button className="sale-add-button" type="button" onClick={onAddToCart}>Add item to sale</Button>
        </> : <Button variant="secondary" type="button" onClick={onAddAnotherItem}>Add another item</Button>}
      {cart.length > 0 && <div className="cart-panel">
        <div className="cart-heading"><h3>Items in this sale <span className="count-badge">{cart.length}</span></h3><Button variant="text" onClick={onClearCart}>Clear sale</Button></div>
        <ul className="item-list">{cart.map((line) => {
          const item = outletMenu.find((entry) => entry.id === line.menuItemId);
          return <li key={line.menuItemId}>
            <span>{line.name} <small>× {line.quantity}</small></span>
            <span className="cart-line-actions"><strong>{((item?.price ?? 0) * line.quantity).toFixed(2)}</strong><Button variant="text" onClick={() => onRemoveFromCart(line.menuItemId)}>Remove</Button></span>
          </li>;
        })}</ul>
        <p className="cart-total">Sale total <strong>{cartTotal.toFixed(2)}</strong></p>
        <Button onClick={onCheckout}>Complete sale</Button>
      </div>}
      {receipt && <p className="success-message">{receipt}</p>}
    </section>
  </div>;
}
