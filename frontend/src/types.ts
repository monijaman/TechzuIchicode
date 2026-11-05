export type Role = 'HQ' | 'OUTLET';

export type Session = {
  accessToken: string;
  refreshToken: string;
  role: Role;
  companyId: string;
  outletId?: string;
  companyName?: string;
};

export type AuthUser = { role: Role; companyId: string; outletId?: string | null };
export type AuthResponse = {
  user: AuthUser;
  company?: { name: string };
  tokens: { accessToken: string; refreshToken: string };
};
export type MenuItem = { id: string; name: string; basePrice: number };
export type OutletMenuItem = { id: string; name: string; price: number };
export type ItemCount = { menuItemId: string; name: string; quantity: number };
export type OutletSalesReport = {
  outletId: string;
  outletName: string;
  totalRevenue: number;
  topItems: ItemCount[];
};
export type CompanyUser = {
  id: string;
  email: string;
  role: Role;
  outletId: string | null;
  isActive: boolean;
  createdAt: string;
  outlet: { name: string } | null;
};
export type ApiErrorDetails = Array<{ path: string; message: string }>;
