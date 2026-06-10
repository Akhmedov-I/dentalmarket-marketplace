import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { DisputesService } from '../services/disputes.service';
import { CreateDisputeDto } from '../dto/create-dispute.dto';
import { CreateMessageDto } from '../dto/create-message.dto';
import { ResolveDisputeDto } from '../dto/resolve-dispute.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Controller('disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @Roles('customer')
  async raiseDispute(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDisputeDto,
  ) {
    return this.disputesService.raiseDispute(user.sub, dto);
  }

  @Get()
  async getDisputes(@CurrentUser() user: JwtPayload) {
    return this.disputesService.getDisputes(user.sub, user.roles);
  }

  @Get(':id')
  async getDisputeDetails(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.disputesService.getDisputeDetails(user.sub, user.roles, id);
  }

  @Post(':id/messages')
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.disputesService.sendMessage(user.sub, user.roles, id, dto.body);
  }

  @Post(':id/resolve')
  @Roles('admin', 'support')
  async resolveDispute(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputesService.resolveDispute(user.sub, id, dto);
  }
}
