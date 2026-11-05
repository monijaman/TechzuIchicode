import { PageHeading } from '../components/molecules/PageHeading';
import { Button } from '../components/atoms/Button';

type HqSection = 'overview' | 'outlets' | 'menu' | 'operations' | 'reports' | 'users';

type HqOverviewPageProps = {
  outletCount: number;
  menuItemCount: number;
  outletLabel?: string;
  onNavigate: (section: HqSection) => void;
  onStartSale: () => void;
};

export function HqOverviewPage({
  outletCount,
  menuItemCount,
  outletLabel,
  onNavigate,
  onStartSale
}: HqOverviewPageProps) {
  return <div className="page-content">
    <PageHeading eyebrow="Your business at a glance" title="Overview" />
    <div className="summary-grid">
      <button className="summary-card" onClick={() => onNavigate('outlets')}><span>Outlets</span><strong>{outletCount}</strong><small>Manage your locations</small></button>
      <button className="summary-card" onClick={() => onNavigate('menu')}><span>Master menu items</span><strong>{menuItemCount}</strong><small>Manage shared menu and pricing</small></button>
      <button className="summary-card" onClick={() => onNavigate('operations')}><span>Working outlet</span><strong className="summary-outlet">{outletLabel ?? 'None selected'}</strong><small>View outlet operations</small></button>
    </div>
    <section className="content-card welcome-card">
      <h3>Get started</h3>
      <p>Set up your outlets and menu, then choose an outlet for operations or open Reports to compare sales across outlets.</p>
      <div className="quick-actions">
        <Button onClick={() => onNavigate('outlets')}>Manage outlets</Button>
        <Button variant="secondary" onClick={() => onNavigate('menu')}>Manage menu</Button>
        <Button onClick={onStartSale}>Start a sale</Button>
      </div>
    </section>
  </div>;
}
