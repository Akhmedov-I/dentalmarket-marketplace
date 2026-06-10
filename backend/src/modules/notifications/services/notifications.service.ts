import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@shared/db/prisma.service';
import { NotifChannel, NotifStatus } from '@prisma/client';

export interface SendNotificationOptions {
  userId: string;
  channel: NotifChannel;
  templateKey: string;
  payload: Record<string, unknown>;
}

export interface GetNotificationsOptions {
  unreadOnly?: boolean;
  cursor?: string;
  limit?: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a notification record and dispatch to the appropriate channel.
   * For in_app: persisted in DB with status 'delivered'.
   * For email/sms/push: logged to console (placeholder) and marked 'sent'.
   */
  async send(options: SendNotificationOptions) {
    const { userId, channel, templateKey, payload } = options;

    const status = channel === NotifChannel.in_app
      ? NotifStatus.delivered
      : NotifStatus.sent;

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        channel,
        templateKey,
        payload: payload as any,
        status,
        sentAt: new Date(),
      },
    });

    // Dispatch to channel
    switch (channel) {
      case NotifChannel.in_app:
        // Already persisted — nothing else to do
        this.logger.log(`[in_app] Notification ${notification.id} delivered to user ${userId}`);
        break;

      case NotifChannel.email:
        // TODO: integrate real email provider (SendGrid, SES, etc.)
        this.logger.log(
          `[email] Would send "${templateKey}" to user ${userId} | payload: ${JSON.stringify(payload)}`,
        );
        break;

      case NotifChannel.sms:
        // TODO: integrate real SMS provider (Twilio, Eskiz, etc.)
        this.logger.log(
          `[sms] Would send "${templateKey}" to user ${userId} | payload: ${JSON.stringify(payload)}`,
        );
        break;

      case NotifChannel.push:
        // TODO: integrate push provider (FCM, APNs, etc.)
        this.logger.log(
          `[push] Would send "${templateKey}" to user ${userId} | payload: ${JSON.stringify(payload)}`,
        );
        break;
    }

    return notification;
  }

  /**
   * List notifications for a user, optionally filtering to unread only,
   * with cursor-based pagination.
   */
  async getForUser(userId: string, options: GetNotificationsOptions = {}) {
    const { unreadOnly = false, cursor, limit = 20 } = options;

    const where: any = { userId };

    if (unreadOnly) {
      where.readAt = null;
      where.status = { not: NotifStatus.read };
    }

    const take = Math.min(limit, 100);

    const queryArgs: any = {
      where,
      orderBy: { createdAt: 'desc' as const },
      take: take + 1, // fetch one extra to determine hasMore
    };

    if (cursor) {
      queryArgs.cursor = { id: cursor };
      queryArgs.skip = 1; // skip the cursor record itself
    }

    const notifications = await this.prisma.notification.findMany(queryArgs);

    const hasMore = notifications.length > take;
    const items = hasMore ? notifications.slice(0, take) : notifications;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return { items, nextCursor, hasMore };
  }

  /**
   * Mark a notification as read. Only the owning user may do this.
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('You cannot mark another user\'s notification as read');
    }

    if (notification.readAt) {
      return notification; // already read — idempotent
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotifStatus.read,
        readAt: new Date(),
      },
    });
  }

  /**
   * Get notification preferences for a user.
   */
  async getPreferences(userId: string) {
    return this.prisma.notificationPreference.findMany({
      where: { userId },
      orderBy: { category: 'asc' },
    });
  }

  /**
   * Upsert notification preferences for a user.
   * Each preference is a category + enabled flag.
   */
  async updatePreferences(
    userId: string,
    prefs: Array<{ category: string; enabled: boolean }>,
  ) {
    const upserts = prefs.map((pref) =>
      this.prisma.notificationPreference.upsert({
        where: {
          userId_category: {
            userId,
            category: pref.category,
          },
        },
        create: {
          userId,
          category: pref.category,
          enabled: pref.enabled,
        },
        update: {
          enabled: pref.enabled,
        },
      }),
    );

    return this.prisma.$transaction(upserts);
  }
}
