import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { NotificationPrefsController } from './notification-prefs.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController, NotificationPrefsController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
