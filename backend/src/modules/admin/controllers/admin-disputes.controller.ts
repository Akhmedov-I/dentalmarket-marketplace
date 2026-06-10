import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from '../services/admin.service';
import { AssignDisputeDto } from '../dto/assign-dispute.dto';
import { AdminResolveDisputeDto } from '../dto/admin-resolve-dispute.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Controller('admin/disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'support')
export class AdminDisputesController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async listDisputes(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('assignedAdminId') assignedAdminId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listDisputes({
      status,
      type,
      assignedAdminId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post(':id/assign')
  async assignDispute(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AssignDisputeDto,
  ) {
    return this.adminService.assignDispute(user.sub, id, dto);
  }

  @Post(':id/resolve')
  async resolveDispute(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdminResolveDisputeDto,
  ) {
    return this.adminService.resolveDispute(user.sub, id, dto);
  }
}
