import { Button } from '../atoms/Button';

type AppHeaderProps = {
  companyName?: string;
  isHq: boolean;
  onSignOut: () => void;
};

export function AppHeader({ companyName, isHq, onSignOut }: AppHeaderProps) {
  return <header className="app-header">
    <div>
      <p className="eyebrow">{companyName ?? (isHq ? 'Head office' : 'Outlet')}</p>
      <h1>{isHq ? 'HQ Management' : 'Outlet POS'}</h1>
    </div>
    <Button variant="secondary" onClick={onSignOut}>Sign out</Button>
  </header>;
}
