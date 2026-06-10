import { Test, TestingModule } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { CertificationService } from '../../certification/services/certification.service';
import { PrismaService } from '@shared/db/prisma.service';
import { StorageService } from '@shared/storage/storage.service';
import { ConfigModule } from '@nestjs/config';
import { ProductStatus, CertStatus, CertHolderType, KycStatus, SellerStatus, UserStatus } from '@prisma/client';

describe('CatalogService (Business Rules)', () => {
  let catalogService: CatalogService;
  let certService: CertificationService;
  let prisma: PrismaService;

  let testUser: any;
  let testSeller: any;
  let testCategory: any;
  let testStandard: any;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        CatalogService,
        CertificationService,
        PrismaService,
        StorageService,
      ],
    }).compile();

    catalogService = module.get<CatalogService>(CatalogService);
    certService = module.get<CertificationService>(CertificationService);
    prisma = module.get<PrismaService>(PrismaService);

    // Clean up database testing records if any leak occurred
    await cleanup();

    // 1. Create a test user
    testUser = await prisma.user.create({
      data: {
        email: `test-seller-${Date.now()}@dentalmarket.uz`,
        passwordHash: 'dummy_hash',
        status: UserStatus.active,
      },
    });

    // 2. Create a test seller profile
    testSeller = await prisma.sellerProfile.create({
      data: {
        userId: testUser.id,
        legalName: 'Test Lab LLC',
        taxId: '123456789',
        registrationNumber: 'REG-999',
        sellerType: 'reseller',
        country: 'UZ',
        kycStatus: KycStatus.approved,
        status: SellerStatus.active,
      },
    });

    // 3. Create a test standard
    testStandard = await prisma.certificationStandard.create({
      data: {
        code: `TEST_STD_${Date.now()}`,
        name: 'Test Standards Conformity',
        category: 'product',
        issuingRegion: 'UZ',
        validatorType: 'manual',
      },
    });

    // 4. Create a test category with the required standard
    testCategory = await prisma.category.create({
      data: {
        slug: `test-cat-${Date.now()}`,
        name: 'Test Regulated Category',
        nameI18n: { ru: 'Тест Категория' },
        path: '/test-cat',
        requiredStandardIds: [testStandard.id],
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  async function cleanup() {
    // Delete test categories, products, certifications in reverse dependency order
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
      await prisma.user.delete({ where: { id: testUser.id } });
    }
  }

  it('should create a product listing as a draft', async () => {
    const product = await catalogService.createProduct(testSeller.id, {
      sku: 'TEST-SKU-001',
      title: 'Regulated Autoclave',
      description: 'Medical class autoclave sterilization machine',
      brand: 'Sterilmax',
      model: 'SX-200',
      basePrice: 1500, // 1500 UZS (represented as 1500.00)
      currency: 'UZS',
      categoryId: testCategory.id,
      variants: [
        {
          name: 'SX-200 Standard',
          sku: 'TEST-SKU-001-V1',
          attributes: { capacity: '20L' },
        },
      ],
    });

    expect(product).toBeDefined();
    expect(product.status).toBe(ProductStatus.draft);
  });

  it('should block submitting product for review if required certifications are missing', async () => {
    // Retrieve the product we created
    const product = await prisma.product.findFirst({
      where: { sellerId: testSeller.id, sku: 'TEST-SKU-001' },
    });

    // Attempting to submit for review should throw an error since standard is required but no cert is attached
    await expect(
      catalogService.submitForReview(testSeller.id, product!.id),
    ).rejects.toThrowError(
      `Product lacks required verified certifications for this category. Missing standards: ${testStandard.code}`,
    );
  });

  it('should permit submitting product for review only after all required certifications are verified', async () => {
    const product = await prisma.product.findFirst({
      where: { sellerId: testSeller.id, sku: 'TEST-SKU-001' },
    });

    // 1. Upload a dummy certificate for the required standard
    const cert = await prisma.certification.create({
      data: {
        holderType: CertHolderType.product,
        productId: product!.id,
        standardId: testStandard.id,
        certificateNumber: 'CERT-12345',
        issuedBy: 'UZ Certification Authority',
        issueDate: new Date(),
        expiryDate: new Date(Date.now() + 86400000 * 305), // 10 months from now
        documentObjectKey: 'uploads/certificates/dummy.pdf',
        documentSha256: 'a'.repeat(64),
        status: CertStatus.pending, // uploaded but not yet verified
      },
    });

    // Attempting to submit for review should still fail because certificate status is pending, not verified
    await expect(
      catalogService.submitForReview(testSeller.id, product!.id),
    ).rejects.toThrowError(
      `Product lacks required verified certifications for this category. Missing standards: ${testStandard.code}`,
    );

    // 2. Mock Admin Verification
    await prisma.certification.update({
      where: { id: cert.id },
      data: { status: CertStatus.verified },
    });

    // 3. Submit for review should now succeed
    const updatedProduct = await catalogService.submitForReview(testSeller.id, product!.id);
    expect(updatedProduct.status).toBe(ProductStatus.pending_review);
  });
});
