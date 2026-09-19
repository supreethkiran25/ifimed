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

// KPI Displays
const kpiTotalAmount = document.getElementById('kpiTotalAmount');
const kpiTotalCount = document.getElementById('kpiTotalCount');
const kpiMappedAmount = document.getElementById('kpiMappedAmount');
const kpiMappedCount = document.getElementById('kpiMappedCount');
const kpiUnmappedAmount = document.getElementById('kpiUnmappedAmount');
const kpiUnmappedCount = document.getElementById('kpiUnmappedCount');
const mappedCountDisplay = document.getElementById('mappedCountDisplay');

// Statement Files Desk
const statementFilesTableBody = document.getElementById('statementFilesTableBody');
const dropZone = document.getElementById('dropZone');
const bankCsvInput = document.getElementById('bankCsvInput');
const uploadCsvBtn = document.getElementById('uploadCsvBtn');

// Credit Mapping Desk
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

// Invoice Actions & Modals
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

// Preview banner
const closePreviewBannerBtn = document.getElementById('closePreviewBannerBtn');

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
// 7. Credit Mapping Table Desk & Inline Confirmation (Matching Screenshot 2)
// =============================================================================

function renderCreditTable() {
  const currentSheet = getCurrentSheet();
  if (currentMonthLabel) currentMonthLabel.textContent = currentSheet.label;

  let records = currentSheet.records || [];

  // Stats calculation
  const totalCount = records.length;
  const mappedCount = records.filter(r => r.status === 'mapped' || r.status === 'noted').length;
  const unmappedCount = totalCount - mappedCount;
  
  const sumCreditAll = records.reduce((acc, r) => acc + r.amount, 0);
  const sumCreditMapped = records.filter(r => r.status === 'mapped').reduce((acc, r) => acc + r.amount, 0);
  const sumCreditUnmapped = records.filter(r => r.status === 'unmapped').reduce((acc, r) => acc + r.amount, 0);

  // Update KPI Cards
  if (kpiTotalAmount) kpiTotalAmount.textContent = formatINR(sumCreditAll);
  if (kpiTotalCount) kpiTotalCount.textContent = totalCount;
  if (kpiMappedAmount) kpiMappedAmount.textContent = formatINR(sumCreditMapped);
  if (kpiMappedCount) kpiMappedCount.textContent = mappedCount;
  if (kpiUnmappedAmount) kpiUnmappedAmount.textContent = formatINR(sumCreditUnmapped);
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
      const matchNarration = r.narration.toLowerCase().includes(q);
      const matchPayer = r.payer ? r.payer.toLowerCase().includes(q) : false;
      const matchRef = r.bankRef.toLowerCase().includes(q);
      const matchAmount = r.amount.toString().includes(q);
      const matchInvoice = r.mapping ? r.mapping.invoiceNo.toLowerCase().includes(q) : false;
      return matchNarration || matchPayer || matchRef || matchAmount || matchInvoice;
    });
  }

  if (visibleRowCount) visibleRowCount.textContent = records.length;
  const sumCreditVisible = records.reduce((acc, r) => acc + r.amount, 0);
  if (totalCreditAmount) totalCreditAmount.textContent = formatINR(sumCreditVisible);

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

    // Invoice Mapping Cell
    let mappingCellHtml = '';
    if (row.status === 'mapped') {
      mappingCellHtml = `
        <div class="mapped-tag-badge">
          <span>${escapeHtml(row.mapping.invoiceNo)}</span>
        </div>
      `;
    } else if (row.status === 'noted') {
      mappingCellHtml = `
        <span style="font-size: 11.5px; color: var(--amber-text); font-weight: 600;">Note: ${escapeHtml(row.mapping.noteText)}</span>
      `;
    } else {
      mappingCellHtml = `
        <div class="cell-input-mapping">
          <input type="text" class="mapping-inv-input" placeholder="Invoice #" id="input-inv-${row.id}" autocomplete="off">
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
        <span class="amount-text">${formatINR(row.amount)}</span>
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

          const matches = appInvoices.filter(b => {
            if (!term) return true;
            return b.invoiceNo.toLowerCase().includes(term) ||
                   b.guestName.toLowerCase().includes(term);
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
                <span class="suggestion-expected-amount">${formatINR(m.amount)}</span>
              </div>
              <div class="suggestion-payer-name">${escapeHtml(m.guestName)} · ${escapeHtml(m.category)}</div>
            `;

            item.addEventListener('mousedown', (e) => {
              e.preventDefault();
              dropdown.style.display = 'none';
              openInlineConfirmation(row, m.invoiceNo, m.guestName);
            });

            dropdown.appendChild(item);
          });

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
              const matched = appInvoices.find(b => b.invoiceNo.toLowerCase() === val.toLowerCase());
              openInlineConfirmation(row, val, matched ? matched.guestName : null);
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
    // INLINE CONFIRMATION DRAWER (Matching Screenshot 2)
    // =========================================================================
    if (isConfirming) {
      const confirmTr = document.createElement('tr');
      confirmTr.className = 'inline-confirm-row';

      confirmTr.innerHTML = `
        <td colspan="7">
          <div class="inline-confirm-box">
            <!-- Header -->
            <div class="confirm-header-row">
              <div class="confirm-title-left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Confirm invoice link</span>
              </div>
              <button type="button" class="confirm-close-btn" id="close-confirm-${row.id}">&times;</button>
            </div>
            <p class="confirm-subtitle-text">Review the evidence before this credit is locked to an invoice.</p>

            <!-- Data Fields Grid -->
            <div class="confirm-data-grid">
              <div class="confirm-data-field">
                <label>INVOICE NUMBER</label>
                <div class="confirm-inv-input-wrap">
                  <input type="text" class="confirm-inv-search-input font-mono" id="confirm-inv-input-${row.id}" placeholder="🔍 Search invoice or payer" value="${escapeHtml(confirmingInvoiceNo)}">
                  <ul class="suggestions-dropdown" id="confirm-dropdown-${row.id}" style="display: none;"></ul>
                </div>
              </div>

              <div class="confirm-data-field">
                <label>BANK DATE</label>
                <div class="confirm-field-val font-mono">${escapeHtml(row.date)}</div>
              </div>

              <div class="confirm-data-field">
                <label>CREDIT AMOUNT</label>
                <div class="confirm-field-val font-mono font-bold">${formatINR(row.amount)}</div>
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
              ${(confirmingGuestName || row.payer) ? `<span>Payer: <strong>${escapeHtml(confirmingGuestName || row.payer)}</strong></span>` : ''}
            </div>

            <!-- Action Buttons -->
            <div class="confirm-actions-toolbar">
              <button type="button" class="btn-confirm-cancel" id="cancel-confirm-${row.id}">Cancel</button>
              <button type="button" class="btn-confirm-submit" id="submit-confirm-${row.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Link invoice
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

        const matches = appInvoices.filter(b => {
          if (!term) return true;
          return b.invoiceNo.toLowerCase().includes(term) ||
                 b.guestName.toLowerCase().includes(term);
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
              <span class="suggestion-expected-amount">${formatINR(m.amount)}</span>
            </div>
            <div class="suggestion-payer-name">${escapeHtml(m.guestName)} · ${escapeHtml(m.category)}</div>
          `;

          item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            drawerInput.value = m.invoiceNo;
            confirmingInvoiceNo = m.invoiceNo;
            confirmingGuestName = m.guestName;
            drawerDropdown.style.display = 'none';
            // Re-render drawer with updated payer name
            renderCreditTable();
          });

          drawerDropdown.appendChild(item);
        });

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
        const invNo = drawerInput.value.trim();
        if (!invNo) {
          showToast('Please specify an invoice number', 'amber');
          drawerInput.focus();
          return;
        }
        executeInvoiceLink(row, invNo, confirmingGuestName || row.payer);
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
  row.status = 'mapped';
  row.mapping = {
    invoiceNo: invoiceNo,
    guestName: guestName || row.payer || 'Customer',
    mappedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    mappedBy: 'Boss (Accounts Controller)',
    isNote: false
  };

  // Record recent activity
  const bank = getActiveBank();
  recentActivities.unshift({
    text: `Linked ${invoiceNo} (${guestName || 'Customer'})`,
    meta: `${bank.name} ${bank.accNo} · Just now`
  });

  activeConfirmingRowId = null;
  confirmingInvoiceNo = '';
  confirmingGuestName = '';

  renderAll();
  showToast(`Successfully linked invoice ${invoiceNo} to ${row.date} credit!`);
}

