import { useMemo, useState, type FormEvent } from 'react';
import { ApiRequestError } from '../services/apiClient';
import type { CompanyUser, Role } from '../types';

type Outlet = { id: string; name: string };
type UserErrors = { email?: string; password?: string; role?: string };
type ApiRequest = <T>(path: string, options?: RequestInit) => Promise<T>;

type UseUserManagementOptions = {
  companyId?: string;
  workingOutletId: string;
  outlets: Outlet[];
  users: CompanyUser[];
  request: ApiRequest;
  reloadUsers: () => Promise<void>;
};

function validateEmail(value: string) {
  if (!value.trim()) return 'Enter the user’s email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email address.';
  return undefined;
}

function validatePassword(value: string) {
  if (!value) return 'Enter a temporary password.';
  if (value.length < 12) return 'Use at least 12 characters.';
  if (value.length > 128) return 'Use no more than 128 characters.';
  return undefined;
}

const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export function useUserManagement({
  companyId,
  workingOutletId,
  outlets,
  users,
  request,
  reloadUsers
}: UseUserManagementOptions) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('HQ');
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState<UserErrors>({});
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL');
  const [outletFilter, setOutletFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [editingUserId, setEditingUserId] = useState('');
  const [editingOutletId, setEditingOutletId] = useState('');
  const [updatingOutlet, setUpdatingOutlet] = useState(false);

  const filteredUsers = useMemo(() => users.filter((user) => {
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
    const matchesOutlet = outletFilter === 'ALL' || user.outletId === outletFilter;
    const matchesSearch = user.email.toLowerCase().includes(search.trim().toLowerCase());
    return matchesRole && matchesOutlet && matchesSearch;
  }), [users, roleFilter, outletFilter, search]);

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccess('');
    setError('');

    const nextErrors: UserErrors = {};
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError) nextErrors.email = emailError;
    if (passwordError) nextErrors.password = passwordError;
    if (role === 'OUTLET' && !workingOutletId) {
      nextErrors.role = 'Choose a working outlet before creating an outlet user.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!companyId) {
      setError('Your company session is unavailable. Sign in again and retry.');
      return;
    }

    setCreating(true);
    try {
      await request(`/companies/${companyId}/users`, {
        signal: AbortSignal.timeout(20000),
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          role,
          ...(role === 'OUTLET' && { outletId: workingOutletId })
        })
      });
      setEmail('');
      setPassword('');
      setErrors({});
      setSuccess('User created successfully.');
      await reloadUsers();
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        const emailValidation = requestError.details?.find((detail) => detail.path === 'email');
        if (requestError.code === 'EMAIL_ALREADY_EXISTS') {
          setErrors((current) => ({ ...current, email: 'An account with this email already exists.' }));
        } else if (emailValidation) {
          setErrors((current) => ({ ...current, email: emailValidation.message }));
        } else {
          setError(requestError.message);
        }
      } else if (requestError instanceof DOMException && requestError.name === 'TimeoutError') {
        setError('The request took too long. Check your connection and try again.');
      } else if (requestError instanceof TypeError) {
        setError('Could not reach the server. Check your connection and try again.');
      } else {
        setError(errorText(requestError, 'Failed to create user.'));
      }
    } finally {
      setCreating(false);
    }
  };

  const onUpdateOutlet = async (event: FormEvent<HTMLFormElement>, userId: string) => {
    event.preventDefault();
    setSuccess('');
    setError('');
    if (!companyId) {
      setError('Your company session is unavailable. Sign in again and retry.');
      return;
    }

    setUpdatingOutlet(true);
    try {
      await request(`/companies/${companyId}/users/${userId}/outlet`, {
        method: 'PUT',
        body: JSON.stringify({ outletId: editingOutletId })
      });
      setEditingUserId('');
      setSuccess('User outlet updated successfully.');
      await reloadUsers();
    } catch (requestError) {
      setError(errorText(requestError, 'Failed to update user outlet.'));
    } finally {
      setUpdatingOutlet(false);
    }
  };

  return {
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
    onEmailChange: (value: string) => {
      setEmail(value);
      setErrors((current) => ({ ...current, email: current.email ? validateEmail(value) : undefined }));
      setError('');
      setSuccess('');
    },
    onEmailBlur: () => setErrors((current) => ({ ...current, email: validateEmail(email) })),
    onPasswordChange: (value: string) => {
      setPassword(value);
      setErrors((current) => ({ ...current, password: current.password ? validatePassword(value) : undefined }));
      setError('');
      setSuccess('');
    },
    onPasswordBlur: () => setErrors((current) => ({ ...current, password: validatePassword(password) })),
    onRoleChange: (value: Role) => {
      setRole(value);
      setErrors((current) => ({ ...current, role: undefined }));
      setError('');
      setSuccess('');
    },
    onRoleBlur: () => setErrors((current) => ({
      ...current,
      role: role === 'OUTLET' && !workingOutletId ? 'Choose a working outlet before creating an outlet user.' : undefined
    })),
    onWorkingOutletAvailable: () => setErrors((current) => ({ ...current, role: undefined })),
    onSearchChange: setSearch,
    onRoleFilterChange: setRoleFilter,
    onOutletFilterChange: setOutletFilter,
    onStartEditingOutlet: (user: CompanyUser) => {
      setEditingUserId(user.id);
      setEditingOutletId(user.outletId ?? '');
    },
    onEditingOutletChange: setEditingOutletId,
    onCancelEditingOutlet: () => setEditingUserId(''),
    onUpdateOutlet
  };
}
