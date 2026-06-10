import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from '../services/notifications.service';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Controller()
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /me/notifications
   * List notifications for the current user.
   * Query params: unreadOnly (boolean), cursor (string), limit (number)
   */
  @Get('me/notifications')
  async getNotifications(
    @CurrentUser() user: JwtPayload,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getForUser(user.sub, {
      unreadOnly: unreadOnly === 'true',
      cursor: cursor || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * PATCH /me/notifications/:id/read
   * Mark a notification as read.
   */
  @Patch('me/notifications/:id/read')
  async markAsRead(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(id, user.sub);
  }

  /**
   * GET /me/notification-preferences
   * Get notification preferences for the current user.
   */
  @Get('me/notification-preferences')
  async getPreferences(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getPreferences(user.sub);
  }

  /**
   * PATCH /me/notification-preferences
   * Update notification preferences for the current user.
   */
  @Patch('me/notification-preferences')
  async updatePreferences(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(user.sub, dto.preferences);
  }
}
