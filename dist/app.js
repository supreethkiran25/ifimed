/**
 * IFIMED Pharmaceuticals Pvt. Ltd. — Bank Reconciliation Workspace
 * Production-Ready Desk with Sidebar Navigation, Inline Confirmation Drawer,
 * Multiple Corporate Bank Accounts, and CSV Deduplication Desk.
 */

// =============================================================================
// 1. Initial State & Data Store
// =============================================================================

// Default Customer Invoices Catalog (Dynamic store: users can add manually or upload via CSV)
let appInvoices = [
  { invoiceNo: 'INV-2026-0041', guestName: 'ABC Pharma Ltd', amount: 48500, category: 'Syrups & Suspensions Batch #18', date: '19 Sep 2026' },
  { invoiceNo: 'INV-2026-0039', guestName: 'Hetero Healthcare', amount: 125000, category: 'Hospital Formulations Bulk', date: '18 Sep 2026' },
  { invoiceNo: 'INV-2026-0038', guestName: 'Zydus Lifesciences', amount: 75000, category: 'Speciality Oncology Consignment', date: '17 Sep 2026' },
  { invoiceNo: 'INV-2026-0035', guestName: 'Sun Pharma Ltd', amount: 248300, category: 'Cardiovascular Tablets Batch #4', date: '16 Sep 2026' },
  { invoiceNo: 'INV-2026-0032', guestName: 'Om Sai Medicals', amount: 31400, category: 'Retail Paediatric Drops', date: '16 Sep 2026' },
  { invoiceNo: 'FDR-2026-0922', guestName: 'Ananya Sharma', amount: 8200, category: 'Bulk Formulations Batch #12', date: '18 Sep 2026' },
  { invoiceNo: 'INV-KAP-4819', guestName: 'Infosys Ltd (Health Center)', amount: 245000, category: 'Corporate Annual Medicine Supply', date: '18 Sep 2026' },
  { invoiceNo: 'INV-KAP-4822', guestName: 'Verma Consultancy', amount: 65000, category: 'Workplace Wellness Kits', date: '16 Sep 2026' },
  { invoiceNo: 'BANQ-2026-104', guestName: 'Mehta Healthcare Network', amount: 500000, category: 'Institutional Antibiotics Tender', date: '17 Sep 2026' },
  { invoiceNo: 'FDR-2026-0914', guestName: 'Sunita Agarwal', amount: 18000, category: 'Speciality Oncology Adjuvants', date: '16 Sep 2026' },
  { invoiceNo: 'FDR-2026-0928', guestName: 'Priya Nambiar', amount: 15000, category: 'Vitamins & Minerals Tablets', date: '14 Sep 2026' },
  { invoiceNo: 'FDR-2026-0931', guestName: 'Vikram Singhania', amount: 42000, category: 'Pain Relief Injectables', date: '19 Sep 2026' },
  { invoiceNo: 'BANQ-2026-108', guestName: 'Kirloskar Employee Health', amount: 185000, category: 'First Aid & Chronic Care Consignment', date: '13 Sep 2026' },
  { invoiceNo: 'INV-IFM-2026-019', guestName: 'Apollo Pharmacy Ltd', amount: 325000, category: 'Retail Chain Stockist Batch #88', date: '17 Sep 2026' },
  { invoiceNo: 'INV-IFM-2026-022', guestName: 'Manipal Hospitals', amount: 145000, category: 'ICU Injectables & IV Fluids', date: '18 Sep 2026' }
];

// Default Vendor Purchase Bills & Operational Expenses Catalog (Dynamic store for debit matching)
let appVendorBills = [
  { billNo: 'BILL-2026-081', vendorName: 'Bharat Chemical Synthetics Ltd', amount: 180000, category: 'Active Pharma Ingredients (API)', date: '18 Sep 2026' },
  { billNo: 'BILL-2026-079', vendorName: 'Omega Packaging & Cartons', amount: 42500, category: 'Blister Pack Foil & Cartons', date: '17 Sep 2026' },
  { billNo: 'BILL-2026-075', vendorName: 'BlueDart Express Logistics', amount: 16800, category: 'Cold Chain Freight & Shipping', date: '16 Sep 2026' },
  { billNo: 'BILL-2026-072', vendorName: 'Torrent Power Utilities', amount: 64200, category: 'Manufacturing Plant Electricity', date: '15 Sep 2026' },
  { billNo: 'BILL-2026-068', vendorName: 'Shree Logistics Warehousing', amount: 85000, category: 'Warehouse Lease & Storage', date: '14 Sep 2026' },
  { billNo: 'BILL-2026-065', vendorName: 'Dr. Reddy Labs Testing', amount: 35000, category: 'Analytical Quality Testing', date: '14 Sep 2026' },
  { billNo: 'BILL-2026-059', vendorName: 'Astra Bio-Clean Services', amount: 22400, category: 'Cleanroom Sanitization Supplies', date: '12 Sep 2026' },
  { billNo: 'BILL-2026-054', vendorName: 'Siemens Healthineers AMC', amount: 115000, category: 'Spectrometry Equipment Maintenance', date: '11 Sep 2026' }
];

// Initial Canara Bank Statement Sheets
const CANARA_SHEETS = [
  {
    monthId: '2026-09',
    label: 'September 2026',
    fileName: 'September-2026.xlsx',
    uploadedOn: '19 Sept 2026',
    creditsCount: 148,
    debitsCount: 92,
    records: [
      {
        id: 'CR-202609-01',
        date: '19 Sept 2026',
        narration: 'UPI/RAZORPAY/ABC PHARMA/458923',
        payer: 'ABC Pharma Ltd',
        type: 'UPI',
        bankRef: 'UPI 458923',
        amount: 48500,
        status: 'unmapped',
        mapping: null
      },
      {
        id: 'CR-202609-02',
        date: '18 Sept 2026',
        narration: 'NEFT FROM HETERO HEALTHCARE',
        payer: 'Hetero Healthcare',
        type: 'NEFT',
        bankRef: 'NEFT N123456789',
        amount: 125000,
        status: 'unmapped',
        mapping: null
      },
      {
        id: 'CR-202609-03',
        date: '17 Sept 2026',
        narration: 'RTGS/ZYDUS LIFESCIENCES LTD',
        payer: 'Zydus Lifesciences',
        type: 'RTGS',
        bankRef: 'RTGS R987654321',
        amount: 75000,
        status: 'unmapped',
        mapping: null
      },
      {
        id: 'CR-202609-04',
        date: '16 Sept 2026',
        narration: 'CHEQUE DEP - 008921 - SUN PHARMA',
        payer: 'Sun Pharma',
        type: 'CHQ',
        bankRef: 'CHEQUE 008921',
        amount: 248300,
        status: 'unmapped',
        mapping: null
      },
      {
        id: 'CR-202609-05',
        date: '16 Sept 2026',
        narration: 'UPI/PHONEPE/OM SAI MEDICALS',
        payer: 'Om Sai Medicals',
        type: 'UPI',
        bankRef: 'UPI 9928103',
        amount: 31400,
        status: 'mapped',
        mapping: {
          invoiceNo: 'INV-2026-0032',
          guestName: 'Om Sai Medicals',
          mappedAt: '16 Sep 2026 04:30 PM',
          mappedBy: 'Boss (Accounts Controller)',
          isNote: false
        }
      },
      {
        id: 'CR-202609-06',
        date: '18 Sep 2026',
        narration: 'NEFT-AXISP00291039821-INFOSYS LTD-IFIMED SUPPLIES',
        payer: 'Infosys Ltd (Health Center)',
        type: 'NEFT',
        bankRef: 'AXISP00291039821',
        amount: 245000,
        status: 'mapped',
        mapping: {
          invoiceNo: 'INV-KAP-4819',
          guestName: 'Infosys Ltd (Health Center)',
          mappedAt: '18 Sep 2026 11:30 AM',
          mappedBy: 'Boss (Accounts Controller)',
          isNote: false
        }
      },
      {
        id: 'CR-202609-07',
        date: '17 Sep 2026',
        narration: 'RTGS/BARBR520260917001829/MEHTA HEALTHCARE/TENDER ADV',
        payer: 'Mehta Healthcare Network',
        type: 'RTGS',
        bankRef: 'RTGS-BARBR520260917',
        amount: 500000,
        status: 'unmapped',
        mapping: null
      },
      {
        id: 'CR-202609-08',
        date: '16 Sep 2026',
        narration: 'CLG-CHQ DEPOSIT-CHQ NO 004819-VERMA CONSULTANCY',
        payer: 'Verma Consultancy',
        type: 'CHQ',
        bankRef: 'CHQ-004819',
        amount: 65000,
        status: 'mapped',
        mapping: {
          invoiceNo: 'INV-KAP-4822',
          guestName: 'Verma Consultancy',
          mappedAt: '16 Sep 2026 04:15 PM',
          mappedBy: 'Boss (Accounts Controller)',
          isNote: false
        }
      },
      {
        id: 'CR-202609-09',
        date: '16 Sep 2026',
        narration: 'IMPS/P2A/62611892019/SUNITA AGARWAL/MEDICINE ADV',
        payer: 'Sunita Agarwal',
        type: 'IMPS',
        bankRef: 'IMPS-62611892019',
        amount: 18000,
        status: 'unmapped',
        mapping: null
      },
      {
        id: 'CR-202609-10',
        date: '15 Sep 2026',
        narration: 'UPI/CR/625902819201/DR AMIT PATEL/DERMA OINTMENTS',
        payer: 'Dr. Amit Patel',
        type: 'UPI',
        bankRef: 'UPI-625902819201',
        amount: 12500,
        status: 'unmapped',
        mapping: null
      }
    ],
    debitRecords: [
      {
        id: 'DR-202609-01',
        date: '18 Sep 2026',
        narration: 'NEFT/BARB00291/BHARAT CHEMICAL SYNTHETICS/API-RM-49',
        payer: 'Bharat Chemical Synthetics Ltd',
        type: 'NEFT',
        bankRef: 'NEFT N91823019',
        amount: 180000,
        status: 'unmapped',
        mapping: null
      },
      {
        id: 'DR-202609-02',
        date: '17 Sep 2026',
        narration: 'RTGS/HDFC001928/OMEGA PACKAGING/BLISTER FOIL',
        payer: 'Omega Packaging & Cartons',
        type: 'RTGS',
        bankRef: 'RTGS R82910381',
        amount: 42500,
        status: 'unmapped',
        mapping: null
      },
      {
        id: 'DR-202609-03',
        date: '16 Sep 2026',
        narration: 'UPI/BLUEDART LOGISTICS/COLD CHAIN EXP',
        payer: 'BlueDart Express Logistics',
        type: 'UPI',
        bankRef: 'UPI 8819203',
        amount: 16800,
        status: 'mapped',
        mapping: {
          invoiceNo: 'BILL-2026-075',
          billNo: 'BILL-2026-075',
          guestName: 'BlueDart Express Logistics',
          vendorName: 'BlueDart Express Logistics',
          mappedAt: '16 Sep 2026 05:10 PM',
          mappedBy: 'Boss (Accounts Controller)',
          isNote: false
        }
      },
      {
        id: 'DR-202609-04',
        date: '15 Sep 2026',
        narration: 'BILLPAY/TORRENT POWER/PLANT ENERGY SEP',
        payer: 'Torrent Power Utilities',
        type: 'NEFT',
        bankRef: 'NEFT N48102931',
        amount: 64200,
        status: 'unmapped',
        mapping: null
      },
      {
        id: 'DR-202609-05',
        date: '14 Sep 2026',
        narration: 'RTGS/SHREE LOGISTICS/WH LEASE SEP',
        payer: 'Shree Logistics Warehousing',
        type: 'RTGS',
        bankRef: 'RTGS R11928374',
        amount: 85000,
        status: 'mapped',
        mapping: {
          invoiceNo: 'BILL-2026-068',
          billNo: 'BILL-2026-068',
          guestName: 'Shree Logistics Warehousing',
          vendorName: 'Shree Logistics Warehousing',
          mappedAt: '14 Sep 2026 02:45 PM',
          mappedBy: 'Boss (Accounts Controller)',
          isNote: false
        }
      },
      {
        id: 'DR-202609-06',
        date: '14 Sep 2026',
        narration: 'CHQ 001928 - DR REDDYS LAB TESTING',
        payer: 'Dr. Reddy Labs Testing',
        type: 'CHQ',
        bankRef: 'CHQ-001928',
        amount: 35000,
        status: 'unmapped',
        mapping: null
      }
    ]
  },
  {
    monthId: '2026-08',
    label: 'August 2026',
    fileName: 'August-2026.xlsx',
    uploadedOn: '21 Aug 2026',
    creditsCount: 132,
    debitsCount: 87,
    records: [
      {
        id: 'CR-202608-01',
        date: '28 Aug 2026',
        narration: 'RTGS-BARBR520260828001-KAPILA HOSPITAL SUPPLIES',
        payer: 'Kapila Hospital Network',
        type: 'RTGS',
        bankRef: 'RTGS-BARBR520260828',
        amount: 450000,
        status: 'mapped',
        mapping: {
          invoiceNo: 'INV-AUG-102',
          guestName: 'Kapila Hospital Network',
          mappedAt: '28 Aug 2026',
          mappedBy: 'Boss (Accounts Controller)',
          isNote: false
        }
      },
      {
        id: 'CR-202608-02',
        date: '26 Aug 2026',
        narration: 'UPI/CR/62489201823/VIJAY PHARMA/PYTM',
        payer: 'Vijay Pharma',
        type: 'UPI',
        bankRef: 'UPI-62489201823',
        amount: 38500,
        status: 'unmapped',
        mapping: null
      }
    ],
    debitRecords: [
      {
        id: 'DR-202608-01',
        date: '27 Aug 2026',
        narration: 'RTGS/SIEMENS HEALTHINEERS/SPECTROMETRY AMC',
        payer: 'Siemens Healthineers AMC',
        type: 'RTGS',
        bankRef: 'RTGS-SIEM-202608',
        amount: 115000,
        status: 'mapped',
        mapping: {
          billNo: 'BILL-2026-054',
          invoiceNo: 'BILL-2026-054',
          vendorName: 'Siemens Healthineers AMC',
          guestName: 'Siemens Healthineers AMC',
          mappedAt: '27 Aug 2026',
          mappedBy: 'Boss (Accounts Controller)',
          isNote: false
        }
      },
      {
        id: 'DR-202608-02',
        date: '24 Aug 2026',
        narration: 'UPI/ASTRA BIO CLEAN/CLEANROOM SANITIZATION',
        payer: 'Astra Bio-Clean Services',
        type: 'UPI',
        bankRef: 'UPI-ASTRA-8291',
        amount: 22400,
        status: 'unmapped',
        mapping: null
      }
    ]
  },
  {
    monthId: '2026-07',
    label: 'July 2026',
    fileName: 'July-2026.xlsx',
    uploadedOn: '14 Aug 2026',
    creditsCount: 126,
    debitsCount: 81,
    records: [
      {
        id: 'CR-202607-01',
        date: '29 Jul 2026',
        narration: 'NEFT-SBIN00291039-SHAH PHARMA DISTRIBUTORS',
        payer: 'Shah Pharma Distributors',
        type: 'NEFT',
        bankRef: 'SBIN00291039',
        amount: 220000,
        status: 'mapped',
        mapping: {
          invoiceNo: 'BANQ-JUL-009',
          guestName: 'Shah Pharma Distributors',
          mappedAt: '29 Jul 2026',
          mappedBy: 'Boss (Accounts Controller)',
          isNote: false
        }
      }
    ]
  },
  {
    monthId: '2026-06',
    label: 'June 2026',
    fileName: 'June-2026.xlsx',
    uploadedOn: '07 Aug 2026',
    creditsCount: 118,
    debitsCount: 76,
    records: [
      {
        id: 'CR-202606-01',
        date: '25 Jun 2026',
        narration: 'RTGS/HDFC00291823/GLOBAL LIFE SCIENCES',
        payer: 'Global Life Sciences',
        type: 'RTGS',
        bankRef: 'HDFCR520260625',
        amount: 340000,
        status: 'mapped',
        mapping: {
          invoiceNo: 'INV-JUN-088',
          guestName: 'Global Life Sciences',
          mappedAt: '25 Jun 2026',
          mappedBy: 'Boss (Accounts Controller)',
          isNote: false
        }
      }
    ]
  }
];

