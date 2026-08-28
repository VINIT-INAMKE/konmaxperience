import { Body, Controller, Patch, Req } from '@nestjs/common';
import express from 'express';
import { UsersService } from './users.service';
import { UpdateNotificationPrefsDto } from './dto/notification-prefs.dto';

/**
 * RUN-01 — a person's own contactability, on `/me` rather than on `/users/:id`.
 *
 * It carries **no** `@RequiresPermission` on purpose. `/users/:id` is gated
 * behind `MANAGE_RBAC` because it can rename and deactivate anyone; consenting
 * to be messaged on WhatsApp — and withdrawing that consent — belongs to the
 * person, not to an administrator, and a channel you cannot switch off yourself
 * is not a channel you have opted into. The JWT guard is the whole gate, and
 * the id is read from the verified token, so this route has no addressable
 * subject other than the caller.
 *
 * It lives beside `MeController` rather than inside it because the user columns
 * and their validation belong to `src/users`; Nest routes both controllers
 * under `/me` with no conflict.
 */
@Controller('me')
export class NotificationPrefsController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('notification-prefs')
  async update(
    @Req() request: express.Request,
    @Body() dto: UpdateNotificationPrefsDto,
  ) {
    const currentUser = (request as any).user;
    return this.usersService.updateNotificationPrefs(currentUser.id, {
      phone: dto.phone,
      whatsapp_opt_in: dto.whatsapp_opt_in,
    });
  }
}
