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
  };
}

export interface RefreshResponse {
  accessToken: string;
}
