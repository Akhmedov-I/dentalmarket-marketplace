import { Controller, Post, Get, Delete, Body, Param, UploadedFile, UseInterceptors, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CertificationService } from '../services/certification.service';
import { UploadCertDto } from '../dto/upload-cert.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '@shared/db/prisma.service';
import { UnauthorizedException } from '@nestjs/common';

@Controller('certifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('seller')
export class CertificationController {
  constructor(
    private readonly certService: CertificationService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: any,
    @Body() dto: UploadCertDto,
  ) {
    return this.certService.uploadCertificate(user.sub, file, dto);
  }

  @Get()
  async getMyCertifications(@CurrentUser() user: JwtPayload) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId: user.sub },
    });
    if (!seller) {
      throw new UnauthorizedException('Seller profile not found');
    }
    return this.certService.getSellerCertifications(seller.id);
  }

  @Delete(':id')
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId: user.sub },
    });
    if (!seller) {
      throw new UnauthorizedException('Seller profile not found');
    }
    return this.certService.deleteCertificate(seller.id, id);
  }
}
