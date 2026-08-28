import {
  PrismaClient,
  UserRole,
  LeadStage,
  LeadPriority,
  LeadSource,
  CustomerSegment,
  CustomerStatus,
  PaymentStatus,
  ActivityAction,
  OrderStatus,
  DeliveryStatus,
  ProductionStatus,
  ExpenseCategory,
  LedgerAccountType,
  CommunicationChannel,
  QuotationStatus,
  QuotationTaxMode,
  InvoiceStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

function seedDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  const url = new URL(raw);
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("connect_timeout", "30");
  return url.toString();
}

const prisma = new PrismaClient({
  datasources: { db: { url: seedDatabaseUrl() } },
});
const PASSWORD = "Admin@2026";

function seedQuoteLine(
  product: { id: string; name: string; hsnCode: string | null },
  quantity: number,
  unitPrice: number,
  taxMode: QuotationTaxMode = "DOMESTIC",
) {
  const gross = unitPrice * quantity;
  const gstPercent = taxMode === "EXPORT" ? 0 : 5;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  if (taxMode === "DOMESTIC") {
    cgstAmount = (gross * gstPercent) / 100 / 2;
    sgstAmount = (gross * gstPercent) / 100 / 2;
  } else if (taxMode === "IGST") {
    igstAmount = (gross * gstPercent) / 100;
  }
  const lineSubtotal = gross;
  return {
    productId: product.id,
    productName: product.name,
    hsnCode: product.hsnCode ?? undefined,
    quantity,
    unitPrice,
    gstPercent,
    cgstAmount,
    sgstAmount,
    igstAmount,
    lineSubtotal,
    lineTotal: lineSubtotal + cgstAmount + sgstAmount + igstAmount,
  };
}

