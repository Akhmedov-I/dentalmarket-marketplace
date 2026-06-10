import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/db/prisma.service';
import { CertStatus, ProductStatus, SellerStatus, NotifChannel, NotifStatus } from '@prisma/client';

export interface CertExpiryRunResult {
  runAt: Date;
  warningsSent: number;
  certificatesExpired: number;
  productsPaused: number;
  sellersPaused: number;
  errors: string[];
}

@Injectable()
export class CertExpiryWorker {
  private readonly logger = new Logger(CertExpiryWorker.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Main entry point — scan all verified certifications for upcoming or past expiry.
   * Designed to run daily (via cron or manual admin trigger).
   */
  async run(): Promise<CertExpiryRunResult> {
    const now = new Date();
    const warningThreshold = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days

    const result: CertExpiryRunResult = {
      runAt: now,
      warningsSent: 0,
      certificatesExpired: 0,
      productsPaused: 0,
      sellersPaused: 0,
      errors: [],
    };

    this.logger.log('Starting certification expiry scan…');

    try {
      // ── 1. Warn about certs expiring within 3 days (but not yet expired) ──
      await this.sendExpiryWarnings(now, warningThreshold, result);

      // ── 2. Expire already-past-due certs and cascade to products/sellers ──
      await this.expireAndCascade(now, result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Cert expiry scan failed: ${msg}`);
      result.errors.push(msg);
    }

    this.logger.log(
      `Cert expiry scan complete — warnings=${result.warningsSent}, ` +
        `expired=${result.certificatesExpired}, productsPaused=${result.productsPaused}, ` +
        `sellersPaused=${result.sellersPaused}, errors=${result.errors.length}`,
    );

    return result;
  }

  // ─── Warning phase ────────────────────────────────────────────────────────

  private async sendExpiryWarnings(
    now: Date,
    warningThreshold: Date,
    result: CertExpiryRunResult,
  ): Promise<void> {
    const expiringCerts = await this.prisma.certification.findMany({
      where: {
        status: CertStatus.verified,
        expiryDate: {
          not: null,
          gt: now,           // not yet expired
          lte: warningThreshold, // but within 3-day window
        },
      },
      include: {
        sellerProfile: { include: { user: true } },
        product: { include: { seller: { include: { user: true } } } },
        standard: true,
      },
    });

    for (const cert of expiringCerts) {
      try {
        const sellerId = this.resolveSellerUserId(cert);
        if (!sellerId) continue;

        const daysLeft = Math.ceil(
          (cert.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        await this.prisma.notification.create({
          data: {
            userId: sellerId,
            channel: NotifChannel.in_app,
            templateKey: 'cert.expiry_warning',
            payload: {
              certificationId: cert.id,
              certificateNumber: cert.certificateNumber,
              standardCode: cert.standard.code,
              expiryDate: cert.expiryDate!.toISOString(),
              daysLeft,
              holderType: cert.holderType,
            },
            status: NotifStatus.queued,
          },
        });
        result.warningsSent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Warning for cert ${cert.id}: ${msg}`);
      }
    }
  }

  // ─── Expiry + cascade phase ───────────────────────────────────────────────

  private async expireAndCascade(now: Date, result: CertExpiryRunResult): Promise<void> {
    const expiredCerts = await this.prisma.certification.findMany({
      where: {
        status: CertStatus.verified,
        expiryDate: {
          not: null,
          lte: now, // already expired
        },
      },
      include: {
        sellerProfile: { include: { user: true } },
        product: { include: { seller: { include: { user: true } } } },
        standard: true,
      },
    });

    for (const cert of expiredCerts) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // 2a. Transition cert → expired
          await tx.certification.update({
            where: { id: cert.id },
            data: { status: CertStatus.expired },
          });
          result.certificatesExpired++;

          // 2b. Pause affected product (if product-level cert)
          if (cert.holderType === 'product' && cert.productId) {
            const product = await tx.product.findUnique({
              where: { id: cert.productId },
            });
            if (product && product.status === ProductStatus.active) {
              await tx.product.update({
                where: { id: cert.productId },
                data: { status: ProductStatus.paused },
              });
              result.productsPaused++;
            }
          }

          // 2c. For seller-level certs: pause the seller and all their active products
          if (cert.holderType === 'seller' && cert.sellerProfileId) {
            const sellerProfile = await tx.sellerProfile.findUnique({
              where: { id: cert.sellerProfileId },
            });
            if (sellerProfile && sellerProfile.status === SellerStatus.active) {
              await tx.sellerProfile.update({
                where: { id: cert.sellerProfileId },
                data: { status: SellerStatus.paused },
              });
              result.sellersPaused++;

              // Pause all active products of this seller
              const pausedProducts = await tx.product.updateMany({
                where: {
                  sellerId: cert.sellerProfileId,
                  status: ProductStatus.active,
                },
                data: { status: ProductStatus.paused },
              });
              result.productsPaused += pausedProducts.count;
            }
          }

          // 2d. Audit log (uses system actor — actorId is the seller's userId)
          const actorId = this.resolveSellerUserId(cert);
          if (actorId) {
            await tx.auditLog.create({
              data: {
                actorId,
                action: 'cert.auto_expired',
                entityType: 'certification',
                entityId: cert.id,
                before: { status: CertStatus.verified },
                after: { status: CertStatus.expired },
              },
            });
          }

          // 2e. Notify the seller
          const sellerUserId = this.resolveSellerUserId(cert);
          if (sellerUserId) {
            await tx.notification.create({
              data: {
                userId: sellerUserId,
                channel: NotifChannel.in_app,
                templateKey: 'cert.expired',
                payload: {
                  certificationId: cert.id,
                  certificateNumber: cert.certificateNumber,
                  standardCode: cert.standard.code,
                  holderType: cert.holderType,
                },
                status: NotifStatus.queued,
              },
            });
          }
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to expire cert ${cert.id}: ${msg}`);
        result.errors.push(`Expire cert ${cert.id}: ${msg}`);
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Resolves the seller's User.id from a certification (works for both
   * seller-level and product-level certs).
   */
  private resolveSellerUserId(cert: {
    sellerProfile?: { user?: { id: string } | null; userId?: string } | null;
    product?: { seller?: { user?: { id: string } | null; userId?: string } | null } | null;
  }): string | null {
    if (cert.sellerProfile?.user?.id) return cert.sellerProfile.user.id;
    if (cert.sellerProfile?.userId) return cert.sellerProfile.userId;
    if (cert.product?.seller?.user?.id) return cert.product.seller.user.id;
    if (cert.product?.seller?.userId) return cert.product.seller.userId;
    return null;
  }
}