// Corporate Bank Accounts Catalog (3 Demo Accounts for Client Presentation)
const CORPORATE_BANKS = [
  {
    id: 'canara-4092',
    name: 'Canara Bank',
    type: 'Current A/c',
    accNo: '••••4092',
    fullAccNo: '0482201004092',
    ifsc: 'CNRB0000482',
    branch: 'Koramangala, Bengaluru',
    sheets: JSON.parse(JSON.stringify(CANARA_SHEETS))
  },
  {
    id: 'hdfc-1930',
    name: 'HDFC Bank',
    type: 'Current A/c',
    accNo: '••••1930',
    fullAccNo: '50200029101930',
    ifsc: 'HDFC0000412',
    branch: 'Indiranagar, Bengaluru',
    sheets: [
      {
        monthId: '2026-09',
        label: 'September 2026',
        fileName: 'HDFC-Sept-2026.xlsx',
        uploadedOn: '19 Sept 2026',
        creditsCount: 94,
        debitsCount: 42,
        records: [
          {
            id: 'HDFC-202609-01',
            date: '18 Sep 2026',
            narration: 'NEFT-CR-HDFCN0029103-MANIPAL HOSPITALS',
            payer: 'Manipal Hospitals',
            type: 'NEFT',
            bankRef: 'HDFCN002910389',
            amount: 145000,
            status: 'unmapped',
            mapping: null
          },
          {
            id: 'HDFC-202609-02',
            date: '17 Sep 2026',
            narration: 'RTGS-CR-ICICR520260917-APOLLO PHARMACY BULK',
            payer: 'Apollo Pharmacy Ltd',
            type: 'RTGS',
            bankRef: 'ICICR52026091701',
            amount: 325000,
            status: 'mapped',
            mapping: {
              invoiceNo: 'INV-IFM-2026-019',
              guestName: 'Apollo Pharmacy Ltd',
              mappedAt: '17 Sep 2026 03:20 PM',
              mappedBy: 'Boss (Accounts Controller)',
              isNote: false
            }
          },
          {
            id: 'HDFC-202609-03',
            date: '16 Sep 2026',
            narration: 'UPI/CR/626019918231/BIOCON RESEARCH/PYTM',
            payer: 'Biocon Research',
            type: 'UPI',
            bankRef: 'UPI-626019918231',
            amount: 58000,
            status: 'unmapped',
            mapping: null
          }
        ],
        debitRecords: [
          {
            id: 'HDFC-DR-202609-01',
            date: '18 Sep 2026',
            narration: 'NEFT-DR-HDFCN008819-THERMO FISHER LAB REAGENTS',
            payer: 'Thermo Fisher Scientific',
            type: 'NEFT',
            bankRef: 'HDFCN00881920',
            amount: 98000,
            status: 'unmapped',
            mapping: null
          },
          {
            id: 'HDFC-DR-202609-02',
            date: '16 Sep 2026',
            narration: 'RTGS-DR-KOTAK00918-BENGALURU WAREHOUSE LEASE',
            payer: 'Prestige Industrial Parks',
            type: 'RTGS',
            bankRef: 'KOTAKR520260916',
            amount: 175000,
            status: 'mapped',
            mapping: {
              billNo: 'BILL-HDFC-019',
              invoiceNo: 'BILL-HDFC-019',
              vendorName: 'Prestige Industrial Parks',
              guestName: 'Prestige Industrial Parks',
              mappedAt: '16 Sep 2026 04:10 PM',
              mappedBy: 'Boss (Accounts Controller)',
              isNote: false
            }
          }
        ]
      }
    ]
  },
  {
    id: 'sbi-8814',
    name: 'State Bank of India',
    type: 'Cash Credit A/c',
    accNo: '••••8814',
    fullAccNo: '38190029108814',
    ifsc: 'SBIN0004819',
    branch: 'MG Road Commercial, Bengaluru',
    sheets: [
      {
        monthId: '2026-09',
        label: 'September 2026',
        fileName: 'SBI-CC-Sept-2026.xlsx',
        uploadedOn: '19 Sept 2026',
        creditsCount: 65,
        debitsCount: 38,
        records: [
          {
            id: 'SBI-202609-01',
            date: '18 Sep 2026',
            narration: 'NEFT-SBIN0019283-CIPLA DISTRIBUTORS',
            payer: 'Cipla Distributors',
            type: 'NEFT',
            bankRef: 'SBIN0019283719',
            amount: 210000,
            status: 'unmapped',
            mapping: null
          },
          {
            id: 'SBI-202609-02',
            date: '15 Sep 2026',
            narration: 'RTGS-SBIR520260915-FORTIS HEALTHCARE BATCH',
            payer: 'Fortis Healthcare',
            type: 'RTGS',
            bankRef: 'SBIR520260915002',
            amount: 480000,
            status: 'mapped',
            mapping: {
              invoiceNo: 'INV-IFM-2026-028',
              guestName: 'Cipla Distributors',
              mappedAt: '15 Sep 2026 02:15 PM',
              mappedBy: 'Boss (Accounts Controller)',
              isNote: false
            }
          }
        ],
        debitRecords: [
          {
            id: 'SBI-DR-202609-01',
            date: '17 Sep 2026',
            narration: 'NEFT-DR-SBIN004819-BHARAT PETROLEUM GENERATOR DIESEL',
            payer: 'Bharat Petroleum Corp Ltd',
            type: 'NEFT',
            bankRef: 'SBIN0048192018',
            amount: 82000,
            status: 'unmapped',
            mapping: null
          }
        ]
      }
    ]
  }
];

// Recent Desk Activity (for Dashboard feed)
let recentActivities = [
  { text: 'Linked INV-KAP-4819 (Infosys Ltd)', meta: 'Canara Bank Current A/c ••4092 · 18 Sep 2026' },
  { text: 'Linked INV-IFM-2026-019 (Apollo Pharmacy Ltd)', meta: 'HDFC Bank Current A/c ••1930 · 17 Sep 2026' },
  { text: 'Linked INV-2026-0032 (Om Sai Medicals)', meta: 'Canara Bank Current A/c ••4092 · 16 Sep 2026' }
];

// Active State
let currentActiveView = 'bank-statements'; // 'dashboard' | 'bank-statements'
let activeMappingMode = 'credit'; // 'credit' (Inflow) | 'debit' (Outflow)
let selectedBankId = 'canara-4092';
let selectedMonthId = '2026-09';
let activeFilter = 'all'; // 'all' | 'unmapped' | 'mapped'
let searchQuery = '';

// Local copy of corporate banks
let corporateBanks = JSON.parse(JSON.stringify(CORPORATE_BANKS));

// Active inline confirmation state: rowId being confirmed, or null
let activeConfirmingRowId = null;
let confirmingInvoiceNo = '';
let confirmingGuestName = '';

// =============================================================================
// 2. DOM Selectors
// =============================================================================

// Nav & Shell
const navDashboard = document.getElementById('navDashboard');
const navBankStatements = document.getElementById('navBankStatements');
const viewDashboard = document.getElementById('viewDashboard');
const viewBankStatements = document.getElementById('viewBankStatements');
const currentCrumb = document.getElementById('currentCrumb');

