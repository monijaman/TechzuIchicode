type Outlet = { id: string; name: string };

type ReportFiltersProps = {
  outlets: Outlet[];
  outletFilter: string;
  from: string;
  to: string;
  onOutletFilterChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onLoad: () => void;
};

export function ReportFilters({
  outlets,
  outletFilter,
  from,
  to,
  onOutletFilterChange,
  onFromChange,
  onToChange,
  onLoad
}: ReportFiltersProps) {
  return <section className="content-card">
    <p className="muted">Compare total revenue and the top five selling items for each outlet.</p>
    <div className="form-grid report-filters">
      <label htmlFor="report-outlet-filter">Outlet<select id="report-outlet-filter" value={outletFilter} onChange={(event) => onOutletFilterChange(event.target.value)}>
        <option value="">All outlets</option>
        {outlets.map((outlet) => <option value={outlet.id} key={outlet.id}>{outlet.name}</option>)}
      </select></label>
      <label htmlFor="report-from">From<input id="report-from" type="date" value={from} onChange={(event) => onFromChange(event.target.value)} /></label>
      <label htmlFor="report-to">To<input id="report-to" type="date" value={to} onChange={(event) => onToChange(event.target.value)} /></label>
      <button type="button" onClick={onLoad}>Load reports</button>
    </div>
  </section>;
}
