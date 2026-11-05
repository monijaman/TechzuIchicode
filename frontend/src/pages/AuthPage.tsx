import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { Button } from '../components/atoms/Button';

type AuthMode = 'login' | 'signup';
type AuthErrors = { companyName?: string; email?: string; password?: string };

type AuthPageProps = {
  mode: AuthMode;
  setMode: Dispatch<SetStateAction<AuthMode>>;
  companyName: string;
  setCompanyName: Dispatch<SetStateAction<string>>;
  email: string;
  setEmail: Dispatch<SetStateAction<string>>;
  password: string;
  setPassword: Dispatch<SetStateAction<string>>;
  submitting: boolean;
  signedOut: boolean;
  message: string;
  setMessage: Dispatch<SetStateAction<string>>;
  setSignedOut: Dispatch<SetStateAction<boolean>>;
  authErrors: AuthErrors;
  setAuthErrors: Dispatch<SetStateAction<AuthErrors>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AuthPage({
  mode,
  setMode,
  companyName,
  setCompanyName,
  email,
  setEmail,
  password,
  setPassword,
  submitting,
  signedOut,
  message,
  setMessage,
  setSignedOut,
  authErrors,
  setAuthErrors,
  onSubmit
}: AuthPageProps) {
  const signup = mode === 'signup';

  return <main className="auth-page">
    <section className="auth-showcase">
      <div className="auth-brand"><span className="auth-brand-mark" aria-hidden="true">F</span><span>FIELDNOTES <small>OUTLET MANAGEMENT</small></span></div>
      <div className="showcase-copy">
        <p className="showcase-kicker">One clear view of your business</p>
        <h1>Good service starts with a well-run team.</h1>
        <p>Bring your menu, outlets, inventory, and sales together in one simple workspace.</p>
        <div className="showcase-points">
          <div><span className="point-icon">01</span><span><strong>Stay in sync</strong><small>Manage every outlet from HQ.</small></span></div>
          <div><span className="point-icon">02</span><span><strong>Know your numbers</strong><small>Keep an eye on sales and stock.</small></span></div>
        </div>
      </div>
      <div className="showcase-footer"><span>Made for the people behind the counter.</span><span>F&amp;B OPERATIONS</span></div>
    </section>

    <section className="auth-panel">
      <div className="auth-form-wrap">
        <div className="mobile-auth-brand"><span className="auth-brand-mark" aria-hidden="true">F</span><span>FIELDNOTES</span></div>
        <p className="eyebrow">{signup ? 'Get your workspace started' : 'Welcome back'}</p>
        <h2>{signup ? 'Create your account' : 'Sign in to your workspace'}</h2>
        <p className="auth-subtitle">{signup ? 'Set up your company and invite your team when you’re ready.' : 'Enter your details to pick up where you left off.'}</p>
        {signedOut && <p className="signed-out-message" role="status"><span aria-hidden="true">✓</span> You’re signed out. Sign in again whenever you’re ready.</p>}
        {message && <p className="auth-error" role="alert">{message}</p>}
        <form className="auth-form" noValidate onSubmit={onSubmit}>
          {signup && <label htmlFor="auth-company">Company name<input id="auth-company" name="organization" autoComplete="organization" placeholder="Your restaurant group" required value={companyName} aria-invalid={Boolean(authErrors.companyName)} aria-describedby={authErrors.companyName ? 'auth-company-error' : undefined} onChange={(event) => { setCompanyName(event.target.value); setAuthErrors((current) => ({ ...current, companyName: undefined })); }} />{authErrors.companyName && <span className="field-error" id="auth-company-error">{authErrors.companyName}</span>}</label>}
          <label htmlFor="auth-email">Work email<input id="auth-email" name="email" autoComplete="email" placeholder="you@company.com" required type="email" value={email} aria-invalid={Boolean(authErrors.email)} aria-describedby={authErrors.email ? 'auth-email-error' : undefined} onChange={(event) => { setEmail(event.target.value); setAuthErrors((current) => ({ ...current, email: undefined })); }} />{authErrors.email && <span className="field-error" id="auth-email-error">{authErrors.email}</span>}</label>
          <label htmlFor="auth-password">Password<input id="auth-password" name="password" autoComplete={signup ? 'new-password' : 'current-password'} placeholder="Enter your password" required type="password" minLength={signup ? 12 : 1} value={password} aria-invalid={Boolean(authErrors.password)} aria-describedby={authErrors.password ? 'auth-password-error' : undefined} onChange={(event) => { setPassword(event.target.value); setAuthErrors((current) => ({ ...current, password: undefined })); }} />{authErrors.password && <span className="field-error" id="auth-password-error">{authErrors.password}</span>}</label>
          {signup && <small className="password-hint">Use at least 12 characters for a secure password.</small>}
          <Button variant="auth" type="submit" disabled={submitting}>{submitting ? 'Please wait…' : signup ? 'Create workspace' : 'Sign in'}<span aria-hidden="true">→</span></Button>
        </form>
        <p className="auth-switch">
          {signup ? 'Already have an account?' : 'New to Fieldnotes?'}
          <button type="button" onClick={() => { setMode(signup ? 'login' : 'signup'); setMessage(''); setSignedOut(false); setAuthErrors({}); }}>
            {signup ? 'Sign in' : 'Create a workspace'}
          </button>
        </p>
        <p className="auth-privacy">Your workspace is private to your company.</p>
      </div>
    </section>
  </main>;
}
