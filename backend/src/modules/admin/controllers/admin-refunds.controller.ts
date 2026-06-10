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
import { RefundDecisionDto } from '../dto/refund-decision.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Controller('admin/refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'finance')
export class AdminRefundsController {
  constructor(private readonly adminService: AdminService) {}

  @Get('pending')
  async listPendingRefunds(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listPendingRefunds({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post(':id/decision')
  async refundDecision(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RefundDecisionDto,
  ) {
    return this.adminService.refundDecision(user.sub, id, dto);
  }
}
