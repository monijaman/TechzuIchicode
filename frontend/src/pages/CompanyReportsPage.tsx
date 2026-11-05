import type { OutletSalesReport } from '../types';
import { PageHeading } from '../components/molecules/PageHeading';
import { ReportFilters } from '../components/molecules/ReportFilters';
import { ReportOutletCard } from '../components/organisms/ReportOutletCard';

type Outlet = { id: string; name: string };

type CompanyReportsPageProps = {
  outlets: Outlet[];
  outletFilter: string;
  from: string;
  to: string;
  reports: OutletSalesReport[] | null;
  onOutletFilterChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onLoad: () => void;
};

export function CompanyReportsPage({
  outlets,
  outletFilter,
  from,
  to,
  reports,
  onOutletFilterChange,
  onFromChange,
  onToChange,
  onLoad
}: CompanyReportsPageProps) {
  return <div className="page-content">
    <PageHeading eyebrow="Company performance" title="Sales reports" />
    <ReportFilters
      outlets={outlets}
      outletFilter={outletFilter}
      from={from}
      to={to}
      onOutletFilterChange={onOutletFilterChange}
      onFromChange={onFromChange}
      onToChange={onToChange}
      onLoad={onLoad}
    />
    {reports !== null && (reports.length > 0
      ? <>
        <section className="content-card report-summary">
          <span>Total revenue across selected outlets</span>
          <strong>{reports.reduce((total, report) => total + report.totalRevenue, 0).toFixed(2)}</strong>
        </section>
        <div className="report-outlet-grid">
          {reports.map((report) => <ReportOutletCard key={report.outletId} report={report} />)}
        </div>
      </>
      : <section className="content-card empty-state"><p>No outlets match this report filter.</p></section>)}
  </div>;
}
