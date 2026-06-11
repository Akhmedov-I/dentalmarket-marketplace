import { PrismaService } from './prisma.service';
import * as argon2 from 'argon2';

export async function seedDatabaseIfEmpty(prisma: PrismaService) {
  try {
    console.log('[SeedHelper] Checking database state...');

    // 1. Seed Roles
    const roleCount = await prisma.role.count();
    if (roleCount === 0) {
      console.log('[SeedHelper] Seeding roles...');
      const roles = [
        { name: 'admin', permissions: { all: true } },
        { name: 'seller', permissions: { products: ['create', 'read', 'update', 'delete'], orders: ['read', 'update'], certifications: ['create', 'read'] } },
        { name: 'customer', permissions: { products: ['read'], orders: ['create', 'read'], reviews: ['create', 'read'] } },
        { name: 'support', permissions: { users: ['read'], orders: ['read'], disputes: ['read', 'update'] } },
        { name: 'finance', permissions: { ledger: ['read'], payouts: ['read', 'update'], reconciliation: ['read'] } },
        { name: 'compliance', permissions: { certifications: ['read', 'update'], audit_logs: ['read'], disputes: ['read', 'update'] } },
      ];
      for (const role of roles) {
        await prisma.role.create({ data: role });
      }
      console.log('[SeedHelper] Roles seeded successfully.');
    }

    // 2. Seed Certification Standards
    const standardCount = await prisma.certificationStandard.count();
    if (standardCount === 0) {
      console.log('[SeedHelper] Seeding certification standards...');
      const standards = [
        {
          code: 'CE_MDR',
          name: 'EU Medical Device Regulation (CE)',
          category: 'product' as const,
          issuingRegion: 'EU',
          validatorType: 'manual' as const,
        },
        {
          code: 'FDA_510K',
          name: 'FDA 510(k) Clearance',
          category: 'product' as const,
          issuingRegion: 'US',
          validatorType: 'manual' as const,
        },
        {
          code: 'ISO_13485',
          name: 'ISO 13485 — Quality Management for Medical Devices',
          category: 'quality_system' as const,
          issuingRegion: 'ISO',
          validatorType: 'manual' as const,
        },
        {
          code: 'IEC_60601',
          name: 'IEC 60601 — Electrical Safety for Medical Equipment',
          category: 'electrical_safety' as const,
          issuingRegion: 'ISO',
          validatorType: 'manual' as const,
        },
        {
          code: 'EAEU_TR',
          name: 'EAEU Technical Regulation for Medical Devices',
          category: 'product' as const,
          issuingRegion: 'EAEU',
          validatorType: 'manual' as const,
        },
        {
          code: 'UZ_MOH_REG',
          name: 'Uzbekistan Ministry of Health Device Registration',
          category: 'registration' as const,
          issuingRegion: 'UZ',
          validatorType: 'manual' as const,
        },
      ];
      for (const std of standards) {
        await prisma.certificationStandard.create({ data: std });
      }
      console.log('[SeedHelper] Certification standards seeded.');
    }

    // 3. Seed Categories
    const categoryCount = await prisma.category.count();
    if (categoryCount === 0) {
      console.log('[SeedHelper] Seeding categories...');
      const ceMdr = await prisma.certificationStandard.findUnique({ where: { code: 'CE_MDR' } });
      const uzMoh = await prisma.certificationStandard.findUnique({ where: { code: 'UZ_MOH_REG' } });
      const iec60601 = await prisma.certificationStandard.findUnique({ where: { code: 'IEC_60601' } });

      const defaultRequiredStandards = [ceMdr!.id, uzMoh!.id];
      const electricalRequiredStandards = [...defaultRequiredStandards, iec60601!.id];

      const categories = [
        {
          slug: 'imaging',
          name: 'Imaging',
          nameI18n: { ru: 'Визуализация', uz: 'Tasvirlash', en: 'Imaging' },
          path: '/imaging',
          requiredStandardIds: electricalRequiredStandards,
        },
        {
          slug: 'chairs-units',
          name: 'Chairs & Units',
          nameI18n: { ru: 'Стоматологические установки', uz: 'Stomatologik qurilmalar', en: 'Chairs & Units' },
          path: '/chairs-units',
          requiredStandardIds: electricalRequiredStandards,
        },
        {
          slug: 'handpieces-motors',
          name: 'Handpieces & Motors',
          nameI18n: { ru: 'Наконечники и моторы', uz: 'Nakonechniklar va motorlar', en: 'Handpieces & Motors' },
          path: '/handpieces-motors',
          requiredStandardIds: electricalRequiredStandards,
        },
        {
          slug: 'sterilisation',
          name: 'Sterilisation',
          nameI18n: { ru: 'Стерилизация', uz: 'Sterilizatsiya', en: 'Sterilisation' },
          path: '/sterilisation',
          requiredStandardIds: electricalRequiredStandards,
        },
        {
          slug: 'lab-equipment',
          name: 'Lab Equipment',
          nameI18n: { ru: 'Лабораторное оборудование', uz: 'Laboratoriya jihozlari', en: 'Lab Equipment' },
          path: '/lab-equipment',
          requiredStandardIds: defaultRequiredStandards,
        },
        {
          slug: 'consumables',
          name: 'Consumables',
          nameI18n: { ru: 'Расходные материалы', uz: 'Sarf materiallari', en: 'Consumables' },
          path: '/consumables',
          requiredStandardIds: defaultRequiredStandards,
        },
        {
          slug: 'surgical',
          name: 'Surgical',
          nameI18n: { ru: 'Хирургия', uz: 'Jarrohlik', en: 'Surgical' },
          path: '/surgical',
          requiredStandardIds: defaultRequiredStandards,
        },
      ];
      for (const cat of categories) {
        await prisma.category.create({ data: cat });
      }
      console.log('[SeedHelper] Categories seeded.');
    }

    // 4. Seed Demo Users
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('[SeedHelper] Seeding demo users...');
      const passwordHash = await argon2.hash('password123', { type: argon2.argon2id });

      const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
      const sellerRole = await prisma.role.findUnique({ where: { name: 'seller' } });
      const customerRole = await prisma.role.findUnique({ where: { name: 'customer' } });

      // Create Admin
      const admin = await prisma.user.create({
        data: {
          email: 'admin-smoke@dentalmarket.uz',
          phone: '+998909999999',
          passwordHash,
          status: 'active',
          locale: 'ru-UZ',
        },
      });
      if (adminRole) {
        await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });
      }

      // Create Seller
      const seller = await prisma.user.create({
        data: {
          email: 'seller-smoke@dentalmarket.uz',
          phone: '+998901111111',
          passwordHash,
          status: 'active',
          locale: 'ru-UZ',
        },
      });
      if (sellerRole) {
        await prisma.userRole.create({ data: { userId: seller.id, roleId: sellerRole.id } });
        await prisma.sellerProfile.create({
          data: {
            userId: seller.id,
            legalName: 'Apex Dental Distributorship LLC',
            taxId: 'UZ-SMOKE-TAX-99',
            registrationNumber: 'REG-UZ-99',
            sellerType: 'reseller',
            country: 'UZ',
            kycStatus: 'approved',
            status: 'active',
          },
        });
      }

      // Create Buyer (Customer)
      const buyer = await prisma.user.create({
        data: {
          email: 'buyer-smoke@dentalmarket.uz',
          phone: '+998901234567',
          passwordHash,
          status: 'active',
          locale: 'ru-UZ',
        },
      });
      if (customerRole) {
        await prisma.userRole.create({ data: { userId: buyer.id, roleId: customerRole.id } });
        await prisma.customerProfile.create({
          data: {
            userId: buyer.id,
            organizationName: 'Smile Dental Clinic Tashkent',
            practiceLicenseNo: 'LIC-UZ-102030',
          },
        });
      }

      console.log('[SeedHelper] Demo users seeded successfully.');
    }
    
    console.log('[SeedHelper] Database check complete.');
  } catch (err) {
    console.error('[SeedHelper] Seed check failed:', err);
  }
}
