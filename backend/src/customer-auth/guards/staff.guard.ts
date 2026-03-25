import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class StaffGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user || user.type !== 'staff') {
      throw err || new UnauthorizedException('Staff authentication required');
    }
    return user;
  }
}