// Header & Bank Selector
const bankSelectorBtn = document.getElementById('bankSelectorBtn');
const bankDropdownMenu = document.getElementById('bankDropdownMenu');
const bankOptionsList = document.getElementById('bankOptionsList');
const activeBankName = document.getElementById('activeBankName');
const dropZoneBankName = document.getElementById('dropZoneBankName');
const pageBankSubheading = document.getElementById('pageBankSubheading');
const statementFilesSubtitle = document.getElementById('statementFilesSubtitle');
const footerBankDetails = document.getElementById('footerBankDetails');

// KPI Displays & Headers
const kpiTotalAmount = document.getElementById('kpiTotalAmount');
const kpiTotalCount = document.getElementById('kpiTotalCount');
const kpiMappedAmount = document.getElementById('kpiMappedAmount');
const kpiMappedCount = document.getElementById('kpiMappedCount');
const kpiUnmappedAmount = document.getElementById('kpiUnmappedAmount');
const kpiUnmappedCount = document.getElementById('kpiUnmappedCount');
const mappedCountDisplay = document.getElementById('mappedCountDisplay');
const kpiTotalHeader = document.getElementById('kpiTotalHeader');
const kpiMappedHeader = document.getElementById('kpiMappedHeader');
const kpiUnmappedHeader = document.getElementById('kpiUnmappedHeader');
const kpiTrendHeader = document.getElementById('kpiTrendHeader');
const kpiTotalIcon = document.getElementById('kpiTotalIcon');

// Statement Files Desk
const statementFilesTableBody = document.getElementById('statementFilesTableBody');
const dropZone = document.getElementById('dropZone');
const bankCsvInput = document.getElementById('bankCsvInput');
const uploadCsvBtn = document.getElementById('uploadCsvBtn');

// Desk Tabs & Dynamic Labels
const tabCreditMode = document.getElementById('tabCreditMode');
const tabDebitMode = document.getElementById('tabDebitMode');
const tabCreditBadge = document.getElementById('tabCreditBadge');
const tabDebitBadge = document.getElementById('tabDebitBadge');
const mappingCardTitle = document.getElementById('mappingCardTitle');
const mappingCardSubtitle = document.getElementById('mappingCardSubtitle');
const thAmountLabel = document.getElementById('thAmountLabel');
const thMappingLabel = document.getElementById('thMappingLabel');
const footerSubtotalLabel = document.getElementById('footerSubtotalLabel');
const emptyStateTitle = document.getElementById('emptyStateTitle');
const emptyStateDesc = document.getElementById('emptyStateDesc');
const exportCsvBtnText = document.getElementById('exportCsvBtnText');

// Credit / Debit Mapping Desk
const creditTableBody = document.getElementById('creditTableBody');
const tableSearchInput = document.getElementById('tableSearchInput');
const filterDropdownBtn = document.getElementById('filterDropdownBtn');
const filterMenuPopover = document.getElementById('filterMenuPopover');
const activeFilterLabel = document.getElementById('activeFilterLabel');
const filterAll = document.getElementById('filterAll');
const filterUnmapped = document.getElementById('filterUnmapped');
const filterMapped = document.getElementById('filterMapped');
const countAllSpan = document.getElementById('countAll');
const countUnmappedSpan = document.getElementById('countUnmapped');
const countMappedSpan = document.getElementById('countMapped');
const tableEmptyState = document.getElementById('tableEmptyState');
const visibleRowCount = document.getElementById('visibleRowCount');
const currentMonthLabel = document.getElementById('currentMonthLabel');
const totalCreditAmount = document.getElementById('totalCreditAmount');
const exportCurrentMonthBtn = document.getElementById('exportCurrentMonthBtn');

// Action Groups
const creditActionsGroup = document.getElementById('creditActionsGroup');
const debitActionsGroup = document.getElementById('debitActionsGroup');

// Customer Invoice Actions & Modals
const openAddInvoiceModalBtn = document.getElementById('openAddInvoiceModalBtn');
const openUploadInvoiceCsvBtn = document.getElementById('openUploadInvoiceCsvBtn');
const invoiceCsvInput = document.getElementById('invoiceCsvInput');
const viewInvoicesBtn = document.getElementById('viewInvoicesBtn');
const totalInvoicesCountBadge = document.getElementById('totalInvoicesCountBadge');
const addInvoiceModal = document.getElementById('addInvoiceModal');
const closeAddInvoiceModalBtn = document.getElementById('closeAddInvoiceModalBtn');
const cancelAddInvoiceBtn = document.getElementById('cancelAddInvoiceBtn');
const addInvoiceForm = document.getElementById('addInvoiceForm');

// Invoices Catalog Modal
const invoicesCatalogModal = document.getElementById('invoicesCatalogModal');
const closeInvoicesCatalogBtn = document.getElementById('closeInvoicesCatalogBtn');
const doneInvoicesCatalogBtn = document.getElementById('doneInvoicesCatalogBtn');
const invoiceCatalogSearch = document.getElementById('invoiceCatalogSearch');
const catalogInvoicesTableBody = document.getElementById('catalogInvoicesTableBody');

// Vendor Bills Actions & Modals
const openAddBillModalBtn = document.getElementById('openAddBillModalBtn');
const openUploadBillCsvBtn = document.getElementById('openUploadBillCsvBtn');
const billCsvInput = document.getElementById('billCsvInput');
const viewBillsBtn = document.getElementById('viewBillsBtn');
const totalBillsCountBadge = document.getElementById('totalBillsCountBadge');
const addBillModal = document.getElementById('addBillModal');
const closeAddBillModalBtn = document.getElementById('closeAddBillModalBtn');
const cancelAddBillBtn = document.getElementById('cancelAddBillBtn');
const addBillForm = document.getElementById('addBillForm');

// Vendor Bills Catalog Modal
const billsCatalogModal = document.getElementById('billsCatalogModal');
const closeBillsCatalogBtn = document.getElementById('closeBillsCatalogBtn');
const doneBillsCatalogBtn = document.getElementById('doneBillsCatalogBtn');
const billCatalogSearch = document.getElementById('billCatalogSearch');
const catalogBillsTableBody = document.getElementById('catalogBillsTableBody');

// Bank Account Modal
const openAddBankModalBtn = document.getElementById('openAddBankModalBtn');
const addBankModal = document.getElementById('addBankModal');
const closeAddBankModalBtn = document.getElementById('closeAddBankModalBtn');
const cancelAddBankBtn = document.getElementById('cancelAddBankBtn');
const addBankForm = document.getElementById('addBankForm');
const dashAddBankBtn = document.getElementById('dashAddBankBtn');

// Global Search / Command Palette
const globalSearchTrigger = document.getElementById('globalSearchTrigger');
const commandPaletteModal = document.getElementById('commandPaletteModal');
const commandPaletteInput = document.getElementById('commandPaletteInput');
const commandPaletteResults = document.getElementById('commandPaletteResults');

// Unlink Modal
const unlinkModal = document.getElementById('unlinkModal');
const closeUnlinkModalBtn = document.getElementById('closeUnlinkModalBtn');
const cancelUnlinkBtn = document.getElementById('cancelUnlinkBtn');
const confirmUnlinkBtn = document.getElementById('confirmUnlinkBtn');
const unlinkInvoiceNo = document.getElementById('unlinkInvoiceNo');
let pendingUnlinkTarget = null;

// Toast Feedback
const toastNotification = document.getElementById('toastNotification');
const toastIcon = document.getElementById('toastIcon');
const toastMessage = document.getElementById('toastMessage');

// Preview banner & Trend Chart
const closePreviewBannerBtn = document.getElementById('closePreviewBannerBtn');
const miniBarChart = document.getElementById('miniBarChart');

// =============================================================================
// 3. Formatting & Toast Helpers
// =============================================================================

