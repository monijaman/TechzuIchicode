import type { FormEvent } from 'react';
import type { MenuItem, OutletMenuItem } from '../types';
import { PageHeading } from '../components/molecules/PageHeading';
import { Button } from '../components/atoms/Button';

type MenuSection = 'catalog' | 'base-pricing' | 'outlet-assignment';
type Outlet = { id: string; name: string };
type FieldErrors = Record<string, string>;
type SetFieldError = (field: string, error?: string) => void;

type CatalogControls = {
  items: MenuItem[];
  name: string;
  setName: (value: string) => void;
  price: string;
  setPrice: (value: string) => void;
  editingId: string;
  editingName: string;
  setEditingName: (value: string) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateName: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (id: string) => void;
  setEditing: (id: string, name: string) => void;
  onCancelEdit: () => void;
  fieldErrors: FieldErrors;
  setFieldError: SetFieldError;
  priceError: (value: string, label: string) => string | undefined;
};

type PricingControls = {
  items: MenuItem[];
  selectedItemId: string;
  setSelectedItemId: (value: string) => void;
  selectedItem?: MenuItem;
  newPrice: string;
  setNewPrice: (value: string) => void;
  onUpdate: () => void;
  fieldErrors: FieldErrors;
  setFieldError: SetFieldError;
  priceError: (value: string, label: string) => string | undefined;
};

type AssignmentControls = {
  outlets: Outlet[];
  workingOutletId: string;
  outletId: string;
  setOutletId: (value: string) => void;
  outletLabel?: string;
  assignedItems: OutletMenuItem[];
  menuItems: MenuItem[];
  selectedItemId: string;
  setSelectedItemId: (value: string) => void;
  selectedItemAssigned: boolean;
  overridePrice: string;
  setOverridePrice: (value: string) => void;
  itemOutlets: Array<{ id: string; name: string; price: number }>;
  onLoadItemOutlets: (id: string) => void;
  onAssign: () => void;
  onUnassign: () => void;
  onSetPrice: () => void;
  fieldErrors: FieldErrors;
  setFieldError: SetFieldError;
  priceError: (value: string, label: string) => string | undefined;
};

type MenuManagementPageProps = {
  section: MenuSection;
  onSectionChange: (section: MenuSection) => void;
  catalog: CatalogControls;
  pricing: PricingControls;
  assignment: AssignmentControls;
};

