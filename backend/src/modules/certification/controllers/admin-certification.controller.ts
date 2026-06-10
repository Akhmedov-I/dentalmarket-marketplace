import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { CertificationService } from '../services/certification.service';
import { VerifyCertDto } from '../dto/verify-cert.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Controller('admin/certifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'compliance')
export class AdminCertificationController {
  constructor(private readonly certService: CertificationService) {}

  @Get('pending')
  async getPending() {
    return this.certService.getPendingCertifications();
  }

  @Post(':id/verify')
  async verify(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: VerifyCertDto,
  ) {
    return this.certService.verifyCertificate(user.sub, id, dto);
  }
}
