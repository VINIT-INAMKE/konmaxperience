export interface JwtPayload {
  userId: string;
  roleCode: string;
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
    permissions: string[];
    xp_total: number;
    level: number;
  };
}

export interface RefreshResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    roleCode: string;
    roleName: string;
    permissions: string[];
    xp_total: number;
    level: number;
  };
}
