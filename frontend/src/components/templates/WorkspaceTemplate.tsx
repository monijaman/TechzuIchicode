import type { ReactNode } from 'react';
import { AppHeader } from '../organisms/AppHeader';

type WorkspaceTemplateProps = {
  companyName?: string;
  isHq: boolean;
  onSignOut: () => void;
  children: ReactNode;
};

export function WorkspaceTemplate({ companyName, isHq, onSignOut, children }: WorkspaceTemplateProps) {
  return <main className={`app-shell ${isHq ? 'hq-app' : 'outlet-app'}`}>
    <AppHeader companyName={companyName} isHq={isHq} onSignOut={onSignOut} />
    {children}
  </main>;
}
