import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from '../services/admin.service';
import { CreateStandardDto } from '../dto/create-standard.dto';
import { UpdateStandardDto } from '../dto/update-standard.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Controller('admin/standards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminStandardsController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  async createStandard(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateStandardDto,
  ) {
    return this.adminService.createStandard(user.sub, dto);
  }

  @Patch(':id')
  async updateStandard(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStandardDto,
  ) {
    return this.adminService.updateStandard(user.sub, id, dto);
  }
}
