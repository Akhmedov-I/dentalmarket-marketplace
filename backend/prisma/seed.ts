// =============================================================================
// DentalMarket — Database Seed
// Populates reference data: roles, certification standards, categories
// =============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ─────────────────────────────────────────────────────────────────────────
  // ROLES
  // ─────────────────────────────────────────────────────────────────────────
  const roles = [
    { name: 'admin', permissions: { all: true } },
    { name: 'seller', permissions: { products: ['create', 'read', 'update', 'delete'], orders: ['read', 'update'], certifications: ['create', 'read'] } },
    { name: 'customer', permissions: { products: ['read'], orders: ['create', 'read'], reviews: ['create', 'read'] } },
    { name: 'support', permissions: { users: ['read'], orders: ['read'], disputes: ['read', 'update'] } },
    { name: 'finance', permissions: { ledger: ['read'], payouts: ['read', 'update'], reconciliation: ['read'] } },
    { name: 'compliance', permissions: { certifications: ['read', 'update'], audit_logs: ['read'], disputes: ['read', 'update'] } },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }
  console.log(`✅ Roles seeded: ${roles.map(r => r.name).join(', ')}`);

  // ─────────────────────────────────────────────────────────────────────────
  // CERTIFICATION STANDARDS
  // ─────────────────────────────────────────────────────────────────────────
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

  for (const standard of standards) {
    await prisma.certificationStandard.upsert({
      where: { code: standard.code },
      update: {},
      create: standard,
    });
  }
  console.log(`✅ Certification standards seeded: ${standards.map(s => s.code).join(', ')}`);

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORIES — Root dental equipment taxonomy
  // ─────────────────────────────────────────────────────────────────────────

  // Fetch standard IDs for required_standard_ids
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
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log(`✅ Categories seeded: ${categories.map(c => c.slug).join(', ')}`);

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
