import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';
export const RequiresPermission = (permission: string) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);
