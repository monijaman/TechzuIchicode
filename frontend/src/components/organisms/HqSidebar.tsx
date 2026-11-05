import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../atoms/Button';

type HqSection = 'overview' | 'outlets' | 'menu' | 'operations' | 'reports' | 'users';
type Outlet = { id: string; name: string };

type HqSidebarProps = {
  section: HqSection;
  setSection: Dispatch<SetStateAction<HqSection>>;
  outlets: Outlet[];
  workingOutletId: string;
  onWorkingOutletChange: (outletId: string) => void;
  onStartSale: () => void;
};

const navigation: Array<{ id: HqSection; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'outlets', label: 'Outlets' },
  { id: 'menu', label: 'Menu' },
  { id: 'operations', label: 'Operations' },
  { id: 'reports', label: 'Reports' },
  { id: 'users', label: 'Users' }
];

export function HqSidebar({
  section,
  setSection,
  outlets,
  workingOutletId,
  onWorkingOutletChange,
  onStartSale
}: HqSidebarProps) {
  return <aside className="sidebar">
    <div className="sidebar-heading">
      <span className="brand-mark" aria-hidden="true">F</span>
      <div><strong>Workspace</strong><small>Head office</small></div>
    </div>
    <nav className="sidebar-nav" aria-label="HQ sections">
      {navigation.map((item) => <Button
        key={item.id}
        type="button"
        className={section === item.id ? 'nav-item active' : 'nav-item'}
        aria-current={section === item.id ? 'page' : undefined}
        onClick={() => setSection(item.id)}
      >{item.label}</Button>)}
      <Button type="button" className="nav-item" onClick={onStartSale}>POS checkout</Button>
    </nav>
    <div className="sidebar-outlet">
      <label htmlFor="working-outlet">Working outlet</label>
      <select id="working-outlet" value={workingOutletId} onChange={(event) => onWorkingOutletChange(event.target.value)}>
        <option value="">Choose outlet</option>
        {outlets.map((outlet) => <option value={outlet.id} key={outlet.id}>{outlet.name}</option>)}
      </select>
      <small>Outlet selection applies to menu and operations.</small>
    </div>
  </aside>;
}
