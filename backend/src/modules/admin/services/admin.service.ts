import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@shared/db/prisma.service';
import { Prisma } from '@prisma/client';
import { KycStatus, SellerStatus, DisputeStatus, UserStatus } from '@prisma/client';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';
import { KycDecisionDto } from '../dto/kyc-decision.dto';
import { SetCommissionDto } from '../dto/set-commission.dto';
import { AssignDisputeDto } from '../dto/assign-dispute.dto';
import { AdminResolveDisputeDto } from '../dto/admin-resolve-dispute.dto';
import { RefundDecisionDto } from '../dto/refund-decision.dto';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CreateStandardDto } from '../dto/create-standard.dto';
import { UpdateStandardDto } from '../dto/update-standard.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // USER MANAGEMENT
  // ============================================================

  async searchUsers(query: {
    email?: string;
    status?: string;
    role?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (query.email) {
      where.email = { contains: query.email, mode: 'insensitive' };
    }
    if (query.status) {
      where.status = query.status as UserStatus;
    }
    if (query.role) {
      where.userRoles = { some: { role: { name: query.role } } };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          phone: true,
          status: true,
          mfaEnabled: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
          createdAt: true,
          userRoles: {
            include: { role: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, total, page, limit };
  }

  async updateUserStatus(actorId: string, userId: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const previousStatus = user.status;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { status: dto.status },
        select: {
          id: true,
          email: true,
          status: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: `user.status_changed`,
          entityType: 'User',
          entityId: userId,
          before: { status: previousStatus },
          after: { status: dto.status, reason: dto.reason },
        },
      });

      return updated;
    });
  }

  async resetUserMfa(actorId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled for this user');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
        },
        select: {
          id: true,
          email: true,
          mfaEnabled: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'user.mfa_reset',
          entityType: 'User',
          entityId: userId,
          before: { mfaEnabled: true },
          after: { mfaEnabled: false },
        },
      });

      return updated;
    });
  }

  // ============================================================
  // SELLER / KYC MANAGEMENT
  // ============================================================

  async getPendingSellers(query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where = { kycStatus: KycStatus.pending };

    const [sellers, total] = await Promise.all([
      this.prisma.sellerProfile.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, email: true, phone: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.sellerProfile.count({ where }),
    ]);

    return { data: sellers, total, page, limit };
  }

  async kycDecision(actorId: string, sellerId: string, dto: KycDecisionDto) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { id: sellerId },
    });
    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }
    if (seller.kycStatus !== KycStatus.pending) {
      throw new BadRequestException(
        `Cannot review KYC in current status: ${seller.kycStatus}`,
      );
    }

    const newKycStatus =
      dto.decision === 'approved' ? KycStatus.approved : KycStatus.rejected;
    const newSellerStatus =
      dto.decision === 'approved' ? SellerStatus.active : SellerStatus.onboarding;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.sellerProfile.update({
        where: { id: sellerId },
        data: {
          kycStatus: newKycStatus,
          kycReviewedBy: actorId,
          status: newSellerStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: `seller.kyc_${dto.decision}`,
          entityType: 'SellerProfile',
          entityId: sellerId,
          before: { kycStatus: seller.kycStatus, status: seller.status },
          after: {
            kycStatus: newKycStatus,
            status: newSellerStatus,
            reason: dto.reason || null,
          },
        },
      });

      return updated;
    });
  }

  async setCommission(actorId: string, sellerId: string, dto: SetCommissionDto) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { id: sellerId },
    });
    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    const previousBps = seller.commissionRateBps;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.sellerProfile.update({
        where: { id: sellerId },
        data: { commissionRateBps: dto.commissionRateBps },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'seller.commission_updated',
          entityType: 'SellerProfile',
          entityId: sellerId,
          before: { commissionRateBps: previousBps },
          after: { commissionRateBps: dto.commissionRateBps },
        },
      });

      return updated;
    });
  }

  // ============================================================
  // DISPUTES
  // ============================================================

  async listDisputes(query: {
    status?: string;
    type?: string;
    assignedAdminId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status as DisputeStatus;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.assignedAdminId) {
      where.assignedAdminId = query.assignedAdminId;
    }

    const [disputes, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        skip,
        take: limit,
        include: {
          order: { select: { id: true, orderNumber: true } },
          raiser: { select: { id: true, email: true } },
          againstSeller: { select: { id: true, legalName: true } },
          assignedAdmin: { select: { id: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return { data: disputes, total, page, limit };
  }

  async assignDispute(actorId: string, disputeId: string, dto: AssignDisputeDto) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Verify the target admin user exists
    const adminUser = await this.prisma.user.findUnique({
      where: { id: dto.adminId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!adminUser) {
      throw new NotFoundException('Admin user not found');
    }

    const hasAdminRole = adminUser.userRoles.some(
      (ur) => ur.role.name === 'admin' || ur.role.name === 'support',
    );
    if (!hasAdminRole) {
      throw new BadRequestException('Target user does not have admin or support role');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.dispute.update({
        where: { id: disputeId },
        data: {
          assignedAdminId: dto.adminId,
          status:
            dispute.status === DisputeStatus.open
              ? DisputeStatus.under_review
              : dispute.status,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'dispute.assigned',
          entityType: 'Dispute',
          entityId: disputeId,
          before: { assignedAdminId: dispute.assignedAdminId },
          after: { assignedAdminId: dto.adminId },
        },
      });

      return updated;
    });
  }

  async resolveDispute(
    actorId: string,
    disputeId: string,
    dto: AdminResolveDisputeDto,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const terminalStatuses: DisputeStatus[] = [
      DisputeStatus.resolved_release,
      DisputeStatus.resolved_partial_refund,
      DisputeStatus.resolved_full_refund,
      DisputeStatus.closed,
    ];
    if (terminalStatuses.includes(dispute.status)) {
      throw new BadRequestException('Dispute is already resolved or closed');
    }

    const statusMap: Record<string, DisputeStatus> = {
      release: DisputeStatus.resolved_release,
      partial_refund: DisputeStatus.resolved_partial_refund,
      full_refund: DisputeStatus.resolved_full_refund,
    };
    const newStatus = statusMap[dto.decision];

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: newStatus,
          resolutionNotes: dto.notes,
          resolvedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: `dispute.resolved_${dto.decision}`,
          entityType: 'Dispute',
          entityId: disputeId,
          before: { status: dispute.status },
          after: { status: newStatus, notes: dto.notes },
        },
      });

      return updated;
    });
  }

  // ============================================================
  // REFUNDS
  // ============================================================

  async listPendingRefunds(query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where = { status: 'requested' };

    const [refunds, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        skip,
        take: limit,
        include: {
          payment: {
            select: {
              id: true,
              orderId: true,
              amount: true,
              currency: true,
              provider: true,
            },
          },
          dispute: { select: { id: true, type: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.refund.count({ where }),
    ]);

    return { data: refunds, total, page, limit };
  }

  async refundDecision(actorId: string, refundId: string, dto: RefundDecisionDto) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
    });
    if (!refund) {
      throw new NotFoundException('Refund not found');
    }
    if (refund.status !== 'requested') {
      throw new BadRequestException(
        `Cannot process refund in current status: ${refund.status}`,
      );
    }

    const newStatus = dto.decision === 'approved' ? 'approved' : 'rejected';

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.refund.update({
        where: { id: refundId },
        data: {
          status: newStatus,
          processedBy: actorId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: `refund.${dto.decision}`,
          entityType: 'Refund',
          entityId: refundId,
          before: { status: refund.status },
          after: { status: newStatus, reason: dto.reason || null },
        },
      });

      return updated;
    });
  }

  // ============================================================
  // PAYOUTS
  // ============================================================

  async listPayouts(query: {
    status?: string;
    sellerId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.sellerId) {
      where.sellerId = query.sellerId;
    }

    const [payouts, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        skip,
        take: limit,
        include: {
          seller: {
            select: { id: true, legalName: true },
            },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payout.count({ where }),
    ]);

    return { data: payouts, total, page, limit };
  }

  async approvePayout(actorId: string, payoutId: string) {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
    });
    if (!payout) {
      throw new NotFoundException('Payout not found');
    }
    if (payout.status !== 'scheduled') {
      throw new BadRequestException(
        `Cannot approve payout in current status: ${payout.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payout.update({
        where: { id: payoutId },
        data: { status: 'processing' },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'payout.approved',
          entityType: 'Payout',
          entityId: payoutId,
          before: { status: 'scheduled' },
          after: { status: 'processing' },
        },
      });

      return updated;
    });
  }

  // ============================================================
  // AUDIT LOGS
  // ============================================================

  async searchAuditLogs(query: {
    actorId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 50, 200);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.actorId) {
      where.actorId = query.actorId;
    }
    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' };
    }
    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.entityId) {
      where.entityId = query.entityId;
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.createdAt.lte = new Date(query.dateTo);
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          actor: { select: { id: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data: logs, total, page, limit };
  }

  // ============================================================
  // CATEGORIES
  // ============================================================

  async createCategory(actorId: string, dto: CreateCategoryDto) {
    // Check slug uniqueness
    const existing = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Category with slug "${dto.slug}" already exists`);
    }

    // Validate parent if provided
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
    }

    // Validate required standard IDs exist
    if (dto.requiredStandardIds && dto.requiredStandardIds.length > 0) {
      const standards = await this.prisma.certificationStandard.findMany({
        where: { id: { in: dto.requiredStandardIds } },
        select: { id: true },
      });
      if (standards.length !== dto.requiredStandardIds.length) {
        throw new NotFoundException('One or more certification standard IDs not found');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          slug: dto.slug,
          name: dto.name,
          nameI18n: dto.nameI18n,
          parentId: dto.parentId || null,
          path: dto.path,
          requiredStandardIds: dto.requiredStandardIds || [],
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'category.created',
          entityType: 'Category',
          entityId: category.id,
          after: {
            slug: category.slug,
            name: category.name,
            requiredStandardIds: category.requiredStandardIds,
          },
        },
      });

      return category;
    });
  }

  async updateCategory(actorId: string, categoryId: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Validate required standard IDs if being updated
    if (dto.requiredStandardIds && dto.requiredStandardIds.length > 0) {
      const standards = await this.prisma.certificationStandard.findMany({
        where: { id: { in: dto.requiredStandardIds } },
        select: { id: true },
      });
      if (standards.length !== dto.requiredStandardIds.length) {
        throw new NotFoundException('One or more certification standard IDs not found');
      }
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.nameI18n !== undefined) data.nameI18n = dto.nameI18n;
    if (dto.requiredStandardIds !== undefined)
      data.requiredStandardIds = dto.requiredStandardIds;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({
        where: { id: categoryId },
        data,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'category.updated',
          entityType: 'Category',
          entityId: categoryId,
          before: {
            name: category.name,
            nameI18n: category.nameI18n,
            requiredStandardIds: category.requiredStandardIds,
          },
          after: data,
        },
      });

      return updated;
    });
  }

  // ============================================================
  // CERTIFICATION STANDARDS
  // ============================================================

  async createStandard(actorId: string, dto: CreateStandardDto) {
    const existing = await this.prisma.certificationStandard.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        `Certification standard with code "${dto.code}" already exists`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const standard = await tx.certificationStandard.create({
        data: {
          code: dto.code,
          name: dto.name,
          category: dto.category,
          issuingRegion: dto.issuingRegion,
          validatorType: dto.validatorType,
          validatorConfig: dto.validatorConfig || Prisma.JsonNull,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'standard.created',
          entityType: 'CertificationStandard',
          entityId: standard.id,
          after: { code: standard.code, name: standard.name },
        },
      });

      return standard;
    });
  }

  async updateStandard(actorId: string, standardId: string, dto: UpdateStandardDto) {
    const standard = await this.prisma.certificationStandard.findUnique({
      where: { id: standardId },
    });
    if (!standard) {
      throw new NotFoundException('Certification standard not found');
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.issuingRegion !== undefined) data.issuingRegion = dto.issuingRegion;
    if (dto.validatorType !== undefined) data.validatorType = dto.validatorType;
    if (dto.validatorConfig !== undefined) data.validatorConfig = dto.validatorConfig || Prisma.JsonNull;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.certificationStandard.update({
        where: { id: standardId },
        data,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'standard.updated',
          entityType: 'CertificationStandard',
          entityId: standardId,
          before: {
            name: standard.name,
            category: standard.category,
            issuingRegion: standard.issuingRegion,
            validatorType: standard.validatorType,
          },
          after: data,
        },
      });

      return updated;
    });
  }
}