function formatINR(amount) {
  if (typeof amount !== 'number') amount = parseFloat(amount) || 0;
  return '₹ ' + amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function showToast(message, type = 'success') {
  if (!toastNotification) return;
  
  if (type === 'success') {
    toastIcon.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    `;
  } else if (type === 'amber') {
    toastIcon.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    `;
  } else {
    toastIcon.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1877f2" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    `;
  }

  toastMessage.textContent = message;
  toastNotification.classList.add('show');
  clearTimeout(toastNotification._timer);
  toastNotification._timer = setTimeout(() => {
    toastNotification.classList.remove('show');
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =============================================================================
// 4. View Navigation (Sidebar Router)
// =============================================================================

function switchView(viewName) {
  currentActiveView = viewName;
  
  // Update sidebar active buttons
  [navDashboard, navBankStatements].forEach(btn => {
    if (btn) btn.classList.remove('active');
  });

  // Update panels
  [viewDashboard, viewBankStatements].forEach(panel => {
    if (panel) {
      panel.style.display = 'none';
      panel.classList.remove('active');
    }
  });

  if (viewName === 'dashboard') {
    if (navDashboard) navDashboard.classList.add('active');
    if (viewDashboard) {
      viewDashboard.style.display = 'block';
      viewDashboard.classList.add('active');
    }
    if (currentCrumb) currentCrumb.textContent = 'Dashboard';
    renderDashboardView();
  } else {
    if (navBankStatements) navBankStatements.classList.add('active');
    if (viewBankStatements) {
      viewBankStatements.style.display = 'block';
      viewBankStatements.classList.add('active');
    }
    if (currentCrumb) currentCrumb.textContent = 'Bank statements';
    renderAll();
  }

  // Auto-close mobile drawer if open
  const appSidebar = document.querySelector('.app-sidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  if (appSidebar) appSidebar.classList.remove('open');
  if (sidebarBackdrop) sidebarBackdrop.classList.remove('open');
}

// =============================================================================
// 5. Corporate Bank Management
// =============================================================================

function getActiveBank() {
  return corporateBanks.find(b => b.id === selectedBankId) || corporateBanks[0];
}

function getCurrentSheet() {
  const bank = getActiveBank();
  return bank.sheets.find(s => s.monthId === selectedMonthId) || bank.sheets[0];
}

function switchBank(bankId) {
  selectedBankId = bankId;
  const bank = getActiveBank();
  selectedMonthId = bank.sheets[0] ? bank.sheets[0].monthId : '2026-09';
  activeConfirmingRowId = null;

  if (bankDropdownMenu) bankDropdownMenu.style.display = 'none';
  renderAll();
  showToast(`Switched account to ${bank.name} (${bank.accNo})`);
}

function renderBankSelector() {
  const bank = getActiveBank();
  const bankFullName = `${bank.name} ${bank.type} ${bank.accNo}`;

  if (activeBankName) activeBankName.textContent = bankFullName;
  if (dropZoneBankName) dropZoneBankName.textContent = `${bank.name} CSV only`;
  if (pageBankSubheading) pageBankSubheading.textContent = `Turn incoming ${bank.name} credits into explicit invoice links.`;
  if (statementFilesSubtitle) statementFilesSubtitle.textContent = `Monthly uploads from ${bank.name}`;
  if (footerBankDetails) footerBankDetails.textContent = `${bank.name} ${bank.type} (${bank.fullAccNo || bank.accNo}) · IFSC: ${bank.ifsc}`;

  if (bankOptionsList) {
    bankOptionsList.innerHTML = '';
    corporateBanks.forEach(b => {
      const isSelected = b.id === selectedBankId;
      const item = document.createElement('div');
      item.className = `bank-option-item ${isSelected ? 'active' : ''}`;
      item.innerHTML = `
        <div>
          <div class="bank-option-title">${escapeHtml(b.name)}</div>
          <div class="bank-option-sub">${escapeHtml(b.type)} · ${escapeHtml(b.accNo)}</div>
        </div>
        <span class="bank-option-badge">${isSelected ? 'Active' : 'Select'}</span>
      `;
      item.addEventListener('click', () => switchBank(b.id));
      bankOptionsList.appendChild(item);
    });
  }
}

// =============================================================================
// 6. Statement Files Desk (Matching Screenshot 1)
// =============================================================================

function renderStatementFilesTable() {
  if (!statementFilesTableBody) return;
  statementFilesTableBody.innerHTML = '';

  const bank = getActiveBank();
  bank.sheets.forEach(sheet => {
    const isCurrent = sheet.monthId === selectedMonthId;
    const tr = document.createElement('tr');
    tr.className = `statement-month-row ${isCurrent ? 'active-month' : ''}`;

    tr.innerHTML = `
      <td>
        <div class="file-name-cell">
          <span class="file-status-dot ${isCurrent ? 'dot-active' : ''}"></span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1877f2" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span>${escapeHtml(sheet.label)} · ${escapeHtml(sheet.fileName)}</span>
        </div>
      </td>
      <td>${sheet.creditsCount || (sheet.records ? sheet.records.length : 0)} credits</td>
      <td>${sheet.debitsCount || 0} debits</td>
      <td>${escapeHtml(sheet.uploadedOn || '19 Sept 2026')}</td>
    `;

    tr.addEventListener('click', () => {
      selectedMonthId = sheet.monthId;
      activeConfirmingRowId = null;
      renderAll();
      showToast(`Viewing ${sheet.label} statement`);
    });

    statementFilesTableBody.appendChild(tr);
  });
}

// =============================================================================
// 7. Credit & Debit Mapping Desk & Inline Confirmation Drawer
// =============================================================================

function switchMappingMode(mode) {
  if (activeMappingMode === mode) return;
  activeMappingMode = mode;
  activeConfirmingRowId = null;
  confirmingInvoiceNo = '';
  confirmingGuestName = '';

  // Update tab buttons
  if (tabCreditMode) {
    tabCreditMode.classList.toggle('active', mode === 'credit');
    tabCreditMode.setAttribute('aria-selected', mode === 'credit');
  }
  if (tabDebitMode) {
    tabDebitMode.classList.toggle('active', mode === 'debit');
    tabDebitMode.setAttribute('aria-selected', mode === 'debit');
  }

  // Update action groups
  if (creditActionsGroup) creditActionsGroup.style.display = mode === 'credit' ? 'flex' : 'none';
  if (debitActionsGroup) debitActionsGroup.style.display = mode === 'debit' ? 'flex' : 'none';

  // Update Titles & Subtitles
  if (mappingCardTitle) {
    mappingCardTitle.textContent = mode === 'credit' ? 'Credit mapping' : 'Debit mapping';
  }
  if (mappingCardSubtitle) {
    mappingCardSubtitle.textContent = mode === 'credit'
      ? 'Choose an invoice, review the bank evidence, then confirm the link.'
      : 'Choose a vendor bill, review the bank evidence, then confirm the link.';
  }

  // Update Table Headers
  if (thAmountLabel) {
    thAmountLabel.textContent = mode === 'credit' ? 'CREDIT AMOUNT' : 'DEBIT AMOUNT';
  }
  if (thMappingLabel) {
    thMappingLabel.textContent = mode === 'credit' ? 'INVOICE MAPPING' : 'VENDOR BILL MAPPING';
  }
  if (footerSubtotalLabel) {
    footerSubtotalLabel.textContent = mode === 'credit' ? 'Subtotal Inflow:' : 'Subtotal Outflow:';
  }
  if (exportCsvBtnText) {
    exportCsvBtnText.textContent = mode === 'credit' ? 'Export CSV' : 'Export Reconciled Debits';
  }

  // Update KPI Headers
  if (kpiTotalHeader) {
    kpiTotalHeader.textContent = mode === 'credit' ? 'TOTAL CREDITS · THIS MONTH' : 'TOTAL DEBITS · THIS MONTH';
  }
  if (kpiMappedHeader) {
    kpiMappedHeader.textContent = mode === 'credit' ? 'MAPPED CREDITS' : 'MAPPED DEBITS';
  }
  if (kpiUnmappedHeader) {
    kpiUnmappedHeader.textContent = mode === 'credit' ? 'UNMAPPED CREDITS' : 'UNMAPPED DEBITS';
  }
  if (kpiTrendHeader) {
    kpiTrendHeader.textContent = mode === 'credit' ? 'CREDIT TREND' : 'DEBIT TREND';
  }
  if (kpiTotalIcon) {
    kpiTotalIcon.className = `kpi-icon-circle ${mode === 'credit' ? 'icon-circle-blue' : 'icon-circle-rose'}`;
    kpiTotalIcon.innerHTML = mode === 'credit' ? `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="17" y1="7" x2="7" y2="17"></line>
        <polyline points="17 17 7 17 7 7"></polyline>
      </svg>
    ` : `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="7" y1="17" x2="17" y2="7"></line>
        <polyline points="7 7 17 7 17 17"></polyline>
      </svg>
    `;
  }

  // Update Empty State Texts
  if (emptyStateTitle) {
    emptyStateTitle.textContent = mode === 'credit'
      ? 'No matching credit records found'
      : 'No matching debit records found';
  }

  renderAll();
  showToast(`Switched to ${mode === 'credit' ? 'Credit' : 'Debit'} mapping desk`);
}

// Expose globally for inline onclick handlers & shortcuts
window.switchMappingMode = switchMappingMode;

function renderCreditTable() {
  const currentSheet = getCurrentSheet();
  if (currentMonthLabel) currentMonthLabel.textContent = currentSheet.label;

  const isDebit = activeMappingMode === 'debit';
  if (!currentSheet.records) currentSheet.records = [];
  if (!currentSheet.debitRecords) currentSheet.debitRecords = [];

  // Update Tab Badges
  if (tabCreditBadge) tabCreditBadge.textContent = currentSheet.records.length;
  if (tabDebitBadge) tabDebitBadge.textContent = currentSheet.debitRecords.length;

  let records = isDebit ? currentSheet.debitRecords : currentSheet.records;

  // Stats calculation
  const totalCount = records.length;
  const mappedCount = records.filter(r => r.status === 'mapped' || r.status === 'noted').length;
  const unmappedCount = totalCount - mappedCount;
  
  const sumAmountAll = records.reduce((acc, r) => acc + r.amount, 0);
  const sumAmountMapped = records.filter(r => r.status === 'mapped').reduce((acc, r) => acc + r.amount, 0);
  const sumAmountUnmapped = records.filter(r => r.status === 'unmapped').reduce((acc, r) => acc + r.amount, 0);

  // Update KPI Cards
  if (kpiTotalAmount) kpiTotalAmount.textContent = formatINR(sumAmountAll);
  if (kpiTotalCount) kpiTotalCount.textContent = totalCount;
  if (kpiMappedAmount) kpiMappedAmount.textContent = formatINR(sumAmountMapped);
  if (kpiMappedCount) kpiMappedCount.textContent = mappedCount;
  if (kpiUnmappedAmount) kpiUnmappedAmount.textContent = formatINR(sumAmountUnmapped);
  if (kpiUnmappedCount) kpiUnmappedCount.textContent = unmappedCount;

  if (countAllSpan) countAllSpan.textContent = totalCount;
  if (countUnmappedSpan) countUnmappedSpan.textContent = unmappedCount;
  if (countMappedSpan) countMappedSpan.textContent = mappedCount;
  if (mappedCountDisplay) mappedCountDisplay.textContent = `${totalCount} records`;

  // Apply Filter
  if (activeFilter === 'unmapped') {
    records = records.filter(r => r.status !== 'mapped' && r.status !== 'noted');
  } else if (activeFilter === 'mapped') {
    records = records.filter(r => r.status === 'mapped' || r.status === 'noted');
  }

  // Apply Search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    records = records.filter(r => {
      const matchNarration = r.narration ? r.narration.toLowerCase().includes(q) : false;
      const matchPayer = r.payer ? r.payer.toLowerCase().includes(q) : false;
      const matchRef = r.bankRef ? r.bankRef.toLowerCase().includes(q) : false;
      const matchAmount = r.amount.toString().includes(q);
      const matchDoc = r.mapping ? (
        (r.mapping.invoiceNo && r.mapping.invoiceNo.toLowerCase().includes(q)) ||
        (r.mapping.billNo && r.mapping.billNo.toLowerCase().includes(q)) ||
        (r.mapping.guestName && r.mapping.guestName.toLowerCase().includes(q)) ||
        (r.mapping.vendorName && r.mapping.vendorName.toLowerCase().includes(q))
      ) : false;
      return matchNarration || matchPayer || matchRef || matchAmount || matchDoc;
    });
  }

  if (visibleRowCount) visibleRowCount.textContent = records.length;
  const sumAmountVisible = records.reduce((acc, r) => acc + r.amount, 0);
  if (totalCreditAmount) totalCreditAmount.textContent = formatINR(sumAmountVisible);

  creditTableBody.innerHTML = '';

  if (records.length === 0) {
    if (tableEmptyState) tableEmptyState.style.display = 'flex';
    return;
  } else {
    if (tableEmptyState) tableEmptyState.style.display = 'none';
  }

  records.forEach(row => {
    const isConfirming = activeConfirmingRowId === row.id;

    // Normal Row
    const tr = document.createElement('tr');
    tr.id = `row-${row.id}`;
    if (isConfirming) tr.classList.add('active-confirming-row');

    let badgeClass = 'badge-upi';
    if (row.type === 'NEFT') badgeClass = 'badge-neft';
    if (row.type === 'RTGS') badgeClass = 'badge-rtgs';
    if (row.type === 'CHQ') badgeClass = 'badge-chq';
    if (row.type === 'IMPS') badgeClass = 'badge-imps';

    // Status Pill
    let statusPillHtml = `<span class="status-pill status-pill-unmapped"><span class="status-dot-sm"></span> Unmapped</span>`;
    if (row.status === 'mapped') {
      statusPillHtml = `<span class="status-pill status-pill-mapped"><span class="status-dot-sm"></span> Mapped</span>`;
    } else if (row.status === 'noted') {
      statusPillHtml = `<span class="status-pill status-pill-noted"><span class="status-dot-sm"></span> Noted</span>`;
    }

    // Mapping Cell (Invoice vs Vendor Bill)
    let mappingCellHtml = '';
    if (row.status === 'mapped') {
      const docNo = row.mapping.billNo || row.mapping.invoiceNo;
      const tagBadgeClass = isDebit ? 'mapped-tag-badge badge-bill' : 'mapped-tag-badge';
      mappingCellHtml = `
        <div class="${tagBadgeClass}">
          <span>${escapeHtml(docNo)}</span>
        </div>
      `;
    } else if (row.status === 'noted') {
      mappingCellHtml = `
        <span style="font-size: 11.5px; color: var(--amber-text); font-weight: 600;">Note: ${escapeHtml(row.mapping.noteText)}</span>
      `;
    } else {
      const placeholder = isDebit ? 'Bill / Voucher #' : 'Invoice #';
      mappingCellHtml = `
        <div class="cell-input-mapping">
          <input type="text" class="mapping-inv-input" placeholder="${placeholder}" id="input-inv-${row.id}" autocomplete="off">
          <ul class="suggestions-dropdown" id="dropdown-${row.id}" style="display: none;"></ul>
        </div>
      `;
    }

    tr.innerHTML = `
      <td class="col-date">${escapeHtml(row.date)}</td>
      <td class="col-narration">
        <div class="narration-primary">${escapeHtml(row.narration)}</div>
        ${row.payer ? `<div class="narration-secondary">${escapeHtml(row.payer)}</div>` : ''}
      </td>
      <td class="col-ref">
        <div class="ref-badge-wrap">
          <span class="badge-type ${badgeClass}">${escapeHtml(row.type)}</span>
          <span class="ref-code-text">${escapeHtml(row.bankRef || '—')}</span>
        </div>
      </td>
      <td class="col-amount text-right">
        <span class="amount-text ${isDebit ? 'amount-debit' : ''}">${isDebit ? '- ' : ''}${formatINR(row.amount)}</span>
      </td>
      <td class="col-mapping">
        ${mappingCellHtml}
      </td>
      <td class="col-status">
        ${statusPillHtml}
      </td>
      <td class="col-actions text-center">
        <button type="button" class="btn-actions-menu" id="action-btn-${row.id}" title="Row options">···</button>
      </td>
    `;

    creditTableBody.appendChild(tr);

    // Setup Row Input & Suggestion Picker (for unmapped rows)
    if (row.status === 'unmapped') {
      const invInput = tr.querySelector(`#input-inv-${row.id}`);
      const dropdown = tr.querySelector(`#dropdown-${row.id}`);

      if (invInput && dropdown) {
        function showSuggestions(filterVal) {
          dropdown.innerHTML = '';
          const term = (filterVal || '').trim().toLowerCase();

          if (isDebit) {
            // Debit Mode: Search Vendor Bills Catalog
            const matches = appVendorBills.filter(b => {
              if (!term) return true;
              return b.billNo.toLowerCase().includes(term) ||
                     b.vendorName.toLowerCase().includes(term) ||
                     (b.category && b.category.toLowerCase().includes(term));
            }).slice(0, 6);

            if (matches.length === 0) {
              dropdown.style.display = 'none';
              return;
            }

            const header = document.createElement('li');
            header.className = 'suggestion-header';
            header.textContent = 'Available Vendor Bills';
            dropdown.appendChild(header);

            matches.forEach(m => {
              const item = document.createElement('li');
              item.className = 'suggestion-item';
              item.innerHTML = `
                <div class="suggestion-item-top">
                  <span class="suggestion-inv-num" style="color: #e11d48;">${escapeHtml(m.billNo)}</span>
                  <span class="suggestion-expected-amount font-bold" style="color: #be123c;">${formatINR(m.amount)}</span>
                </div>
                <div class="suggestion-payer-name">${escapeHtml(m.vendorName)} · ${escapeHtml(m.category || 'Expense')}</div>
              `;

              const handleSelect = (e) => {
                e.preventDefault();
                dropdown.style.display = 'none';
                openInlineConfirmation(row, m.billNo, m.vendorName);
              };
              item.addEventListener('pointerdown', handleSelect);
              item.addEventListener('mousedown', handleSelect);

              dropdown.appendChild(item);
            });
          } else {
            // Credit Mode: Search Customer Invoices Catalog
            const matches = appInvoices.filter(b => {
              if (!term) return true;
              return b.invoiceNo.toLowerCase().includes(term) ||
                     b.guestName.toLowerCase().includes(term) ||
                     (b.category && b.category.toLowerCase().includes(term));
            }).slice(0, 6);

            if (matches.length === 0) {
              dropdown.style.display = 'none';
              return;
            }

            const header = document.createElement('li');
            header.className = 'suggestion-header';
            header.textContent = 'Available Invoices';
            dropdown.appendChild(header);

            matches.forEach(m => {
              const item = document.createElement('li');
              item.className = 'suggestion-item';
              item.innerHTML = `
                <div class="suggestion-item-top">
                  <span class="suggestion-inv-num">${escapeHtml(m.invoiceNo)}</span>
                  <span class="suggestion-expected-amount font-bold">${formatINR(m.amount)}</span>
                </div>
                <div class="suggestion-payer-name">${escapeHtml(m.guestName)} · ${escapeHtml(m.category)}</div>
              `;

              const handleSelect = (e) => {
                e.preventDefault();
                dropdown.style.display = 'none';
                openInlineConfirmation(row, m.invoiceNo, m.guestName);
              };
              item.addEventListener('pointerdown', handleSelect);
              item.addEventListener('mousedown', handleSelect);

              dropdown.appendChild(item);
            });
          }

          dropdown.style.display = 'block';
        }

        invInput.addEventListener('focus', () => showSuggestions(invInput.value));
        invInput.addEventListener('input', () => showSuggestions(invInput.value));
        invInput.addEventListener('blur', () => {
          setTimeout(() => { dropdown.style.display = 'none'; }, 200);
        });

        invInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const val = invInput.value.trim();
            if (val) {
              if (isDebit) {
                const matched = appVendorBills.find(b => b.billNo.toLowerCase() === val.toLowerCase());
                openInlineConfirmation(row, val, matched ? matched.vendorName : null);
              } else {
                const matched = appInvoices.find(b => b.invoiceNo.toLowerCase() === val.toLowerCase());
                openInlineConfirmation(row, val, matched ? matched.guestName : null);
              }
            }
          }
        });
      }
    }

    // Row Actions Button (···)
    const actionBtn = tr.querySelector(`#action-btn-${row.id}`);
    if (actionBtn) {
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (row.status === 'mapped') {
          triggerUnlinkModal(row);
        } else {
          // Open inline confirm directly
          openInlineConfirmation(row, confirmingInvoiceNo || '', row.payer || '');
        }
      });
    }

    // =========================================================================
    // INLINE CONFIRMATION DRAWER
    // =========================================================================
    if (isConfirming) {
      const confirmTr = document.createElement('tr');
      confirmTr.className = 'inline-confirm-row';

      const docTypeLabel = isDebit ? 'vendor bill' : 'invoice';
      const docHeaderLabel = isDebit ? 'Confirm vendor bill link' : 'Confirm invoice link';
      const docSubLabel = isDebit
        ? 'Review the evidence before this debit is locked to a vendor bill.'
        : 'Review the evidence before this credit is locked to an invoice.';
      const docFieldLabel = isDebit ? 'BILL / VOUCHER NUMBER' : 'INVOICE NUMBER';
      const docSearchPlaceholder = isDebit ? '🔍 Search bill # or vendor' : '🔍 Search invoice or payer';
      const amountFieldLabel = isDebit ? 'DEBIT AMOUNT' : 'CREDIT AMOUNT';
      const payerLabel = isDebit ? 'Vendor / Payee' : 'Payer';
      const submitBtnLabel = isDebit ? 'Link vendor bill' : 'Link invoice';

      confirmTr.innerHTML = `
        <td colspan="7">
          <div class="inline-confirm-box">
            <!-- Header -->
            <div class="confirm-header-row">
              <div class="confirm-title-left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>${docHeaderLabel}</span>
              </div>
              <button type="button" class="confirm-close-btn" id="close-confirm-${row.id}">&times;</button>
            </div>
            <p class="confirm-subtitle-text">${docSubLabel}</p>

            <!-- Data Fields Grid -->
            <div class="confirm-data-grid">
              <div class="confirm-data-field">
                <label>${docFieldLabel}</label>
                <div class="confirm-inv-input-wrap">
                  <input type="text" class="confirm-inv-search-input font-mono" id="confirm-inv-input-${row.id}" placeholder="${docSearchPlaceholder}" value="${escapeHtml(confirmingInvoiceNo)}">
                  <ul class="suggestions-dropdown" id="confirm-dropdown-${row.id}" style="display: none;"></ul>
                </div>
              </div>

              <div class="confirm-data-field">
                <label>BANK DATE</label>
                <div class="confirm-field-val font-mono">${escapeHtml(row.date)}</div>
              </div>

              <div class="confirm-data-field">
                <label>${amountFieldLabel}</label>
                <div class="confirm-field-val font-mono font-bold ${isDebit ? 'text-danger' : ''}">${isDebit ? '- ' : ''}${formatINR(row.amount)}</div>
              </div>
            </div>

            <!-- Reference -->
            <div class="confirm-ref-row">
              <label>REFERENCE</label>
              <div class="confirm-field-val font-mono">${escapeHtml(row.bankRef || '—')}</div>
            </div>

            <!-- Narration Box -->
            <div class="confirm-narration-banner">
              <span>Narration: <strong>${escapeHtml(row.narration)}</strong></span>
              ${(confirmingGuestName || row.payer) ? `<span>${payerLabel}: <strong>${escapeHtml(confirmingGuestName || row.payer)}</strong></span>` : ''}
            </div>

            <!-- Action Buttons -->
            <div class="confirm-actions-toolbar">
              <button type="button" class="btn-confirm-cancel" id="cancel-confirm-${row.id}">Cancel</button>
              <button type="button" class="btn-confirm-submit" id="submit-confirm-${row.id}" style="${isDebit ? 'background: #e11d48;' : ''}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                ${submitBtnLabel}
              </button>
            </div>
          </div>
        </td>
      `;

      creditTableBody.appendChild(confirmTr);

      // Setup Search inside confirmation panel
      const drawerInput = confirmTr.querySelector(`#confirm-inv-input-${row.id}`);
      const drawerDropdown = confirmTr.querySelector(`#confirm-dropdown-${row.id}`);

      function showDrawerSuggestions(filterVal) {
        drawerDropdown.innerHTML = '';
        const term = (filterVal || '').trim().toLowerCase();

        if (isDebit) {
          const matches = appVendorBills.filter(b => {
            if (!term) return true;
            return b.billNo.toLowerCase().includes(term) ||
                   b.vendorName.toLowerCase().includes(term) ||
                   (b.category && b.category.toLowerCase().includes(term));
          }).slice(0, 6);

          if (matches.length === 0) {
            drawerDropdown.style.display = 'none';
            return;
          }

          const header = document.createElement('li');
          header.className = 'suggestion-header';
          header.textContent = 'Select Vendor Bill';
          drawerDropdown.appendChild(header);

          matches.forEach(m => {
            const item = document.createElement('li');
            item.className = 'suggestion-item';
            item.innerHTML = `
              <div class="suggestion-item-top">
                <span class="suggestion-inv-num" style="color: #e11d48;">${escapeHtml(m.billNo)}</span>
                <span class="suggestion-expected-amount font-bold" style="color: #be123c;">${formatINR(m.amount)}</span>
              </div>
              <div class="suggestion-payer-name">${escapeHtml(m.vendorName)} · ${escapeHtml(m.category || 'Expense')}</div>
            `;

            const handleDrawerSelect = (e) => {
              e.preventDefault();
              drawerInput.value = m.billNo;
              confirmingInvoiceNo = m.billNo;
              confirmingGuestName = m.vendorName;
              drawerDropdown.style.display = 'none';
              renderCreditTable();
            };
            item.addEventListener('pointerdown', handleDrawerSelect);
            item.addEventListener('mousedown', handleDrawerSelect);

            drawerDropdown.appendChild(item);
          });
        } else {
          const matches = appInvoices.filter(b => {
            if (!term) return true;
            return b.invoiceNo.toLowerCase().includes(term) ||
                   b.guestName.toLowerCase().includes(term) ||
                   (b.category && b.category.toLowerCase().includes(term));
          }).slice(0, 6);

          if (matches.length === 0) {
            drawerDropdown.style.display = 'none';
            return;
          }

          const header = document.createElement('li');
          header.className = 'suggestion-header';
          header.textContent = 'Select Customer Invoice';
          drawerDropdown.appendChild(header);

          matches.forEach(m => {
            const item = document.createElement('li');
            item.className = 'suggestion-item';
            item.innerHTML = `
              <div class="suggestion-item-top">
                <span class="suggestion-inv-num">${escapeHtml(m.invoiceNo)}</span>
                <span class="suggestion-expected-amount font-bold">${formatINR(m.amount)}</span>
              </div>
              <div class="suggestion-payer-name">${escapeHtml(m.guestName)} · ${escapeHtml(m.category)}</div>
            `;

            const handleDrawerSelect = (e) => {
              e.preventDefault();
              drawerInput.value = m.invoiceNo;
              confirmingInvoiceNo = m.invoiceNo;
              confirmingGuestName = m.guestName;
              drawerDropdown.style.display = 'none';
              renderCreditTable();
            };
            item.addEventListener('pointerdown', handleDrawerSelect);
            item.addEventListener('mousedown', handleDrawerSelect);

            drawerDropdown.appendChild(item);
          });
        }

        drawerDropdown.style.display = 'block';
      }

      drawerInput.addEventListener('focus', () => showDrawerSuggestions(drawerInput.value));
      drawerInput.addEventListener('input', () => {
        confirmingInvoiceNo = drawerInput.value;
        showDrawerSuggestions(drawerInput.value);
      });
      drawerInput.addEventListener('blur', () => {
        setTimeout(() => { drawerDropdown.style.display = 'none'; }, 200);
      });

      // Submit Confirm
      confirmTr.querySelector(`#submit-confirm-${row.id}`).addEventListener('click', () => {
        const docNo = drawerInput.value.trim();
        if (!docNo) {
          showToast(`Please specify a ${docTypeLabel} number`, 'amber');
          drawerInput.focus();
          return;
        }
        executeInvoiceLink(row, docNo, confirmingGuestName || row.payer);
      });

      // Cancel / Close
      const closeHandler = () => {
        activeConfirmingRowId = null;
        confirmingInvoiceNo = '';
        confirmingGuestName = '';
        renderCreditTable();
      };

      confirmTr.querySelector(`#cancel-confirm-${row.id}`).addEventListener('click', closeHandler);
      confirmTr.querySelector(`#close-confirm-${row.id}`).addEventListener('click', closeHandler);
    }
  });
}

