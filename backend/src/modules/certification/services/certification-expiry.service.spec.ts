import { Test, TestingModule } from '@nestjs/testing';
import { CertificationService } from './certification.service';
import { CatalogService } from '../../catalog/services/catalog.service';
import { PrismaService } from '@shared/db/prisma.service';
import { StorageService } from '@shared/storage/storage.service';
import { ConfigModule } from '@nestjs/config';
import { CertStatus, CertHolderType, KycStatus, SellerStatus, UserStatus, ProductStatus } from '@prisma/client';

describe('Certification Expiry Automation Tests', () => {
  let certService: CertificationService;
  let catalogService: CatalogService;
  let prisma: PrismaService;

  let testUser: any;
  let testSeller: any;
  let testCategory: any;
  let testStandard: any;
  let testProduct: any;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        CertificationService,
        CatalogService,
        PrismaService,
        StorageService,
      ],
    }).compile();

    certService = module.get<CertificationService>(CertificationService);
    catalogService = module.get<CatalogService>(CatalogService);
    prisma = module.get<PrismaService>(PrismaService);

    await cleanup();

    // 1. Create a test user
    testUser = await prisma.user.create({
      data: {
        email: `test-cert-expiry-seller-${Date.now()}@dentalmarket.uz`,
        passwordHash: 'dummy_hash',
        status: UserStatus.active,
      },
    });

    // 2. Create a test seller profile
    testSeller = await prisma.sellerProfile.create({
      data: {
        userId: testUser.id,
        legalName: 'Compliance Test LLC',
        taxId: `TX-COMP-${Date.now()}`,
        registrationNumber: `REG-COMP-${Date.now()}`,
        sellerType: 'reseller',
        country: 'UZ',
        kycStatus: KycStatus.approved,
        status: SellerStatus.active,
      },
    });

    // 3. Create a test standard
    testStandard = await prisma.certificationStandard.create({
      data: {
        code: `COMP_STD_${Date.now()}`,
        name: 'Compliance Standards Conformity',
        category: 'product',
        issuingRegion: 'UZ',
        validatorType: 'manual',
      },
    });

    // 4. Create a test category with the required standard
    testCategory = await prisma.category.create({
      data: {
        slug: `comp-cat-${Date.now()}`,
        name: 'Regulated Compliance Category',
        nameI18n: { ru: 'Тест Категория Комплаенс' },
        path: '/comp-cat',
        requiredStandardIds: [testStandard.id],
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  async function cleanup() {
    if (prisma) {
      // Use TRUNCATE to bypass append-only trigger on audit_logs
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE audit_logs CASCADE`);
      if (testCategory) {
        await prisma.product.deleteMany({ where: { categoryId: testCategory.id } });
        await prisma.category.delete({ where: { id: testCategory.id } });
      }
      if (testStandard) {
        await prisma.certification.deleteMany({ where: { standardId: testStandard.id } });
        await prisma.certificationStandard.delete({ where: { id: testStandard.id } });
      }
      if (testSeller) {
        await prisma.sellerProfile.delete({ where: { id: testSeller.id } });
      }
      if (testUser) {
        await prisma.user.deleteMany({ where: { id: testUser.id } });
      }
    }
  }

  describe('Certification Expiration Engine', () => {
    it('should transition verified expired product certs to expired, and auto-pause non-compliant active products', async () => {
      // 1. Create a product (draft status)
      testProduct = await prisma.product.create({
        data: {
          sellerId: testSeller.id,
          categoryId: testCategory.id,
          sku: `COMP-PROD-${Date.now()}`,
          title: 'Conformity Curing Machine',
          description: 'Curing machine',
          brand: 'DentCure',
          model: 'DC-50',
          basePrice: 500000n,
          currency: 'UZS',
          status: ProductStatus.draft,
        },
      });

      // 2. Upload and link standard certificate (initially with future expiry so product can activate)
      const futureExpiryDate = new Date();
      futureExpiryDate.setDate(futureExpiryDate.getDate() + 30); // 30 days ahead

      const cert = await prisma.certification.create({
        data: {
          holderType: CertHolderType.product,
          productId: testProduct.id,
          standardId: testStandard.id,
          certificateNumber: `CERT-EXP-${Date.now()}`,
          issuedBy: 'State Certification Authority',
          issueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
          expiryDate: futureExpiryDate,
          documentObjectKey: 'cert-object-key-123',
          documentSha256: 'a'.repeat(64),
          status: CertStatus.verified,
        },
      });

      // Set product as active (cert is valid, so DB trigger allows this)
      await prisma.product.update({
        where: { id: testProduct.id },
        data: { status: ProductStatus.active },
      });

      // Now expire the cert to simulate the real scenario
      const pastExpiryDate = new Date();
      pastExpiryDate.setDate(pastExpiryDate.getDate() - 1);
      await prisma.certification.update({
        where: { id: cert.id },
        data: { expiryDate: pastExpiryDate },
      });

      // Verify setup state
      const initialProduct = await prisma.product.findUnique({ where: { id: testProduct.id } });
      expect(initialProduct?.status).toBe(ProductStatus.active);

      // 3. Run Expiry Automation
      const report = await certService.checkExpiredCertifications();

      expect(report.expiredCertIds).toContain(cert.id);
      expect(report.pausedProductIds).toContain(testProduct.id);

      // 4. Assert certificate transitioned to CertStatus.expired
      const updatedCert = await prisma.certification.findUnique({
        where: { id: cert.id },
      });
      expect(updatedCert?.status).toBe(CertStatus.expired);

      // 5. Assert product auto-paused
      const updatedProduct = await prisma.product.findUnique({
        where: { id: testProduct.id },
      });
      expect(updatedProduct?.status).toBe(ProductStatus.paused);

      // 6. Assert audit log exists for auto-pausing
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'product.auto_paused',
          entityId: testProduct.id,
        },
      });
      expect(auditLog).toBeDefined();
      const auditLogAfter = auditLog?.after as any;
      expect(auditLogAfter?.reason).toContain('Auto-paused due to expiration of certificate');
    });

    it('should auto-pause active sellers if their seller-level certifications expire', async () => {
      // 1. Create a seller certificate expiring in the past
      const pastExpiryDate = new Date();
      pastExpiryDate.setDate(pastExpiryDate.getDate() - 1);

      const cert = await prisma.certification.create({
        data: {
          holderType: CertHolderType.seller,
          sellerProfileId: testSeller.id,
          standardId: testStandard.id,
          certificateNumber: `CERT-EXP-SELL-${Date.now()}`,
          issuedBy: 'State Certification Authority',
          issueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          expiryDate: pastExpiryDate,
          documentObjectKey: 'cert-sell-key-123',
          documentSha256: 'b'.repeat(64),
          status: CertStatus.verified,
        },
      });

      // Run Expiry Automation
      const report = await certService.checkExpiredCertifications();

      expect(report.expiredCertIds).toContain(cert.id);
      expect(report.pausedSellerProfileIds).toContain(testSeller.id);

      // Verify seller profile is paused
      const updatedSeller = await prisma.sellerProfile.findUnique({
        where: { id: testSeller.id },
      });
      expect(updatedSeller?.status).toBe(SellerStatus.paused);

      // Assert audit log exists for seller pausing
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'seller.auto_paused',
          entityId: testSeller.id,
        },
      });
      expect(auditLog).toBeDefined();
      const sellerAuditAfter = auditLog?.after as any;
      expect(sellerAuditAfter?.reason).toContain('Auto-paused due to expiration of certificate');
    });
  });
});