function triggerUnlinkModal(row) {
  pendingUnlinkTarget = row;
  if (unlinkInvoiceNo) unlinkInvoiceNo.textContent = row.mapping ? row.mapping.invoiceNo : '—';
  if (unlinkModal) unlinkModal.style.display = 'flex';
}

function executeUnlink() {
  if (!pendingUnlinkTarget) return;
  const row = pendingUnlinkTarget;
  const oldInv = row.mapping ? row.mapping.invoiceNo : '—';

  row.status = 'unmapped';
  row.mapping = null;

  const bank = getActiveBank();
  recentActivities.unshift({
    text: `Unlinked invoice ${oldInv}`,
    meta: `${bank.name} ${bank.accNo} · Just now`
  });

  pendingUnlinkTarget = null;
  if (unlinkModal) unlinkModal.style.display = 'none';
  renderAll();
  showToast(`Unlinked ${oldInv}. Credit is now open for review.`);
}

// =============================================================================
// 8. Bank Statement CSV Upload with Strict Deduplication
// =============================================================================

function processBankStatementCsv(csvText) {
  const currentSheet = getCurrentSheet();
  const existingSet = new Set(
    currentSheet.records.map(r => `${r.date}|${r.amount}|${r.type}|${r.bankRef}`.toLowerCase())
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
      currentSheet.records.unshift({
        id: `CR-IMP-${Date.now()}-${added}`,
        date: date,
        narration: narration,
        payer: cols[5] || '',
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
    text: `Imported statement (${added} credits added)`,
    meta: `${bank.name} ${bank.accNo} · Just now`
  });

  renderAll();
  showToast(`Statement CSV processed: ${added} added, ${skipped} duplicates safely skipped!`);
}

// =============================================================================
// 9. Invoices Catalog & CSV Upload
// =============================================================================

function renderInvoicesCatalogModal() {
  if (!catalogInvoicesTableBody) return;
  catalogInvoicesTableBody.innerHTML = '';

  const q = (invoiceCatalogSearch ? invoiceCatalogSearch.value : '').toLowerCase().trim();
  const filtered = appInvoices.filter(inv => {
    if (!q) return true;
    return inv.invoiceNo.toLowerCase().includes(q) ||
           inv.guestName.toLowerCase().includes(q) ||
           inv.category.toLowerCase().includes(q);
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

// =============================================================================
// 10. Dashboard & Audit Trail Renderers
// =============================================================================

function renderDashboardView() {
  if (dashTotalInvoicesCount) dashTotalInvoicesCount.textContent = `${appInvoices.length} Invoices`;

  const dashBankList = document.getElementById('dashboardBankList');
  if (dashBankList) {
    dashBankList.innerHTML = '';
    corporateBanks.forEach(b => {
      const activeSheet = b.sheets[0] || { records: [] };
      const totalInflow = activeSheet.records.reduce((acc, r) => acc + r.amount, 0);
      const mapped = activeSheet.records.filter(r => r.status === 'mapped').length;
      const total = activeSheet.records.length;
      const pct = total > 0 ? Math.round((mapped / total) * 100) : 0;

      const row = document.createElement('div');
      row.className = 'bank-account-summary-row';
      row.innerHTML = `
        <div>
          <strong style="font-size: 13.5px; color: var(--text-primary);">${escapeHtml(b.name)}</strong>
          <div style="font-size: 11.5px; color: var(--text-muted);">${escapeHtml(b.type)} · ${escapeHtml(b.accNo)}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 700; font-size: 14px;">${formatINR(totalInflow)}</div>
          <div style="font-size: 11px; color: #059669; font-weight: 600;">${pct}% Reconciled (${mapped}/${total})</div>
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
    { title: 'View Bank Statements', desc: 'Jump to reconciliation workspace', action: () => switchView('bank-statements') },
    { title: 'View Financial Dashboard', desc: 'Jump to executive analytics', action: () => switchView('dashboard') },
    { title: 'Switch Bank: Canara Bank', desc: 'Account ••4092', action: () => switchBank('canara-4092') },
    { title: 'Switch Bank: HDFC Bank', desc: 'Account ••1930', action: () => switchBank('hdfc-1930') },
    { title: 'Switch Bank: State Bank of India', desc: 'Account ••8814', action: () => switchBank('sbi-8814') },
    { title: 'Add Invoice Manually', desc: 'Create new pending customer invoice', action: () => { if (openAddInvoiceModalBtn) openAddInvoiceModalBtn.click(); } },
    { title: 'View Invoices Catalog', desc: 'Inspect available invoice records', action: () => { if (viewInvoicesBtn) viewInvoicesBtn.click(); } }
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
// 12. Main Re-render Coordinator
// =============================================================================

function renderAll() {
  renderBankSelector();
  renderStatementFilesTable();
  renderCreditTable();
  if (totalInvoicesCountBadge) totalInvoicesCountBadge.textContent = `${appInvoices.length} Invoices`;
}

// =============================================================================
// 13. Event Listeners & Binding
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Sidebar Nav
  if (navDashboard) navDashboard.addEventListener('click', () => switchView('dashboard'));
  if (navBankStatements) navBankStatements.addEventListener('click', () => switchView('bank-statements'));

  // 2. Bank Selector Dropdown
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

  // 3. Filter Popover
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

  // 4. Search Filter
  if (tableSearchInput) {
    tableSearchInput.addEventListener('input', () => {
      searchQuery = tableSearchInput.value;
      renderCreditTable();
    });
  }

  // 5. Statement CSV Upload & Dropzone
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

  // 6. Manual Invoice Creation Modal
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

  // 7. Invoice CSV Upload
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

  // 8. Invoices Catalog Modal
  if (viewInvoicesBtn) {
    viewInvoicesBtn.addEventListener('click', () => {
      if (invoicesCatalogModal) invoicesCatalogModal.style.display = 'flex';
      renderInvoicesCatalogModal();
    });
  }

  const closeCatModal = () => { if (invoicesCatalogModal) invoicesCatalogModal.style.display = 'none'; };
  if (closeInvoicesCatalogBtn) closeInvoicesCatalogBtn.addEventListener('click', closeCatModal);
  if (doneInvoicesCatalogBtn) doneInvoicesCatalogBtn.addEventListener('click', closeCatModal);
  if (invoiceCatalogSearch) invoiceCatalogSearch.addEventListener('input', renderInvoicesCatalogModal);

  // 9. Add Bank Account Modal
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
            records: []
          }
        ]
      });

      addBankForm.reset();
      closeBankModal();
      switchBank(newId);
      showToast(`New bank account ${name} registered successfully!`);
    });
  }

  // 10. Unlink Dialog
  if (closeUnlinkModalBtn) closeUnlinkModalBtn.addEventListener('click', () => { unlinkModal.style.display = 'none'; });
  if (cancelUnlinkBtn) cancelUnlinkBtn.addEventListener('click', () => { unlinkModal.style.display = 'none'; });
  if (confirmUnlinkBtn) confirmUnlinkBtn.addEventListener('click', executeUnlink);

  // 11. Command Palette Trigger & Keyboard Shortcut
  if (globalSearchTrigger) globalSearchTrigger.addEventListener('click', openCommandPalette);

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
    if (e.key === 'Escape') {
      closeCommandPalette();
      if (addInvoiceModal) addInvoiceModal.style.display = 'none';
      if (addBankModal) addBankModal.style.display = 'none';
      if (invoicesCatalogModal) invoicesCatalogModal.style.display = 'none';
      if (unlinkModal) unlinkModal.style.display = 'none';
    }
  });

  if (commandPaletteInput) {
    commandPaletteInput.addEventListener('input', () => {
      renderCommandPaletteResults(commandPaletteInput.value);
    });
  }

  if (commandPaletteModal) {
    commandPaletteModal.addEventListener('click', (e) => {
      if (e.target === commandPaletteModal) closeCommandPalette();
    });
  }

  // 12. Export Reconciled CSV
  if (exportCurrentMonthBtn) {
    exportCurrentMonthBtn.addEventListener('click', () => {
      const sheet = getCurrentSheet();
      const mapped = sheet.records.filter(r => r.status === 'mapped');
      if (mapped.length === 0) {
        showToast('No reconciled records to export for this month', 'amber');
        return;
      }

      let csv = 'Date,Bank Reference,Credit Amount,Narration,Invoice No,Customer,Mapped By,Mapped At\n';
      mapped.forEach(r => {
        csv += `"${r.date}","${r.bankRef}","${r.amount}","${r.narration.replace(/"/g, '""')}","${r.mapping.invoiceNo}","${(r.mapping.guestName || '').replace(/"/g, '""')}","${r.mapping.mappedBy}","${r.mapping.mappedAt}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Reconciled_${sheet.label.replace(/\s+/g, '_')}.csv`;
      link.click();
      showToast(`Exported ${mapped.length} reconciled records to CSV!`);
    });
  }

  // Done event listeners

  // Initial Boot
  renderAll();
});