function openInlineConfirmation(row, invoiceNo, guestName) {
  activeConfirmingRowId = row.id;
  confirmingInvoiceNo = invoiceNo || '';
  confirmingGuestName = guestName || '';
  renderCreditTable();

  // Scroll to row smoothly
  setTimeout(() => {
    const el = document.getElementById(`row-${row.id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
}

function executeInvoiceLink(row, invoiceNo, guestName) {
  const isDebit = activeMappingMode === 'debit' || (row.id && String(row.id).startsWith('DR-'));
  row.status = 'mapped';
  row.mapping = {
    invoiceNo: invoiceNo,
    billNo: invoiceNo,
    guestName: guestName || row.payer || (isDebit ? 'Vendor' : 'Customer'),
    vendorName: guestName || row.payer || (isDebit ? 'Vendor' : 'Customer'),
    mappedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    mappedBy: 'Boss (Accounts Controller)',
    isNote: false
  };

  // Record recent activity
  const bank = getActiveBank();
  recentActivities.unshift({
    text: `Linked ${isDebit ? 'Bill' : 'Invoice'} ${invoiceNo} (${guestName || (isDebit ? 'Vendor' : 'Customer')})`,
    meta: `${bank.name} ${bank.accNo} · Just now`
  });

  activeConfirmingRowId = null;
  confirmingInvoiceNo = '';
  confirmingGuestName = '';

  renderAll();
  showToast(`Successfully linked ${isDebit ? 'vendor bill' : 'invoice'} ${invoiceNo} to ${row.date} ${isDebit ? 'debit' : 'credit'}!`);
}

function triggerUnlinkModal(row) {
  pendingUnlinkTarget = row;
  const docNo = row.mapping ? (row.mapping.billNo || row.mapping.invoiceNo) : '—';
  if (unlinkInvoiceNo) unlinkInvoiceNo.textContent = docNo;
  if (unlinkModal) unlinkModal.style.display = 'flex';
}

function executeUnlink() {
  if (!pendingUnlinkTarget) return;
  const row = pendingUnlinkTarget;
  const oldDoc = row.mapping ? (row.mapping.billNo || row.mapping.invoiceNo) : '—';

  row.status = 'unmapped';
  row.mapping = null;

  const bank = getActiveBank();
  recentActivities.unshift({
    text: `Unlinked ${oldDoc}`,
    meta: `${bank.name} ${bank.accNo} · Just now`
  });

  pendingUnlinkTarget = null;
  if (unlinkModal) unlinkModal.style.display = 'none';
  renderAll();
  showToast(`Unlinked ${oldDoc}. Transaction is now open for review.`);
}

// =============================================================================
// 8. Bank Statement CSV Upload with Strict Deduplication (Credits & Debits)
// =============================================================================

function processBankStatementCsv(csvText) {
  const currentSheet = getCurrentSheet();
  const isDebit = activeMappingMode === 'debit';
  if (!currentSheet.records) currentSheet.records = [];
  if (!currentSheet.debitRecords) currentSheet.debitRecords = [];

  const targetList = isDebit ? currentSheet.debitRecords : currentSheet.records;
  const existingSet = new Set(
    targetList.map(r => `${r.date}|${r.amount}|${r.type}|${r.bankRef}`.toLowerCase())
  );

  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    showToast('CSV file appears to be empty or has only headers', 'amber');
    return;
  }

  let added = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 4) continue;

    const date = cols[0];
    const narration = cols[1];
    const ref = cols[2];
    const amount = parseFloat(cols[3]) || 0;
    const type = cols[4] || (narration.includes('UPI') ? 'UPI' : narration.includes('NEFT') ? 'NEFT' : narration.includes('RTGS') ? 'RTGS' : 'NEFT');

    const key = `${date}|${amount}|${type}|${ref}`.toLowerCase();
    if (existingSet.has(key)) {
      skipped++;
    } else {
      existingSet.add(key);
      added++;
      targetList.unshift({
        id: `${isDebit ? 'DR' : 'CR'}-IMP-${Date.now()}-${added}`,
        date: date,
        narration: narration,
        payer: cols[5] || (isDebit ? 'Vendor' : ''),
        type: type,
        bankRef: ref,
        amount: amount,
        status: 'unmapped',
        mapping: null
      });
    }
  }

  const bank = getActiveBank();
  recentActivities.unshift({
    text: `Imported statement (${added} ${isDebit ? 'debits' : 'credits'} added)`,
    meta: `${bank.name} ${bank.accNo} · Just now`
  });

  renderAll();
  showToast(`${isDebit ? 'Debit' : 'Credit'} statement CSV processed: ${added} added, ${skipped} duplicates safely skipped!`);
}

// =============================================================================
// 9. Invoices & Vendor Bills Catalogs & CSV Uploads
// =============================================================================

function renderInvoicesCatalogModal() {
  if (!catalogInvoicesTableBody) return;
  catalogInvoicesTableBody.innerHTML = '';

  const q = (invoiceCatalogSearch ? invoiceCatalogSearch.value : '').toLowerCase().trim();
  const filtered = appInvoices.filter(inv => {
    if (!q) return true;
    return inv.invoiceNo.toLowerCase().includes(q) ||
           inv.guestName.toLowerCase().includes(q) ||
           (inv.category && inv.category.toLowerCase().includes(q));
  });

  filtered.forEach(inv => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong class="font-mono">${escapeHtml(inv.invoiceNo)}</strong></td>
      <td>${escapeHtml(inv.guestName)}</td>
      <td>${formatINR(inv.amount)}</td>
      <td>${escapeHtml(inv.date || '—')}</td>
      <td><span class="text-muted">${escapeHtml(inv.category || '—')}</span></td>
    `;
    catalogInvoicesTableBody.appendChild(tr);
  });
}

function processInvoiceCsv(csvText) {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    showToast('CSV file is empty or missing data rows', 'amber');
    return;
  }

  let added = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 3) continue;

    const invoiceNo = cols[0];
    const customer = cols[1];
    const amount = parseFloat(cols[2]) || 0;
    const date = cols[3] || '19 Sep 2026';
    const category = cols[4] || 'Bulk Supply';

    if (!appInvoices.some(inv => inv.invoiceNo.toLowerCase() === invoiceNo.toLowerCase())) {
      appInvoices.unshift({
        invoiceNo,
        guestName: customer,
        amount,
        date,
        category
      });
      added++;
    }
  }

  renderAll();
  showToast(`Imported ${added} customer invoices from CSV!`);
}

