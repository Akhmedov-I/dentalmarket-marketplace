import { Controller, Post, Param, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { PaymentsService } from '../services/payments.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '@shared/db/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':orderId/pay')
  @UseGuards(JwtAuthGuard)
  async simulatePayment(
    @Param('orderId') orderId: string,
    @Body('providerPaymentId') providerPaymentId?: string,
  ) {
    const payId = providerPaymentId || `sim_${uuidv4().slice(0, 8)}`;

    return this.prisma.$transaction(async (tx) => {
      return this.paymentsService.capturePayment(tx, orderId, payId);
    });
  }
}
