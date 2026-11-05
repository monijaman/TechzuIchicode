import type { ItemCount } from '../types';
import { PageHeading } from '../components/molecules/PageHeading';
import { Button } from '../components/atoms/Button';

type OutletReportsPageProps = {
  revenue: number | null;
  topItems: ItemCount[];
  onLoad: () => void;
};

export function OutletReportsPage({ revenue, topItems, onLoad }: OutletReportsPageProps) {
  return <div className="page-content">
    <PageHeading eyebrow="Performance" title="Reports" />
    <section className="content-card">
      <p className="muted">View total revenue and the top-selling items for this outlet.</p>
      <Button onClick={onLoad}>Load reports</Button>
      {revenue !== null && <p className="report-total">Total revenue: {revenue.toFixed(2)}</p>}
      {topItems.length > 0 && <ul className="item-list">{topItems.map((item) => <li key={item.menuItemId}><span>{item.name}</span><strong>{item.quantity} sold</strong></li>)}</ul>}
    </section>
  </div>;
}