function renderVendorBillsCatalogModal() {
  if (!catalogBillsTableBody) return;
  catalogBillsTableBody.innerHTML = '';

  const q = (billCatalogSearch ? billCatalogSearch.value : '').toLowerCase().trim();
  const filtered = appVendorBills.filter(bill => {
    if (!q) return true;
    return bill.billNo.toLowerCase().includes(q) ||
           bill.vendorName.toLowerCase().includes(q) ||
           (bill.category && bill.category.toLowerCase().includes(q));
  });

  filtered.forEach(bill => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong class="font-mono" style="color: #be123c;">${escapeHtml(bill.billNo)}</strong></td>
      <td>${escapeHtml(bill.vendorName)}</td>
      <td class="font-bold" style="color: #be123c;">${formatINR(bill.amount)}</td>
      <td>${escapeHtml(bill.date || '—')}</td>
      <td><span class="text-muted">${escapeHtml(bill.category || '—')}</span></td>
    `;
    catalogBillsTableBody.appendChild(tr);
  });
}

function processVendorBillCsv(csvText) {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    showToast('CSV file is empty or missing data rows', 'amber');
    return;
  }

  let added = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 3) continue;

    const billNo = cols[0];
    const vendor = cols[1];
    const amount = parseFloat(cols[2]) || 0;
    const date = cols[3] || '18 Sep 2026';
    const category = cols[4] || 'Operating Expense';

    if (!appVendorBills.some(b => b.billNo.toLowerCase() === billNo.toLowerCase())) {
      appVendorBills.unshift({
        billNo,
        vendorName: vendor,
        amount,
        date,
        category
      });
      added++;
    }
  }

  renderAll();
  showToast(`Imported ${added} vendor bills from CSV!`);
}

// =============================================================================
// 10. Dashboard & Audit Trail Renderers
// =============================================================================

function renderDashboardView() {
  if (dashTotalInvoicesCount) dashTotalInvoicesCount.textContent = `${appInvoices.length} Invoices`;

  const dashBankList = document.getElementById('dashboardBankList');
  if (dashBankList) {
    dashBankList.innerHTML = '';
    corporateBanks.forEach(b => {
      const activeSheet = b.sheets[0] || { records: [], debitRecords: [] };
      const totalInflow = (activeSheet.records || []).reduce((acc, r) => acc + r.amount, 0);
      const totalOutflow = (activeSheet.debitRecords || []).reduce((acc, r) => acc + r.amount, 0);
      const mappedCredits = (activeSheet.records || []).filter(r => r.status === 'mapped').length;
      const totalCredits = (activeSheet.records || []).length;
      const pct = totalCredits > 0 ? Math.round((mappedCredits / totalCredits) * 100) : 0;

      const row = document.createElement('div');
      row.className = 'bank-account-summary-row';
      row.innerHTML = `
        <div>
          <strong style="font-size: 13.5px; color: var(--text-primary);">${escapeHtml(b.name)}</strong>
          <div style="font-size: 11.5px; color: var(--text-muted);">${escapeHtml(b.type)} · ${escapeHtml(b.accNo)}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 700; font-size: 14px;">In: ${formatINR(totalInflow)} <span style="color: #be123c; font-size: 12px; font-weight: 600;">| Out: ${formatINR(totalOutflow)}</span></div>
          <div style="font-size: 11px; color: #059669; font-weight: 600;">${pct}% Credits Reconciled (${mappedCredits}/${totalCredits})</div>
        </div>
      `;
      dashBankList.appendChild(row);
    });
  }

  const dashFeed = document.getElementById('dashboardActivityFeed');
  if (dashFeed) {
    dashFeed.innerHTML = '';
    recentActivities.slice(0, 5).forEach(entry => {
      const item = document.createElement('div');
      item.className = 'activity-feed-item';
      item.innerHTML = `
        <span class="activity-icon-bullet"></span>
        <div style="flex: 1;">
          <div style="font-size: 12.5px; font-weight: 600; color: var(--text-primary);">${escapeHtml(entry.text)}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(entry.meta)}</div>
        </div>
      `;
      dashFeed.appendChild(item);
    });
  }
}

// =============================================================================
// 11. Command Palette (⌘ K)
// =============================================================================

function openCommandPalette() {
  if (!commandPaletteModal) return;
  commandPaletteModal.style.display = 'flex';
  if (commandPaletteInput) {
    commandPaletteInput.value = '';
    commandPaletteInput.focus();
    renderCommandPaletteResults('');
  }
}

function closeCommandPalette() {
  if (commandPaletteModal) commandPaletteModal.style.display = 'none';
}

function renderCommandPaletteResults(term) {
  if (!commandPaletteResults) return;
  commandPaletteResults.innerHTML = '';
  const q = (term || '').toLowerCase().trim();

  const actions = [
    { title: 'Switch to Debit Mapping Desk', desc: 'Match outgoing debits to vendor bills', action: () => { switchView('bank-statements'); switchMappingMode('debit'); } },
    { title: 'Switch to Credit Mapping Desk', desc: 'Match incoming credits to sales invoices', action: () => { switchView('bank-statements'); switchMappingMode('credit'); } },
    { title: 'View Bank Statements', desc: 'Jump to reconciliation workspace', action: () => switchView('bank-statements') },
    { title: 'View Financial Dashboard', desc: 'Jump to executive analytics', action: () => switchView('dashboard') },
    { title: 'Switch Bank: Canara Bank', desc: 'Account ••4092', action: () => switchBank('canara-4092') },
    { title: 'Switch Bank: HDFC Bank', desc: 'Account ••1930', action: () => switchBank('hdfc-1930') },
    { title: 'Switch Bank: State Bank of India', desc: 'Account ••8814', action: () => switchBank('sbi-8814') },
    { title: 'Add Invoice Manually', desc: 'Create new pending customer sales invoice', action: () => { if (openAddInvoiceModalBtn) openAddInvoiceModalBtn.click(); } },
    { title: 'Add Vendor Bill Manually', desc: 'Create new pending supplier purchase bill', action: () => { if (openAddBillModalBtn) openAddBillModalBtn.click(); } },
    { title: 'View Invoices Catalog', desc: 'Inspect available customer invoice records', action: () => { if (viewInvoicesBtn) viewInvoicesBtn.click(); } },
    { title: 'View Vendor Bills Catalog', desc: 'Inspect available vendor bills & expenses', action: () => { if (viewBillsBtn) viewBillsBtn.click(); } }
  ];

  const matched = actions.filter(a => !q || a.title.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q));

  matched.forEach(item => {
    const div = document.createElement('div');
    div.className = 'command-result-item';
    div.innerHTML = `
      <div style="flex: 1;">
        <div>${escapeHtml(item.title)}</div>
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 400;">${escapeHtml(item.desc)}</div>
      </div>
      <span style="font-size: 11px; color: var(--text-light);">Jump ➔</span>
    `;
    div.addEventListener('click', () => {
      closeCommandPalette();
      item.action();
    });
    commandPaletteResults.appendChild(div);
  });
}

// =============================================================================
// 12. Dynamic 6-Month Trend Bar Chart (Mode-Aware Credits & Debits)
// =============================================================================

const TREND_MONTHS = [
  { monthId: '2026-04', label: 'April 2026', shortName: 'Apr', defaultInflow: 1640000, credits: 78 },
  { monthId: '2026-05', label: 'May 2026', shortName: 'May', defaultInflow: 2120000, credits: 96 },
  { monthId: '2026-06', label: 'June 2026', shortName: 'Jun', defaultInflow: 2580000, credits: 118 },
  { monthId: '2026-07', label: 'July 2026', shortName: 'Jul', defaultInflow: 2850000, credits: 126 },
  { monthId: '2026-08', label: 'August 2026', shortName: 'Aug', defaultInflow: 2410000, credits: 132 },
  { monthId: '2026-09', label: 'September 2026', shortName: 'Sep', defaultInflow: 3383500, credits: 148 }
];

function renderCreditTrendChart() {
  if (!miniBarChart) return;
  miniBarChart.innerHTML = '';

  const bank = getActiveBank();
  const isDebit = activeMappingMode === 'debit';

  // Compute live monthly volumes for active bank and active mode
  const data = TREND_MONTHS.map(m => {
    const sheet = bank.sheets ? bank.sheets.find(s => s.monthId === m.monthId) : null;
    let total = 0;
    let count = 0;
    if (sheet) {
      const records = isDebit ? (sheet.debitRecords || []) : (sheet.records || []);
      if (records.length > 0) {
        total = records.reduce((acc, r) => acc + r.amount, 0);
        count = records.length;
      } else {
        const estCount = isDebit ? (sheet.debitsCount || Math.round(m.credits * 0.6)) : (sheet.creditsCount || m.credits);
        total = estCount * (isDebit ? 16500 : 22000);
        count = estCount;
      }
    } else {
      total = isDebit ? Math.round(m.defaultInflow * 0.6) : m.defaultInflow;
      count = isDebit ? Math.round(m.credits * 0.6) : m.credits;
    }
    return {
      ...m,
      total,
      count
    };
  });

  const maxTotal = Math.max(...data.map(d => d.total), 1);

  data.forEach(d => {
    const isCurrent = d.monthId === selectedMonthId;
    const heightPct = Math.max(24, Math.round((d.total / maxTotal) * 95));

    const col = document.createElement('div');
    col.className = `chart-col ${isCurrent ? 'active' : ''}`;
    col.title = `${d.label} (${isDebit ? 'Debits' : 'Credits'}): ${formatINR(d.total)} (${d.count} transactions) · Click to view`;

    col.innerHTML = `
      <div class="chart-bar ${isCurrent ? 'bar-active' : ''}" style="height: ${heightPct}%; ${isDebit && isCurrent ? 'background: #e11d48;' : ''}"></div>
      <span class="chart-label ${isCurrent ? 'label-active' : ''}">${d.shortName}</span>
    `;

    col.addEventListener('click', () => {
      let sheet = bank.sheets.find(s => s.monthId === d.monthId);
      if (!sheet) {
        sheet = {
          monthId: d.monthId,
          label: d.label,
          fileName: `${bank.name.replace(/\s+/g, '_')}_${d.shortName}_2026.xlsx`,
          uploadedOn: `15 ${d.shortName} 2026`,
          creditsCount: d.count,
          debitsCount: Math.round(d.count * 0.6),
          records: [
            {
              id: `CR-${d.monthId}-01`,
              date: `18 ${d.shortName} 2026`,
              narration: `RTGS/BARB0029103/CONSIGNMENT #${d.shortName.toUpperCase()}`,
              payer: 'Zydus Healthcare Ltd',
              type: 'RTGS',
              bankRef: `RTGS-${d.monthId}-01`,
              amount: Math.round(d.total * 0.6),
              status: 'unmapped',
              mapping: null
            }
          ],
          debitRecords: [
            {
              id: `DR-${d.monthId}-01`,
              date: `17 ${d.shortName} 2026`,
              narration: `NEFT/DR-SUPPLIES-${d.shortName.toUpperCase()}`,
              payer: 'Bharat Chemical Synthetics Ltd',
              type: 'NEFT',
              bankRef: `NEFT-${d.monthId}-DR01`,
              amount: Math.round(d.total * 0.5),
              status: 'unmapped',
              mapping: null
            }
          ]
        };
        bank.sheets.push(sheet);
      }

      selectedMonthId = d.monthId;
      activeConfirmingRowId = null;
      renderAll();
      showToast(`Switched to ${d.label} statement (${formatINR(d.total)})`);
    });

    miniBarChart.appendChild(col);
  });
}