export function MenuManagementPage({ section, onSectionChange, catalog, pricing, assignment }: MenuManagementPageProps) {
  return <div className="page-content">
    <PageHeading eyebrow="Catalog and pricing" title="Menu" />
    <nav className="section-nav" aria-label="Menu management tabs" role="tablist">
      {([
        { id: 'catalog', label: 'Master menu' },
        { id: 'base-pricing', label: 'Base pricing' },
        { id: 'outlet-assignment', label: 'Outlet assignment' }
      ] as const).map((tab) => <Button
        key={tab.id}
        type="button"
        role="tab"
        id={`menu-tab-${tab.id}`}
        aria-selected={section === tab.id}
        aria-controls={`menu-panel-${tab.id}`}
        className={section === tab.id ? 'section-nav-item active' : 'section-nav-item'}
        onClick={() => onSectionChange(tab.id)}
      >{tab.label}</Button>)}
    </nav>
    {section === 'catalog' && <section className="content-card" role="tabpanel" id="menu-panel-catalog" aria-labelledby="menu-tab-catalog">
      <h3>Master menu</h3>
      <p className="muted">Add items and set their standard prices for your company.</p>
      <form noValidate onSubmit={catalog.onCreate} className="form-grid">
        <label>Item name<input required value={catalog.name} aria-invalid={Boolean(catalog.fieldErrors.menuName)} aria-describedby={catalog.fieldErrors.menuName ? 'menu-name-error' : undefined} onBlur={() => catalog.setFieldError('menuName', catalog.name.trim() ? undefined : 'Enter a menu item name.')} onChange={(event) => {
          catalog.setName(event.target.value);
          if (catalog.fieldErrors.menuName) catalog.setFieldError('menuName', event.target.value.trim() ? undefined : 'Enter a menu item name.');
        }} />{catalog.fieldErrors.menuName && <span className="field-error" id="menu-name-error">{catalog.fieldErrors.menuName}</span>}</label>
        <label>Base price<input required type="number" min="0.01" step="0.01" value={catalog.price} aria-invalid={Boolean(catalog.fieldErrors.menuPrice)} aria-describedby={catalog.fieldErrors.menuPrice ? 'menu-price-error' : undefined} onBlur={() => catalog.setFieldError('menuPrice', catalog.priceError(catalog.price, 'base price'))} onChange={(event) => {
          catalog.setPrice(event.target.value);
          if (catalog.fieldErrors.menuPrice) catalog.setFieldError('menuPrice', catalog.priceError(event.target.value, 'base price'));
        }} />{catalog.fieldErrors.menuPrice && <span className="field-error" id="menu-price-error">{catalog.fieldErrors.menuPrice}</span>}</label>
        <Button type="submit">Add menu item</Button>
      </form>
      {catalog.items.length
        ? <ul className="item-list">{catalog.items.map((item) => <li key={item.id}>
          {catalog.editingId === item.id
            ? <form className="menu-item-edit-form" noValidate onSubmit={catalog.onUpdateName}>
              <label htmlFor={`edit-menu-name-${item.id}`}>Menu item name<input id={`edit-menu-name-${item.id}`} autoFocus value={catalog.editingName} aria-invalid={Boolean(catalog.fieldErrors.editingMenuItemName)} aria-describedby={catalog.fieldErrors.editingMenuItemName ? `edit-menu-name-error-${item.id}` : undefined} onChange={(event) => {
                catalog.setEditingName(event.target.value);
                if (catalog.fieldErrors.editingMenuItemName) catalog.setFieldError('editingMenuItemName', event.target.value.trim() ? undefined : 'Enter a menu item name.');
              }} /></label>
              {catalog.fieldErrors.editingMenuItemName && <span className="field-error" id={`edit-menu-name-error-${item.id}`}>{catalog.fieldErrors.editingMenuItemName}</span>}
              <div className="menu-item-actions">
                <Button type="submit">Save name</Button>
                <Button type="button" variant="secondary" onClick={catalog.onCancelEdit}>Cancel</Button>
              </div>
            </form>
            : <>
              <span>{item.name} <small>{item.basePrice.toFixed(2)}</small></span>
              <div className="menu-item-actions">
                <Button variant="secondary" onClick={() => catalog.setEditing(item.id, item.name)}>Edit</Button>
                <Button variant="danger" onClick={() => catalog.onDelete(item.id)}>Delete</Button>
              </div>
            </>}
        </li>)}</ul>
        : <p className="empty-state">No menu items yet. Add your first item above.</p>}
    </section>}
    {section === 'base-pricing' && <section className="content-card" role="tabpanel" id="menu-panel-base-pricing" aria-labelledby="menu-tab-base-pricing">
      <h3>Update base price</h3>
      <p className="muted">Change the standard price used by outlets unless they have an outlet-specific override.</p>
      <div className="form-grid">
        <label>Menu item<select value={pricing.selectedItemId} aria-invalid={Boolean(pricing.fieldErrors.masterItemId)} aria-describedby={pricing.fieldErrors.masterItemId ? 'base-item-error' : undefined} onBlur={() => pricing.setFieldError('masterItemId', pricing.selectedItemId ? undefined : 'Choose a menu item.')} onChange={(event) => {
          pricing.setSelectedItemId(event.target.value);
          pricing.setFieldError('masterItemId', event.target.value ? undefined : 'Choose a menu item.');
        }}><option value="">Choose item</option>{pricing.items.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{pricing.fieldErrors.masterItemId && <span className="field-error" id="base-item-error">{pricing.fieldErrors.masterItemId}</span>}</label>
        {pricing.selectedItem && <p className="current-price">Current base price: <strong>{pricing.selectedItem.basePrice.toFixed(2)}</strong></p>}
        <label>New base price<input type="number" min="0.01" step="0.01" value={pricing.newPrice} aria-invalid={Boolean(pricing.fieldErrors.basePriceEdit)} aria-describedby={pricing.fieldErrors.basePriceEdit ? 'base-price-error' : undefined} onBlur={() => pricing.setFieldError('basePriceEdit', pricing.priceError(pricing.newPrice, 'new base price'))} onChange={(event) => {
          pricing.setNewPrice(event.target.value);
          if (pricing.fieldErrors.basePriceEdit) pricing.setFieldError('basePriceEdit', pricing.priceError(event.target.value, 'new base price'));
        }} />{pricing.fieldErrors.basePriceEdit && <span className="field-error" id="base-price-error">{pricing.fieldErrors.basePriceEdit}</span>}</label>
        <Button onClick={pricing.onUpdate}>Update base price</Button>
      </div>
    </section>}
    {section === 'outlet-assignment' && <section className="content-card" role="tabpanel" id="menu-panel-outlet-assignment" aria-labelledby="menu-tab-outlet-assignment">
      <div className="outlet-card-heading">
        <div><h3>Assign menu to an outlet</h3><p className="muted">{assignment.outletLabel ? `Selected outlet: ${assignment.outletLabel}` : 'Choose an outlet below to manage its menu assignments.'}</p></div>
        <span className="count-badge">{assignment.assignedItems.length} assigned</span>
      </div>
      <label htmlFor="assignment-outlet">Outlet<select id="assignment-outlet" value={assignment.outletId} onChange={(event) => assignment.setOutletId(event.target.value)}>
        <option value="">Choose outlet</option>
        {assignment.outlets.map((outlet) => <option value={outlet.id} key={outlet.id}>{outlet.name}{outlet.id === assignment.workingOutletId ? ' (Working outlet)' : ''}</option>)}
      </select></label>
      <div className="form-grid">
        <label>Menu item<select value={assignment.selectedItemId} aria-invalid={Boolean(assignment.fieldErrors.masterItemId)} aria-describedby={assignment.fieldErrors.masterItemId ? 'assign-item-error' : undefined} onBlur={() => assignment.setFieldError('masterItemId', assignment.selectedItemId ? undefined : 'Choose a menu item.')} onChange={(event) => {
          assignment.setSelectedItemId(event.target.value);
          assignment.setFieldError('masterItemId', event.target.value ? undefined : 'Choose a menu item.');
          assignment.onLoadItemOutlets(event.target.value);
        }}><option value="">Choose item</option>{assignment.menuItems.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{assignment.fieldErrors.masterItemId && <span className="field-error" id="assign-item-error">{assignment.fieldErrors.masterItemId}</span>}</label>
        <label>Outlet price override<input type="number" min="0.01" step="0.01" value={assignment.overridePrice} aria-invalid={Boolean(assignment.fieldErrors.overridePrice)} aria-describedby={assignment.fieldErrors.overridePrice ? 'outlet-price-error' : undefined} onBlur={() => assignment.setFieldError('overridePrice', assignment.overridePrice ? assignment.priceError(assignment.overridePrice, 'outlet price') : undefined)} onChange={(event) => {
          assignment.setOverridePrice(event.target.value);
          if (assignment.fieldErrors.overridePrice) assignment.setFieldError('overridePrice', event.target.value ? assignment.priceError(event.target.value, 'outlet price') : undefined);
        }} />{assignment.fieldErrors.overridePrice && <span className="field-error" id="outlet-price-error">{assignment.fieldErrors.overridePrice}</span>}</label>
        <div className="button-row">
          <Button onClick={assignment.onAssign} disabled={!assignment.outletId || assignment.selectedItemAssigned}>{assignment.selectedItemAssigned ? 'Already assigned' : 'Assign to outlet'}</Button>
          {assignment.selectedItemAssigned && <Button variant="secondary" onClick={assignment.onUnassign}>Unassign</Button>}
          <Button variant="secondary" onClick={assignment.onSetPrice} disabled={!assignment.outletId || !assignment.selectedItemAssigned}>Set outlet price</Button>
        </div>
      </div>
      {assignment.selectedItemId && <div className="assigned-menu-list">
        <strong>Outlets with this menu item <span className="count-badge">{assignment.itemOutlets.length}</span></strong>
        {assignment.itemOutlets.length > 0
          ? <ul className="item-list">{assignment.itemOutlets.map((outlet) => <li key={outlet.id}><span>{outlet.name}</span><strong>{outlet.price.toFixed(2)}</strong></li>)}</ul>
          : <p className="empty-state">This menu item is not assigned to any outlet yet.</p>}
      </div>}
      {assignment.assignedItems.length > 0
        ? <div className="assigned-menu-list">
          <strong>Items assigned to {assignment.outletLabel}</strong>
          <ul className="item-list">{assignment.assignedItems.map((item) => <li key={item.id}><span>{item.name}</span><strong>{item.price.toFixed(2)}</strong></li>)}</ul>
        </div>
        : assignment.outletId && <p className="empty-state">No menu items are assigned to this outlet yet.</p>}
    </section>}
  </div>;
}
