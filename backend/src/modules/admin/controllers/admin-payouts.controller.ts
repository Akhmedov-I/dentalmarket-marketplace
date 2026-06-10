import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from '../services/admin.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Controller('admin/payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'finance')
export class AdminPayoutsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async listPayouts(
    @Query('status') status?: string,
    @Query('sellerId') sellerId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listPayouts({
      status,
      sellerId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post(':id/approve')
  async approvePayout(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.adminService.approvePayout(user.sub, id);
  }
}
