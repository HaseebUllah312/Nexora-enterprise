import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('notifications')
@UseGuards(RolesGuard)
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get() findMine(@CurrentUser() user: any) { return this.service.findForUser(user.userId); }
  @Get('unread-count') unreadCount(@CurrentUser() user: any) { return this.service.unreadCount(user.userId); }
  @Patch(':id/read') markRead(@Param('id') id: string) { return this.service.markRead(id); }
  @Patch('read-all') markAllRead(@CurrentUser() user: any) { return this.service.markAllRead(user.userId); }
}
