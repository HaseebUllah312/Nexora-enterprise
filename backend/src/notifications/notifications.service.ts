import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // Called internally by other services to push a notification
  async push(userId: string | null, type: string, title: string, message: string) {
    return this.prisma.notification.create({
      data: { userId, type: type as any, title, message },
    });
  }

  findForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { OR: [{ userId }, { userId: null }] }, // null = broadcast to all
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { OR: [{ userId }, { userId: null }], isRead: false },
    });
  }

  markRead(id: string) {
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