function seedQuoteTotals(
  lines: ReturnType<typeof seedQuoteLine>[],
  shippingAmount = 0,
  discountAmount = 0,
) {
  const subtotal = lines.reduce((sum, line) => sum + line.lineSubtotal, 0);
  const cgstAmount = lines.reduce((sum, line) => sum + line.cgstAmount, 0);
  const sgstAmount = lines.reduce((sum, line) => sum + line.sgstAmount, 0);
  const igstAmount = lines.reduce((sum, line) => sum + line.igstAmount, 0);
  const gstAmount = cgstAmount + sgstAmount + igstAmount;
  const total = subtotal + gstAmount + shippingAmount - discountAmount;
  return { subtotal, cgstAmount, sgstAmount, igstAmount, gstAmount, total, discountAmount, shippingAmount };
}

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 12);

  const org = await prisma.organization.upsert({
    where: { code: "DF-MAIN" },
    update: {},
    create: {
      code: "DF-MAIN",
      name: "Dandakaranya Foods",
      legalName: "Dandakaranya Foods",
      gstin: "22AAAAA0000A1Z5",
      address: "Nursery Park Road, Sukma District, Chhattisgarh, India",
      phone: "+91 9949233777",
      email: "dandakaranyafoods@gmail.com",
      website: "https://dandakaranyafoods.com",
      isDefault: true,
      isActive: true,
    },
  });

  const companyData = {
    name: "Dandakaranya Foods",
    legalName: "Dandakaranya Foods",
    tagline: "Forest Heritage · Export Quality",
    address: "Nursery Park Road, Sukma District, Chhattisgarh, India",
    phone: "+91 9949233777",
    email: "dandakaranyafoods@gmail.com",
    gstin: "22AAAAA0000A1Z5",
    website: "https://dandakaranyafoods.com",
    logoUrl: "https://dandakaranyafoods.com/logo.png?v=11",
  };
  await prisma.companyProfile.upsert({
    where: { id: 1 },
    update: companyData,
    create: { id: 1, ...companyData },
  });

  const userSpecs = [
    { email: "t.balarama@gmail.com", name: "Balarama T", role: UserRole.ADMIN },
    { email: "admin@dandakaranyafoods.com", name: "Admin User", role: UserRole.ADMIN },
    { email: "manager@dandakaranyafoods.com", name: "Operations Manager", role: UserRole.MANAGER },
    { email: "sales@dandakaranyafoods.com", name: "Sales Executive", role: UserRole.SALES_EXECUTIVE },
    { email: "accountant@dandakaranyafoods.com", name: "Accounts Lead", role: UserRole.ACCOUNTANT },
    { email: "hr@dandakaranyafoods.com", name: "HR Manager", role: UserRole.HR_EXECUTIVE },
  ];
  const users = [];
  for (const u of userSpecs) {
    users.push(
      await prisma.user.upsert({
        where: { email: u.email },
        update: { passwordHash: hash, name: u.name, role: u.role, active: true, organizationId: org.id },
        create: { ...u, passwordHash: hash, organizationId: org.id },
      }),
    );
  }

  const admin = users[0];
  const sales = users[2];

  const branch = await prisma.branch.upsert({
    where: { code: "SKM" },
    update: {
      region: "South Chhattisgarh",
      latitude: 18.8569,
      longitude: 81.6487,
      email: "sukma@dandakaranyafoods.com",
    },
    create: {
      code: "SKM",
      name: "Sukma HQ",
      address: "Nursery Park Road, Sukma",
      city: "Sukma",
      state: "Chhattisgarh",
      region: "South Chhattisgarh",
      phone: "+91 9949233777",
      email: "sukma@dandakaranyafoods.com",
      latitude: 18.8569,
      longitude: 81.6487,
    },
  });

  const raipurBranch = await prisma.branch.upsert({
    where: { code: "RPR" },
    update: { region: "Central Chhattisgarh", latitude: 21.2514, longitude: 81.6296 },
    create: {
      code: "RPR",
      name: "Raipur Distribution",
      city: "Raipur",
      state: "Chhattisgarh",
      region: "Central Chhattisgarh",
      latitude: 21.2514,
      longitude: 81.6296,
    },
  });

  const dc = await prisma.distributionCenter.upsert({
    where: { code: "DC-CG-01" },
    update: { branchId: raipurBranch.id },
    create: {
      code: "DC-CG-01",
      name: "Raipur Regional DC",
      branchId: raipurBranch.id,
      region: "Central India",
      city: "Raipur",
      state: "Chhattisgarh",
      latitude: 21.2514,
      longitude: 81.6296,
      palletCapacity: 800,
      storageCapacityKg: 500000,
    },
  });

  const warehouse = await prisma.warehouse.upsert({
    where: { id: "wh-sukma" },
    update: {
      branchId: branch.id,
      code: "WH-SKM-01",
      storageCapacityKg: 120000,
      storageUsedKg: 45000,
      palletCapacity: 300,
      isColdStorage: false,
      latitude: 18.8569,
      longitude: 81.6487,
    },
    create: {
      id: "wh-sukma",
      code: "WH-SKM-01",
      name: "Sukma Main Facility",
      location: "Sukma, CG",
      isDefault: true,
      branchId: branch.id,
      facilityKind: "WAREHOUSE",
      storageCapacityKg: 120000,
      storageUsedKg: 45000,
      palletCapacity: 300,
      latitude: 18.8569,
      longitude: 81.6487,
    },
  });

  const warehouseCold = await prisma.warehouse.upsert({
    where: { id: "wh-sukma-cold" },
    update: { branchId: branch.id, distributionCenterId: dc.id },
    create: {
      id: "wh-sukma-cold",
      code: "WH-SKM-COLD",
      name: "Sukma Cold Storage",
      location: "Sukma, CG",
      branchId: branch.id,
      distributionCenterId: dc.id,
      facilityKind: "COLD_STORAGE",
      isColdStorage: true,
      isHumidityControlled: true,
      tempMinC: 2,
      tempMaxC: 8,
      humidityMinPct: 45,
      humidityMaxPct: 65,
      storageCapacityKg: 40000,
      storageUsedKg: 12000,
      palletCapacity: 80,
      latitude: 18.858,
      longitude: 81.65,
    },
  });

  const warehouseRaipur = await prisma.warehouse.upsert({
    where: { id: "wh-rpr-dc" },
    update: { branchId: raipurBranch.id, distributionCenterId: dc.id },
    create: {
      id: "wh-rpr-dc",
      code: "WH-RPR-DC",
      name: "Raipur Distribution Warehouse",
      location: "Raipur, CG",
      branchId: raipurBranch.id,
      distributionCenterId: dc.id,
      facilityKind: "DISTRIBUTION_CENTER",
      storageCapacityKg: 200000,
      storageUsedKg: 95000,
      palletCapacity: 500,
      latitude: 21.252,
      longitude: 81.63,
    },
  });

  const categories = await Promise.all(
    ["Raw material", "Industrial", "Ingredients", "Value-added", "Nutrition"].map((name) =>
      prisma.productCategory.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );
  const catMap = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  const productDefs = [
    { sku: "DF-TAM-001", name: "Tamarind (Whole Pods)", cat: "Raw material", price: 180, stock: 500 },
    { sku: "DF-CON-001", name: "Tamarind Concentrate", cat: "Industrial", price: 450, stock: 120 },
    { sku: "DF-PWD-001", name: "Tamarind Powder", cat: "Ingredients", price: 199, stock: 300 },
    { sku: "DF-CHU-001", name: "Tamarind Chutney", cat: "Value-added", price: 165, stock: 200 },
    { sku: "DF-HSK-001", name: "Tamarind Husk Powder", cat: "Industrial", price: 120, stock: 80 },
    { sku: "DF-SED-001", name: "Tamarind Seed Powder", cat: "Industrial", price: 220, stock: 150 },
    { sku: "DF-IRN-001", name: "Iron Booster", cat: "Nutrition", price: 299, stock: 90 },
  ];

  const hsnMap: Record<string, string> = {
    "DF-TAM-001": "08134000",
    "DF-CON-001": "13019099",
    "DF-PWD-001": "13019099",
    "DF-CHU-001": "21039090",
    "DF-HSK-001": "14049090",
    "DF-SED-001": "13019099",
    "DF-IRN-001": "21069099",
  };

  const products = [];
  for (const p of productDefs) {
    const prod = await prisma.product.upsert({
      where: { sku: p.sku },
      update: { stockQty: p.stock, salePrice: p.price, hsnCode: hsnMap[p.sku] },
      create: {
        sku: p.sku,
        barcode: p.sku.replace(/-/g, ""),
        name: p.name,
        categoryId: catMap[p.cat],
        warehouseId: warehouse.id,
        inventoryClass: p.cat === "Raw material" ? "RAW_MATERIAL" : p.cat === "Value-added" ? "FINISHED_GOODS" : p.sku.includes("PWD") ? "PACKAGING" : "FINISHED_GOODS",
        unit: p.cat === "Value-added" ? "jar" : "kg",
        costPrice: p.price * 0.65,
        salePrice: p.price,
        gstPercent: 5,
        hsnCode: hsnMap[p.sku],
        stockQty: p.stock,
        minStockQty: 25,
        safetyStockQty: 15,
        reorderPoint: 30,
        valuationMethod: p.cat === "Raw material" ? "LANDED_COST" : "FIFO",
        rotationPolicy: "FEFO",
      },
    });
    products.push(prod);
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + (p.cat === "Raw material" ? 8 : 14));
    await prisma.batch.upsert({
      where: { productId_batchNumber: { productId: prod.id, batchNumber: "B2026-01" } },
      update: {},
      create: {
        productId: prod.id,
        batchNumber: "B2026-01",
        quantity: p.stock,
        supplierBatch: p.cat === "Raw material" ? "SUP-TAM-2026-01" : null,
        mfgDate: new Date(),
        expiryDate: expiry,
        inventoryStatus: "AVAILABLE",
        qcStatus: "PASSED",
        landedCost: p.price * 0.68,
      },
    });
  }

  const customer = await prisma.customer.upsert({
    where: { id: "cust-demo-1" },
    update: {},
    create: {
      id: "cust-demo-1",
      name: "Forest Foods Mumbai",
      company: "Forest Foods Pvt Ltd",
      email: "buyer@forestfoods.in",
      phone: "919876543210",
      gstin: "27AABCU9603R1ZM",
      address: "Andheri East, Mumbai",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      segment: CustomerSegment.WHOLESALE,
      status: CustomerStatus.ACTIVE,
      creditLimit: 500000,
      packagingPreference: "25 kg HDPE drums",
      moq: "500 kg",
      portalEnabled: true,
      portalEmail: "buyer@forestfoods.in",
      contacts: {
        create: {
          name: "Forest Foods Mumbai",
          email: "buyer@forestfoods.in",
          phone: "919876543210",
          title: "Procurement Head",
          isPrimary: true,
        },
      },
      addresses: {
        create: [
          {
            type: "BILLING",
            line1: "Andheri East, Mumbai",
            city: "Mumbai",
            state: "Maharashtra",
            country: "India",
            isDefault: true,
          },
          {
            type: "SHIPPING",
            line1: "Bhiwandi Warehouse, Thane",
            city: "Thane",
            state: "Maharashtra",
            country: "India",
            isDefault: true,
          },
        ],
      },
    },
  });

  const exportCustomer = await prisma.customer.upsert({
    where: { id: "cust-demo-2" },
    update: {},
    create: {
      id: "cust-demo-2",
      name: "Global Spice Imports",
      company: "Global Spice Imports Pte Ltd",
      email: "sarah@globalspice.com",
      phone: "919900112233",
      segment: CustomerSegment.EXPORT,
      status: CustomerStatus.ACTIVE,
      country: "Singapore",
      creditLimit: 2000000,
      exportRequirements: "FSSAI, ISO 22000, phytosanitary certificate",
      moq: "1 MT",
      packagingPreference: "Food-grade laminated pouches",
      seasonalNotes: "Peak orders Q3–Q4 (festive season)",
      contacts: {
        create: { name: "Sarah Chen", email: "sarah@globalspice.com", phone: "919900112233", isPrimary: true },
      },
    },
  });

  const distributor = await prisma.customer.upsert({
    where: { id: "cust-demo-3" },
    update: {},
    create: {
      id: "cust-demo-3",
      name: "Metro Distributors",
      company: "Metro Distributors Pvt Ltd",
      email: "raj@metrodist.in",
      phone: "919988776655",
      segment: CustomerSegment.DISTRIBUTOR,
      status: CustomerStatus.ACTIVE,
      distributorTerritory: "Maharashtra, Gujarat, Karnataka",
      moq: "200 kg per SKU",
      contacts: {
        create: { name: "Raj Patel", email: "raj@metrodist.in", isPrimary: true },
      },
    },
  });

  void exportCustomer;
  void distributor;

  // Created before quotations because QT-2026-0002 references this lead via leadId.
  await prisma.lead.upsert({
    where: { id: "lead-demo-1" },
    update: {},
    create: {
      id: "lead-demo-1",
      company: "Global Spice Imports",
      contactName: "Sarah Chen",
      email: "sarah@globalspice.com",
      phone: "919900112233",
      stage: LeadStage.NEGOTIATION,
      priority: LeadPriority.HIGH,
      leadSource: LeadSource.LINKEDIN,
      products: "Tamarind powder, concentrate",
      volume: "2 MT/month",
      value: 850000,
      country: "Singapore",
      moq: "500 kg",
      packagingPreference: "25 kg HDPE drums",
      shippingTerms: "FOB Chennai",
      certifications: "FSSAI, ISO 22000",
      assigneeId: sales.id,
      followUpAt: new Date(Date.now() + 3 * 86400000),
      lastContactAt: new Date(),
    },
  });

  const sentLines = [seedQuoteLine(products[2], 2000, 199, "DOMESTIC")];
  const sentTotals = seedQuoteTotals(sentLines, 15000, 0);
  await prisma.quotation.upsert({
    where: { quoteNumber: "QT-2026-0001" },
    update: {},
    create: {
      quoteNumber: "QT-2026-0001",
      customerId: exportCustomer.id,
      userId: sales.id,
      items: sentLines,
      subtotal: sentTotals.subtotal,
      shippingAmount: sentTotals.shippingAmount,
      gstAmount: sentTotals.gstAmount,
      cgstAmount: sentTotals.cgstAmount,
      sgstAmount: sentTotals.sgstAmount,
      igstAmount: sentTotals.igstAmount,
      total: sentTotals.total,
      status: QuotationStatus.SENT,
      taxMode: QuotationTaxMode.DOMESTIC,
      currency: "INR",
      validUntil: new Date(Date.now() + 12 * 86400000),
      sentAt: new Date(Date.now() - 5 * 86400000),
      notes: "Payment: 30% advance, balance against BL copy. Delivery within 21 days.",
      templateKey: "standard",
    },
  });

  const exportLines = [seedQuoteLine(products[2], 2000, 4.5, "EXPORT")];
  const exportTotals = seedQuoteTotals(exportLines, 0, 0);
  await prisma.quotation.upsert({
    where: { quoteNumber: "QT-2026-0002" },
    update: {},
    create: {
      quoteNumber: "QT-2026-0002",
      leadId: "lead-demo-1",
      userId: sales.id,
      items: exportLines,
      subtotal: exportTotals.subtotal,
      gstAmount: exportTotals.gstAmount,
      total: exportTotals.total,
      status: QuotationStatus.NEGOTIATION,
      taxMode: QuotationTaxMode.EXPORT,
      currency: "USD",
      exchangeRate: 83.5,
      validUntil: new Date(Date.now() + 5 * 86400000),
      incoterms: "FOB Chennai",
      pricingTerms: "FOB",
      moq: "1 MT",
      packagingConfig: "25 kg food-grade laminated pouches",
      containerQty: "1 x 20ft container",
      shelfLife: "18 months from manufacture",
      notes: "Phytosanitary certificate and COA included.",
      templateKey: "export",
    },
  });

  const reviewLines = [seedQuoteLine(products[2], 500, 160, "DOMESTIC")];
  const reviewTotals = seedQuoteTotals(reviewLines, 2500, 5000);
  await prisma.quotation.upsert({
    where: { quoteNumber: "QT-2026-0003" },
    update: {},
    create: {
      quoteNumber: "QT-2026-0003",
      customerId: distributor.id,
      userId: sales.id,
      items: reviewLines,
      subtotal: reviewTotals.subtotal,
      discountAmount: reviewTotals.discountAmount,
      shippingAmount: reviewTotals.shippingAmount,
      gstAmount: reviewTotals.gstAmount,
      cgstAmount: reviewTotals.cgstAmount,
      sgstAmount: reviewTotals.sgstAmount,
      total: reviewTotals.total,
      status: QuotationStatus.UNDER_REVIEW,
      taxMode: QuotationTaxMode.DOMESTIC,
      requiresApproval: true,
      validUntil: new Date(Date.now() + 20 * 86400000),
      internalNotes: "Below-list pricing requested for distributor onboarding.",
      templateKey: "institutional",
    },
  });

  const approvedLines = [seedQuoteLine(products[1], 100, 450, "IGST")];
  const approvedTotals = seedQuoteTotals(approvedLines);
  await prisma.quotation.upsert({
    where: { quoteNumber: "QT-2026-0004" },
    update: {},
    create: {
      quoteNumber: "QT-2026-0004",
      customerId: customer.id,
      userId: sales.id,
      items: approvedLines,
      subtotal: approvedTotals.subtotal,
      gstAmount: approvedTotals.gstAmount,
      igstAmount: approvedTotals.igstAmount,
      total: approvedTotals.total,
      status: QuotationStatus.APPROVED,
      taxMode: QuotationTaxMode.IGST,
      validUntil: new Date(Date.now() + 25 * 86400000),
      approvedAt: new Date(Date.now() - 2 * 86400000),
      templateKey: "standard",
    },
  });

  const expiredLines = [seedQuoteLine(products[3], 300, 165, "DOMESTIC")];
  const expiredTotals = seedQuoteTotals(expiredLines);
  await prisma.quotation.upsert({
    where: { quoteNumber: "QT-2026-0005" },
    update: {},
    create: {
      quoteNumber: "QT-2026-0005",
      customerId: customer.id,
      userId: sales.id,
      items: expiredLines,
      subtotal: expiredTotals.subtotal,
      gstAmount: expiredTotals.gstAmount,
      cgstAmount: expiredTotals.cgstAmount,
      sgstAmount: expiredTotals.sgstAmount,
      total: expiredTotals.total,
      status: QuotationStatus.EXPIRED,
      taxMode: QuotationTaxMode.DOMESTIC,
      validUntil: new Date(Date.now() - 3 * 86400000),
      expiredAt: new Date(Date.now() - 3 * 86400000),
      templateKey: "standard",
    },
  });

  const vendor = await prisma.vendor.upsert({
    where: { id: "vendor-demo-1" },
    update: {},
    create: {
      id: "vendor-demo-1",
      code: "VND-FPO-001",
      name: "Bastar FPO Collective",
      classification: "FPO_PARTNER",
      status: "PREFERRED",
      contact: "Ramesh Kumar",
      phone: "919988776655",
      email: "fpo@bastar.in",
      gstin: "22AABFB1234F1Z5",
      address: "Main Road, Jagdalpur",
      city: "Jagdalpur",
      state: "Chhattisgarh",
      pincode: "494001",
      paymentTerms: "NET_30",
      fssaiNumber: "12822000001234",
      bankName: "State Bank of India",
      bankAccount: "3847291056",
      bankIfsc: "SBIN0001234",
      qualityScore: 91.5,
      deliveryScore: 93.2,
      rejectionRate: 1.8,
      isFpoPartner: true,
      fpoRegion: "Bastar · Dantewada",
      seasonalNotes: "Peak procurement Apr–Jun. Monitor moisture during monsoon.",
      moistureLimitPct: 12,
    },
  });

  const vendor2 = await prisma.vendor.upsert({
    where: { id: "vendor-demo-2" },
    update: {},
    create: {
      id: "vendor-demo-2",
      code: "VND-PKG-002",
      name: "EcoPack Solutions",
      classification: "PACKAGING",
      status: "ACTIVE",
      contact: "Priya Sharma",
      phone: "919876543210",
      email: "sales@ecopack.in",
      gstin: "27AACCE5678G1Z9",
      city: "Pune",
      state: "Maharashtra",
      paymentTerms: "NET_15",
      qualityScore: 88,
      deliveryScore: 89.5,
      rejectionRate: 2.5,
    },
  });

  await prisma.vendorDocument.createMany({
    skipDuplicates: true,
    data: [
      { vendorId: vendor.id, docType: "GST_CERTIFICATE", name: "GST Registration 2024", expiresAt: new Date("2027-03-31") },
      { vendorId: vendor.id, docType: "FSSAI_LICENSE", name: "FSSAI Central License", expiresAt: new Date("2026-08-15") },
      { vendorId: vendor.id, docType: "AGREEMENT", name: "Annual Supply Agreement 2026", expiresAt: new Date("2026-12-31") },
      { vendorId: vendor.id, docType: "BANK_DETAILS", name: "Cancelled cheque & bank letter" },
      { vendorId: vendor2.id, docType: "GST_CERTIFICATE", name: "GST Certificate", expiresAt: new Date("2027-01-01") },
    ],
  });

  await prisma.vendorContract.upsert({
    where: { contractNumber: "CNT-2026-FPO-001" },
    update: {},
    create: {
      contractNumber: "CNT-2026-FPO-001",
      vendorId: vendor.id,
      title: "Tamarind raw material supply FY 2026",
      status: "ACTIVE",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      value: 2500000,
      autoRenew: true,
      terms: "Grade A tamarind, max 12% moisture, quarterly price review",
    },
  });

  const rfqSentAt = new Date(Date.now() - 5 * 86400000);
  const rfq = await prisma.procurementRFQ.upsert({
    where: { rfqNumber: "RFQ-2026-0001" },
    update: {
      status: "COMPARED",
      sentAt: rfqSentAt,
      comparisonStartedAt: new Date(),
      budgetAmount: 520000,
      baselinePrice: 255,
      specTamarindGrade: "GRADE_A",
      specMoistureMaxPct: 12,
      specPulpYieldMinPct: 38,
      sourcingType: "MIXED",
      auctionMode: "STANDARD",
      seasonalWindow: "default",
      aiRecommendedVendorId: vendor.id,
    },
    create: {
      rfqNumber: "RFQ-2026-0001",
      title: "Premium tamarind pulp — Q2 2026",
      status: "COMPARED",
      productName: "Raw Tamarind (with seed)",
      quantity: 2000,
      unit: "kg",
      dueDate: new Date(Date.now() + 14 * 86400000),
      notes: "Require FSSAI compliant suppliers. Moisture max 12%.",
      createdById: admin.id,
      sentAt: rfqSentAt,
      comparisonStartedAt: new Date(),
      budgetAmount: 520000,
      baselinePrice: 255,
      specTamarindGrade: "GRADE_A",
      specMoistureMaxPct: 12,
      specPulpYieldMinPct: 38,
      packagingRequirements: "Food-grade HDPE 25kg bags",
      moqRequired: 500,
      sourcingType: "MIXED",
      auctionMode: "STANDARD",
      seasonalWindow: "default",
      aiRecommendedVendorId: vendor.id,
    },
  });

  await prisma.vendorRFQQuote.deleteMany({ where: { rfqId: rfq.id } }).catch(() => undefined);
  await prisma.vendorRFQQuote.createMany({
    data: [
      {
        rfqId: rfq.id,
        vendorId: vendor.id,
        unitPrice: 245,
        totalPrice: 490000,
        deliveryDays: 7,
        moq: 500,
        moisturePct: 11.2,
        pulpYieldPct: 39,
        tamarindGrade: "GRADE_A",
        qualityScore: 92,
        complianceScore: 94,
        reliabilityScore: 91,
        responseHours: 18,
      },
      {
        rfqId: rfq.id,
        vendorId: vendor2.id,
        unitPrice: 238,
        totalPrice: 476000,
        deliveryDays: 10,
        moq: 1000,
        moisturePct: 12.8,
        pulpYieldPct: 36,
        tamarindGrade: "GRADE_B",
        qualityScore: 86,
        complianceScore: 82,
        reliabilityScore: 88,
        responseHours: 32,
      },
    ],
  });

  await prisma.rFQEvent.createMany({
    skipDuplicates: true,
    data: [
      { rfqId: rfq.id, eventType: "CREATED", title: "RFQ drafted", userId: admin.id },
      { rfqId: rfq.id, eventType: "SENT", title: "RFQ sent to vendors", userId: admin.id },
      { rfqId: rfq.id, eventType: "QUOTE_RECEIVED", title: "Quote from Bastar Agro FPO", vendorId: vendor.id },
      { rfqId: rfq.id, eventType: "QUOTE_RECEIVED", title: "Quote from Raipur Traders", vendorId: vendor2.id },
      { rfqId: rfq.id, eventType: "COMPARISON_STARTED", title: "Comparison matrix opened", userId: admin.id },
    ],
  }).catch(() => undefined);

  const inv = await prisma.saleInvoice.upsert({
    where: { invoiceNumber: "INV-2026-0001" },
    update: {},
    create: {
      invoiceNumber: "INV-2026-0001",
      customerId: customer.id,
      userId: sales.id,
      subtotal: 1990,
      gstAmount: 99.5,
      cgstAmount: 49.75,
      sgstAmount: 49.75,
      total: 2089.5,
      paidAmount: 2089.5,
      status: InvoiceStatus.PAID,
      paymentStatus: PaymentStatus.PAID,
      paidAt: new Date(),
      stockDeducted: true,
      items: {
        create: [
          {
            productId: products[2].id,
            quantity: 10,
            unitPrice: 199,
            gstPercent: 5,
            gstAmount: 99.5,
            lineTotal: 2089.5,
          },
        ],
      },
    },
  });

  await prisma.purchase.upsert({
    where: { purchaseNumber: "PUR-2026-0001" },
    update: {},
    create: {
      purchaseNumber: "PUR-2026-0001",
      vendorId: vendor.id,
      userId: admin.id,
      subtotal: 50000,
      gstAmount: 2500,
      total: 52500,
      paymentStatus: PaymentStatus.PENDING,
      procurementStage: "BILLED",
      paymentTerms: "NET_30",
      dueDate: new Date(Date.now() + 20 * 86400000),
      items: {
        create: [
          {
            productId: products[0].id,
            quantity: 200,
            unitPrice: 250,
            gstPercent: 5,
            gstAmount: 2500,
            lineTotal: 52500,
          },
        ],
      },
      rfqId: rfq.id,
      billRecordedAt: new Date(),
      expectedDelivery: new Date(Date.now() + 7 * 86400000),
      grn: {
        create: {
          grnNumber: "GRN-2026-0001",
          status: "RECEIVED",
          lifecycle: "STOCK_UPDATED",
          receivedAt: new Date(),
          deliveryReceivedAt: new Date(Date.now() - 86400000),
          moisturePct: 11.5,
          acidityPct: 3.2,
          pulpYieldPct: 39,
          seedRatioPct: 16,
          foreignMatterPct: 0.6,
          microbialPass: true,
          tamarindGrade: "GRADE_A",
          qcPassed: true,
          qcNotes: "Grade A tamarind — passed QC",
          stockUpdated: true,
          intakeValue: 52500,
          fssaiCompliant: true,
          haccpCompliant: true,
          isoCompliant: true,
          barcodeData: "GRN-2026-0001",
        },
      },
    },
  });

  const demoPurchase = await prisma.purchase.findUnique({
    where: { purchaseNumber: "PUR-2026-0001" },
    include: { grn: true, items: true },
  });

  if (demoPurchase?.grn) {
    await prisma.warehouseBin.createMany({
      skipDuplicates: true,
      data: [
        { warehouseId: warehouse.id, code: "A-01", zone: "Raw material", rack: "R1", aisle: "A", capacityKg: 5000 },
        { warehouseId: warehouse.id, code: "A-02", zone: "Raw material", rack: "R1", aisle: "B", capacityKg: 5000 },
        { warehouseId: warehouse.id, code: "Q-01", zone: "Quarantine", rack: "Q1", aisle: "Q", capacityKg: 2000 },
        { warehouseId: warehouse.id, code: "FG-01", zone: "Finished goods", rack: "F1", aisle: "1", capacityKg: 3000 },
      ],
    });

    const bin = await prisma.warehouseBin.findFirst({ where: { warehouseId: warehouse.id, code: "A-01" } });

    await prisma.gRNItem.createMany({
      skipDuplicates: true,
      data: demoPurchase.items.map((item, i) => ({
        grnId: demoPurchase.grn!.id,
        purchaseItemId: item.id,
        productId: item.productId,
        orderedQty: item.quantity,
        receivedQty: item.quantity,
        damagedQty: i === 0 ? 2 : 0,
        acceptedQty: item.quantity,
        batchNumber: `BT-2026-${String(40 + i).padStart(3, "0")}`,
        supplierBatch: `SUP-BST-${40 + i}`,
        warehouseBatch: `WH-2026-${String(40 + i).padStart(3, "0")}`,
        moisturePct: 11.5,
        acidityPct: 3.2,
        pulpYieldPct: 39,
        seedRatioPct: 16,
        foreignMatterPct: 0.6,
        microbialPass: true,
        tamarindGrade: "GRADE_A" as const,
        qcStatus: "PASSED" as const,
        warehouseId: warehouse.id,
        binId: bin?.id,
        fifoRank: i + 1,
      })),
    });

    await prisma.gRNEvent.createMany({
      data: [
        { grnId: demoPurchase.grn.id, eventType: "DELIVERY_RECEIVED", title: "Delivery received at gate" },
        { grnId: demoPurchase.grn.id, eventType: "GRN_CREATED", title: "GRN posted" },
        { grnId: demoPurchase.grn.id, eventType: "QC_APPROVED", title: "QC approved — Grade A" },
        { grnId: demoPurchase.grn.id, eventType: "STOCK_UPDATED", title: "Stock posted to warehouse A-01" },
      ],
    });

    await prisma.complianceAuditLog.createMany({
      data: [
        { grnId: demoPurchase.grn.id, standard: "FSSAI", passed: true, checklist: { moisture: 11.5 } },
        { grnId: demoPurchase.grn.id, standard: "HACCP", passed: true, checklist: { ccp: "intake" } },
        { grnId: demoPurchase.grn.id, standard: "ISO_22000", passed: true, checklist: { doc: "GRN-2026-0001" } },
      ],
    });
  }

  if (demoPurchase) {
    const dueAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await prisma.procurementApproval.createMany({
      skipDuplicates: true,
      data: [
        {
          purchaseId: demoPurchase.id,
          approvalType: "PROCUREMENT",
          status: "APPROVED",
          approvedAt: new Date(),
          slaTargetHours: 48,
        },
        {
          purchaseId: demoPurchase.id,
          approvalType: "FINANCE",
          status: "APPROVED",
          approvedAt: new Date(),
          slaTargetHours: 48,
        },
        {
          purchaseId: demoPurchase.id,
          approvalType: "INVENTORY",
          status: "PENDING",
          dueAt,
          slaTargetHours: 48,
        },
        {
          purchaseId: demoPurchase.id,
          approvalType: "BUDGET",
          status: "PENDING",
          dueAt,
          slaTargetHours: 48,
        },
        {
          purchaseId: demoPurchase.id,
          approvalType: "QUALITY_CONTROL",
          status: "PENDING",
          dueAt,
          slaTargetHours: 36,
        },
      ],
    });

    await prisma.approvalWorkflowEvent.createMany({
      data: [
        {
          purchaseId: demoPurchase.id,
          approvalType: "PROCUREMENT",
          action: "APPROVE",
          title: "Procurement — Approved",
          detail: "Vendor terms and line items verified",
        },
        {
          purchaseId: demoPurchase.id,
          approvalType: "FINANCE",
          action: "APPROVE",
          title: "Finance — Approved",
          detail: "Payment terms within policy",
        },
        {
          purchaseId: demoPurchase.id,
          action: "BUDGET_VALIDATE",
          title: "Budget validation executed",
          detail: "Within department raw material budget for May",
        },
      ],
    });

    await prisma.approvalComment.createMany({
      data: [
        {
          purchaseId: demoPurchase.id,
          userId: admin.id,
          body: "Please confirm warehouse capacity before inventory sign-off.",
          approvalType: "INVENTORY",
        },
      ],
    });
  }

  await prisma.approvalMatrixRule.createMany({
    skipDuplicates: true,
    data: [
      {
        name: "Standard PO (< ₹5L)",
        maxPoValue: 500000,
        requiredLevels: ["PROCUREMENT", "FINANCE", "INVENTORY", "BUDGET"],
        slaHours: 48,
      },
      {
        name: "High-value PO (≥ ₹5L)",
        minPoValue: 500000,
        maxPoValue: 2000000,
        requiredLevels: ["PROCUREMENT", "FINANCE", "INVENTORY", "BUDGET", "COMPLIANCE"],
        escalateAbove: 1000000,
        slaHours: 24,
        requiresCompliance: true,
      },
      {
        name: "Raw material QC gate",
        minPoValue: 100000,
        classification: "RAW_MATERIAL",
        requiredLevels: ["PROCUREMENT", "FINANCE", "INVENTORY", "BUDGET", "QUALITY_CONTROL"],
        slaHours: 36,
        requiresQc: true,
      },
      {
        name: "FPO seasonal procurement",
        classification: "FPO_PARTNER",
        requiredLevels: ["PROCUREMENT", "FINANCE", "INVENTORY", "BUDGET", "SEASONAL_PROCUREMENT"],
        slaHours: 72,
        seasonalOnly: true,
      },
    ],
  });

  await prisma.procurementBudget.createMany({
    skipDuplicates: true,
    data: [
      {
        fiscalYear: 2026,
        month: 5,
        label: "Raw materials — May",
        classification: "RAW_MATERIAL",
        department: "Procurement",
        region: "Chhattisgarh",
        budgetAmount: 800000,
        spentAmount: 52500,
        committedAmount: 120000,
        alertThresholdPct: 90,
        warningThresholdPct: 70,
        criticalThresholdPct: 90,
        lockThresholdPct: 100,
        status: "ACTIVE",
        enforcementLevel: "ESCALATE",
        scenario: "EXPECTED",
        seasonalFlag: true,
        yieldBudgetPct: 92,
        forecastAmount: 680000,
      },
      {
        fiscalYear: 2026,
        month: 5,
        label: "Packaging — May",
        classification: "PACKAGING",
        department: "Operations",
        budgetAmount: 150000,
        spentAmount: 42000,
        committedAmount: 18000,
        alertThresholdPct: 85,
        warningThresholdPct: 70,
        criticalThresholdPct: 90,
        packagingForecast: 145000,
        logisticsForecast: 22000,
        status: "ACTIVE",
        enforcementLevel: "WARN",
        scenario: "EXPECTED",
      },
      {
        fiscalYear: 2026,
        label: "FPO partners — FY",
        classification: "FPO_PARTNER",
        department: "Farmer Relations",
        region: "Dandakaranya",
        budgetAmount: 2500000,
        spentAmount: 490000,
        committedAmount: 310000,
        alertThresholdPct: 90,
        warningThresholdPct: 70,
        criticalThresholdPct: 90,
        fpoAllocationPct: 35,
        seasonalFlag: true,
        status: "ACTIVE",
        enforcementLevel: "ESCALATE",
        scenario: "INFLATION_ADJUSTED",
        inflationRatePct: 6.5,
        planHorizonYears: 3,
      },
    ],
  });

  const rawBudget = await prisma.procurementBudget.findFirst({
    where: { label: "Raw materials — May" },
  });

  const multiYearPlan = await prisma.budgetMultiYearPlan.create({
    data: {
      name: "FY2026–2028 Procurement Plan",
      startYear: 2026,
      endYear: 2028,
      scenario: "EXPECTED",
      totalPlanned: 12500000,
      notes: "Tamarind raw material, FPO sourcing, packaging expansion",
    },
  });

  if (rawBudget) {
    await prisma.budgetAuditLog.createMany({
      data: [
        { budgetId: rawBudget.id, action: "CREATED", title: "Budget line created for May raw materials" },
        { budgetId: rawBudget.id, action: "FORECAST_UPDATED", title: "AI forecast: ₹680,000/mo seasonal uplift applied" },
      ],
    });

    await prisma.budgetForecastPoint.createMany({
      data: [
        { budgetId: rawBudget.id, periodYear: 2026, periodMonth: 3, scenario: "EXPECTED", plannedAmount: 750000, actualAmount: 620000, forecastAmount: 640000, aiForecastAmount: 635000 },
        { budgetId: rawBudget.id, periodYear: 2026, periodMonth: 4, scenario: "EXPECTED", plannedAmount: 800000, actualAmount: 710000, forecastAmount: 680000, aiForecastAmount: 672000 },
        { budgetId: rawBudget.id, periodYear: 2026, periodMonth: 5, scenario: "OPTIMISTIC", plannedAmount: 800000, forecastAmount: 720000, aiForecastAmount: 715000 },
        { budgetId: rawBudget.id, periodYear: 2026, periodMonth: 5, scenario: "INFLATION_ADJUSTED", plannedAmount: 800000, forecastAmount: 852000, aiForecastAmount: 848000 },
      ],
    });

    if (demoPurchase) {
      await prisma.budgetPurchaseLink.create({
        data: {
          budgetId: rawBudget.id,
          purchaseId: demoPurchase.id,
          committedAmount: demoPurchase.total,
          status: "COMMITTED",
        },
      });
      await prisma.purchase.update({
        where: { id: demoPurchase.id },
        data: { budgetId: rawBudget.id },
      });
    }
  }

  await prisma.procurementBudget.updateMany({
    where: { multiYearPlanId: null },
    data: { multiYearPlanId: multiYearPlan.id },
  });

  await prisma.vendorQualityRecord.createMany({
    skipDuplicates: true,
    data: [
      {
        vendorId: vendor.id,
        productName: "Raw Tamarind",
        batchRef: "BT-2026-042",
        tamarindGrade: "GRADE_A",
        moisturePct: 11.5,
        rejectionPct: 1.2,
        qualityScore: 92,
        passed: true,
      },
      {
        vendorId: vendor.id,
        productName: "Raw Tamarind",
        batchRef: "BT-2026-038",
        tamarindGrade: "PREMIUM",
        moisturePct: 10.8,
        rejectionPct: 0.5,
        qualityScore: 95,
        passed: true,
      },
    ],
  });

  const demoLeads = [
    {
      id: "lead-demo-2",
      company: "Fresh Foods Dubai",
      contactName: "Ahmed Al-Rashid",
      email: "ahmed@freshfoods.ae",
      phone: "971501234567",
      stage: LeadStage.PROPOSAL_SENT,
      priority: LeadPriority.URGENT,
      leadSource: LeadSource.TRADE_FAIR,
      value: 1200000,
      country: "UAE",
      products: "Tamarind paste, puliogare mix",
    },
    {
      id: "lead-demo-3",
      company: "Organic Mart UK",
      contactName: "Emma Watson",
      email: "emma@organicmart.co.uk",
      phone: "447700900123",
      stage: LeadStage.SAMPLE_SENT,
      priority: LeadPriority.MEDIUM,
      leadSource: LeadSource.WEBSITE,
      value: 450000,
      country: "United Kingdom",
      products: "Organic tamarind blocks",
      tastingFeedback: "Positive on aroma; requested lower moisture spec",
    },
    {
      id: "lead-demo-4",
      company: "Metro Distributors",
      contactName: "Raj Patel",
      email: "raj@metrodist.in",
      phone: "919876543210",
      stage: LeadStage.QUALIFIED,
      priority: LeadPriority.HIGH,
      leadSource: LeadSource.DISTRIBUTOR,
      value: 650000,
      country: "India",
      distributorName: "Metro Distributors Pvt Ltd",
      products: "Bulk tamarind, spice blends",
    },
    {
      id: "lead-demo-5",
      company: "WhatsApp Enquiry — Chennai",
      contactName: "Priya S",
      phone: "919988776655",
      stage: LeadStage.NEW,
      priority: LeadPriority.LOW,
      leadSource: LeadSource.WHATSAPP,
      products: "Retail tamarind packs",
    },
  ] as const;

  for (const lead of demoLeads) {
    await prisma.lead.upsert({
      where: { id: lead.id },
      update: {},
      create: { ...lead, assigneeId: sales.id },
    });
  }

  await prisma.leadCommunication.createMany({
    data: [
      {
        leadId: "lead-demo-1",
        channel: CommunicationChannel.MEETING,
        message: "Video call — discussed MOQ and export documentation",
        userId: sales.id,
      },
      {
        leadId: "lead-demo-1",
        channel: CommunicationChannel.QUOTATION,
        message: "Sent quotation QT-2026-001 for 2 MT tamarind powder",
        userId: sales.id,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.leadTask.createMany({
    data: [
      {
        leadId: "lead-demo-1",
        title: "Send revised pricing for 2 MT order",
        dueAt: new Date(Date.now() + 2 * 86400000),
        assigneeId: sales.id,
      },
      {
        leadId: "lead-demo-3",
        title: "Collect tasting feedback from buyer",
        dueAt: new Date(Date.now() + 86400000),
        assigneeId: sales.id,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.activityLog.createMany({
    data: [
      {
        userId: admin.id,
        userName: admin.name,
        action: ActivityAction.LOGIN,
        entityType: "User",
        entityId: admin.id,
        message: "Admin signed in",
        ipAddress: "127.0.0.1",
      },
      {
        userId: sales.id,
        userName: sales.name,
        action: ActivityAction.CREATE,
        entityType: "SaleInvoice",
        entityId: inv.id,
        message: `Created invoice INV-2026-0001`,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.salesOrder.upsert({
    where: { orderNumber: "SO-2026-0001" },
    update: {},
    create: {
      orderNumber: "SO-2026-0001",
      customerId: customer.id,
      userId: sales.id,
      branchId: branch.id,
      status: OrderStatus.CONFIRMED,
      deliveryStatus: DeliveryStatus.IN_TRANSIT,
      subtotal: 3980,
      gstAmount: 199,
      total: 4179,
      items: {
        create: [
          {
            productId: products[2].id,
            quantity: 20,
            unitPrice: 199,
            gstPercent: 5,
            gstAmount: 199,
            lineTotal: 4179,
          },
        ],
      },
    },
  });

  const convertedOrder = await prisma.salesOrder.findUniqueOrThrow({
    where: { orderNumber: "SO-2026-0001" },
  });
  const convertedLines = [seedQuoteLine(products[2], 20, 199, "DOMESTIC")];
  const convertedTotals = seedQuoteTotals(convertedLines);
  await prisma.quotation.upsert({
    where: { quoteNumber: "QT-2026-0006" },
    update: {},
    create: {
      quoteNumber: "QT-2026-0006",
      customerId: customer.id,
      userId: sales.id,
      items: convertedLines,
      subtotal: convertedTotals.subtotal,
      gstAmount: convertedTotals.gstAmount,
      cgstAmount: convertedTotals.cgstAmount,
      sgstAmount: convertedTotals.sgstAmount,
      total: convertedTotals.total,
      status: QuotationStatus.CONVERTED,
      taxMode: QuotationTaxMode.DOMESTIC,
      validUntil: new Date(Date.now() + 30 * 86400000),
      convertedOrderId: convertedOrder.id,
      approvedAt: new Date(Date.now() - 10 * 86400000),
      sentAt: new Date(Date.now() - 12 * 86400000),
      templateKey: "standard",
    },
  });

  const recipe = await prisma.recipe.upsert({
    where: { id: "recipe-powder-1" },
    update: {
      expectedYieldPct: 94,
      standardCycleMin: 480,
      stages: { MIXING: 60, HEATING: 120, DRYING: 180, GRINDING: 90, PACKING: 30 },
    },
    create: {
      id: "recipe-powder-1",
      name: "Tamarind Powder Batch",
      productId: products[2].id,
      yieldQty: 100,
      yieldUnit: "kg",
      expectedYieldPct: 94,
      standardCycleMin: 480,
      stages: { MIXING: 60, HEATING: 120, DRYING: 180, GRINDING: 90, PACKING: 30 },
      lines: {
        create: [{ productId: products[0].id, quantity: 120, unit: "kg", scrapPct: 2 }],
      },
    },
  });

  await seedProductionEnterprise({
    adminId: admin.id,
    branchId: branch.id,
    recipeId: recipe.id,
    rawProductId: products[0].id,
    finishedProductId: products[2].id,
  });

  await prisma.expense.createMany({
    data: [
      { category: ExpenseCategory.RAW_MATERIAL, amount: 25000, description: "FPO tamarind procurement", branchId: branch.id, userId: admin.id },
      { category: ExpenseCategory.LOGISTICS, amount: 4500, description: "Freight to Mumbai", branchId: branch.id, userId: admin.id },
    ],
    skipDuplicates: true,
  });

  const cash = await prisma.ledgerAccount.upsert({
    where: { code: "1000" },
    update: {},
    create: { code: "1000", name: "Cash", type: LedgerAccountType.ASSET },
  });
  const salesAcc = await prisma.ledgerAccount.upsert({
    where: { code: "4000" },
    update: {},
    create: { code: "4000", name: "Sales Revenue", type: LedgerAccountType.REVENUE },
  });
  await prisma.ledgerEntry.createMany({
    data: [
      { accountId: cash.id, debit: 2089.5, credit: 0, description: "Invoice payment INV-2026-0001" },
      { accountId: salesAcc.id, debit: 0, credit: 2089.5, description: "Invoice payment INV-2026-0001" },
    ],
    skipDuplicates: true,
  });

  const emp = await prisma.employee.upsert({
    where: { employeeNo: "EMP-001" },
    update: { biometricUserId: "1" },
    create: {
      employeeNo: "EMP-001",
      name: "Balarama T",
      email: "t.balarama@gmail.com",
      department: "Management",
      designation: "Director",
      salary: 85000,
      branchId: branch.id,
      userId: admin.id,
      biometricUserId: "1",
    },
  });

  await prisma.biometricDevice.upsert({
    where: { apiKey: "demo-key-sukma-gate" },
    update: {},
    create: {
      name: "Main Gate — ZKTeco K40",
      provider: "ZKTECO",
      ipAddress: "192.168.1.201",
      port: 4370,
      serialNo: "ZK-SKM-001",
      apiKey: "demo-key-sukma-gate",
      branchId: branch.id,
      status: "ONLINE",
      enabled: true,
    },
  });

  await prisma.biometricDevice.upsert({
    where: { apiKey: "demo-key-secureye-aif600" },
    update: {},
    create: {
      name: "Reception — Secureye S-AIF600",
      provider: "SECUREYE_S_AIF600",
      ipAddress: "192.168.1.210",
      port: 4370,
      serialNo: "S-AIF600-SKM-01",
      apiKey: "demo-key-secureye-aif600",
      branchId: branch.id,
      status: "ONLINE",
      enabled: true,
    },
  });

  await prisma.apiIntegration.upsert({
    where: { provider: "biometric" },
    update: {},
    create: {
      provider: "biometric",
      label: "Biometric attendance",
      enabled: true,
      config: { webhookPath: "/api/v1/hr/biometric/webhook", defaultPort: 4370 },
    },
  });

  await prisma.leadCommunication.create({
    data: {
      leadId: "lead-demo-1",
      userId: sales.id,
      channel: CommunicationChannel.WHATSAPP,
      message: "Shared product catalog and FSSAI certificate via WhatsApp.",
    },
  });

  await prisma.apiIntegration.upsert({
    where: { provider: "whatsapp" },
    update: {},
    create: { provider: "whatsapp", label: "WhatsApp Business", enabled: false, config: { phoneNumberId: "" } },
  });

  await prisma.auditTrail.create({
    data: {
      userId: admin.id,
      action: "SEED",
      entityType: "Database",
      after: { message: "ERP extended seed completed" },
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        title: "Low stock alert",
        message: "Tamarind Husk Powder is below minimum stock.",
        link: "/inventory",
        category: "INVENTORY",
        severity: "WARNING",
        ruleKey: "seed-low-stock-1",
        actions: [
          { type: "VIEW_DETAILS", label: "View inventory", href: "/inventory" },
          { type: "RESOLVE", label: "Resolve" },
        ],
      },
      {
        userId: sales.id,
        title: "Quotation expiring soon",
        message: "QT-2026-0002 (Global Spice) expires in 5 days — follow up on export negotiation.",
        link: "/quotations",
        category: "SALES",
        severity: "WARNING",
        ruleKey: "seed-quote-expiry-1",
        actions: [{ type: "VIEW_DETAILS", label: "View quotations", href: "/quotations?expiring=1" }],
      },
      {
        userId: sales.id,
        title: "Follow-up due",
        message: "Global Spice Imports — follow up scheduled.",
        link: "/leads",
        category: "SALES",
        severity: "INFO",
        ruleKey: "seed-lead-1",
        actions: [{ type: "VIEW_DETAILS", label: "View lead", href: "/leads" }],
      },
      {
        userId: admin.id,
        title: "Purchase approval required",
        message: "GRN pending manager approval — review procurement workflow.",
        link: "/purchases",
        category: "APPROVAL",
        severity: "WARNING",
        ruleKey: "seed-approval-1",
        actions: [
          { type: "APPROVE", label: "Approve", href: "/purchases" },
          { type: "REJECT", label: "Reject", href: "/purchases" },
        ],
      },
    ],
    skipDuplicates: true,
  });

  await seedInventoryEnterprise(products, warehouse.id, admin.id);
  await seedWarehouseEnterprise({
    adminId: admin.id,
    branchId: branch.id,
    raipurBranchId: raipurBranch.id,
    dcId: dc.id,
    warehouseId: warehouse.id,
    warehouseColdId: warehouseCold.id,
    warehouseRaipurId: warehouseRaipur.id,
    productId: products.find((p) => p.sku === "DF-TAM-001")?.id,
  });

  console.log("Seed complete. Login: t.balarama@gmail.com /", PASSWORD);
}

async function seedInventoryEnterprise(products: { id: string; sku: string }[], warehouseId: string, adminId: string) {
  const rawProduct = products.find((p) => p.sku === "DF-TAM-001");
  if (!rawProduct) return;

  await prisma.stockMovement.createMany({
    skipDuplicates: true,
    data: [
      { productId: rawProduct.id, warehouseId, type: "GRN", quantity: 500, reference: "GRN-2026-0001", referenceType: "GRN", unit: "kg" },
      { productId: rawProduct.id, warehouseId, type: "PRODUCTION_OUT", quantity: 120, reference: "PB-2026-001", referenceType: "PRODUCTION", unit: "kg" },
    ],
  });

  await prisma.inventoryAuditLog.createMany({
    data: [
      { productId: rawProduct.id, action: "CYCLE_COUNT", title: "Cycle count completed — variance within tolerance", actorId: adminId },
      { productId: rawProduct.id, action: "REORDER_TRIGGER", title: "Reorder point review — stock healthy", actorId: adminId },
    ],
  });

  await prisma.inventoryForecastPoint.createMany({
    skipDuplicates: true,
    data: [
      { productId: rawProduct.id, periodYear: 2026, periodMonth: 3, demandForecast: 400, actualDemand: 380, aiForecast: 395 },
      { productId: rawProduct.id, periodYear: 2026, periodMonth: 4, demandForecast: 450, actualDemand: 420, aiForecast: 440 },
      { productId: rawProduct.id, periodYear: 2026, periodMonth: 5, demandForecast: 500, aiForecast: 485 },
    ],
  });

  const wh2 = await prisma.warehouse.findFirst({ where: { id: { not: warehouseId } } });
  if (wh2) {
    await prisma.warehouseTransfer.create({
      data: {
        transferNumber: "WT-2026-0001",
        fromWarehouseId: warehouseId,
        toWarehouseId: wh2.id,
        status: "IN_TRANSIT",
        items: { create: [{ productId: rawProduct.id, quantity: 50, unit: "kg" }] },
      },
    }).catch(() => undefined);
  }
}

async function seedWarehouseEnterprise(input: {
  adminId: string;
  branchId: string;
  raipurBranchId: string;
  dcId: string;
  warehouseId: string;
  warehouseColdId: string;
  warehouseRaipurId: string;
  productId?: string;
}) {
  const zoneRaw = await prisma.warehouseZone.upsert({
    where: { warehouseId_code: { warehouseId: input.warehouseId, code: "RM-A" } },
    update: {},
    create: {
      warehouseId: input.warehouseId,
      code: "RM-A",
      name: "Raw material zone A",
      zoneType: "RAW_MATERIAL",
      capacityKg: 50000,
      usedKg: 18000,
    },
  });

  const rack = await prisma.warehouseRack.upsert({
    where: { zoneId_code: { zoneId: zoneRaw.id, code: "R1" } },
    update: {},
    create: { zoneId: zoneRaw.id, code: "R1", name: "Rack 1", capacityKg: 10000 },
  });

  const shelf = await prisma.warehouseShelf.upsert({
    where: { rackId_code: { rackId: rack.id, code: "S1" } },
    update: {},
    create: { rackId: rack.id, code: "S1", name: "Shelf 1", capacityKg: 2500 },
  });

  await prisma.warehouseZone.upsert({
    where: { warehouseId_code: { warehouseId: input.warehouseId, code: "Q-01" } },
    update: {},
    create: {
      warehouseId: input.warehouseId,
      code: "Q-01",
      name: "Quarantine yard",
      zoneType: "QUARANTINE",
      capacityKg: 5000,
      usedKg: 800,
    },
  });

  await prisma.regionalDistributionPlan.upsert({
    where: { id: "rdp-cg-2026" },
    update: {},
    create: {
      id: "rdp-cg-2026",
      branchId: input.raipurBranchId,
      region: "Central India",
      planYear: 2026,
      planMonth: 5,
      targetVolume: 120000,
      actualVolume: 78000,
      skuMix: { RAW_MATERIAL: 45, FINISHED_GOODS: 35, PACKAGING: 20 },
    },
  }).catch(() =>
    prisma.regionalDistributionPlan.create({
      data: {
        branchId: input.raipurBranchId,
        region: "Central India",
        planYear: 2026,
        planMonth: 5,
        targetVolume: 120000,
        actualVolume: 78000,
      },
    }),
  );

  await prisma.warehouseStaffAssignment.upsert({
    where: {
      warehouseId_userId_staffRole: {
        warehouseId: input.warehouseId,
        userId: input.adminId,
        staffRole: "MANAGER",
      },
    },
    update: { active: true },
    create: {
      warehouseId: input.warehouseId,
      userId: input.adminId,
      staffRole: "MANAGER",
      isPrimary: true,
    },
  });

  await prisma.warehouseTask.createMany({
    skipDuplicates: true,
    data: [
      { warehouseId: input.warehouseId, taskType: "PUTAWAY", title: "Putaway GRN pallets to A-01", priority: 2, status: "OPEN" },
      { warehouseId: input.warehouseId, taskType: "CYCLE_COUNT", title: "Cycle count — Raw material zone", priority: 3, status: "ASSIGNED", assignedToId: input.adminId },
      { warehouseId: input.warehouseColdId, taskType: "QC_HOLD", title: "Monitor cold chain readings", priority: 1, status: "IN_PROGRESS" },
    ],
  });

  await prisma.warehouseEnvironmentalReading.createMany({
    skipDuplicates: true,
    data: [
      { warehouseId: input.warehouseColdId, temperatureC: 4.2, humidityPct: 58, inRange: true },
      { warehouseId: input.warehouseColdId, temperatureC: 9.1, humidityPct: 72, inRange: false, alertTriggered: true },
    ],
  });

  await prisma.dockAppointment.upsert({
    where: { appointmentNo: "DOCK-2026-0001" },
    update: {},
    create: {
      appointmentNo: "DOCK-2026-0001",
      warehouseId: input.warehouseRaipurId,
      dockBay: "Bay-2",
      carrierName: "CG Freight Co",
      vehicleNumber: "CG-04-AB-1234",
      scheduledAt: new Date(Date.now() + 86400000),
    },
  });

  if (input.productId) {
    await prisma.warehouseTransfer.upsert({
      where: { transferNumber: "WT-2026-0002" },
      update: {},
      create: {
        transferNumber: "WT-2026-0002",
        fromWarehouseId: input.warehouseId,
        toWarehouseId: input.warehouseRaipurId,
        status: "PENDING_APPROVAL",
        initiatedById: input.adminId,
        items: { create: [{ productId: input.productId, quantity: 100, unit: "kg" }] },
      },
    });

    await prisma.pickPackDispatch.upsert({
      where: { dispatchNumber: "PPD-2026-0001" },
      update: {},
      create: {
        dispatchNumber: "PPD-2026-0001",
        warehouseId: input.warehouseRaipurId,
        status: "PICKING",
        assignedToId: input.adminId,
        lines: { create: [{ productId: input.productId, quantity: 40, pickedQty: 20, unit: "kg" }] },
      },
    });

    await prisma.warehouseForecastPoint.createMany({
      skipDuplicates: true,
      data: [
        {
          warehouseId: input.warehouseId,
          productId: input.productId,
          periodYear: 2026,
          periodMonth: 5,
          demandForecast: 520,
          replenishmentQty: 180,
          aiOptimizedQty: 195,
          utilizationPct: 37.5,
        },
      ],
    });
  }

  await prisma.warehouseAuditLog.createMany({
    skipDuplicates: true,
    data: [
      { warehouseId: input.warehouseId, action: "CREATED", title: "Enterprise WMS configuration seeded", actorId: input.adminId },
      { warehouseId: input.warehouseColdId, action: "ENVIRONMENT_ALERT", title: "Cold storage humidity spike detected", actorId: input.adminId },
    ],
  });
}

async function seedProductionEnterprise(input: {
  adminId: string;
  branchId: string;
  recipeId: string;
  rawProductId: string;
  finishedProductId: string;
}) {
  const machine = await prisma.productionMachine.upsert({
    where: { code: "MIX-01" },
    update: { branchId: input.branchId },
    create: {
      code: "MIX-01",
      name: "Mixing Line 1",
      line: "Line A",
      branchId: input.branchId,
      status: "ACTIVE",
      capacityKgPerHour: 150,
      throughputActual: 120,
      downtimeMinutes: 45,
      nextMaintenanceAt: new Date(Date.now() + 14 * 86400000),
    },
  });

  await prisma.productionMachine.upsert({
    where: { code: "DRY-01" },
    update: {},
    create: {
      code: "DRY-01",
      name: "Dryer Unit 1",
      line: "Line B",
      branchId: input.branchId,
      status: "ACTIVE",
      capacityKgPerHour: 100,
    },
  });

  const shift = await prisma.productionShift.upsert({
    where: { branchId_code: { branchId: input.branchId, code: "A" } },
    update: {},
    create: { branchId: input.branchId, code: "A", name: "Morning shift", startTime: "06:00", endTime: "14:00" },
  });

  const start = new Date();
  start.setHours(8, 0, 0, 0);
  const end = new Date(start.getTime() + 8 * 3600000);

  const batch = await prisma.productionBatch.upsert({
    where: { batchCode: "PRD-2026-001" },
    update: {
      machineId: machine.id,
      shiftId: shift.id,
      currentStage: "HEATING",
      scheduledStart: start,
      scheduledEnd: end,
    },
    create: {
      batchCode: "PRD-2026-001",
      recipeId: input.recipeId,
      branchId: input.branchId,
      machineId: machine.id,
      shiftId: shift.id,
      status: ProductionStatus.IN_PROGRESS,
      currentStage: "HEATING",
      plannedQty: 100,
      expectedYieldPct: 94,
      materialCost: 15000,
      laborCost: 3000,
      machineCost: 1200,
      utilityCost: 800,
      totalCost: 20000,
      scheduledStart: start,
      scheduledEnd: end,
      releasedAt: new Date(start.getTime() - 3600000),
      startedAt: start,
    },
  });

  const wo = await prisma.productionWorkOrder.upsert({
    where: { orderNumber: "WO-2026-0001" },
    update: {},
    create: {
      orderNumber: "WO-2026-0001",
      recipeId: input.recipeId,
      branchId: input.branchId,
      machineId: machine.id,
      batchId: batch.id,
      status: ProductionStatus.IN_PROGRESS,
      priority: "HIGH",
      plannedQty: 100,
      plannedStart: start,
      plannedEnd: end,
      releasedAt: start,
    },
  });

  await prisma.productionScheduleSlot.create({
    data: { batchId: batch.id, machineId: machine.id, shiftId: shift.id, scheduledStart: start, scheduledEnd: end, ganttRow: 1 },
  }).catch(() => undefined);

  await prisma.productionMaterialRequirement.createMany({
    skipDuplicates: true,
    data: [
      { batchId: batch.id, workOrderId: wo.id, productId: input.rawProductId, requiredQty: 122.4, allocatedQty: 120, shortageQty: 2.4, unit: "kg" },
    ],
  });

  await prisma.productionStageEvent.createMany({
    skipDuplicates: true,
    data: [
      { batchId: batch.id, stage: "MIXING", operatorId: input.adminId, completedAt: new Date(start.getTime() + 3600000) },
      { batchId: batch.id, stage: "HEATING", operatorId: input.adminId },
    ],
  });

  await prisma.productionOperatorAssignment.createMany({
    skipDuplicates: true,
    data: [{ batchId: batch.id, shiftId: shift.id, userId: input.adminId, role: "OPERATOR", overtimeHours: 1.5 }],
  });

  await prisma.productionUtilityReading.createMany({
    skipDuplicates: true,
    data: [
      { batchId: batch.id, branchId: input.branchId, utilityType: "GAS", quantity: 45, unit: "m³", costAmount: 320 },
      { batchId: batch.id, branchId: input.branchId, utilityType: "ELECTRICITY", quantity: 120, unit: "kWh", costAmount: 480 },
    ],
  });

  await prisma.productionComplianceLog.createMany({
    skipDuplicates: true,
    data: [
      { batchId: batch.id, standard: "FSSAI", checklist: { hygiene: true, labeling: true }, passed: true, auditorId: input.adminId },
      { batchId: batch.id, standard: "HACCP", checklist: { ccp1: true, sanitation: true }, passed: true, auditorId: input.adminId },
    ],
  });

  await prisma.productionOeeSnapshot.createMany({
    skipDuplicates: true,
    data: [
      { machineId: machine.id, snapshotDate: new Date(), availability: 88, performance: 91, quality: 95, oee: 76.1, throughputKg: 120 },
    ],
  });

  await prisma.productionAlert.createMany({
    skipDuplicates: true,
    data: [
      { batchId: batch.id, branchId: input.branchId, alertType: "MATERIAL_SHORTAGE", severity: "WARNING", title: "Tamarind raw material short 2.4 kg" },
    ],
  });

  await prisma.productionMaintenanceOrder.upsert({
    where: { orderNumber: "PM-2026-0001" },
    update: {},
    create: {
      orderNumber: "PM-2026-0001",
      machineId: machine.id,
      scheduledAt: new Date(Date.now() + 7 * 86400000),
      isPreventive: true,
    },
  });

  await prisma.productionAuditLog.createMany({
    skipDuplicates: true,
    data: [
      { batchId: batch.id, action: "ORDER_RELEASED", title: "Batch PRD-2026-001 released", actorId: input.adminId },
      { batchId: batch.id, action: "STAGE_STARTED", title: "Heating stage started", actorId: input.adminId },
    ],
  });

  const plannedStart2 = new Date(end.getTime() + 3600000);
  const plannedEnd2 = new Date(plannedStart2.getTime() + 6 * 3600000);
  const batch2 = await prisma.productionBatch.upsert({
    where: { batchCode: "PRD-2026-002" },
    update: {},
    create: {
      batchCode: "PRD-2026-002",
      recipeId: input.recipeId,
      branchId: input.branchId,
      status: ProductionStatus.PLANNED,
      plannedQty: 80,
      expectedYieldPct: 94,
      scheduledStart: plannedStart2,
      scheduledEnd: plannedEnd2,
    },
  });

  await prisma.productionScheduleSlot.create({
    data: { batchId: batch2.id, machineId: machine.id, shiftId: shift.id, scheduledStart: plannedStart2, scheduledEnd: plannedEnd2, ganttRow: 1, sequenceOrder: 2 },
  }).catch(() => undefined);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
