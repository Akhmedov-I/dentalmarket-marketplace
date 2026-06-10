import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { CatalogService } from '../services/catalog.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'compliance')
export class AdminCatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('pending')
  async getPending() {
    return this.catalogService.getPendingModerationList();
  }

  @Post(':id/moderate')
  async moderate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('decision') decision: 'approve' | 'reject',
  ) {
    return this.catalogService.moderateProduct(user.sub, id, decision);
  }
}