// =============================================================================
// 13. Main Re-render Coordinator
// =============================================================================

function renderAll() {
  renderBankSelector();
  renderStatementFilesTable();
  renderCreditTable();
  renderCreditTrendChart();
  if (totalInvoicesCountBadge) totalInvoicesCountBadge.textContent = `${appInvoices.length} Invoices`;
  if (totalBillsCountBadge) totalBillsCountBadge.textContent = `${appVendorBills.length} Vendor Bills`;
}

// =============================================================================
// 14. Event Listeners & Binding
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Sidebar Nav
  if (navDashboard) navDashboard.addEventListener('click', () => switchView('dashboard'));
  if (navBankStatements) navBankStatements.addEventListener('click', () => switchView('bank-statements'));

  // 2. Desk Mode Switcher Tabs (Credits vs Debits)
  const handleTabSwitch = (mode) => {
    switchMappingMode(mode);
  };

  if (tabCreditMode) {
    tabCreditMode.addEventListener('click', (e) => {
      e.preventDefault();
      handleTabSwitch('credit');
    });
  }
  if (tabDebitMode) {
    tabDebitMode.addEventListener('click', (e) => {
      e.preventDefault();
      handleTabSwitch('debit');
    });
  }

  // Keyboard accessibility for desk switcher tabs
  [tabCreditMode, tabDebitMode].forEach(btn => {
    if (btn) {
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleTabSwitch(btn.dataset.mode || (btn.id === 'tabDebitMode' ? 'debit' : 'credit'));
        }
      });
    }
  });

  // Global delegated click listener for desk switcher tabs
  document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('#tabCreditMode, #tabDebitMode, .desk-tab-btn');
    if (tabBtn && tabBtn.dataset && tabBtn.dataset.mode) {
      e.preventDefault();
      handleTabSwitch(tabBtn.dataset.mode);
    }
  });

  // 3. Bank Selector Dropdown
  if (bankSelectorBtn) {
    bankSelectorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = bankDropdownMenu.style.display === 'block';
      bankDropdownMenu.style.display = open ? 'none' : 'block';
    });
  }

  document.addEventListener('click', (e) => {
    if (bankDropdownMenu && !bankDropdownMenu.contains(e.target) && e.target !== bankSelectorBtn) {
      bankDropdownMenu.style.display = 'none';
    }
    if (filterMenuPopover && !filterMenuPopover.contains(e.target) && e.target !== filterDropdownBtn) {
      filterMenuPopover.style.display = 'none';
    }
  });

  // 4. Filter Popover
  if (filterDropdownBtn) {
    filterDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = filterMenuPopover.style.display === 'block';
      filterMenuPopover.style.display = open ? 'none' : 'block';
    });
  }

  function setFilter(type, label) {
    activeFilter = type;
    if (activeFilterLabel) activeFilterLabel.textContent = label;
    [filterAll, filterUnmapped, filterMapped].forEach(btn => {
      if (btn) btn.classList.toggle('active', btn.dataset.filter === type);
    });
    if (filterMenuPopover) filterMenuPopover.style.display = 'none';
    renderCreditTable();
  }

  if (filterAll) filterAll.addEventListener('click', () => setFilter('all', 'Filter'));
  if (filterUnmapped) filterUnmapped.addEventListener('click', () => setFilter('unmapped', 'Pending'));
  if (filterMapped) filterMapped.addEventListener('click', () => setFilter('mapped', 'Reconciled'));

  // 5. Search Filter
  if (tableSearchInput) {
    tableSearchInput.addEventListener('input', () => {
      searchQuery = tableSearchInput.value;
      renderCreditTable();
    });
  }

  // 6. Statement CSV Upload & Dropzone
  if (uploadCsvBtn && bankCsvInput) {
    uploadCsvBtn.addEventListener('click', () => bankCsvInput.click());
  }

  if (dropZone && bankCsvInput) {
    dropZone.addEventListener('click', () => bankCsvInput.click());
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        const reader = new FileReader();
        reader.onload = () => processBankStatementCsv(reader.result);
        reader.readAsText(file);
      }
    });
  }

  if (bankCsvInput) {
    bankCsvInput.addEventListener('change', () => {
      if (bankCsvInput.files.length > 0) {
        const file = bankCsvInput.files[0];
        const reader = new FileReader();
        reader.onload = () => processBankStatementCsv(reader.result);
        reader.readAsText(file);
        bankCsvInput.value = '';
      }
    });
  }

  // 7. Manual Customer Invoice Modal
  if (openAddInvoiceModalBtn) {
    openAddInvoiceModalBtn.addEventListener('click', () => {
      if (addInvoiceModal) addInvoiceModal.style.display = 'flex';
      const noInput = document.getElementById('newInvNo');
      if (noInput) noInput.focus();
    });
  }

  const closeInvModal = () => { if (addInvoiceModal) addInvoiceModal.style.display = 'none'; };
  if (closeAddInvoiceModalBtn) closeAddInvoiceModalBtn.addEventListener('click', closeInvModal);
  if (cancelAddInvoiceBtn) cancelAddInvoiceBtn.addEventListener('click', closeInvModal);

  if (addInvoiceForm) {
    addInvoiceForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const no = document.getElementById('newInvNo').value.trim();
      const amt = parseFloat(document.getElementById('newInvAmount').value) || 0;
      const cust = document.getElementById('newInvCustomer').value.trim();
      const dt = document.getElementById('newInvDate').value.trim() || '19 Sep 2026';
      const cat = document.getElementById('newInvCategory').value.trim() || 'General Pharma Supply';

      if (!no || !amt || !cust) return;

      appInvoices.unshift({
        invoiceNo: no,
        guestName: cust,
        amount: amt,
        date: dt,
        category: cat
      });

      addInvoiceForm.reset();
      closeInvModal();
      renderAll();
      showToast(`Invoice ${no} (${cust}) successfully registered!`);
    });
  }

  // 8. Invoice CSV Upload
  if (openUploadInvoiceCsvBtn && invoiceCsvInput) {
    openUploadInvoiceCsvBtn.addEventListener('click', () => invoiceCsvInput.click());
  }

  if (invoiceCsvInput) {
    invoiceCsvInput.addEventListener('change', () => {
      if (invoiceCsvInput.files.length > 0) {
        const file = invoiceCsvInput.files[0];
        const reader = new FileReader();
        reader.onload = () => processInvoiceCsv(reader.result);
        reader.readAsText(file);
        invoiceCsvInput.value = '';
      }
    });
  }

  // 9. Invoices Catalog Modal
  if (viewInvoicesBtn) {
    viewInvoicesBtn.addEventListener('click', () => {
      if (invoicesCatalogModal) invoicesCatalogModal.style.display = 'flex';
      renderInvoicesCatalogModal();
    });
  }

  const closeCatModal = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (invoicesCatalogModal) invoicesCatalogModal.style.display = 'none';
  };
  if (closeInvoicesCatalogBtn) closeInvoicesCatalogBtn.addEventListener('click', closeCatModal);
  if (doneInvoicesCatalogBtn) doneInvoicesCatalogBtn.addEventListener('click', closeCatModal);
  if (invoiceCatalogSearch) invoiceCatalogSearch.addEventListener('input', renderInvoicesCatalogModal);

  // 10. Manual Vendor Bill Modal
  if (openAddBillModalBtn) {
    openAddBillModalBtn.addEventListener('click', () => {
      if (addBillModal) addBillModal.style.display = 'flex';
      const billInput = document.getElementById('newBillNo');
      if (billInput) billInput.focus();
    });
  }

  const closeBillModal = () => { if (addBillModal) addBillModal.style.display = 'none'; };
  if (closeAddBillModalBtn) closeAddBillModalBtn.addEventListener('click', closeBillModal);
  if (cancelAddBillBtn) cancelAddBillBtn.addEventListener('click', closeBillModal);

  if (addBillForm) {
    addBillForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const no = document.getElementById('newBillNo').value.trim();
      const amt = parseFloat(document.getElementById('newBillAmount').value) || 0;
      const vendor = document.getElementById('newBillVendor').value.trim();
      const dt = document.getElementById('newBillDate').value.trim() || '18 Sep 2026';
      const cat = document.getElementById('newBillCategory').value.trim() || 'Operational Expense';

      if (!no || !amt || !vendor) return;

      appVendorBills.unshift({
        billNo: no,
        vendorName: vendor,
        amount: amt,
        date: dt,
        category: cat
      });

      addBillForm.reset();
      closeBillModal();
      renderAll();
      showToast(`Vendor bill ${no} (${vendor}) registered successfully!`);
    });
  }

  // 11. Vendor Bills CSV Upload
  if (openUploadBillCsvBtn && billCsvInput) {
    openUploadBillCsvBtn.addEventListener('click', () => billCsvInput.click());
  }

  if (billCsvInput) {
    billCsvInput.addEventListener('change', () => {
      if (billCsvInput.files.length > 0) {
        const file = billCsvInput.files[0];
        const reader = new FileReader();
        reader.onload = () => processVendorBillCsv(reader.result);
        reader.readAsText(file);
        billCsvInput.value = '';
      }
    });
  }

  // 12. Vendor Bills Catalog Modal
  if (viewBillsBtn) {
    viewBillsBtn.addEventListener('click', () => {
      if (billsCatalogModal) billsCatalogModal.style.display = 'flex';
      renderVendorBillsCatalogModal();
    });
  }

  const closeBillsCatModal = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (billsCatalogModal) billsCatalogModal.style.display = 'none';
  };
  if (closeBillsCatalogBtn) closeBillsCatalogBtn.addEventListener('click', closeBillsCatModal);
  if (doneBillsCatalogBtn) doneBillsCatalogBtn.addEventListener('click', closeBillsCatModal);
  if (billCatalogSearch) billCatalogSearch.addEventListener('input', renderVendorBillsCatalogModal);

  // Universal Modal Backdrop Click to Close (Never get trapped)
  [addInvoiceModal, addBillModal, addBankModal, invoicesCatalogModal, billsCatalogModal, unlinkModal, commandPaletteModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    }
  });

  // 13. Add Bank Account Modal
  const openBankModal = () => {
    if (bankDropdownMenu) bankDropdownMenu.style.display = 'none';
    if (addBankModal) addBankModal.style.display = 'flex';
  };
  if (openAddBankModalBtn) openAddBankModalBtn.addEventListener('click', openBankModal);
  if (dashAddBankBtn) dashAddBankBtn.addEventListener('click', openBankModal);

  const closeBankModal = () => { if (addBankModal) addBankModal.style.display = 'none'; };
  if (closeAddBankModalBtn) closeAddBankModalBtn.addEventListener('click', closeBankModal);
  if (cancelAddBankBtn) cancelAddBankBtn.addEventListener('click', closeBankModal);

  if (addBankForm) {
    addBankForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('newBankName').value.trim();
      const type = document.getElementById('newBankType').value;
      const accNo = document.getElementById('newBankAccNo').value.trim();
      const ifsc = document.getElementById('newBankIfsc').value.trim();

      if (!name || !accNo) return;

      const newId = `bank-${Date.now()}`;
      corporateBanks.push({
        id: newId,
        name: name,
        type: type,
        accNo: `••••${accNo.slice(-4)}`,
        fullAccNo: accNo,
        ifsc: ifsc || 'CORP000100',
        branch: 'Corporate Finance Branch',
        sheets: [
          {
            monthId: '2026-09',
            label: 'September 2026',
            fileName: `${name.replace(/\s+/g, '_')}_Sept_2026.xlsx`,
            uploadedOn: '19 Sept 2026',
            creditsCount: 0,
            debitsCount: 0,
            records: [],
            debitRecords: []
          }
        ]
      });

      addBankForm.reset();
      closeBankModal();
      switchBank(newId);
      showToast(`New bank account ${name} registered successfully!`);
    });
  }

  // 14. Unlink Dialog
  if (closeUnlinkModalBtn) closeUnlinkModalBtn.addEventListener('click', () => { if (unlinkModal) unlinkModal.style.display = 'none'; });
  if (cancelUnlinkBtn) cancelUnlinkBtn.addEventListener('click', () => { if (unlinkModal) unlinkModal.style.display = 'none'; });
  if (confirmUnlinkBtn) confirmUnlinkBtn.addEventListener('click', executeUnlink);

  // 15. Command Palette Trigger & Keyboard Shortcut
  if (globalSearchTrigger) globalSearchTrigger.addEventListener('click', openCommandPalette);

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
    if (e.key === 'Escape') {
      closeCommandPalette();
      if (addInvoiceModal) addInvoiceModal.style.display = 'none';
      if (addBillModal) addBillModal.style.display = 'none';
      if (addBankModal) addBankModal.style.display = 'none';
      if (invoicesCatalogModal) invoicesCatalogModal.style.display = 'none';
      if (billsCatalogModal) billsCatalogModal.style.display = 'none';
      if (unlinkModal) unlinkModal.style.display = 'none';
    }
  });

  if (commandPaletteInput) {
    commandPaletteInput.addEventListener('input', () => {
      renderCommandPaletteResults(commandPaletteInput.value);
    });
  }

  // 16. Mode-Aware Export Reconciled CSV
  if (exportCurrentMonthBtn) {
    exportCurrentMonthBtn.addEventListener('click', () => {
      const sheet = getCurrentSheet();
      const isDebit = activeMappingMode === 'debit';
      const records = isDebit ? (sheet.debitRecords || []) : (sheet.records || []);
      const mapped = records.filter(r => r.status === 'mapped');
      if (mapped.length === 0) {
        showToast(`No reconciled ${isDebit ? 'debits' : 'credits'} to export for this month`, 'amber');
        return;
      }

      let csv = isDebit
        ? 'Date,Bank Reference,Debit Amount,Narration,Bill No,Vendor / Payee,Mapped By,Mapped At\n'
        : 'Date,Bank Reference,Credit Amount,Narration,Invoice No,Customer,Mapped By,Mapped At\n';

      mapped.forEach(r => {
        const docNo = r.mapping ? (r.mapping.billNo || r.mapping.invoiceNo || '') : '';
        const party = r.mapping ? (r.mapping.vendorName || r.mapping.guestName || '') : '';
        csv += `"${r.date}","${r.bankRef}","${r.amount}","${(r.narration || '').replace(/"/g, '""')}","${docNo}","${party.replace(/"/g, '""')}","${r.mapping.mappedBy}","${r.mapping.mappedAt}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Reconciled_${isDebit ? 'Debits' : 'Credits'}_${sheet.label.replace(/\s+/g, '_')}.csv`;
      link.click();
      showToast(`Exported ${mapped.length} reconciled ${isDebit ? 'debits' : 'credits'} to CSV!`);
    });
  }

  // 17. Mobile Sidebar Drawer Toggle
  const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
  const appSidebar = document.querySelector('.app-sidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  if (mobileSidebarToggle && appSidebar) {
    mobileSidebarToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = appSidebar.classList.toggle('open');
      if (sidebarBackdrop) sidebarBackdrop.classList.toggle('open', isOpen);
    });
  }

  if (sidebarBackdrop && appSidebar) {
    sidebarBackdrop.addEventListener('click', () => {
      appSidebar.classList.remove('open');
      sidebarBackdrop.classList.remove('open');
    });
  }

  // Initial Boot
  renderAll();
});

