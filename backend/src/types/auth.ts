export interface JwtPayload {
  // Staff fields (present when type='staff')
  userId?: string;
  roleCode?: string;
  // Customer fields (present when type='customer')
  customerId?: string;
  // Discriminator (always present)
  type: 'staff' | 'customer';
  iat?: number;
  exp?: number;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    roleCode: string;
    roleName: string;
  };
}

export interface RefreshResponse {
  accessToken: string;
}
