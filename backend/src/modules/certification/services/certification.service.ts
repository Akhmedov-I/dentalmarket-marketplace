import { Injectable, NotFoundException, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@shared/db/prisma.service';
import { StorageService } from '@shared/storage/storage.service';
import { UploadCertDto } from '../dto/upload-cert.dto';
import { VerifyCertDto } from '../dto/verify-cert.dto';
import { CertStatus, CertHolderType, VerificationResult, ProductStatus, SellerStatus } from '@prisma/client';

@Injectable()
export class CertificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * List all recognized certification standards
   */
  async getStandards() {
    return this.prisma.certificationStandard.findMany({
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Upload a certificate (PDF/Scan) and save its metadata
   */
  async uploadCertificate(
    userId: string,
    file: { buffer: Buffer; originalname: string },
    dto: UploadCertDto,
  ) {
    // 1. Verify that the standard exists
    const standard = await this.prisma.certificationStandard.findUnique({
      where: { id: dto.standardId },
    });
    if (!standard) {
      throw new NotFoundException('Certification standard not found');
    }

    // 2. Resolve seller profile of the user
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    });
    if (!seller) {
      throw new UnauthorizedException('Seller profile not found');
    }

    // Verify holder ownership and set correct relation ID
    let sellerProfileId: string | null = null;
    let productId: string | null = null;

    if (dto.holderType === CertHolderType.seller) {
      if (dto.holderId !== seller.id) {
        throw new UnauthorizedException('Cannot upload certificate for another seller profile');
      }
      sellerProfileId = seller.id;
    } else if (dto.holderType === CertHolderType.product) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.holderId },
      });
      if (!product) {
        throw new NotFoundException('Product not found');
      }
      if (product.sellerId !== seller.id) {
        throw new UnauthorizedException('You do not own this product');
      }
      productId = product.id;
    }

    // 3. Save file and compute SHA-256 hash
    const { objectKey, sha256 } = await this.storage.saveFile(file, 'certificates');

    // 4. Check for duplicates (anti-fraud flags)
    const duplicateCert = await this.prisma.certification.findFirst({
      where: {
        OR: [
          { certificateNumber: dto.certificateNumber },
          { documentSha256: sha256 },
        ],
      },
    });

    let notes = '';
    if (duplicateCert) {
      if (duplicateCert.documentSha256 === sha256) {
        notes += `[System Flag: Duplicate file hash detected with Cert ID ${duplicateCert.id}] `;
      }
      if (duplicateCert.certificateNumber === dto.certificateNumber) {
        notes += `[System Flag: Duplicate certificate number detected with Cert ID ${duplicateCert.id}] `;
      }
    }

    // 5. Parse dates
    const issueDate = new Date(dto.issueDate);
    const expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;

    if (isNaN(issueDate.getTime())) {
      throw new BadRequestException('Invalid issue date format');
    }
    if (expiryDate && isNaN(expiryDate.getTime())) {
      throw new BadRequestException('Invalid expiry date format');
    }

    // 6. Create database record
    return this.prisma.certification.create({
      data: {
        holderType: dto.holderType,
        sellerProfileId,
        productId,
        standardId: dto.standardId,
        certificateNumber: dto.certificateNumber,
        issuedBy: dto.issuedBy,
        issueDate,
        expiryDate,
        documentObjectKey: objectKey,
        documentSha256: sha256,
        status: CertStatus.pending,
        notes: notes || null,
      },
      include: {
        standard: true,
      },
    });
  }

  /**
   * Get all certificates uploaded by/for a seller
   */
  async getSellerCertifications(sellerId: string) {
    return this.prisma.certification.findMany({
      where: {
        OR: [
          // Seller-level certificates
          {
            sellerProfileId: sellerId,
          },
          // Product-level certificates for products belonging to this seller
          {
            product: {
              sellerId: sellerId,
            },
          },
        ],
      },
      include: {
        standard: true,
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get list of certificates awaiting review (Admin queue)
   */
  async getPendingCertifications() {
    return this.prisma.certification.findMany({
      where: { status: CertStatus.pending },
      include: {
        standard: true,
        sellerProfile: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
        product: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Admin/Compliance verification of a certificate
   */
  async verifyCertificate(adminId: string, certId: string, dto: VerifyCertDto) {
    const cert = await this.prisma.certification.findUnique({
      where: { id: certId },
    });

    if (!cert) {
      throw new NotFoundException('Certification not found');
    }

    // Map verification result to certificate status
    let newStatus: CertStatus;
    if (dto.result === VerificationResult.pass) {
      newStatus = CertStatus.verified;
    } else if (dto.result === VerificationResult.fail) {
      newStatus = CertStatus.rejected;
    } else {
      newStatus = CertStatus.pending; // inconclusive
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update the certificate status
      const updatedCert = await tx.certification.update({
        where: { id: certId },
        data: {
          status: newStatus,
          verifiedBy: adminId,
          verifiedAt: new Date(),
          rejectionReason: dto.rejectionReason || null,
          notes: dto.notes ? `${cert.notes || ''} | Admin notes: ${dto.notes}` : cert.notes,
        },
        include: {
          standard: true,
        },
      });

      // 2. Append to verification audit trail
      await tx.certificationVerification.create({
        data: {
          certificationId: cert.id,
          actorId: adminId,
          method: 'manual', // or third_party/registry_api if automated in future
          result: dto.result,
          evidence: {
            adminId,
            decision: newStatus,
            rejectionReason: dto.rejectionReason || null,
            notes: dto.notes || null,
          },
        },
      });

      // 3. Create governance audit log
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: `cert.${newStatus.toLowerCase()}`,
          entityType: 'Certification',
          entityId: cert.id,
          before: { status: cert.status },
          after: { status: newStatus },
        },
      });

      return updatedCert;
    });
  }

  /**
   * Delete a certificate
   */
  async deleteCertificate(sellerId: string, certId: string) {
    const cert = await this.prisma.certification.findUnique({
      where: { id: certId },
      include: {
        product: true,
      },
    });

    if (!cert) {
      throw new NotFoundException('Certification not found');
    }

    // Verify ownership
    let isOwner = false;
    if (cert.holderType === CertHolderType.seller && cert.sellerProfileId === sellerId) {
      isOwner = true;
    } else if (cert.holderType === CertHolderType.product && cert.product?.sellerId === sellerId) {
      isOwner = true;
    }

    if (!isOwner) {
      throw new UnauthorizedException('You do not own this certificate');
    }

    // Remove from DB and delete file
    await this.prisma.certification.delete({ where: { id: certId } });
    await this.storage.deleteFile(cert.documentObjectKey);
    return { success: true };
  }

  /**
   * Validates if a product satisfies all required standards of its category.
   * Enforces that all standards in category.requiredStandardIds are verified and unexpired.
   */
  async validateProductCertifications(
    productId: string,
    categoryId: string,
  ): Promise<{ isValid: boolean; missingStandards: string[] }> {
    // 1. Fetch category required standards
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const requiredIds = category.requiredStandardIds || [];
    if (requiredIds.length === 0) {
      return { isValid: true, missingStandards: [] };
    }

    // 2. Fetch all verified, unexpired certifications for this product
    const now = new Date();
    const productCertifications = await this.prisma.certification.findMany({
      where: {
        productId: productId,
        status: CertStatus.verified,
        OR: [
          { expiryDate: null },
          { expiryDate: { gt: now } },
        ],
      },
    });

    const activeStandardIds = new Set(productCertifications.map((c) => c.standardId));

    // 3. Find missing standard codes/names
    const missingIds = requiredIds.filter((id) => !activeStandardIds.has(id));
    if (missingIds.length === 0) {
      return { isValid: true, missingStandards: [] };
    }

    const missingStandards = await this.prisma.certificationStandard.findMany({
      where: { id: { in: missingIds } },
      select: { code: true },
    });

    return {
      isValid: false,
      missingStandards: missingStandards.map((s) => s.code),
    };
  }

  /**
   * Scans for expired certifications, transitions their status, and automatically
   * pauses any affected products or sellers to enforce compliance.
   */
  async checkExpiredCertifications() {
    const now = new Date();

    // 1. Find all verified certifications that are past their expiry date
    const expiredCerts = await this.prisma.certification.findMany({
      where: {
        status: CertStatus.verified,
        expiryDate: {
          not: null,
          lt: now,
        },
      },
    });

    const expiredCertIds = expiredCerts.map((c) => c.id);
    const pausedProductIds: string[] = [];
    const pausedSellerProfileIds: string[] = [];

    if (expiredCertIds.length === 0) {
      return { expiredCertIds, pausedProductIds, pausedSellerProfileIds };
    }

    await this.prisma.$transaction(async (tx) => {
      // Find a valid admin/compliance user or any user to use as actorId to satisfy the FK constraint
      let systemUser = await tx.user.findFirst({
        where: { userRoles: { some: { role: { name: 'admin' } } } },
      });
      if (!systemUser) {
        systemUser = await tx.user.findFirst();
      }
      const systemActorId = systemUser?.id || '00000000-0000-0000-0000-000000000000';

      // Transition all expired certificates to CertStatus.expired
      await tx.certification.updateMany({
        where: { id: { in: expiredCertIds } },
        data: { status: CertStatus.expired },
      });

      for (const cert of expiredCerts) {
        // Record audit log for certificate expiration
        await tx.auditLog.create({
          data: {
            actorId: systemActorId,
            action: 'cert.expired',
            entityType: 'Certification',
            entityId: cert.id,
            before: { status: CertStatus.verified },
            after: { status: CertStatus.expired },
          },
        });

        // If it's a product certification, validate compliance
        if (cert.productId) {
          const product = await tx.product.findUnique({
            where: { id: cert.productId },
          });

          if (product && product.status === ProductStatus.active) {
            // Re-validate product certifications under transaction context
            const activeProductCerts = await tx.certification.findMany({
              where: {
                productId: product.id,
                status: CertStatus.verified,
                OR: [
                  { expiryDate: null },
                  { expiryDate: { gt: now } },
                ],
              },
            });
            const activeStandardIds = new Set(activeProductCerts.map((c) => c.standardId));

            // Fetch category required standards
            const category = await tx.category.findUnique({
              where: { id: product.categoryId },
            });
            const requiredIds = category?.requiredStandardIds || [];

            const isStillValid = requiredIds.every((id) => activeStandardIds.has(id));

            if (!isStillValid) {
              await tx.product.update({
                where: { id: product.id },
                data: { status: ProductStatus.paused },
              });
              pausedProductIds.push(product.id);

              await tx.auditLog.create({
                data: {
                  actorId: systemActorId,
                  action: 'product.auto_paused',
                  entityType: 'Product',
                  entityId: product.id,
                  before: { status: ProductStatus.active },
                  after: {
                    status: ProductStatus.paused,
                    reason: `Auto-paused due to expiration of certificate ${cert.certificateNumber} (${cert.id})`,
                  },
                },
              });
            }
          }
        }

        // If it's a seller-level certification, pause the seller profile
        if (cert.sellerProfileId) {
          const seller = await tx.sellerProfile.findUnique({
            where: { id: cert.sellerProfileId },
          });

          if (seller && seller.status === SellerStatus.active) {
            await tx.sellerProfile.update({
              where: { id: seller.id },
              data: { status: SellerStatus.paused },
            });
            pausedSellerProfileIds.push(seller.id);

            await tx.auditLog.create({
              data: {
                actorId: systemActorId,
                action: 'seller.auto_paused',
                entityType: 'SellerProfile',
                entityId: seller.id,
                before: { status: SellerStatus.active },
                after: {
                  status: SellerStatus.paused,
                  reason: `Auto-paused due to expiration of certificate ${cert.certificateNumber} (${cert.id})`,
                },
              },
            });
          }
        }
      }
    });

    return {
      expiredCertIds,
      pausedProductIds,
      pausedSellerProfileIds,
    };
  }
}

// Simple local UnauthorizedException mapper since we are in modular service scope
// Removed custom exception as it is now imported correctly.
