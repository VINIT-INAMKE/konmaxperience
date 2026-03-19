export interface CreateUserDto {
  name: string;
  email: string;
  roleId: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  roleCode: string;
  roleName: string;
  status: 'active' | 'inactive';
  xpTotal: number;
  level: number;
  createdAt: string;
}
