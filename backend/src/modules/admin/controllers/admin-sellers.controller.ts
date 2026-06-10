import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from '../services/admin.service';
import { KycDecisionDto } from '../dto/kyc-decision.dto';
import { SetCommissionDto } from '../dto/set-commission.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Controller('admin/sellers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'compliance')
export class AdminSellersController {
  constructor(private readonly adminService: AdminService) {}

  @Get('pending')
  async getPendingSellers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getPendingSellers({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post(':id/kyc-decision')
  async kycDecision(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: KycDecisionDto,
  ) {
    return this.adminService.kycDecision(user.sub, id, dto);
  }

  @Patch(':id/commission')
  async setCommission(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetCommissionDto,
  ) {
    return this.adminService.setCommission(user.sub, id, dto);
  }
}
