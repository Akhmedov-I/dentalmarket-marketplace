import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { OrdersService } from '../services/orders.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateShipmentDto } from '../dto/update-shipment.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createOrder(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(user.sub, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMyOrders(@CurrentUser() user: JwtPayload) {
    return this.ordersService.getBuyerOrders(user.sub);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getOrderDetails(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.ordersService.getOrderDetails(user.sub, id);
  }

  @Post(':id/confirm-delivery')
  @UseGuards(JwtAuthGuard)
  async confirmDelivery(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.ordersService.confirmDelivery(user.sub, id);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.ordersService.cancelOrder(user.sub, id);
  }

  // Shipment updates by seller or admin (for simplicity, we can let it be accessible)
  @Patch(':id/shipment')
  @UseGuards(JwtAuthGuard)
  async updateShipment(
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto,
  ) {
    return this.ordersService.updateShipment(id, dto);
  }
}
