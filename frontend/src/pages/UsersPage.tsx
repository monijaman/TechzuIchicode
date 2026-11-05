import type { FormEvent } from 'react';
import type { CompanyUser, Role } from '../types';
import { PageHeading } from '../components/molecules/PageHeading';
import { Button } from '../components/atoms/Button';

type Outlet = { id: string; name: string };
type UserErrors = { email?: string; password?: string; role?: string };

type UsersPageProps = {
  outlets: Outlet[];
  workingOutletId: string;
  success: string;
  error: string;
  email: string;
  password: string;
  role: Role;
  errors: UserErrors;
  creating: boolean;
  users: CompanyUser[];
  filteredUsers: CompanyUser[];
  roleFilter: 'ALL' | Role;
  outletFilter: string;
  search: string;
  editingUserId: string;
  editingOutletId: string;
  updatingOutlet: boolean;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onEmailChange: (value: string) => void;
  onEmailBlur: () => void;
  onPasswordChange: (value: string) => void;
  onPasswordBlur: () => void;
  onRoleChange: (role: Role) => void;
  onRoleBlur: () => void;
  onSearchChange: (value: string) => void;
  onRoleFilterChange: (role: 'ALL' | Role) => void;
  onOutletFilterChange: (outletId: string) => void;
  onStartEditingOutlet: (user: CompanyUser) => void;
  onEditingOutletChange: (outletId: string) => void;
  onCancelEditingOutlet: () => void;
  onUpdateOutlet: (event: FormEvent<HTMLFormElement>, userId: string) => void;
};

export function UsersPage({
  outlets,
  workingOutletId,
  success,
  error,
  email,
  password,
  role,
  errors,
  creating,
  users,
  filteredUsers,
  roleFilter,
  outletFilter,
  search,
  editingUserId,
  editingOutletId,
  updatingOutlet,
  onCreate,
  onEmailChange,
  onEmailBlur,
  onPasswordChange,
  onPasswordBlur,
  onRoleChange,
  onRoleBlur,
  onSearchChange,
  onRoleFilterChange,
  onOutletFilterChange,
  onStartEditingOutlet,
  onEditingOutletChange,
  onCancelEditingOutlet,
  onUpdateOutlet
}: UsersPageProps) {
  return <div className="page-content">
    <PageHeading eyebrow="Team access" title="Users" />
    <section className="content-card">
      <h3>Create a user</h3>
      <p className="muted">Add a head office user or give an outlet team member access to the working outlet.</p>
      {success && <p className="success-message" role="status">{success}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <form noValidate onSubmit={onCreate}>
        <label htmlFor="new-user-email">Email<input id="new-user-email" name="email" autoComplete="email" required type="email" value={email} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'new-user-email-error' : undefined} onBlur={onEmailBlur} onChange={(event) => onEmailChange(event.target.value)} />{errors.email && <span className="field-error" id="new-user-email-error">{errors.email}</span>}</label>
        <label htmlFor="new-user-password">Temporary password<input id="new-user-password" name="new-password" autoComplete="new-password" required minLength={12} maxLength={128} type="password" value={password} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'new-user-password-error' : undefined} onBlur={onPasswordBlur} onChange={(event) => onPasswordChange(event.target.value)} />{errors.password && <span className="field-error" id="new-user-password-error">{errors.password}</span>}</label>
        <label htmlFor="new-user-role">Role<select id="new-user-role" value={role} aria-invalid={Boolean(errors.role && !workingOutletId)} aria-describedby={errors.role && !workingOutletId ? 'new-user-role-error' : undefined} onBlur={onRoleBlur} onChange={(event) => onRoleChange(event.target.value as Role)}><option value="HQ">HQ</option><option value="OUTLET">Outlet (working outlet)</option></select>{errors.role && !workingOutletId && <span className="field-error" id="new-user-role-error">{errors.role}</span>}</label>
        <Button type="submit" disabled={creating}>{creating ? 'Creating user…' : 'Create user'}</Button>
      </form>
    </section>
    <section className="content-card">
      <div className="outlet-card-heading">
        <div><h3>Team directory</h3><p className="muted">All users in your company.</p></div>
        <span className="count-badge">{filteredUsers.length} of {users.length}</span>
      </div>
      <div className="form-grid user-filters">
        <label htmlFor="user-search">Search by email<input id="user-search" type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search users" /></label>
        <label htmlFor="user-role-filter">Role<select id="user-role-filter" value={roleFilter} onChange={(event) => onRoleFilterChange(event.target.value as 'ALL' | Role)}>
          <option value="ALL">All roles</option>
          <option value="HQ">HQ</option>
          <option value="OUTLET">Outlet</option>
        </select></label>
        <label htmlFor="user-outlet-filter">Outlet<select id="user-outlet-filter" value={outletFilter} onChange={(event) => onOutletFilterChange(event.target.value)}>
          <option value="ALL">All outlets</option>
          {outlets.map((outlet) => <option value={outlet.id} key={outlet.id}>{outlet.name}</option>)}
        </select></label>
      </div>
      {filteredUsers.length > 0
        ? <ul className="item-list user-directory">{filteredUsers.map((user) => <li key={user.id}>
          <span><strong>{user.email}{user.role === 'OUTLET' && <small> · {user.outlet?.name ?? 'Outlet not assigned'}</small>}</strong><small>{user.role === 'HQ' ? 'Head office' : 'Outlet'} · {user.isActive ? 'Active' : 'Inactive'}</small></span>
          <div className="user-directory-actions">
            <small>Added {new Date(user.createdAt).toLocaleDateString()}</small>
            {user.role === 'OUTLET' && (editingUserId === user.id
              ? <form className="user-outlet-edit" onSubmit={(event) => onUpdateOutlet(event, user.id)}>
                <label htmlFor={`user-outlet-${user.id}`}>Outlet<select id={`user-outlet-${user.id}`} value={editingOutletId} onChange={(event) => onEditingOutletChange(event.target.value)} required>
                  {outlets.map((outlet) => <option value={outlet.id} key={outlet.id}>{outlet.name}</option>)}
                </select></label>
                <Button type="submit" disabled={updatingOutlet || editingOutletId === user.outletId}>{updatingOutlet ? 'Saving…' : 'Save'}</Button>
                <Button type="button" variant="secondary" onClick={onCancelEditingOutlet} disabled={updatingOutlet}>Cancel</Button>
              </form>
              : <Button type="button" variant="secondary" onClick={() => onStartEditingOutlet(user)}>Change outlet</Button>)}
          </div>
        </li>)}</ul>
        : <p className="empty-state">{users.length ? 'No users match these filters.' : 'No users found.'}</p>}
    </section>
  </div>;
}
