import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompanyUser, ItemCount, MenuItem, OutletMenuItem, Role } from '../types';

type Outlet = { id: string; name: string };
type ApiRequest = <T>(path: string, options?: RequestInit) => Promise<T>;
type ItemsResponse<T> = { items: T[] };

type UseWorkspaceDataOptions = {
  request: ApiRequest;
  role?: Role;
  companyId?: string;
  outletId: string;
  assignmentOutletId: string;
  setMessage: (message: string) => void;
  setMessageIsError: (isError: boolean) => void;
};

const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export function useWorkspaceData({
  request,
  role,
  companyId,
  outletId,
  assignmentOutletId,
  setMessage,
  setMessageIsError
}: UseWorkspaceDataOptions) {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuItemOutlets, setMenuItemOutlets] = useState<Array<Outlet & { price: number }>>([]);
  const [assignmentOutletMenu, setAssignmentOutletMenu] = useState<OutletMenuItem[]>([]);
  const [outletMenu, setOutletMenu] = useState<OutletMenuItem[]>([]);
  const [inventory, setInventory] = useState<ItemCount[]>([]);
  const assignmentRequestId = useRef(0);
  const itemOutletRequestId = useRef(0);

  const loadOutlets = useCallback(async () => {
    if (!companyId) return;
    try {
      const { items } = await request<ItemsResponse<Outlet>>(`/companies/${companyId}/outlets`);
      setOutlets(items);
    } catch (error) {
      setMessage(errorText(error, 'Failed to load outlets'));
      setMessageIsError(true);
    }
  }, [companyId, request, setMessage, setMessageIsError]);

  const loadCompanyUsers = useCallback(async () => {
    if (!companyId) return;
    try {
      const { items } = await request<ItemsResponse<CompanyUser>>(`/companies/${companyId}/users`);
      setCompanyUsers(items);
    } catch (error) {
      setMessage(errorText(error, 'Failed to load users'));
      setMessageIsError(true);
    }
  }, [companyId, request, setMessage, setMessageIsError]);

  const loadMenuItems = useCallback(async () => {
    try {
      const { items } = await request<ItemsResponse<MenuItem>>('/menu-items');
      setMenuItems(items);
    } catch (error) {
      setMessage(errorText(error, 'Failed to load menu'));
      setMessageIsError(true);
    }
  }, [request, setMessage, setMessageIsError]);

  const loadMenuItemOutlets = useCallback(async (menuItemId: string) => {
    const requestId = ++itemOutletRequestId.current;
    if (!menuItemId) {
      setMenuItemOutlets([]);
      return;
    }
    try {
      const { items } = await request<ItemsResponse<Outlet & { price: number }>>(`/menu-items/${menuItemId}/outlets`);
      if (requestId === itemOutletRequestId.current) setMenuItemOutlets(items);
    } catch (error) {
      if (requestId === itemOutletRequestId.current) {
        setMenuItemOutlets([]);
        setMessage(errorText(error, 'Failed to load outlet assignments'));
        setMessageIsError(true);
      }
    }
  }, [request, setMessage, setMessageIsError]);

  const loadOutletMenu = useCallback(async () => {
    if (!outletId) return;
    try {
      const { items } = await request<ItemsResponse<OutletMenuItem>>(`/outlets/${outletId}/menu`);
      setOutletMenu(items);
    } catch (error) {
      setMessage(errorText(error, 'Failed to load outlet menu'));
      setMessageIsError(true);
    }
  }, [outletId, request, setMessage, setMessageIsError]);

  const loadAssignmentOutletMenu = useCallback(async () => {
    const requestId = ++assignmentRequestId.current;
    if (!assignmentOutletId) {
      setAssignmentOutletMenu([]);
      return;
    }
    try {
      const { items } = await request<ItemsResponse<OutletMenuItem>>(`/outlets/${assignmentOutletId}/menu`);
      if (requestId === assignmentRequestId.current) setAssignmentOutletMenu(items);
    } catch (error) {
      if (requestId === assignmentRequestId.current) {
        setAssignmentOutletMenu([]);
        setMessage(errorText(error, 'Failed to load outlet menu'));
        setMessageIsError(true);
      }
    }
  }, [assignmentOutletId, request, setMessage, setMessageIsError]);

  const loadInventory = useCallback(async () => {
    if (!outletId) return;
    try {
      const { items } = await request<ItemsResponse<ItemCount>>(`/outlets/${outletId}/inventory`);
      setInventory(items);
    } catch (error) {
      setMessage(errorText(error, 'Failed to load inventory'));
      setMessageIsError(true);
    }
  }, [outletId, request, setMessage, setMessageIsError]);

  useEffect(() => {
    if (role === 'HQ') {
      void loadOutlets();
      void loadMenuItems();
      void loadCompanyUsers();
    } else {
      setOutlets([]);
      setCompanyUsers([]);
      setMenuItems([]);
      setMenuItemOutlets([]);
    }
  }, [role, companyId, loadOutlets, loadMenuItems, loadCompanyUsers]);

  useEffect(() => {
    if (role === 'HQ') void loadAssignmentOutletMenu();
    else setAssignmentOutletMenu([]);
  }, [role, assignmentOutletId, companyId, loadAssignmentOutletMenu]);

  useEffect(() => {
    setOutletMenu([]);
    setInventory([]);
    if (outletId) {
      void loadOutletMenu();
      void loadInventory();
    }
  }, [outletId, loadOutletMenu, loadInventory]);

  return {
    outlets,
    companyUsers,
    menuItems,
    menuItemOutlets,
    assignmentOutletMenu,
    outletMenu,
    inventory,
    loadOutlets,
    loadCompanyUsers,
    loadMenuItems,
    loadMenuItemOutlets,
    loadOutletMenu,
    loadAssignmentOutletMenu,
    loadInventory
  };
}
