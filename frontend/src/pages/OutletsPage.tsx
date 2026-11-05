import type { FormEvent } from 'react';
import { PageHeading } from '../components/molecules/PageHeading';
import { Button } from '../components/atoms/Button';

type Outlet = { id: string; name: string };
type FieldErrors = Record<string, string>;

type OutletsPageProps = {
  outlets: Outlet[];
  workingOutletId: string;
  outletName: string;
  fieldErrors: FieldErrors;
  onOutletNameChange: (value: string) => void;
  onOutletNameBlur: () => void;
  onCreateOutlet: (event: FormEvent<HTMLFormElement>) => void;
  onFieldError: (field: string, error?: string) => void;
  onSetWorkingOutlet: (outletId: string) => void;
};

export function OutletsPage({
  outlets,
  workingOutletId,
  outletName,
  fieldErrors,
  onOutletNameChange,
  onOutletNameBlur,
  onCreateOutlet,
  onFieldError,
  onSetWorkingOutlet
}: OutletsPageProps) {
  const outletNameError = fieldErrors.outletName;

  return <div className="page-content">
    <PageHeading eyebrow="Locations" title="Outlets" />
    <section className="content-card">
      <h3>Add an outlet</h3>
      <p className="muted">Create a location for your team to manage.</p>
      <form noValidate onSubmit={onCreateOutlet}>
        <label>Outlet name<input required value={outletName} aria-invalid={Boolean(outletNameError)} aria-describedby={outletNameError ? 'outlet-name-error' : undefined} onBlur={onOutletNameBlur} onChange={(event) => {
          onOutletNameChange(event.target.value);
          if (outletNameError) onFieldError('outletName', event.target.value.trim() ? undefined : 'Enter an outlet name.');
        }} />{outletNameError && <span className="field-error" id="outlet-name-error">{outletNameError}</span>}</label>
        <Button type="submit">Create outlet</Button>
      </form>
    </section>
    <section className="content-card">
      <h3>Your outlets <span className="count-badge">{outlets.length}</span></h3>
      {outlets.length
        ? <ul className="item-list">{outlets.map((outlet) => <li key={outlet.id}>
          <span>{outlet.name}</span>
          {workingOutletId === outlet.id
            ? <span className="selected-badge">Working outlet</span>
            : <Button variant="text" onClick={() => onSetWorkingOutlet(outlet.id)}>Set as working outlet</Button>}
        </li>)}</ul>
        : <p className="empty-state">No outlets yet. Create your first outlet above.</p>}
    </section>
  </div>;
}
