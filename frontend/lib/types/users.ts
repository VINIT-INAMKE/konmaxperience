export interface CreateUserDto {
  name: string;
  email: string;
  roleId: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role?: { code: string; name: string };
  roleCode?: string;
  roleName?: string;
  status: 'active' | 'inactive';
  xp_total?: number;
  xpTotal?: number;
  level: number;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
}
