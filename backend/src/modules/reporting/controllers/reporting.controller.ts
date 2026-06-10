import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportingService, DateRange } from '../services/reporting.service';
import { DateRangeQueryDto } from '../dto/date-range-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  // ---------------------------------------------------------------------------
  // SELLER REPORTS
  // ---------------------------------------------------------------------------

  /**
   * GET /seller/reports/sales
   * Sales summary for the authenticated seller.
   */
  @Get('seller/reports/sales')
  @Roles('seller')
  async getSellerSales(
    @CurrentUser() user: JwtPayload,
    @Query() query: DateRangeQueryDto,
  ) {
    const dateRange = this.parseDateRange(query);
    const report = await this.reportingService.getSellerFinancials(user.sub, dateRange);
    return {
      grossSales: report.grossSales,
      totalUnits: report.totalUnits,
      orderItemCount: report.orderItemCount,
      averageOrderValue: report.averageOrderValue,
      dateRange: report.dateRange,
    };
  }

  /**
   * GET /seller/reports/financials
   * Full financial report for the authenticated seller.
   */
  @Get('seller/reports/financials')
  @Roles('seller')
  async getSellerFinancials(
    @CurrentUser() user: JwtPayload,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.reportingService.getSellerFinancials(user.sub, this.parseDateRange(query));
  }

  // ---------------------------------------------------------------------------
  // CUSTOMER REPORTS
  // ---------------------------------------------------------------------------

  /**
   * GET /me/reports/orders
   * Order history and refund summary for the current user.
   */
  @Get('me/reports/orders')
  async getCustomerOrders(
    @CurrentUser() user: JwtPayload,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.reportingService.getCustomerFinancials(user.sub, this.parseDateRange(query));
  }

  // ---------------------------------------------------------------------------
  // ADMIN / FINANCE REPORTS
  // ---------------------------------------------------------------------------

  /**
   * GET /admin/reports/revenue
   * Platform net revenue report.
   */
  @Get('admin/reports/revenue')
  @Roles('admin', 'finance')
  async getRevenueReport(@Query() query: DateRangeQueryDto) {
    const report = await this.reportingService.getPlatformFinancials(this.parseDateRange(query));
    return {
      netRevenue: report.netRevenue,
      takeRateBps: report.takeRateBps,
      transactionCount: report.transactionCount,
      dateRange: report.dateRange,
    };
  }

  /**
   * GET /admin/reports/gmv
   * Gross merchandise value report.
   */
  @Get('admin/reports/gmv')
  @Roles('admin', 'finance')
  async getGmvReport(@Query() query: DateRangeQueryDto) {
    const report = await this.reportingService.getPlatformFinancials(this.parseDateRange(query));
    return {
      gmv: report.gmv,
      transactionCount: report.transactionCount,
      totalRefunds: report.totalRefunds,
      refundCount: report.refundCount,
      dateRange: report.dateRange,
    };
  }

  /**
   * GET /admin/reports/platform-health
   * Overall platform health metrics.
   */
  @Get('admin/reports/platform-health')
  @Roles('admin')
  async getPlatformHealth(@Query() query: DateRangeQueryDto) {
    return this.reportingService.getPlatformFinancials(this.parseDateRange(query));
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private parseDateRange(query: DateRangeQueryDto): DateRange {
    return {
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };
  }
}
