import type { ItemCount, OutletSalesReport } from '../../types';

type ReportOutletCardProps = {
  report: OutletSalesReport;
};

function TopItems({ items }: { items: ItemCount[] }) {
  if (items.length === 0) return <p className="empty-state">No sales in this date range.</p>;

  return <ol className="report-top-items">
    {items.map((item) => <li key={item.menuItemId}><span>{item.name}</span><strong>{item.quantity} sold</strong></li>)}
  </ol>;
}

export function ReportOutletCard({ report }: ReportOutletCardProps) {
  return <section className="content-card report-outlet-card">
    <div className="outlet-card-heading">
      <div><h3>{report.outletName}</h3><p className="muted">Total revenue</p></div>
      <strong className="report-outlet-revenue">{report.totalRevenue.toFixed(2)}</strong>
    </div>
    <h4>Top 5 selling items</h4>
    <TopItems items={report.topItems} />
  </section>;
}
