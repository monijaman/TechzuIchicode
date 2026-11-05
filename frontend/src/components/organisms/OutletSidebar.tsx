import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../atoms/Button';

type OutletSection = 'menu' | 'sales' | 'reports';

type OutletSidebarProps = {
  companyName?: string;
  hasOutlet: boolean;
  section: OutletSection;
  setSection: Dispatch<SetStateAction<OutletSection>>;
};

const navigation: Array<{ id: OutletSection; label: string }> = [
  { id: 'menu', label: 'Menu & stock' },
  { id: 'sales', label: 'Sales' },
  { id: 'reports', label: 'Reports' }
];

export function OutletSidebar({ companyName, hasOutlet, section, setSection }: OutletSidebarProps) {
  return <aside className="sidebar outlet-sidebar">
    <div className="sidebar-heading">
      <span className="brand-mark" aria-hidden="true">F</span>
      <div><strong>Outlet workspace</strong><small>{companyName ?? 'Outlet team'}</small></div>
    </div>
    {hasOutlet && <nav className="sidebar-nav" aria-label="Outlet sections">
      {navigation.map((item) => <Button
        key={item.id}
        type="button"
        className={section === item.id ? 'nav-item active' : 'nav-item'}
        aria-current={section === item.id ? 'page' : undefined}
        onClick={() => setSection(item.id)}
      >{item.label}</Button>)}
    </nav>}
    {hasOutlet && <div className="sidebar-outlet">
      <small>Stock is tracked for this outlet. Completed sales automatically deduct the sold quantity.</small>
    </div>}
  </aside>;
}
