/**
 * IFIMED Pharmaceuticals Pvt. Ltd. — Bank Reconciliation Workspace
 * Production-Ready Desk with Sidebar Navigation, Inline Confirmation Drawer,
 * Multiple Corporate Bank Accounts, and CSV Deduplication Desk.
 */

// =============================================================================
// 1. Initial State & Data Store
// =============================================================================

// Customer Invoices Catalog (Dynamic store: initialized with real IFIMED sales invoices)
let appInvoices = (typeof REAL_INVOICES !== 'undefined' && Array.isArray(REAL_INVOICES))
  ? JSON.parse(JSON.stringify(REAL_INVOICES))
  : [];

// Vendor Purchase Bills & Operational Expenses Catalog (Breakage & Expiry + Sales Return vouchers)
let appVendorBills = (typeof REAL_VENDOR_BILLS !== 'undefined' && Array.isArray(REAL_VENDOR_BILLS))
  ? JSON.parse(JSON.stringify(REAL_VENDOR_BILLS))
  : [];

// Statement Sheets
const ICICI_SHEETS = (typeof REAL_CORPORATE_BANKS !== 'undefined' && REAL_CORPORATE_BANKS[0] && Array.isArray(REAL_CORPORATE_BANKS[0].sheets))
  ? JSON.parse(JSON.stringify(REAL_CORPORATE_BANKS[0].sheets))
  : [];
const CANARA_SHEETS = ICICI_SHEETS; // backward compatibility

// Corporate Bank Accounts Catalog
const CORPORATE_BANKS = (typeof REAL_CORPORATE_BANKS !== 'undefined' && Array.isArray(REAL_CORPORATE_BANKS))
  ? JSON.parse(JSON.stringify(REAL_CORPORATE_BANKS))
  : [
      {
        id: 'icici-3021',
        name: 'ICICI Bank',
        type: 'Current A/c',
        accNo: '••••3021',
        fullAccNo: '000205003021',
        ifsc: 'ICIC0000002',
        branch: 'Mysore Main Branch, Karnataka',
        sheets: []
      },
      {
        id: 'axis-7419',
        name: 'Axis Bank',
        type: 'Current A/c',
        accNo: '••••7419',
        fullAccNo: '921020007419821',
        ifsc: 'UTIB0000042',
        branch: 'Saraswathipuram, Mysore',
        sheets: []
      },
      {
        id: 'kotak-8502',
        name: 'Kotak Mahindra Bank',
        type: 'Current A/c',
        accNo: '••••8502',
        fullAccNo: '711200988502',
        ifsc: 'KKBK0000421',
        branch: 'Devaraj Urs Road, Mysore',
        sheets: []
      }
    ];

// Recent Desk Activity (for Dashboard feed)
let recentActivities = (typeof REAL_ACTIVITIES !== 'undefined' && Array.isArray(REAL_ACTIVITIES))
  ? JSON.parse(JSON.stringify(REAL_ACTIVITIES))
  : [];

// Active State
let currentActiveView = 'bank-statements'; // 'dashboard' | 'bank-statements'
let activeMappingMode = 'credit'; // 'credit' (Inflow) | 'debit' (Outflow)
let selectedBankId = 'icici-3021';
let selectedMonthId = '';
let activeFilter = 'all'; // 'all' | 'unmapped' | 'mapped'
let searchQuery = '';

// Local copy of corporate banks
let corporateBanks = JSON.parse(JSON.stringify(CORPORATE_BANKS));

// Active inline confirmation state: rowId being confirmed, or null
let activeConfirmingRowId = null;
let confirmingInvoiceNo = '';
let confirmingGuestName = '';

// =============================================================================
// Supabase Authentication Configuration & State
// =============================================================================
let currentAuthUser = null;

function getSupabaseClient() {
  return null;
}

function getUserInitials(name, email) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'IF';
}

function updateAuthUI(user) {
  currentAuthUser = user;
  const authGateOverlay = document.getElementById('authGateOverlay');
  const userAvatarInitials = document.getElementById('userAvatarInitials');
  const userDisplayName = document.getElementById('userDisplayName');
  const userRoleName = document.getElementById('userRoleName');
  const dropdownAvatar = document.getElementById('dropdownAvatar');
  const dropdownName = document.getElementById('dropdownName');
  const dropdownEmail = document.getElementById('dropdownEmail');
  const dropdownBadge = document.getElementById('dropdownBadge');
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  const sidebarUserName = document.getElementById('sidebarUserName');

  if (user) {
    const email = user.email || 'user@ifimed.com';
    const metadata = user.user_metadata || {};
    const name = metadata.name || (email.toLowerCase().includes('admin') ? 'IFIMED Admin' : 'Financial Controller');
    const role = metadata.role || (email.toLowerCase().includes('admin') ? 'Corporate Controller' : 'Treasury Controller');
    const initials = getUserInitials(name, email);

    if (userAvatarInitials) userAvatarInitials.textContent = initials;
    if (userDisplayName) userDisplayName.textContent = name;
    if (userRoleName) userRoleName.textContent = role;

    if (dropdownAvatar) dropdownAvatar.textContent = initials;
    if (dropdownName) dropdownName.textContent = name;
    if (dropdownEmail) dropdownEmail.textContent = email;
    if (dropdownBadge) dropdownBadge.textContent = role;

    if (sidebarAvatar) sidebarAvatar.textContent = initials;
    if (sidebarUserName) sidebarUserName.textContent = name;

    if (authGateOverlay) {
      authGateOverlay.classList.add('hidden');
    }
  } else {
    if (userAvatarInitials) userAvatarInitials.textContent = '??';
    if (userDisplayName) userDisplayName.textContent = 'Not Signed In';
    if (userRoleName) userRoleName.textContent = 'Please Authenticate';

    if (sidebarAvatar) sidebarAvatar.textContent = '??';
    if (sidebarUserName) sidebarUserName.textContent = 'Guest';

    if (authGateOverlay) {
      authGateOverlay.classList.remove('hidden');
    }
  }
}

async function handleSignOut() {
  try {
    await fetch('/api/auth/signout', { method: 'POST' });
  } catch (err) {
    console.warn('SignOut error:', err);
  } finally {
    try {
      localStorage.removeItem('ifimed_auth_user');
      sessionStorage.removeItem('ifimed_auth_user');
    } catch (e) {}
    currentAuthUser = null;
    updateAuthUI(null);
    const userProfileDropdown = document.getElementById('userProfileDropdown');
    const userProfileBtn = document.getElementById('userProfileBtn');
    if (userProfileDropdown) userProfileDropdown.style.display = 'none';
    if (userProfileBtn) userProfileBtn.classList.remove('active');
    showToast('Signed out of IFIMED Treasury Desk successfully.', 'info');
  }
}

// =============================================================================
// 2. DOM Selectors
// =============================================================================

// Nav & Shell
const navDashboard = document.getElementById('navDashboard');
const navInvoices = document.getElementById('navInvoices');
const navBankStatements = document.getElementById('navBankStatements');
const navVirtualLedger = document.getElementById('navVirtualLedger');
const viewDashboard = document.getElementById('viewDashboard');
const viewInvoices = document.getElementById('viewInvoices');
const viewBankStatements = document.getElementById('viewBankStatements');
const viewVirtualLedger = document.getElementById('viewVirtualLedger');
const navInvoicesBadge = document.getElementById('navInvoicesBadge');
const currentCrumb = document.getElementById('currentCrumb');

// Invoices Desk State
let invoicesFilter = 'all'; // 'all' | 'reconciled' | 'partial' | 'unreconciled'
let invoicesSearch = '';
let invoicesSort = 'date-desc';

// Virtual Ledger State
let ledgerBankId = 'all';
let ledgerMonthId = 'all';
let ledgerTab = 'all'; // 'all' | 'receipts' | 'payments' | 'adjustments' | 'transfers' | 'receivables' | 'payables' | 'party-ledgers' | 'ageing'
let ledgerSelectedParty = '';
let ledgerAgeingType = 'receivables'; // 'receivables' | 'payables'
let ledgerSearchQuery = '';
let ledgerStatusFilter = 'all'; // 'all' | 'reconciled' | 'pending' | 'matched' | 'exception'
let ledgerDateFrom = '';
let ledgerDateTo = '';
let ledgerMinAmount = null;
let ledgerMaxAmount = null;
let ledgerCurrentPage = 1;
let ledgerPageSize = 25;
let appAdjustments = [];
let activeDrawerTxn = null;
let ledgerSortColumn = 'date';
let ledgerSortDir = 'desc'; // 'desc' or 'asc'

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
const tabAllMode = document.getElementById('tabAllMode');
const tabCreditMode = document.getElementById('tabCreditMode');
const tabDebitMode = document.getElementById('tabDebitMode');
const tabAllBadge = document.getElementById('tabAllBadge');
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

// Statement Rejection Modal
const statementRejectionModal = document.getElementById('statementRejectionModal');
const closeRejectionModalBtn = document.getElementById('closeRejectionModalBtn');
const rejectionDismissBtn = document.getElementById('rejectionDismissBtn');
const rejectionActionBtn = document.getElementById('rejectionActionBtn');

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

// Delete Corporate Bank Account Modal
const deleteBankModal = document.getElementById('deleteBankModal');
const closeDeleteBankModalBtn = document.getElementById('closeDeleteBankModalBtn');
const cancelDeleteBankBtn = document.getElementById('cancelDeleteBankBtn');
const confirmDeleteBankBtn = document.getElementById('confirmDeleteBankBtn');
const deleteBankTargetName = document.getElementById('deleteBankTargetName');
const deleteBankTargetAcc = document.getElementById('deleteBankTargetAcc');
const deleteBankMetaInfo = document.getElementById('deleteBankMetaInfo');
let pendingDeleteBankId = null;

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

function formatBankRef(bankRef, type) {
  if (!bankRef || bankRef === '—') return '—';
  let ref = String(bankRef);
  if (type) {
    const prefixRegex = new RegExp(`^${type}[-_/\\s]+`, 'i');
    if (prefixRegex.test(ref)) {
      ref = ref.replace(prefixRegex, '');
    }
  }
  if (ref.length > 16) return `${ref.slice(0, 14)}…`;
  return ref;
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function showToast(message, type = 'success') {
  if (!toastNotification) return;
  
  if (type === 'success') {
    toastIcon.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green-solid)" stroke-width="2.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    `;
  } else if (type === 'amber') {
    toastIcon.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--amber-solid)" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    `;
  } else {
    toastIcon.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ifimed-primary)" stroke-width="2.5">
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

function switchView(viewName, updateUrl = true) {
  currentActiveView = viewName;
  
  // Update sidebar active buttons
  [navDashboard, navInvoices, navBankStatements, navVirtualLedger].forEach(btn => {
    if (btn) btn.classList.remove('active');
  });

  // Update panels
  [viewDashboard, viewInvoices, viewBankStatements, viewVirtualLedger].forEach(panel => {
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
    if (updateUrl) {
      try { window.history.pushState({ view: 'dashboard' }, '', '/dashboard'); } catch (e) {}
    }
    renderDashboardView();
  } else if (viewName === 'invoices') {
    if (navInvoices) navInvoices.classList.add('active');
    if (viewInvoices) {
      viewInvoices.style.display = 'block';
      viewInvoices.classList.add('active');
    }
    if (currentCrumb) currentCrumb.textContent = 'Customer Invoices';
    if (updateUrl) {
      try { window.history.pushState({ view: 'invoices' }, '', '/invoices'); } catch (e) {}
    }
    renderInvoicesView();
  } else if (viewName === 'virtual-ledger' || viewName === 'ledger') {
    if (navVirtualLedger) navVirtualLedger.classList.add('active');
    if (viewVirtualLedger) {
      viewVirtualLedger.style.display = 'block';
      viewVirtualLedger.classList.add('active');
    }
    if (currentCrumb) currentCrumb.textContent = 'Virtual Ledger';
    if (updateUrl) {
      try { window.history.pushState({ view: 'virtual-ledger' }, '', '/virtual-ledger'); } catch (e) {}
    }
    renderVirtualLedgerView();
  } else {
    if (navBankStatements) navBankStatements.classList.add('active');
    if (viewBankStatements) {
      viewBankStatements.style.display = 'block';
      viewBankStatements.classList.add('active');
    }
    if (currentCrumb) currentCrumb.textContent = 'Bank statements';
    if (updateUrl) {
      try { window.history.pushState({ view: 'bank-statements' }, '', '/bank-statements'); } catch (e) {}
    }
    renderAll();
  }

  updateInvoicesBadge();
  updateVirtualLedgerBadge();

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
  if (!bank || !bank.sheets || bank.sheets.length === 0) {
    return {
      monthId: selectedMonthId || '2026-07',
      label: 'No Statement',
      fileName: 'No file uploaded',
      uploadedOn: '—',
      creditsCount: 0,
      debitsCount: 0,
      records: [],
      debitRecords: []
    };
  }

  // If selectedMonthId matches a sheet in this bank, return it
  if (selectedMonthId) {
    const matched = bank.sheets.find(s => s.monthId === selectedMonthId);
    if (matched) return matched;
  }

  // Otherwise, default to the first sheet with records, or sheets[0], and sync selectedMonthId!
  const sheetWithRecords = bank.sheets.find(s => (s.records && s.records.length > 0) || (s.debitRecords && s.debitRecords.length > 0));
  const defaultSheet = sheetWithRecords || bank.sheets[0];
  selectedMonthId = defaultSheet.monthId;
  return defaultSheet;
}

function switchBank(bankId) {
  const bank = corporateBanks.find(b => b.id === bankId);
  if (!bank) return;
  selectedBankId = bankId;
  selectedMonthId = (bank.sheets && bank.sheets[0]) ? bank.sheets[0].monthId : '2026-07';
  activeConfirmingRowId = null;

  if (bankDropdownMenu) bankDropdownMenu.style.display = 'none';
  renderAll();
  showToast(`Switched account to ${bank.name} (${bank.accNo})`);
}

function statementSourceHeader(csvText) {
  return String(csvText || '').split(/\r?\n/).slice(0, 30).join('\n');
}

function workspaceHasStatementRows() {
  return corporateBanks.some(b => (b.sheets || []).some(s =>
    (s.records && s.records.length) || (s.debitRecords && s.debitRecords.length)
  ));
}

async function fetchLocalStatementFiles() {
  try {
    const res = await fetch('/api/local-statements');
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      const data = await res.json();
      if (data.success && Array.isArray(data.files)) return data.files;
    }
  } catch (err) {}
  return [];
}

function registerBankFromSource(csvText, fileName, sheetNames) {
  const detection = detectBankFromCsv(csvText || '', fileName || '', { sheetNames: sheetNames || [] });
  if (detection && detection.bank && detection.extracted) {
    applyExtractedBankDetails(detection.bank, detection.extracted);
  }
  return detection;
}

function rehomeUploadedSheetsBySource() {
  let moved = 0;
  let updated = 0;
  corporateBanks.slice().forEach(bank => {
    (bank.sheets || []).slice().forEach(sheet => {
      const src = sheet.sourceHeader || '';
      if (!src) return;
      const extracted = extractStatementBankDetails(src, sheet.fileName || '', []);
      if (!extracted.fullAccNo && !extracted.name && !extracted.ifsc) return;
      const detection = registerBankFromSource(src, sheet.fileName || '');
      const target = detection && detection.bank;
      if (!target) return;
      updated++;
      if (target.id === bank.id) return;
      bank.sheets = (bank.sheets || []).filter(s => s !== sheet);
      if (!target.sheets) target.sheets = [];
      if (!target.sheets.some(s => s.monthId === sheet.monthId && s.fileName === sheet.fileName)) {
        target.sheets.unshift(sheet);
      }
      moved++;
    });
  });
  return { moved, updated };
}

async function waitForInitialWorkspaceLoad(ms = 8000) {
  const started = Date.now();
  while (!isInitialSupabaseLoadDone && Date.now() - started < ms) {
    await new Promise(resolve => setTimeout(resolve, 120));
  }
}

async function autoDetectBankAccounts(interactive = true) {
  if (interactive) {
    showToast('Auto-detection is disabled. Please select your matching corporate bank desk before uploading statements.', 'info');
  }
  return false;
}


function promptDeleteBank(bankId, event) {
  if (event) event.stopPropagation();

  if (corporateBanks.length <= 1) {
    showToast('Cannot delete this bank account. The workspace requires at least one active bank account.', 'amber');
    return;
  }

  const bank = corporateBanks.find(b => b.id === bankId);
  if (!bank) return;

  pendingDeleteBankId = bankId;

  if (deleteBankTargetName) deleteBankTargetName.textContent = bank.name;
  if (deleteBankTargetAcc) deleteBankTargetAcc.textContent = `${bank.type} · ${bank.accNo}`;

  let totalSheets = (bank.sheets || []).length;
  let totalCredits = 0;
  let totalDebits = 0;
  (bank.sheets || []).forEach(s => {
    totalCredits += (s.records || []).length;
    totalDebits += (s.debitRecords || []).length;
  });

  if (deleteBankMetaInfo) {
    deleteBankMetaInfo.innerHTML = `
      <div><strong>Associated Data:</strong> ${totalSheets} monthly statement sheet${totalSheets !== 1 ? 's' : ''}, ${totalCredits} credit transaction${totalCredits !== 1 ? 's' : ''}, ${totalDebits} debit transaction${totalDebits !== 1 ? 's' : ''}.</div>
      ${bank.id === selectedBankId ? '<div style="margin-top: 6px; color: var(--ifimed-primary); font-weight: 500;">ℹ️ This is currently your active bank account. If deleted, the workspace will automatically switch to another account.</div>' : ''}
    `;
  }

  if (bankDropdownMenu) bankDropdownMenu.style.display = 'none';
  if (deleteBankModal) deleteBankModal.style.display = 'flex';
}

function closeDeleteBankModal() {
  pendingDeleteBankId = null;
  if (deleteBankModal) deleteBankModal.style.display = 'none';
}

function confirmDeleteBank() {
  if (!pendingDeleteBankId) return;

  if (corporateBanks.length <= 1) {
    showToast('Cannot delete this bank account. At least one bank account must remain.', 'amber');
    closeDeleteBankModal();
    return;
  }

  const targetBank = corporateBanks.find(b => b.id === pendingDeleteBankId);
  const targetName = targetBank ? targetBank.name : 'Bank';
  const wasActive = selectedBankId === pendingDeleteBankId;

  corporateBanks = corporateBanks.filter(b => b.id !== pendingDeleteBankId);

  if (wasActive) {
    selectedBankId = corporateBanks[0].id;
    const newBank = corporateBanks[0];
    selectedMonthId = (newBank.sheets && newBank.sheets[0]) ? newBank.sheets[0].monthId : '2026-07';
    activeConfirmingRowId = null;
  }

  closeDeleteBankModal();
  renderAll();
  showToast(`Bank account "${targetName}" deleted successfully`);
}

function renderBankSelector() {
  const bank = getActiveBank();
  if (!bank) return;
  const bankFullName = `${bank.name} ${bank.type} ${bank.accNo}`;

  if (activeBankName) activeBankName.textContent = bankFullName;
  if (dropZoneBankName) dropZoneBankName.textContent = `${bank.name} CSV only`;
  if (pageBankSubheading) pageBankSubheading.textContent = `Turn incoming ${bank.name} credits into explicit invoice links.`;
  if (statementFilesSubtitle) statementFilesSubtitle.textContent = `Monthly uploads from ${bank.name}`;
  if (footerBankDetails) footerBankDetails.textContent = `${bank.name} ${bank.type} (${bank.fullAccNo || bank.accNo}) · IFSC: ${bank.ifsc || '—'}`;

  const identityBankName = document.getElementById('identityBankName');
  const identityAccNo = document.getElementById('identityAccNo');
  const identityIfsc = document.getElementById('identityIfsc');
  const identityBranch = document.getElementById('identityBranch');
  if (identityBankName) identityBankName.textContent = bank.name || 'Bank';
  if (identityAccNo) identityAccNo.textContent = bank.fullAccNo || bank.accNo || '—';
  if (identityIfsc) identityIfsc.textContent = bank.ifsc || '—';
  if (identityBranch) identityBranch.textContent = bank.branch || '';

  if (bankOptionsList) {
    bankOptionsList.innerHTML = '';
    const canDelete = corporateBanks.length > 1;

    corporateBanks.forEach(b => {
      const isSelected = b.id === selectedBankId;
      const item = document.createElement('div');
      item.className = `bank-option-item ${isSelected ? 'active' : ''}`;
      item.innerHTML = `
        <div class="bank-option-info">
          <div class="bank-option-title">${escapeHtml(b.name)}</div>
          <div class="bank-option-sub">${escapeHtml(b.type)} · ${escapeHtml(b.accNo)}</div>
        </div>
        <div class="bank-option-actions">
          <span class="bank-option-badge">${isSelected ? 'Active' : 'Select'}</span>
          <button type="button" class="bank-delete-btn ${canDelete ? '' : 'disabled'}" title="${canDelete ? `Delete ${escapeHtml(b.name)}` : 'Cannot delete sole remaining bank account'}" aria-label="Delete ${escapeHtml(b.name)}" ${canDelete ? '' : 'disabled'}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.bank-delete-btn')) {
          switchBank(b.id);
        }
      });

      const delBtn = item.querySelector('.bank-delete-btn');
      if (delBtn && canDelete) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          promptDeleteBank(b.id, e);
        });
      }

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
  if (!bank || !bank.sheets || bank.sheets.length === 0) {
    statementFilesTableBody.innerHTML = `
      <tr class="statement-files-empty-row">
image.png        <td colspan="5">
          <div class="statement-files-empty">
            <p>No statement sheets uploaded yet.</p>
            <p class="statement-files-empty-hint">Use Upload Statement above, or drop a CSV / Excel file on this table.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  bank.sheets.forEach(sheet => {
    const isCurrent = sheet.monthId === selectedMonthId;
    const tr = document.createElement('tr');
    tr.className = `statement-month-row ${isCurrent ? 'active-month' : ''}`;

    tr.innerHTML = `
      <td>
        <div class="file-name-cell">
          <span class="file-status-dot ${isCurrent ? 'dot-active' : ''}"></span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span>${escapeHtml(sheet.label)} · ${escapeHtml(sheet.fileName)}</span>
        </div>
      </td>
      <td>${sheet.creditsCount || (sheet.records ? sheet.records.length : 0)} credits</td>
      <td>${sheet.debitsCount || (sheet.debitRecords ? sheet.debitRecords.length : 0)} debits</td>
      <td>${escapeHtml(sheet.uploadedOn || '—')}</td>
      <td>
        <button type="button" class="btn btn-outline statement-delete-btn" data-bank-id="${escapeHtml(bank.id)}" data-month-id="${escapeHtml(sheet.monthId)}" aria-label="Delete ${escapeHtml(sheet.label)} statement">
          Delete
        </button>
      </td>
    `;

    tr.addEventListener('click', (e) => {
      if (e.target.closest('.statement-delete-btn')) return;
      selectedMonthId = sheet.monthId;
      activeConfirmingRowId = null;
      renderAll();
      showToast(`Viewing ${sheet.label} statement`);
    });

    const deleteBtn = tr.querySelector('.statement-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = window.confirm(`Delete ${sheet.label} (${sheet.fileName || 'statement'}) and all its transactions from ${bank.name}?`);
        if (!ok) return;
        await deleteStatementSheet(bank.id, sheet.monthId);
      });
    }

    statementFilesTableBody.appendChild(tr);
  });
}

// =============================================================================
// 7. Credit & Debit Mapping Desk & Inline Confirmation Drawer
// =============================================================================

function switchMappingMode(mode, options) {
  const opts = (options && typeof options === 'object') ? options : {};
  const silent = !!opts.silent;
  if (activeMappingMode === mode) return;
  activeMappingMode = mode;
  activeConfirmingRowId = null;
  confirmingInvoiceNo = '';
  confirmingGuestName = '';

  // Update tab buttons
  if (tabAllMode) {
    tabAllMode.classList.toggle('active', mode === 'all');
    tabAllMode.setAttribute('aria-selected', mode === 'all');
  }
  if (tabCreditMode) {
    tabCreditMode.classList.toggle('active', mode === 'credit');
    tabCreditMode.setAttribute('aria-selected', mode === 'credit');
  }
  if (tabDebitMode) {
    tabDebitMode.classList.toggle('active', mode === 'debit');
    tabDebitMode.setAttribute('aria-selected', mode === 'debit');
  }

  // Update action groups (in 'all' mode, both invoice and bill actions are accessible)
  if (creditActionsGroup) creditActionsGroup.style.display = (mode === 'credit' || mode === 'all') ? 'flex' : 'none';
  if (debitActionsGroup) debitActionsGroup.style.display = (mode === 'debit' || mode === 'all') ? 'flex' : 'none';

  // Update Titles & Subtitles
  if (mappingCardTitle) {
    if (mode === 'all') {
      mappingCardTitle.textContent = 'All transactions (Credits & Debits)';
    } else if (mode === 'credit') {
      mappingCardTitle.textContent = 'Credit mapping (Inflow)';
    } else {
      mappingCardTitle.textContent = 'Debit mapping (Outflow)';
    }
  }
  if (mappingCardSubtitle) {
    if (mode === 'all') {
      mappingCardSubtitle.textContent = 'Reconcile incoming customer payments and outgoing vendor bills together.';
    } else if (mode === 'credit') {
      mappingCardSubtitle.textContent = 'Choose an invoice, review the bank evidence, then confirm the link.';
    } else {
      mappingCardSubtitle.textContent = 'Choose a vendor bill, review the bank evidence, then confirm the link.';
    }
  }

  // Update Table Headers
  if (thAmountLabel) {
    thAmountLabel.textContent = 'Amount';
  }
  if (thMappingLabel) {
    if (mode === 'all') {
      thMappingLabel.textContent = 'Mapping';
    } else if (mode === 'credit') {
      thMappingLabel.textContent = 'Invoice';
    } else {
      thMappingLabel.textContent = 'Bill';
    }
  }
  if (footerSubtotalLabel) {
    if (mode === 'all') {
      footerSubtotalLabel.textContent = 'Net Cash Flow:';
    } else if (mode === 'credit') {
      footerSubtotalLabel.textContent = 'Subtotal Inflow:';
    } else {
      footerSubtotalLabel.textContent = 'Subtotal Outflow:';
    }
  }
  if (exportCsvBtnText) {
    if (mode === 'all') {
      exportCsvBtnText.textContent = 'Export All Reconciled';
    } else if (mode === 'credit') {
      exportCsvBtnText.textContent = 'Export CSV';
    } else {
      exportCsvBtnText.textContent = 'Export Reconciled Debits';
    }
  }

  // Update KPI Headers (Human-friendly Title Case)
  if (kpiTotalHeader) {
    if (mode === 'all') {
      kpiTotalHeader.textContent = 'Total Inflow (Credits)';
    } else if (mode === 'credit') {
      kpiTotalHeader.textContent = 'Total Credits (This Month)';
    } else {
      kpiTotalHeader.textContent = 'Total Debits (This Month)';
    }
  }
  if (kpiMappedHeader) {
    if (mode === 'all') {
      kpiMappedHeader.textContent = 'Total Outflow (Debits)';
    } else if (mode === 'credit') {
      kpiMappedHeader.textContent = 'Mapped Credits';
    } else {
      kpiMappedHeader.textContent = 'Mapped Debits';
    }
  }
  if (kpiUnmappedHeader) {
    if (mode === 'all') {
      kpiUnmappedHeader.textContent = 'Net Cash Flow';
    } else if (mode === 'credit') {
      kpiUnmappedHeader.textContent = 'Unmapped Credits';
    } else {
      kpiUnmappedHeader.textContent = 'Unmapped Debits';
    }
  }
  if (kpiTrendHeader) {
    kpiTrendHeader.textContent = (mode === 'all') ? 'Cash Flow Trend' : (mode === 'credit' ? 'Credit Trend' : 'Debit Trend');
  }
  if (kpiTotalIcon) {
    kpiTotalIcon.className = `kpi-icon-circle ${mode === 'debit' ? 'icon-circle-rose' : 'icon-circle-blue'}`;
    kpiTotalIcon.innerHTML = (mode === 'debit') ? `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="7" y1="17" x2="17" y2="7"></line>
        <polyline points="7 7 17 7 17 17"></polyline>
      </svg>
    ` : `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="17" y1="7" x2="7" y2="17"></line>
        <polyline points="17 17 7 17 7 7"></polyline>
      </svg>
    `;
  }

  // Update Empty State Texts
  if (emptyStateTitle) {
    if (mode === 'all') {
      emptyStateTitle.textContent = 'No matching credit or debit records found';
    } else if (mode === 'credit') {
      emptyStateTitle.textContent = 'No matching credit records found';
    } else {
      emptyStateTitle.textContent = 'No matching debit records found';
    }
  }

  renderAll(opts.autoPersist !== false);
  if (!silent) {
    const deskLabel = mode === 'all' ? 'All (Credits & Debits)' : (mode === 'credit' ? 'Credit' : 'Debit');
    showToast(`Switched to ${deskLabel} reconciliation desk`);
  }
}

// Expose globally for inline onclick handlers & shortcuts
window.switchMappingMode = switchMappingMode;

function renderCreditTable() {
  const currentSheet = getCurrentSheet();
  if (currentMonthLabel) currentMonthLabel.textContent = currentSheet.label;

  if (!currentSheet.records) currentSheet.records = [];
  if (!currentSheet.debitRecords) currentSheet.debitRecords = [];

  const creditsList = currentSheet.records;
  const debitsList = currentSheet.debitRecords;

  const totalCreditsCount = creditsList.length;
  const totalDebitsCount = debitsList.length;
  const totalAllCount = totalCreditsCount + totalDebitsCount;

  // Update Tab Badges
  if (tabAllBadge) tabAllBadge.textContent = totalAllCount;
  if (tabCreditBadge) tabCreditBadge.textContent = totalCreditsCount;
  if (tabDebitBadge) tabDebitBadge.textContent = totalDebitsCount;

  // Overall Financial Totals
  const sumCreditAll = creditsList.reduce((acc, r) => acc + (r.amount || 0), 0);
  const sumDebitAll = debitsList.reduce((acc, r) => acc + (r.amount || 0), 0);
  const netCashFlow = sumCreditAll - sumDebitAll;

  const mappedCreditsCount = creditsList.filter(r => r.status === 'mapped' || r.status === 'noted').length;
  const mappedDebitsCount = debitsList.filter(r => r.status === 'mapped' || r.status === 'noted').length;
  const totalMappedCount = mappedCreditsCount + mappedDebitsCount;

  // Update KPI Cards depending on active mode:
  if (activeMappingMode === 'all') {
    if (kpiTotalAmount) kpiTotalAmount.textContent = formatINR(sumCreditAll);
    if (kpiTotalCount) kpiTotalCount.textContent = `${totalCreditsCount} credits`;
    if (kpiMappedAmount) kpiMappedAmount.textContent = formatINR(sumDebitAll);
    if (kpiMappedCount) kpiMappedCount.textContent = `${totalDebitsCount} debits`;
    if (kpiUnmappedAmount) {
      kpiUnmappedAmount.textContent = `${netCashFlow >= 0 ? '+' : '-'} ${formatINR(Math.abs(netCashFlow))}`;
      kpiUnmappedAmount.style.color = netCashFlow >= 0 ? '#10b981' : '#f43f5e';
    }
    if (kpiUnmappedCount) kpiUnmappedCount.textContent = `${totalMappedCount} of ${totalAllCount} linked`;
  } else if (activeMappingMode === 'credit') {
    const sumMapped = creditsList.filter(r => r.status === 'mapped').reduce((acc, r) => acc + (r.amount || 0), 0);
    const sumUnmapped = creditsList.filter(r => r.status === 'unmapped').reduce((acc, r) => acc + (r.amount || 0), 0);
    if (kpiTotalAmount) kpiTotalAmount.textContent = formatINR(sumCreditAll);
    if (kpiTotalCount) kpiTotalCount.textContent = totalCreditsCount;
    if (kpiMappedAmount) kpiMappedAmount.textContent = formatINR(sumMapped);
    if (kpiMappedCount) kpiMappedCount.textContent = mappedCreditsCount;
    if (kpiUnmappedAmount) {
      kpiUnmappedAmount.textContent = formatINR(sumUnmapped);
      kpiUnmappedAmount.style.color = '';
    }
    if (kpiUnmappedCount) kpiUnmappedCount.textContent = totalCreditsCount - mappedCreditsCount;
  } else {
    // Debit Mode
    const sumMapped = debitsList.filter(r => r.status === 'mapped').reduce((acc, r) => acc + (r.amount || 0), 0);
    const sumUnmapped = debitsList.filter(r => r.status === 'unmapped').reduce((acc, r) => acc + (r.amount || 0), 0);
    if (kpiTotalAmount) kpiTotalAmount.textContent = formatINR(sumDebitAll);
    if (kpiTotalCount) kpiTotalCount.textContent = totalDebitsCount;
    if (kpiMappedAmount) kpiMappedAmount.textContent = formatINR(sumMapped);
    if (kpiMappedCount) kpiMappedCount.textContent = mappedDebitsCount;
    if (kpiUnmappedAmount) {
      kpiUnmappedAmount.textContent = formatINR(sumUnmapped);
      kpiUnmappedAmount.style.color = '';
    }
    if (kpiUnmappedCount) kpiUnmappedCount.textContent = totalDebitsCount - mappedDebitsCount;
  }

  // Build records to display according to activeMappingMode
  let records = [];
  if (activeMappingMode === 'all') {
    const crItems = creditsList.map(r => Object.assign(r, { _isDebit: false }));
    const drItems = debitsList.map(r => Object.assign(r, { _isDebit: true }));
    records = [...crItems, ...drItems];
    // Sort stably: latest date first
    records.sort((a, b) => {
      const da = new Date(a.date).getTime() || 0;
      const db = new Date(b.date).getTime() || 0;
      return db - da;
    });
  } else if (activeMappingMode === 'debit') {
    records = debitsList.map(r => Object.assign(r, { _isDebit: true }));
  } else {
    records = creditsList.map(r => Object.assign(r, { _isDebit: false }));
  }

  const modeTotalCount = records.length;
  const modeMappedCount = records.filter(r => r.status === 'mapped' || r.status === 'noted').length;
  const modeUnmappedCount = modeTotalCount - modeMappedCount;

  if (countAllSpan) countAllSpan.textContent = modeTotalCount;
  if (countUnmappedSpan) countUnmappedSpan.textContent = modeUnmappedCount;
  if (countMappedSpan) countMappedSpan.textContent = modeMappedCount;
  if (mappedCountDisplay) mappedCountDisplay.textContent = `${modeTotalCount} records`;

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
  const sumAmountVisible = records.reduce((acc, r) => acc + (r.amount || 0), 0);

  // Update Footer Subtotals based on mode
  if (activeMappingMode === 'all') {
    if (footerSubtotalLabel) footerSubtotalLabel.textContent = 'Net Cash Flow:';
    if (totalCreditAmount) {
      totalCreditAmount.textContent = `${netCashFlow >= 0 ? '+' : '-'} ${formatINR(Math.abs(netCashFlow))}`;
      totalCreditAmount.className = `subtotal-val font-mono ${netCashFlow >= 0 ? 'amount-credit' : 'amount-debit'}`;
    }
  } else if (activeMappingMode === 'credit') {
    if (footerSubtotalLabel) footerSubtotalLabel.textContent = 'Subtotal Inflow:';
    if (totalCreditAmount) {
      totalCreditAmount.textContent = formatINR(sumAmountVisible);
      totalCreditAmount.className = 'subtotal-val font-mono amount-credit';
    }
  } else {
    if (footerSubtotalLabel) footerSubtotalLabel.textContent = 'Subtotal Outflow:';
    if (totalCreditAmount) {
      totalCreditAmount.textContent = `- ${formatINR(sumAmountVisible)}`;
      totalCreditAmount.className = 'subtotal-val font-mono amount-debit';
    }
  }

  if (!creditTableBody) return;
  creditTableBody.innerHTML = '';

  if (records.length === 0) {
    if (tableEmptyState) tableEmptyState.style.display = 'flex';
    return;
  } else {
    if (tableEmptyState) tableEmptyState.style.display = 'none';
  }

  records.forEach(row => {
    const isDebit = (row._isDebit !== undefined)
      ? row._isDebit
      : (activeMappingMode === 'debit' || (row.id && String(row.id).startsWith('DR-')));
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
        <div class="${tagBadgeClass}" title="Linked to system record">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
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
          <div class="mapping-search-field">
            <svg class="mapping-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" class="mapping-inv-input" placeholder="${placeholder}" id="input-inv-${row.id}" autocomplete="off" aria-label="Search and select ${placeholder}" role="combobox" aria-expanded="false" aria-autocomplete="list">
            <span class="mapping-lookup-hint">Lookup ▾</span>
          </div>
          <ul class="suggestions-dropdown" id="dropdown-${row.id}" style="display: none;" role="listbox"></ul>
        </div>
      `;
    }

    const flowBadge = `<span class="txn-flow-pill ${isDebit ? 'flow-debit' : 'flow-credit'}">${isDebit ? 'DR · Outflow' : 'CR · Inflow'}</span>`;
    const amountSign = isDebit ? '- ' : '+ ';
    const amountClass = isDebit ? 'amount-debit' : 'amount-credit';

    tr.innerHTML = `
      <td class="col-date" title="${escapeHtml(row.date)}">${escapeHtml(row.date)}</td>
      <td class="col-narration" title="${escapeHtml(row.narration)}">
        <div class="narration-primary">${escapeHtml(row.narration)}</div>
        ${row.payer ? `<div class="narration-secondary">${escapeHtml(row.payer)}</div>` : ''}
      </td>
      <td class="col-ref" title="${escapeHtml(row.bankRef || '')}">
        <div class="ref-badge-wrap">
          <span class="badge-type ${badgeClass}">${escapeHtml(row.type)}</span>
          <span class="ref-code-text">${escapeHtml(formatBankRef(row.bankRef, row.type))}</span>
        </div>
      </td>
      <td class="col-amount text-right">
        <div class="amount-cell-wrap">
          ${flowBadge}
          <span class="amount-text ${amountClass}">${amountSign}${formatINR(row.amount)}</span>
        </div>
      </td>
      <td class="col-mapping">
        ${mappingCellHtml}
      </td>
      <td class="col-status">
        ${statusPillHtml}
      </td>
      <td class="col-actions text-center">
        <button type="button" class="btn-actions-menu" id="action-btn-${row.id}" title="Row options" aria-label="Row options for transaction ${escapeHtml(row.id)}" aria-haspopup="menu">···</button>
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
                  <span class="suggestion-inv-num text-debit">${escapeHtml(m.billNo)}</span>
                  <span class="suggestion-expected-amount font-bold amount-debit">${formatINR(m.amount)}</span>
                </div>
                <div class="suggestion-payer-name">${escapeHtml(m.vendorName)}</div>
                <div class="suggestion-sub-info">
                  <span class="suggestion-date">${escapeHtml(m.date || '')}</span>
                  <span class="sub-sep">•</span>
                  <span class="suggestion-cat">${escapeHtml(m.category || 'Claim Voucher')}</span>
                  ${m.gstin ? `<span class="sub-sep">•</span><span class="suggestion-gstin font-mono">GSTIN: ${escapeHtml(m.gstin)}</span>` : ''}
                </div>
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
                     (b.gstin && b.gstin.toLowerCase().includes(term)) ||
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
                <div class="suggestion-payer-name">${escapeHtml(m.guestName)}</div>
                <div class="suggestion-sub-info">
                  <span class="suggestion-date">${escapeHtml(m.date || '')}</span>
                  <span class="sub-sep">•</span>
                  <span class="suggestion-cat">${escapeHtml(m.category || 'Regular B2B Tax Invoice')}</span>
                  ${m.gstin ? `<span class="sub-sep">•</span><span class="suggestion-gstin font-mono">GSTIN: ${escapeHtml(m.gstin)}</span>` : ''}
                </div>
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
              <button type="button" class="btn-confirm-submit ${isDebit ? 'btn-submit-debit' : ''}" id="submit-confirm-${row.id}">
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
                <span class="suggestion-inv-num text-debit">${escapeHtml(m.billNo)}</span>
                <span class="suggestion-expected-amount font-bold amount-debit">${formatINR(m.amount)}</span>
              </div>
              <div class="suggestion-payer-name">${escapeHtml(m.vendorName)}</div>
              <div class="suggestion-sub-info">
                <span class="suggestion-date">${escapeHtml(m.date || '')}</span>
                <span class="sub-sep">•</span>
                <span class="suggestion-cat">${escapeHtml(m.category || 'Claim Voucher')}</span>
                ${m.gstin ? `<span class="sub-sep">•</span><span class="suggestion-gstin font-mono">GSTIN: ${escapeHtml(m.gstin)}</span>` : ''}
              </div>
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
                   (b.gstin && b.gstin.toLowerCase().includes(term)) ||
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
              <div class="suggestion-payer-name">${escapeHtml(m.guestName)}</div>
              <div class="suggestion-sub-info">
                <span class="suggestion-date">${escapeHtml(m.date || '')}</span>
                <span class="sub-sep">•</span>
                <span class="suggestion-cat">${escapeHtml(m.category || 'Regular B2B Tax Invoice')}</span>
                ${m.gstin ? `<span class="sub-sep">•</span><span class="suggestion-gstin font-mono">GSTIN: ${escapeHtml(m.gstin)}</span>` : ''}
              </div>
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
  const isDebit = (row._isDebit !== undefined) ? row._isDebit : (activeMappingMode === 'debit' || (row.id && String(row.id).startsWith('DR-')));
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
// 7b. Auto-Match All Open Transactions with Statement Data
// =============================================================================

function docNumberOf(doc) {
  return String((doc && (doc.invoiceNo || doc.billNo)) || '').trim();
}

function partyNameOf(doc) {
  return String((doc && (doc.guestName || doc.vendorName)) || '').trim();
}

function extractStatementDocCodes(text) {
  const raw = String(text || '');
  const found = [];
  [
    /\bIFB\d{3,}\b/gi,
    /\bCNB\d{3,}\b/gi,
    /\bINV[-_/\s]?\d{3,}\b/gi,
    /\bBILL[-_/\s]?\d{3,}\b/gi
  ].forEach(re => {
    const hits = raw.match(re);
    if (hits) hits.forEach(h => found.push(String(h).replace(/\s+/g, '').toUpperCase()));
  });
  return [...new Set(found)];
}

function normalizePartyName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(pvt|ltd|limited|llc|inc|llp|bank|upi|mr|mrs|ms|dr)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function partyNamesMatch(a, b) {
  const na = normalizePartyName(a);
  const nb = normalizePartyName(b);
  if (!na || !nb || na.length < 3 || nb.length < 3) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ta = na.split(' ').filter(t => t.length > 2);
  const tb = new Set(nb.split(' ').filter(t => t.length > 2));
  if (!ta.length || !tb.size) return false;
  const overlap = ta.filter(t => tb.has(t)).length;
  return overlap >= 1 && (overlap / Math.min(ta.length, tb.size)) >= 0.5;
}

function collectMappedDocKeys() {
  const used = new Set();
  corporateBanks.forEach(bank => {
    (bank.sheets || []).forEach(sheet => {
      [].concat(sheet.records || [], sheet.debitRecords || []).forEach(row => {
        if (row && row.status === 'mapped' && row.mapping) {
          const key = String(row.mapping.invoiceNo || row.mapping.billNo || '').trim().toLowerCase();
          if (key) used.add(key);
        }
      });
    });
  });
  return used;
}

function ensureCatalogDoc(code, row, isDebit) {
  const upper = String(code || '').toUpperCase();
  if (isDebit) {
    let bill = appVendorBills.find(b => String(b.billNo || '').toLowerCase() === upper.toLowerCase());
    if (!bill) {
      bill = {
        billNo: upper,
        vendorName: row.payer || extractPartyFromNarration(row.narration) || 'Vendor',
        amount: row.amount,
        date: row.date,
        category: 'Auto-detected from statement',
        status: 'Paid',
        settledAmount: row.amount
      };
      appVendorBills.unshift(bill);
    }
    return bill;
  }
  let inv = appInvoices.find(i => String(i.invoiceNo || '').toLowerCase() === upper.toLowerCase());
  if (!inv) {
    inv = {
      invoiceNo: upper,
      guestName: row.payer || extractPartyFromNarration(row.narration) || 'Customer',
      amount: row.amount,
      date: row.date,
      category: 'Auto-detected from statement',
      status: 'Paid',
      settledAmount: row.amount
    };
    appInvoices.unshift(inv);
  }
  return inv;
}

function docsMatchFlexible(docNo, haystack) {
  if (!docNo || !haystack) return false;
  const no = String(docNo).trim().toLowerCase();
  const hay = String(haystack).trim().toLowerCase();
  if (hay.includes(no)) return true;

  const alphaNo = no.replace(/[^a-z0-9]/g, '');
  const alphaHay = hay.replace(/[^a-z0-9]/g, '');
  if (alphaNo.length >= 4 && alphaHay.includes(alphaNo)) return true;

  const numOnly = no.replace(/\D/g, '');
  if (numOnly.length >= 4 && alphaHay.includes(numOnly)) return true;

  return false;
}

function findAutoMatchDoc(row, catalog, used, isDebit) {
  const haystack = `${row.narration || ''} ${row.bankRef || ''} ${row.payer || ''}`;
  const hay = haystack.toLowerCase();

  const catalogHits = (catalog || []).filter(doc => {
    const no = docNumberOf(doc);
    return no && no.length >= 3 && !used.has(no.toLowerCase()) && docsMatchFlexible(no, hay);
  });
  if (catalogHits.length === 1) {
    return { doc: catalogHits[0], reason: 'System (Reconciled from Statement)' };
  }
  if (catalogHits.length > 1) {
    const named = catalogHits.filter(doc => partyNamesMatch(row.payer || row.narration, partyNameOf(doc)));
    if (named.length === 1) return { doc: named[0], reason: 'System (Reconciled from Statement)' };
    const amtMatch = catalogHits.filter(doc => Math.abs(Number(doc.amount) - Number(row.amount)) <= 1.00);
    if (amtMatch.length === 1) return { doc: amtMatch[0], reason: 'System (Reconciled by Doc & Amount)' };
  }

  const codes = extractStatementDocCodes(haystack);
  const preferred = isDebit
    ? codes.filter(c => /^CNB|^BILL/.test(c)).concat(codes)
    : codes.filter(c => /^IFB|^INV/.test(c)).concat(codes);
  for (const code of preferred) {
    if (used.has(code.toLowerCase())) continue;
    const existing = (catalog || []).find(doc => docsMatchFlexible(docNumberOf(doc), code));
    if (existing) return { doc: existing, reason: 'System (Reconciled from Statement)' };
  }

  const amountHits = (catalog || []).filter(doc =>
    !used.has(docNumberOf(doc).toLowerCase()) &&
    Math.abs(Number(doc.amount) - Number(row.amount)) <= 1.00
  );
  if (amountHits.length === 1 && partyNamesMatch(row.payer || row.narration, partyNameOf(amountHits[0]))) {
    return { doc: amountHits[0], reason: 'System (Auto-Matched by Amount & Name)' };
  }
  if (amountHits.length === 1) {
    return { doc: amountHits[0], reason: 'System (Auto-Matched by Amount)' };
  }
  return null;
}

function createStatementDoc(row, isDebit, used) {
  const party = row.payer || extractPartyFromNarration(row.narration) || (isDebit ? 'Vendor' : 'Customer');
  const safeParty = String(party).replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase() || 'STMT';
  const amt = String(Math.round(Math.abs(Number(row.amount) || 0)));
  const datePart = String(row.date || '').replace(/\D/g, '').slice(-6) || String(Date.now()).slice(-6);
  const prefix = isDebit ? 'BILL' : 'INV';
  let code = `${prefix}-${safeParty}-${datePart}-${amt}`;
  let n = 1;
  const taken = (value) => {
    const key = String(value).toLowerCase();
    if (used && used.has(key)) return true;
    return isDebit
      ? appVendorBills.some(b => String(b.billNo || '').toLowerCase() === key)
      : appInvoices.some(i => String(i.invoiceNo || '').toLowerCase() === key);
  };
  while (taken(code)) {
    code = `${prefix}-${safeParty}-${datePart}-${amt}-${n++}`;
  }
  return ensureCatalogDoc(code, row, isDebit);
}

function applyAutoMapping(row, doc, isDebit, mappedBy) {
  const docNo = isDebit ? (doc.billNo || doc.invoiceNo) : (doc.invoiceNo || doc.billNo);
  const party = isDebit ? (doc.vendorName || doc.guestName) : (doc.guestName || doc.vendorName);
  row.status = 'mapped';
  row.mapping = {
    invoiceNo: doc.invoiceNo || doc.billNo || docNo,
    billNo: doc.billNo || doc.invoiceNo || docNo,
    guestName: party || row.payer || '',
    vendorName: party || row.payer || '',
    mappedAt: new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }),
    mappedBy,
    isNote: false
  };
  return String(docNo || '').toLowerCase();
}

function autoMatchAllStatementData(interactive = true) {
  const banks = (corporateBanks || []).filter(b => b && Array.isArray(b.sheets) && b.sheets.length);
  const openRows = [];
  banks.forEach(bank => {
    (bank.sheets || []).forEach(sheet => {
      (sheet.records || []).forEach(r => {
        if (r && r.status !== 'mapped') openRows.push({ row: r, isDebit: false });
      });
      (sheet.debitRecords || []).forEach(r => {
        if (r && r.status !== 'mapped') openRows.push({ row: r, isDebit: true });
      });
    });
  });

  if (!openRows.length) {
    if (interactive) showToast('No open transactions to auto-match on this account.', 'amber');
    return 0;
  }

  const used = collectMappedDocKeys();
  let matchedCredits = 0;
  let matchedDebits = 0;

  openRows.forEach(({ row, isDebit }) => {
    const catalog = isDebit ? appVendorBills : appInvoices;
    const found = findAutoMatchDoc(row, catalog, used, isDebit) || {
      doc: createStatementDoc(row, isDebit, used),
      reason: 'System (Auto-Matched from Statement)'
    };
    const key = applyAutoMapping(row, found.doc, isDebit, found.reason);
    if (key) used.add(key);
    if (isDebit) matchedDebits++;
    else matchedCredits++;
  });

  const totalMatched = matchedCredits + matchedDebits;
  renderAll(false);
  persistToSupabase();

  if (interactive) {
    if (totalMatched > 0) {
      showToast(`Auto-matched all ${totalMatched} open transaction${totalMatched === 1 ? '' : 's'} (${matchedCredits} credit${matchedCredits === 1 ? '' : 's'}, ${matchedDebits} debit${matchedDebits === 1 ? '' : 's'}).`);
    } else {
      showToast('No open transactions to auto-match on this account.', 'amber');
    }
  }
  return totalMatched;
}

// =============================================================================
// 8. Bank Statement CSV & Excel Upload with Intelligent Bank Detection & Supabase Persistence
// =============================================================================

function detectCsvDelimiter(csvText) {
  const sample = csvText.slice(0, 5000);
  const commas = (sample.match(/,/g) || []).length;
  const semicolons = (sample.match(/;/g) || []).length;
  const tabs = (sample.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semicolons) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

function parseCsvLine(line, delimiter = ',') {
  const cols = [];
  let insideQuotes = false;
  let curVal = '';
  for (let c = 0; c < line.length; c++) {
    const char = line[c];
    if (char === '"' || char === "'") {
      insideQuotes = !insideQuotes;
    } else if (char === delimiter && !insideQuotes) {
      cols.push(curVal.trim().replace(/^["']|["']$/g, ''));
      curVal = '';
    } else {
      curVal += char;
    }
  }
  cols.push(curVal.trim().replace(/^["']|["']$/g, ''));
  return cols;
}

function isDateLikeValue(val) {
  const str = String(val == null ? '' : val).trim();
  if (!str) return false;
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const n = parseFloat(str);
    return n >= 36526 && n <= 62000;
  }
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/i.test(str)) return true;
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/i.test(str)) return true;
  if (/^\d{1,2}[\s\-\/][A-Za-z]{3,9}[\s\-\/,]+\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/i.test(str)) return true;
  if (/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/i.test(str)) return true;
  if (/^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{4}/.test(str)) return true;
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\s*[-–to]+\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/i.test(str)) return true;
  return false;
}

function isValidTransactionDate(dateStr) {
  const str = String(dateStr == null ? '' : dateStr).trim();
  if (!str || str.length > 48) return false;
  if (/^\d{1,3}$/.test(str)) return false;
  if (/\s[-–]\s/.test(str) || /\s+to\s+/i.test(str)) return false;
  return isDateLikeValue(str);
}

const MONTH_NAMES_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTH_ABBR_INDEX = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

function monthLabelFromId(monthId) {
  const parts = String(monthId || '').split('-');
  const year = parts[0] || '';
  const idx = Math.max(0, parseInt(parts[1], 10) - 1);
  return `${MONTH_NAMES_LONG[idx] || 'Month'} ${year}`.trim();
}

function formatMonthId(year, mon) {
  if (!mon || mon < 1 || mon > 12 || !year || year < 2000 || year > 2100) return null;
  return `${year}-${String(mon).padStart(2, '0')}`;
}

function parseDateToMonthId(dateStr) {
  const s = String(dateStr || '').trim();
  if (!s) return null;

  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = parseFloat(s);
    if (serial >= 30000 && serial <= 65000) {
      const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
      return formatMonthId(utc.getUTCFullYear(), utc.getUTCMonth() + 1);
    }
  }

  let m = s.match(/(?:^|[^\d])(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?!\d)/);
  if (m) {
    const id = formatMonthId(parseInt(m[1], 10), parseInt(m[2], 10));
    if (id) return id;
  }

  m = s.match(/(?:^|[^\d])(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?!\d)/);
  if (m) {
    let day = parseInt(m[1], 10);
    let mon = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    if (mon > 12 && day <= 12) {
      const tmp = mon;
      mon = day;
      day = tmp;
    }
    const id = formatMonthId(year, mon);
    if (id) return id;
  }

  m = s.match(/(\d{1,2})[\s\/\-]([A-Za-z]{3,9})[\s\/\-,]+(\d{2,4})/);
  if (m) {
    const mon = MONTH_ABBR_INDEX[m[2].toLowerCase().slice(0, 3)];
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    const id = formatMonthId(year, mon);
    if (id) return id;
  }

  m = s.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})/);
  if (m) {
    const mon = MONTH_ABBR_INDEX[m[1].toLowerCase().slice(0, 3)];
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    const id = formatMonthId(year, mon);
    if (id) return id;
  }

  m = s.match(/[A-Za-z]{3}\s+([A-Za-z]{3})\s+\d{1,2}\s+(\d{4})/);
  if (m) {
    const mon = MONTH_ABBR_INDEX[m[1].toLowerCase()];
    const id = formatMonthId(parseInt(m[2], 10), mon);
    if (id) return id;
  }

  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    const dt = new Date(parsed);
    if (!Number.isNaN(dt.getTime())) {
      return formatMonthId(dt.getFullYear(), dt.getMonth() + 1);
    }
  }

  return null;
}

function normalizeDisplayedDate(text) {
  const s = String(text || '').trim();
  const dmy = s.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
  if (dmy) return dmy[1];
  const ymd = s.match(/(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/);
  if (ymd) return ymd[1];
  const named = s.match(/(\d{1,2}[\s\-\/][A-Za-z]{3,9}[\s\-\/,]+\d{2,4})/);
  if (named) return named[1];
  return s;
}

function extractRowDateAndMonth(cols, preferredIdx) {
  const tryCell = (raw, allowSerial) => {
    const text = String(raw == null ? '' : raw).trim();
    if (!text) return null;
    if (/^\d{5}(\.\d+)?$/.test(text) && !allowSerial) return null;
    const monthId = parseDateToMonthId(text);
    if (!monthId) return null;
    return { date: normalizeDisplayedDate(text), monthId };
  };
  if (preferredIdx >= 0) {
    const hit = tryCell(cols[preferredIdx], true);
    if (hit) return hit;
  }
  for (let i = 0; i < (cols || []).length; i++) {
    if (i === preferredIdx) continue;
    const hit = tryCell(cols[i], false);
    if (hit) return hit;
  }
  return null;
}

function amountLooksLikeDateDigits(amount, dateStr) {
  const dateDigits = String(dateStr || '').replace(/\D/g, '').replace(/^0+/, '');
  const amtDigits = String(Math.round(Math.abs(Number(amount) || 0)));
  return !!(dateDigits && amtDigits && dateDigits === amtDigits);
}

function isPlausibleMoneyAmount(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num === 0) return false;
  const abs = Math.abs(num);
  if (abs < 0.01 || abs > 100000000) return false;
  return true;
}

function parseAmount(val, options = {}) {
  if (val === undefined || val === null) return 0;
  let str = String(val).trim();
  if (!str || str === '-' || str === '--' || str.toLowerCase() === 'nil' || str.toLowerCase() === 'na') return 0;
  if (isDateLikeValue(str)) return 0;

  // Clean Indian currency symbols (₹, Rs., etc.)
  str = str.replace(/[₹\u20B9]/g, '').replace(/rs\.?/gi, '').trim();

  // In Indian accounting & pharma sales registers, 'Dr' stands for a Debit balance (positive receivable!)
  // Only negative if explicitly wrapped in parentheses (12500) or ends with minus 12500-
  const isNegative = (str.startsWith('(') && str.endsWith(')')) || (str.endsWith('-') && !str.includes(' '));

  // Strip Dr/Cr suffixes, commas, and other non-numeric chars
  str = str.replace(/dr|cr/gi, '').trim();
  str = str.replace(/,/g, '');
  str = str.replace(/[^0-9.-]/g, '');

  if (!str || str === '-' || str === '.' || str === '-.') return 0;
  let num = parseFloat(str) || 0;
  if (isNegative) num = -Math.abs(num);
  return num;
}

function findMaxPlausibleAmountInRow(cols, skipCols) {
  const skip = new Set((skipCols || []).filter(i => i >= 0));
  let maxAmt = 0;
  for (let i = 0; i < cols.length; i++) {
    if (skip.has(i)) continue;
    if (isDateLikeValue(cols[i])) continue;
    const amt = Math.abs(parseAmount(cols[i]));
    if (isPlausibleMoneyAmount(amt) && amt > maxAmt) {
      maxAmt = amt;
    }
  }
  return maxAmt;
}

function findPlausibleAmountInRow(cols, skipCols) {
  const max = findMaxPlausibleAmountInRow(cols, skipCols);
  if (max > 0) return max;
  const skip = new Set((skipCols || []).filter(i => i >= 0));
  for (let i = cols.length - 1; i >= 0; i--) {
    if (skip.has(i)) continue;
    if (isDateLikeValue(cols[i])) continue;
    const amt = parseAmount(cols[i]);
    if (isPlausibleMoneyAmount(amt)) return amt;
  }
  return 0;
}

function isSummaryOrFooterLine(line) {
  if (!line || !line.trim()) return true;
  const normalized = line.toLowerCase().replace(/[\s\-_]+/g, ' ').trim();

  // Never discard a row if it looks like a valid table header row with column labels
  if (/(\bdate\b|\bdt\b).+(\bparticulars\b|\bparty\b|\bcustomer\b|\bvch\b|\binvoice\b|\bbill\b|\bdebit\b)/i.test(normalized)) {
    return false;
  }

  if (normalized.startsWith('total ') ||
      normalized === 'total' ||
      normalized.startsWith('grand total') ||
      normalized.startsWith('sub total') ||
      normalized.includes('t o t a l') ||
      normalized.includes('closing balance') ||
      normalized.includes('opening balance') ||
      normalized.includes('end of statement') ||
      normalized.includes('generated on') ||
      normalized.includes('statement summary') ||
      normalized.startsWith('page ') ||
      normalized.startsWith('count ') ||
      /call\s*0\d{8,}/.test(normalized) ||
      /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\s*[-–to]+\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/i.test(normalized)) {
    return true;
  }
  return false;
}

function isGstOrSalesRegisterFile(fileName, csvText) {
  const sample = `${fileName || ''} ${(csvText || '').slice(0, 10000)}`.toLowerCase();
  if (/gstr|gst[_\s-]?r(?:eturn)?|gstr-?1|gst r-?1|e-?invoice|einvoice/.test(sample)) return true;
  if (/sales\s*book|sales\s*register|invoice\s*register|invoice\s*book|marg\s*erp|busy\s*accounting|bill\s*register/.test(sample)) return true;
  if (/\bvch\s*type\b|\bvoucher\s*type\b|\bvch\s*no\b|\bparticulars\b/i.test(sample) && /\bsales\b|\btaxable\b|\bbill\s*amt\b|\bgstin\b/i.test(sample)) return true;
  const invoiceHits = ((csvText || '').match(/\bIFB[-_\s]?\d{3,}\b/gi) || []).length;
  const hasBankCue = /ifsc|a\/c no\b|account number|statement summary|withdrawal\s*\(dr\)|deposit\s*\(cr\)/i.test(sample);
  return (invoiceHits >= 3 && !hasBankCue);
}

function isSalesRegisterOrInvoiceBook(fileName, csvText) {
  return isGstOrSalesRegisterFile(fileName, csvText);
}

function isPurchaseRegister(fileName, csvText) {
  const sample = `${fileName || ''} ${(csvText || '').slice(0, 4000)}`.toLowerCase();
  return /purchase\s*book|purchase\s*register|debit note register/.test(sample);
}

function sanitizeMaskedAccNo(accNo, fullAccNo, bankId) {
  const raw = String(accNo || '');
  const isCorrupt = /[�\uFFFD]/.test(raw) || !/\d{4}/.test(raw);
  if (!isCorrupt) {
    return `••••${raw.replace(/\D/g, '').slice(-4)}`;
  }
  const idSuffix = String(bankId || '').split('-').pop();
  if (idSuffix && /^\d{4}$/.test(idSuffix)) return `••••${idSuffix}`;
  const suffix = String(fullAccNo || '').replace(/\D/g, '').slice(-4);
  if (suffix) return `••••${suffix}`;
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 4) return `••••${digits.slice(-4)}`;
  return '••••0000';
}

function isGarbageStatementRow(row) {
  if (!row) return true;
  if (!isValidTransactionDate(row.date)) return true;
  if (!isPlausibleMoneyAmount(row.amount)) return true;
  if (amountLooksLikeDateDigits(row.amount, row.date)) return true;
  const blob = `${row.date || ''} ${row.narration || ''} ${row.payer || ''}`;
  if (/marg erp|chemist rs\.|online purchase import|call 0\d{8,}/i.test(blob)) return true;
  return false;
}

function sanitizeCorporateBanks(banks) {
  if (!Array.isArray(banks)) return [];
  return banks.map(b => {
    const sheets = (b.sheets || []).map(s => {
      const records = (s.records || []).filter(r => !isGarbageStatementRow(r));
      const debitRecords = (s.debitRecords || []).filter(r => !isGarbageStatementRow(r));
      return Object.assign({}, s, {
        records,
        debitRecords,
        creditsCount: records.length,
        debitsCount: debitRecords.length
      });
    }).filter(s => (s.records && s.records.length) || (s.debitRecords && s.debitRecords.length));
    return Object.assign({}, b, {
      accNo: sanitizeMaskedAccNo(b.accNo || b.acc_no, b.fullAccNo || b.full_acc_no, b.id),
      sheets
    });
  });
}

function extractPartyFromNarration(narration) {
  if (!narration) return '';
  let str = String(narration).trim();

  // If there are slash-separated parts (e.g. UPI/DR/123/Party/Bank, NEFT/CR/Ref/Party)
  if (str.includes('/')) {
    const parts = str.split('/').map(p => p.trim()).filter(Boolean);
    const partyCandidate = parts.find(p => {
      const lower = p.toLowerCase();
      if (['upi', 'neft', 'rtgs', 'imps', 'cr', 'dr', 'inf', 'inft', 'clg', 'chq', 'cheque', 'transfer'].includes(lower)) return false;
      if (/^\d+$/.test(p)) return false;
      if (/^[A-Za-z]{4,}\d+/.test(p)) return false;
      return p.length >= 3;
    });
    if (partyCandidate) return partyCandidate;
  }

  // If there is a hyphen separator: IMPS-12345-Party Name
  if (str.includes('-')) {
    const parts = str.split('-').map(p => p.trim()).filter(Boolean);
    const partyCandidate = parts.find(p => {
      const lower = p.toLowerCase();
      if (['upi', 'neft', 'rtgs', 'imps', 'cr', 'dr'].includes(lower)) return false;
      if (/^\d+$/.test(p)) return false;
      return p.length >= 3;
    });
    if (partyCandidate) return partyCandidate;
  }

  str = str.replace(/^(?:to|by)\s+(?:transfer|cheque|chq|clearing)[\s\-\:]+/i, '');
  str = str.replace(/^(?:clg|chq)\s+(?:to|by)[\s\-\:]+/i, '');
  return str.slice(0, 60).trim();
}

function rankDateHeader(clean) {
  const s = String(clean || '').trim();
  if (!s) return -1;
  if (/^(transaction date|txn date|tran date|trans date|txn dt|posted date|posting date|entry date)$/.test(s)) return 10;
  if (/transaction date|txn date|tran date|trans date/.test(s)) return 9;
  if (s === 'date' || s === 'dt' || s === 'vch date' || s === 'bill date') return 7;
  if (/^(value date|booking date|value dt)$/.test(s)) return 4;
  if (s.includes('date') && !s.includes('update') && !s.includes('due') && !s.includes('period')) return 3;
  if (s.includes('txn dt')) return 8;
  return -1;
}

function findStatementHeaders(lines, delimiter) {
  let bestHeader = null;
  let maxScore = -1;

  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const lowerLine = rawLine.toLowerCase();
    if (lowerLine.startsWith('statement period') || lowerLine.startsWith('opening balance') || lowerLine.startsWith('account statement for') || lowerLine.startsWith('branch:') || lowerLine.startsWith('customer id:')) {
      continue;
    }

    const rawCols = parseCsvLine(rawLine, delimiter).map(c => c.trim().toLowerCase().replace(/[\r\n\t]+/g, ' '));
    if (rawCols.length < 2) continue;

    let dateCol = -1, narrationCol = -1, refCol = -1, creditCol = -1, debitCol = -1, amountCol = -1, drCrCol = -1, payerCol = -1;
    let dateColScore = -1;
    let score = 0;

    rawCols.forEach((c, idx) => {
      const clean = c.replace(/[_\-\/\.\(\)\s]+/g, ' ').trim();
      const dateRank = rankDateHeader(clean);

      // Prefer Transaction Date over Value Date / generic Date
      if (dateRank > dateColScore) {
        dateCol = idx;
        dateColScore = dateRank;
        score += dateRank >= 8 ? 6 : 4;
      }

      // Narration / Description / Particulars
      else if (narrationCol === -1 && (
        clean === 'narration' || clean === 'particulars' || clean === 'particular' ||
        clean === 'description' || clean === 'desc' || clean === 'remarks' ||
        clean === 'details' || clean === 'tran desc' || clean === 'transaction remarks' ||
        clean.includes('narration') || clean.includes('particular') || clean.includes('description') || clean.includes('remarks')
      )) {
        narrationCol = idx;
        score += 3;
      }

      // Party / Customer / Vendor
      else if (payerCol === -1 && (
        clean.includes('party') || clean.includes('customer') || clean.includes('vendor') ||
        clean.includes('client') || clean.includes('payee') || clean.includes('beneficiary') ||
        clean.includes('name') || clean.includes('account name')
      )) {
        payerCol = idx;
        score += 2;
      }

      // Reference / Cheque
      else if (refCol === -1 && (
        clean === 'chq no' || clean === 'cheque no' || clean === 'chq' || clean === 'cheque' ||
        clean === 'ref no' || clean === 'ref' || clean === 'reference' || clean === 'utr' ||
        clean === 'utr no' || clean === 'txn id' || clean === 'instrument' || clean === 'vch no' ||
        clean.includes('chq') || clean.includes('cheque') || clean.includes('ref') || clean.includes('utr') || clean.includes('vch no')
      )) {
        refCol = idx;
        score += 2;
      }

      // Credit / Deposit
      else if (creditCol === -1 && (
        clean === 'credit' || clean === 'cr' || clean === 'deposit' || clean === 'deposits' ||
        clean === 'credit amt' || clean === 'credit amount' || clean === 'deposit amt' || clean === 'deposit amount' ||
        clean === 'cr amt' || clean === 'cr amount' || clean === 'inflow' || clean === 'paid in' || clean === 'receipts' ||
        clean.startsWith('credit') || clean.startsWith('deposit') || clean === 'cr inr' || clean === 'credit inr'
      )) {
        creditCol = idx;
        score += 3;
      }

      // Debit / Withdrawal
      else if (debitCol === -1 && (
        clean === 'debit' || clean === 'dr' || clean === 'withdrawal' || clean === 'withdrawals' ||
        clean === 'debit amt' || clean === 'debit amount' || clean === 'withdrawal amt' || clean === 'withdrawal amount' ||
        clean === 'dr amt' || clean === 'dr amount' || clean === 'outflow' || clean === 'paid out' || clean === 'payments' ||
        clean.startsWith('debit') || clean.startsWith('withdrawal') || clean === 'dr inr' || clean === 'debit inr'
      )) {
        debitCol = idx;
        score += 3;
      }

      // Amount (single column)
      else if (amountCol === -1 && (
        clean === 'amount' || clean === 'amt' || clean === 'total' || clean === 'net amount' ||
        clean === 'net total' || clean === 'gross total' || clean === 'total amount' || clean === 'txn amt' ||
        clean.includes('amount') || clean === 'value'
      )) {
        amountCol = idx;
        score += 2;
      }

      // Dr/Cr Indicator
      else if (drCrCol === -1 && (
        clean === 'dr cr' || clean === 'cr dr' || clean === 'type' || clean === 'dr cr indicator' ||
        clean === 'indicator' || clean === 'd c' || clean === 'c d' || clean === 'txn type' || clean === 'trans type'
      )) {
        drCrCol = idx;
        score += 2;
      }
    });

    if (dateCol !== -1 && (narrationCol !== -1 || amountCol !== -1 || creditCol !== -1 || debitCol !== -1)) {
      if (score > maxScore) {
        maxScore = score;
        bestHeader = {
          headerIndex: i,
          dateCol,
          narrationCol,
          refCol,
          creditCol,
          debitCol,
          amountCol,
          drCrCol,
          payerCol,
          score
        };
      }
    }
  }

  return bestHeader;
}

function readStatementFile(file, onLoaded) {
  if (!file) return;
  const fileName = file.name || 'statement.csv';
  const isExcel = /\.(xlsx|xls|xlsm|xlsb)$/i.test(fileName);

  if (isExcel && typeof XLSX !== 'undefined') {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellNF: false, dateNF: 'dd/mm/yyyy' });
        const csvText = workbook.SheetNames.map(name =>
          XLSX.utils.sheet_to_csv(workbook.Sheets[name], { dateNF: 'dd/mm/yyyy' })
        ).join('\n');
        onLoaded(csvText, fileName, { sheetNames: workbook.SheetNames.slice() });
      } catch (err) {
        console.error('Error parsing Excel statement:', err);
        showToast('Failed to parse Excel statement: ' + err.message, 'error');
      }
    };
    reader.onerror = (err) => {
      console.error('FileReader error on Excel:', err);
      showToast('Error reading Excel statement from disk', 'error');
    };
    reader.readAsArrayBuffer(file);
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    let text = e.target.result || '';
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }
    onLoaded(text, fileName, { sheetNames: [] });
  };
  reader.onerror = (err) => {
    console.error('FileReader error on CSV:', err);
    showToast('Error reading CSV statement from disk', 'error');
  };
  reader.readAsText(file);
}

const IFSC_BANK_NAMES = {
  ICIC: 'ICICI Bank',
  UTIB: 'Axis Bank',
  KKBK: 'Kotak Mahindra Bank',
  CNRB: 'Canara Bank',
  HDFC: 'HDFC Bank',
  SBIN: 'State Bank of India',
  PUNB: 'Punjab National Bank',
  BARB: 'Bank of Baroda',
  INDB: 'IndusInd Bank',
  YESB: 'YES Bank',
  UBIN: 'Union Bank of India',
  FDRL: 'Federal Bank',
  IDFB: 'IDFC First Bank',
  SCBL: 'Standard Chartered'
};

function statementMetadataText(csvText) {
  const lines = String(csvText || '').split(/\r?\n/);
  const cut = lines.findIndex(line => {
    const compact = String(line || '').replace(/^,+/, '').toLowerCase();
    return /value date.*transaction date|transaction date.*value date/.test(compact) ||
      /^(s\s*no|si\.?\s*no|date\s*[,;]|txn date|transaction date)/.test(compact);
  });
  return lines.slice(0, cut >= 0 ? cut : Math.min(18, lines.length)).join('\n');
}

function firstAccountDigits(text) {
  const m = String(text || '').match(/\b(\d{9,18})\b/);
  return m ? m[1] : '';
}

function accountsEqual(a, b) {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db || da.length < 8 || db.length < 8) return false;
  return da === db || da.endsWith(db) || db.endsWith(da);
}

function applyLabelledBankValue(details, label, value) {
  const key = String(label || '').toLowerCase().replace(/[_./]/g, ' ').replace(/\s+/g, ' ').trim();
  const raw = String(value || '').replace(/^["']|["']$/g, '').trim();
  if (!key || !raw) return;
  if (!details.fullAccNo && /account|a\/c|acct/.test(key) && !/statement|type|description|name/.test(key)) {
    const acc = firstAccountDigits(raw) || digitsOnly(raw);
    if (acc.length >= 8) details.fullAccNo = acc;
    const holder = raw.split(/\s-\s/)[1];
    if (holder && !details.holder) details.holder = holder.replace(/\(.*?\)/g, '').trim().slice(0, 80);
  } else if (!details.ifsc && /ifsc/.test(key)) {
    const ifsc = raw.match(/\b([A-Za-z]{4}0[A-Za-z0-9]{6})\b/);
    if (ifsc) details.ifsc = ifsc[1].toUpperCase();
  } else if (!details.branch && /branch/.test(key) && !/ifsc/.test(key)) {
    details.branch = raw.replace(/\s+/g, ' ').slice(0, 80);
  } else if (!details.holder && /(account name|customer|holder|name of)/.test(key)) {
    details.holder = raw.slice(0, 80);
  } else if (!details.name && /bank name|^bank$/.test(key) && /bank/i.test(raw)) {
    details.name = raw.slice(0, 60);
  }
}

function detectStatementLayout(csvText, fileName = '', sheetNames = []) {
  const sheets = (sheetNames || []).join(' ');
  const head = String(csvText || '').split(/\r?\n/).slice(0, 22).join('\n');
  const blob = `${fileName || ''}\n${sheets}\n${head}`;

  if (/optransactionhistory/i.test(sheets) || /optransactionhistory/i.test(blob)) {
    return { name: 'ICICI Bank', idPrefix: 'icici', reason: 'ICICI OpTransactionHistory statement' };
  }
  const iciciHits = [
    /detailed statement/i.test(blob),
    /withdrawal amount\s*\(\s*inr\s*\)/i.test(blob),
    /deposit amount\s*\(\s*inr\s*\)/i.test(blob),
    /transactions list\s*-/i.test(blob),
    /transaction date from/i.test(blob)
  ].filter(Boolean).length;
  if (iciciHits >= 2) {
    return { name: 'ICICI Bank', idPrefix: 'icici', reason: 'ICICI detailed statement layout' };
  }
  return null;
}

function extractStatementBankDetails(csvText, fileName = '', sheetNames = []) {
  const meta = statementMetadataText(csvText);
  const metaLines = meta.split(/\r?\n/);
  const details = { name: '', fullAccNo: '', ifsc: '', branch: '', holder: '', idPrefix: '' };

  const accLoose = meta.match(/account[^\d]{0,40}(\d{9,18})/i);
  if (accLoose) details.fullAccNo = accLoose[1];

  const ifscMatch = meta.match(/\b([A-Za-z]{4}0[A-Za-z0-9]{6})\b/);
  if (ifscMatch) details.ifsc = ifscMatch[1].toUpperCase();

  const branchMatch = meta.match(/branch\s*[:.\-]*\s*([A-Za-z0-9 ,.\-\/]{3,70})/i);
  if (branchMatch) details.branch = branchMatch[1].replace(/,+\s*$/, '').trim();

  metaLines.forEach(line => {
    const cols = parseCsvLine(line, detectCsvDelimiter(line)).map(c => String(c || '').trim()).filter(Boolean);
    if (cols.length < 2) {
      const colon = String(line || '').split(':');
      if (colon.length >= 2) applyLabelledBankValue(details, colon[0], colon.slice(1).join(':'));
      return;
    }
    cols.forEach((col, idx) => {
      if (!/account|ifsc|branch|bank name|a\/c|acct/i.test(col)) return;
      const rest = cols.slice(idx + 1).join(' ');
      applyLabelledBankValue(details, col, rest);
    });
  });

  const listHolder = meta.match(/transactions list\s*-\s*([A-Za-z .]+?)\s*-\s*\d{6,}/i);
  if (listHolder && !details.holder) details.holder = listHolder[1].trim();

  const layout = detectStatementLayout(csvText, fileName, sheetNames);
  if (layout) {
    details.name = details.name || layout.name;
    details.idPrefix = layout.idPrefix;
  }
  if (!details.name && details.ifsc) {
    details.name = IFSC_BANK_NAMES[details.ifsc.slice(0, 4)] || '';
    details.idPrefix = details.idPrefix || String(details.ifsc.slice(0, 4) || '').toLowerCase();
  }

  const fileMeta = `${fileName || ''} ${(sheetNames || []).join(' ')} ${meta}`;
  if (!details.name) {
    const brandHit = [
      { name: 'ICICI Bank', idPrefix: 'icici', re: /(?:^|[^a-z0-9])icici(?:[^a-z0-9]|$)/i },
      { name: 'Axis Bank', idPrefix: 'axis', re: /(?:^|[^a-z0-9])axis(?:[^a-z0-9]|$)/i },
      { name: 'Kotak Mahindra Bank', idPrefix: 'kotak', re: /(?:^|[^a-z0-9])kotak(?:[^a-z0-9]|$)/i },
      { name: 'Canara Bank', idPrefix: 'canara', re: /(?:^|[^a-z0-9])canara(?:[^a-z0-9]|$)/i },
      { name: 'HDFC Bank', idPrefix: 'hdfc', re: /(?:^|[^a-z0-9])hdfc(?:[^a-z0-9]|$)/i }
    ].find(b => b.re.test(fileMeta));
    if (brandHit) {
      details.name = brandHit.name;
      details.idPrefix = brandHit.idPrefix;
    }
  }

  if (details.fullAccNo && details.fullAccNo.length < 8) details.fullAccNo = '';
  return details;
}

function applyExtractedBankDetails(bank, extracted) {
  if (!bank || !extracted) return bank;
  if (extracted.fullAccNo && extracted.fullAccNo.length >= 6) {
    const current = digitsOnly(bank.fullAccNo);
    if (!current || current === extracted.fullAccNo || current.slice(-4) === extracted.fullAccNo.slice(-4)) {
      bank.fullAccNo = extracted.fullAccNo;
      bank.accNo = `••••${extracted.fullAccNo.slice(-4)}`;
    }
  }
  if (extracted.ifsc) bank.ifsc = extracted.ifsc;
  if (extracted.name) bank.name = extracted.name;
  if (extracted.branch) bank.branch = extracted.branch;
  return bank;
}

const STATEMENT_BANK_BRANDS = [
  { idPrefix: 'icici', name: 'ICICI Bank', fileRe: /(?:^|[^a-z0-9])icici(?:[^a-z0-9]|$)/i, metaRe: /(?:^|[^a-z0-9])icici(?:[^a-z0-9]|$)/i, ifscRe: /\bicic0[a-z0-9]{6}\b/i, defaultIfsc: 'ICIC0000002' },
  { idPrefix: 'axis', name: 'Axis Bank', fileRe: /(?:^|[^a-z0-9])axis(?:[^a-z0-9]|$)/i, metaRe: /\baxis\s+bank\b|\butib0/i, ifscRe: /\butib0[a-z0-9]{6}\b/i, defaultIfsc: 'UTIB0000042' },
  { idPrefix: 'kotak', name: 'Kotak Mahindra Bank', fileRe: /(?:^|[^a-z0-9])kotak(?:[^a-z0-9]|$)/i, metaRe: /(?:^|[^a-z0-9])kotak(?:[^a-z0-9]|$)/i, ifscRe: /\bkkbk0[a-z0-9]{6}\b/i, defaultIfsc: 'KKBK0000421' },
  { idPrefix: 'canara', name: 'Canara Bank', fileRe: /(?:^|[^a-z0-9])canara(?:[^a-z0-9]|$)/i, metaRe: /(?:^|[^a-z0-9])canara(?:[^a-z0-9]|$)/i, ifscRe: /\bcnrb0[a-z0-9]{6}\b/i, defaultIfsc: 'CNRB0000001' },
  { idPrefix: 'hdfc', name: 'HDFC Bank', fileRe: /(?:^|[^a-z0-9])hdfc(?:[^a-z0-9]|$)/i, metaRe: /(?:^|[^a-z0-9])hdfc(?:[^a-z0-9]|$)/i, ifscRe: /\bhdfc0[a-z0-9]{6}\b/i, defaultIfsc: 'HDFC0000001' },
  { idPrefix: 'sbi', name: 'State Bank of India', fileRe: /\b(?:sbi|state[_\s-]?bank)\b/i, metaRe: /\bstate bank\b|\bsbin0/i, ifscRe: /\bsbin0[a-z0-9]{6}\b/i, defaultIfsc: 'SBIN0000001' },
  { idPrefix: 'pnb', name: 'Punjab National Bank', fileRe: /\bpnb\b|punjab\s+national/i, metaRe: /\bpunjab national\b|\bpunb0/i, ifscRe: /\bpunb0[a-z0-9]{6}\b/i, defaultIfsc: 'PUNB0000001' },
  { idPrefix: 'bob', name: 'Bank of Baroda', fileRe: /\bbaroda\b/i, metaRe: /\bbank of baroda\b|\bbarb0/i, ifscRe: /\bbarb0[a-z0-9]{6}\b/i, defaultIfsc: 'BARB0000001' },
  { idPrefix: 'indusind', name: 'IndusInd Bank', fileRe: /\bindusind\b/i, metaRe: /\bindusind\b|\bindb0/i, ifscRe: /\bindb0[a-z0-9]{6}\b/i, defaultIfsc: 'INDB0000001' },
  { idPrefix: 'yes', name: 'YES Bank', fileRe: /\byes[_\s-]?bank\b/i, metaRe: /\byes bank\b|\byesb0/i, ifscRe: /\byesb0[a-z0-9]{6}\b/i, defaultIfsc: 'YESB0000001' },
  { idPrefix: 'union', name: 'Union Bank of India', fileRe: /\bunion[_\s-]?bank\b/i, metaRe: /\bunion bank\b|\bubin0/i, ifscRe: /\bubin0[a-z0-9]{6}\b/i, defaultIfsc: 'UBIN0000001' },
  { idPrefix: 'federal', name: 'Federal Bank', fileRe: /\bfederal\s+bank\b/i, metaRe: /\bfederal bank\b|\bfdrl0/i, ifscRe: /\bfdrl0[a-z0-9]{6}\b/i, defaultIfsc: 'FDRL0000001' },
  { idPrefix: 'idfc', name: 'IDFC First Bank', fileRe: /\bidfc\b/i, metaRe: /\bidfc\b|\bidfb0/i, ifscRe: /\bidfb0[a-z0-9]{6}\b/i, defaultIfsc: 'IDFB0000001' },
  { idPrefix: 'scb', name: 'Standard Chartered', fileRe: /\bstandard[_\s-]?chartered\b/i, metaRe: /\bstandard chartered\b|\bscbl0/i, ifscRe: /\bscbl0[a-z0-9]{6}\b/i, defaultIfsc: 'SCBL0000001' }
];

function findBrandDefinition(idPrefix, name, ifsc = '', metaText = '') {
  if (idPrefix) {
    const hit = STATEMENT_BANK_BRANDS.find(b => b.idPrefix === idPrefix);
    if (hit) return hit;
  }
  if (name) {
    const lowerName = String(name).toLowerCase();
    const hit = STATEMENT_BANK_BRANDS.find(b => b.name.toLowerCase() === lowerName || lowerName.includes(b.idPrefix));
    if (hit) return hit;
  }
  if (ifsc) {
    const code = String(ifsc).slice(0, 4).toUpperCase();
    const hit = STATEMENT_BANK_BRANDS.find(b => (b.defaultIfsc && b.defaultIfsc.startsWith(code)) || (b.ifscRe && b.ifscRe.test(ifsc)));
    if (hit) return hit;
  }
  if (metaText) {
    const hit = STATEMENT_BANK_BRANDS.find(b => b.fileRe.test(metaText) || b.metaRe.test(metaText) || b.ifscRe.test(metaText));
    if (hit) return hit;
  }
  return null;
}

function bankMatchesBrandDef(bank, brand) {
  if (!bank || !brand) return false;
  const bid = String(bank.id || '').toLowerCase();
  const bname = String(bank.name || '').toLowerCase();
  const bifsc = String(bank.ifsc || '').toUpperCase();
  if (bid.includes(brand.idPrefix) || bname.includes(brand.idPrefix) || brand.name.toLowerCase().includes(bname)) return true;
  if (bifsc && brand.ifscRe && brand.ifscRe.test(bifsc)) return true;
  if (bifsc && brand.defaultIfsc && bifsc.slice(0, 4) === brand.defaultIfsc.slice(0, 4)) return true;
  return false;
}

function detectBankFromCsv(csvText, fileName = '', options = {}) {
  const sheetNames = (options && options.sheetNames) || [];
  const extracted = extractStatementBankDetails(csvText, fileName, sheetNames);
  const meta = statementMetadataText(csvText);
  const fileMeta = `${fileName || ''} ${sheetNames.join(' ')} ${meta}`;

  // 1. Match by Account Number if extracted
  if (extracted.fullAccNo && extracted.fullAccNo.length >= 6) {
    const byAcc = corporateBanks.find(b => accountsEqual(b.fullAccNo, extracted.fullAccNo));
    if (byAcc) {
      return { bank: byAcc, isSaved: true, confidence: 'high', reason: `Matched saved account ${byAcc.name} (${byAcc.accNo})`, extracted };
    }
  }

  // 2. Match by IFSC if extracted
  if (extracted.ifsc) {
    const byIfsc = corporateBanks.find(b => String(b.ifsc || '').toUpperCase() === extracted.ifsc);
    if (byIfsc && (!extracted.fullAccNo || accountsEqual(byIfsc.fullAccNo, extracted.fullAccNo))) {
      return { bank: byIfsc, isSaved: true, confidence: 'high', reason: `Matched saved bank IFSC ${extracted.ifsc} (${byIfsc.name})`, extracted };
    }
  }

  // 3. Match by Brand
  const detectedBrand = findBrandDefinition(extracted.idPrefix, extracted.name, extracted.ifsc, fileMeta);
  if (detectedBrand) {
    const matchingSaved = corporateBanks.filter(b => bankMatchesBrandDef(b, detectedBrand));
    if (matchingSaved.length === 1) {
      return { bank: matchingSaved[0], isSaved: true, confidence: 'medium', reason: `Matched saved account ${matchingSaved[0].name}`, extracted, detectedBrand };
    } else if (matchingSaved.length > 1) {
      const active = getActiveBank();
      const pick = (active && matchingSaved.some(b => b.id === active.id)) ? active : matchingSaved[0];
      return { bank: pick, isSaved: true, confidence: 'medium', reason: `Matched saved ${pick.name}`, extracted, detectedBrand };
    }
    // Brand detected but NOT saved in corporateBanks — auto-detection is disabled, NEVER auto-register!
    return {
      bank: null,
      isSaved: false,
      isUnregistered: true,
      confidence: 'none',
      reason: `Unregistered corporate bank: ${detectedBrand.name}`,
      detectedBrand,
      extracted
    };
  }

  const active = getActiveBank() || (corporateBanks && corporateBanks[0]) || null;
  return {
    bank: active,
    isSaved: !!active,
    confidence: 'low',
    reason: active ? `Defaulting to active desk ${active.name}` : 'No saved corporate banks',
    extracted
  };
}

/**
 * Validates whether an uploaded bank statement matches the active corporate bank desk.
 * Strict rules:
 * - If statement points to another saved bank desk -> REJECT with Active Bank Desk Mismatch & offer switch.
 * - If statement points to an unregistered bank -> REJECT with Unregistered Bank Account & offer Add Bank.
 * - If statement account number conflicts with active bank -> REJECT with Account Number Mismatch.
 * - If statement IFSC conflicts with active bank -> REJECT with IFSC Mismatch.
 * - If file has no identifiable bank credentials to verify -> REJECT with Unverified Statement.
 * - If matches active bank desk -> ACCEPT (valid: true).
 */
function validateStatementMatchesSavedBank(csvText, fileName = '', options = {}) {
  const activeBank = (options && options.bank) ||
    (options && options.bankId && corporateBanks.find(b => b.id === options.bankId)) ||
    getActiveBank() ||
    (corporateBanks && corporateBanks[0]);
  if (!activeBank) {
    return {
      valid: false,
      type: 'no_saved_bank',
      reasonTitle: 'No Saved Corporate Bank Account',
      reasonDesc: 'There are no corporate bank accounts configured in your workspace. Auto-detect is disabled.',
      guidance: 'Please add a corporate bank account first using "+ Add Bank Account" before uploading statements.',
      active: { name: 'None configured', accNo: '—', ifsc: '—' },
      detected: { name: 'Unknown', accNo: '—', ifsc: '—', fileName: fileName || 'statement' },
      actionLabel: '+ Add Bank Account',
      actionType: 'add_bank'
    };
  }

  const sheetNames = (options && options.sheetNames) || [];
  const extracted = extractStatementBankDetails(csvText, fileName, sheetNames);
  const meta = statementMetadataText(csvText);
  const fileMeta = `${fileName || ''} ${sheetNames.join(' ')} ${meta}`;

  const normAcc = (acc) => String(acc || '').replace(/\D/g, '');
  const activeAccDigits = normAcc(activeBank.fullAccNo || activeBank.accNo);
  const detectedAccDigits = normAcc(extracted.fullAccNo);

  const detectedBrand = findBrandDefinition(extracted.idPrefix, extracted.name, extracted.ifsc, fileMeta);

  const displayAcc = (full) => {
    if (!full) return '—';
    const digits = normAcc(full);
    return digits.length > 4 ? `••••${digits.slice(-4)}` : digits;
  };

  const detectedDisplay = {
    name: detectedBrand ? detectedBrand.name : (extracted.name || 'Unidentified Bank'),
    accNo: extracted.fullAccNo ? (extracted.fullAccNo.length > 4 ? `••••${extracted.fullAccNo.slice(-4)}` : extracted.fullAccNo) : '—',
    ifsc: extracted.ifsc || (detectedBrand ? detectedBrand.defaultIfsc : '—'),
    fileName: fileName || 'statement.csv'
  };

  const activeDisplay = {
    name: activeBank.name || 'Active Bank',
    accNo: activeBank.accNo || displayAcc(activeBank.fullAccNo),
    ifsc: activeBank.ifsc || '—'
  };

  // CHECK 1: Account number extracted and valid (>= 6 digits)
  if (detectedAccDigits && detectedAccDigits.length >= 6) {
    const matchesActive = accountsEqual(activeBank.fullAccNo, extracted.fullAccNo) ||
      (activeAccDigits && activeAccDigits === detectedAccDigits) ||
      (activeAccDigits && activeAccDigits.endsWith(detectedAccDigits)) ||
      (detectedAccDigits && detectedAccDigits.endsWith(activeAccDigits.slice(-6)));

    if (!matchesActive) {
      // Check if it matches another saved bank desk
      const otherBank = corporateBanks.find(b =>
        b.id !== activeBank.id && (
          accountsEqual(b.fullAccNo, extracted.fullAccNo) ||
          normAcc(b.fullAccNo) === detectedAccDigits ||
          (normAcc(b.fullAccNo) && normAcc(b.fullAccNo).endsWith(detectedAccDigits.slice(-6)))
        )
      );

      if (otherBank) {
        return {
          valid: false,
          type: 'desk_mismatch',
          reasonTitle: 'Active Bank Desk Mismatch',
          reasonDesc: `This statement belongs to saved account "${otherBank.name} (${otherBank.accNo || displayAcc(otherBank.fullAccNo)})", but your current active desk is "${activeBank.name} (${activeBank.accNo || displayAcc(activeBank.fullAccNo)})". Statements must be uploaded directly to their respective bank desk to avoid ledger contamination.`,
          guidance: `Switch to the "${otherBank.name}" desk to upload this statement, or select the statement matching "${activeBank.name}".`,
          suggestedBank: otherBank,
          actionLabel: `Switch to ${otherBank.name} Desk`,
          actionType: 'switch_desk',
          active: activeDisplay,
          detected: {
            name: otherBank.name,
            accNo: detectedDisplay.accNo,
            ifsc: extracted.ifsc || otherBank.ifsc || '—',
            fileName: detectedDisplay.fileName
          }
        };
      } else {
        // Account does not belong to ANY saved bank
        return {
          valid: false,
          type: 'unregistered_account',
          reasonTitle: 'Unregistered Bank Account',
          reasonDesc: `The statement is for Account #${extracted.fullAccNo}${detectedBrand ? ` (${detectedBrand.name})` : ''}, which is not registered in your corporate bank accounts. Auto-detection is disabled.`,
          guidance: `Please add this account to your Corporate Bank Accounts via "+ Add Bank Account" before uploading statements.`,
          actionLabel: detectedBrand ? `+ Add ${detectedBrand.name} Account` : '+ Add Bank Account',
          actionType: 'add_bank',
          suggestedNewBank: {
            name: detectedBrand ? detectedBrand.name : (extracted.name || ''),
            fullAccNo: extracted.fullAccNo || '',
            ifsc: extracted.ifsc || (detectedBrand ? detectedBrand.defaultIfsc : '')
          },
          active: activeDisplay,
          detected: detectedDisplay
        };
      }
    }
  }

  // CHECK 2: Bank Brand / Bank Name
  if (detectedBrand) {
    const activeMatchesBrand = bankMatchesBrandDef(activeBank, detectedBrand);
    if (!activeMatchesBrand) {
      // Check if another saved bank matches this brand
      const otherBank = corporateBanks.find(b => b.id !== activeBank.id && bankMatchesBrandDef(b, detectedBrand));
      if (otherBank) {
        return {
          valid: false,
          type: 'desk_mismatch',
          reasonTitle: 'Active Bank Desk Mismatch',
          reasonDesc: `The uploaded statement is from ${detectedBrand.name}, but your current active desk is ${activeBank.name} (${activeBank.accNo || displayAcc(activeBank.fullAccNo)}). Each bank statement must be uploaded to its corresponding bank desk.`,
          guidance: `Switch to your "${otherBank.name}" desk to upload this statement, or select an ${activeBank.name} statement file.`,
          suggestedBank: otherBank,
          actionLabel: `Switch to ${otherBank.name} Desk`,
          actionType: 'switch_desk',
          active: activeDisplay,
          detected: {
            name: otherBank.name,
            accNo: detectedDisplay.accNo !== '—' ? detectedDisplay.accNo : (otherBank.accNo || '—'),
            ifsc: extracted.ifsc || otherBank.ifsc || '—',
            fileName: detectedDisplay.fileName
          }
        };
      } else {
        // Brand is completely unsaved in corporateBanks
        return {
          valid: false,
          type: 'unregistered_bank',
          reasonTitle: 'Unregistered Corporate Bank',
          reasonDesc: `Detected ${detectedBrand.name} statement, but ${detectedBrand.name} is not in your saved Corporate Banks. Auto-detection is disabled to prevent accidental account creation.`,
          guidance: `Please register this bank account first via "+ Add Bank Account" before uploading statements.`,
          actionLabel: `+ Add ${detectedBrand.name} Account`,
          actionType: 'add_bank',
          suggestedNewBank: {
            name: detectedBrand.name,
            fullAccNo: extracted.fullAccNo || '',
            ifsc: extracted.ifsc || detectedBrand.defaultIfsc || ''
          },
          active: activeDisplay,
          detected: detectedDisplay
        };
      }
    }
  }

  // CHECK 3: IFSC Code conflict
  if (extracted.ifsc && activeBank.ifsc) {
    const detectedPrefix = extracted.ifsc.slice(0, 4).toUpperCase();
    const activePrefix = activeBank.ifsc.slice(0, 4).toUpperCase();
    if (detectedPrefix !== activePrefix) {
      const otherBank = corporateBanks.find(b => b.id !== activeBank.id && b.ifsc && b.ifsc.slice(0, 4).toUpperCase() === detectedPrefix);
      if (otherBank) {
        return {
          valid: false,
          type: 'desk_mismatch',
          reasonTitle: 'Active Bank Desk Mismatch (IFSC)',
          reasonDesc: `Statement IFSC (${extracted.ifsc}) indicates ${otherBank.name}, which conflicts with active desk ${activeBank.name} (${activeBank.ifsc}).`,
          guidance: `Switch to ${otherBank.name} desk before uploading this file.`,
          suggestedBank: otherBank,
          actionLabel: `Switch to ${otherBank.name} Desk`,
          actionType: 'switch_desk',
          active: activeDisplay,
          detected: detectedDisplay
        };
      } else {
        return {
          valid: false,
          type: 'unregistered_bank',
          reasonTitle: 'Unregistered Bank IFSC',
          reasonDesc: `Statement IFSC (${extracted.ifsc}) does not match active bank ${activeBank.name} (${activeBank.ifsc}) or any saved bank. Auto-detect is disabled.`,
          guidance: `Register this bank account first via "+ Add Bank Account".`,
          actionLabel: '+ Add Bank Account',
          actionType: 'add_bank',
          suggestedNewBank: {
            name: extracted.name || '',
            fullAccNo: extracted.fullAccNo || '',
            ifsc: extracted.ifsc
          },
          active: activeDisplay,
          detected: detectedDisplay
        };
      }
    }
  }

  // CHECK 4: Completely unidentified statement
  if (!detectedBrand && !extracted.fullAccNo && !extracted.ifsc && !extracted.name) {
    const activeNameLower = (activeBank.name || '').toLowerCase();
    const activeIdLower = (activeBank.id || '').toLowerCase();
    const fileNameLower = (fileName || '').toLowerCase();
    const hasActiveBrandInFileName = activeNameLower.split(/\s+/).some(part => part.length >= 4 && fileNameLower.includes(part)) ||
      fileNameLower.includes(activeIdLower.split('-')[0]);

    if (!hasActiveBrandInFileName) {
      return {
        valid: false,
        type: 'unverified_statement',
        reasonTitle: 'Unverified Bank Statement',
        reasonDesc: `This file does not contain a recognizable bank name, account number, or IFSC matching your active desk "${activeBank.name}". Auto-detect is disabled.`,
        guidance: `Please verify that this is a valid bank statement file for ${activeBank.name}, or include standard bank headers (Account No, IFSC, or Bank Name).`,
        actionLabel: 'Dismiss & Reject File',
        actionType: 'dismiss',
        active: activeDisplay,
        detected: detectedDisplay
      };
    }
  }

  // Passed all checks! Matches active bank desk.
  return {
    valid: true,
    bank: activeBank,
    extracted
  };
}

let currentRejectionAction = null;

function showStatementRejectionPopup(rejection) {
  if (!statementRejectionModal) return;

  const getEl = (id) => document.getElementById(id);
  const reasonTitleEl = getEl('rejectionReasonTitle');
  const reasonDescEl = getEl('rejectionReasonDesc');
  const activeNameEl = getEl('rejectionActiveBankName');
  const activeAccEl = getEl('rejectionActiveAcc');
  const activeIfscEl = getEl('rejectionActiveIfsc');
  const detNameEl = getEl('rejectionDetectedBankName');
  const detAccEl = getEl('rejectionDetectedAcc');
  const detIfscEl = getEl('rejectionDetectedIfsc');
  const detFileEl = getEl('rejectionFileName');
  const guidanceEl = getEl('rejectionGuidanceText');

  if (reasonTitleEl) reasonTitleEl.textContent = rejection.reasonTitle || 'Bank Verification Failed';
  if (reasonDescEl) reasonDescEl.textContent = rejection.reasonDesc || 'The uploaded statement does not match the active bank desk.';

  if (activeNameEl) activeNameEl.textContent = (rejection.active && rejection.active.name) || 'Active Bank';
  if (activeAccEl) activeAccEl.textContent = (rejection.active && rejection.active.accNo) || '—';
  if (activeIfscEl) activeIfscEl.textContent = (rejection.active && rejection.active.ifsc) || '—';

  if (detNameEl) detNameEl.textContent = (rejection.detected && rejection.detected.name) || 'Unidentified Bank';
  if (detAccEl) detAccEl.textContent = (rejection.detected && rejection.detected.accNo) || '—';
  if (detIfscEl) detIfscEl.textContent = (rejection.detected && rejection.detected.ifsc) || '—';
  if (detFileEl) {
    detFileEl.textContent = (rejection.detected && rejection.detected.fileName) || 'statement.csv';
    detFileEl.title = (rejection.detected && rejection.detected.fileName) || '';
  }

  if (guidanceEl) guidanceEl.textContent = rejection.guidance || 'Please switch to the matching bank desk or register this bank account first.';

  if (rejectionActionBtn) {
    if (rejection.actionLabel && rejection.actionType && rejection.actionType !== 'dismiss') {
      rejectionActionBtn.style.display = 'inline-flex';
      rejectionActionBtn.textContent = rejection.actionLabel;

      if (rejection.actionType === 'switch_desk' && rejection.suggestedBank) {
        currentRejectionAction = () => {
          closeStatementRejectionPopup(false);
          const targetBank = rejection.suggestedBank;
          selectedBankId = targetBank.id;
          if (targetBank.sheets && targetBank.sheets.length > 0) {
            selectedMonthId = targetBank.sheets[0].monthId;
          } else {
            selectedMonthId = '';
          }
          activeConfirmingRowId = null;
          renderAll(false);
          showToast(`Switched to ${targetBank.name} desk. You can now upload statements here.`, 'info');
        };
      } else if (rejection.actionType === 'add_bank') {
        currentRejectionAction = () => {
          closeStatementRejectionPopup(false);
          if (typeof openAddBankModal === 'function') {
            openAddBankModal();
            const sug = rejection.suggestedNewBank;
            if (sug) {
              const nameIn = document.getElementById('bankNameInput');
              const accIn = document.getElementById('bankAccInput');
              const ifscIn = document.getElementById('bankIfscInput');
              if (nameIn && sug.name) nameIn.value = sug.name;
              if (accIn && sug.fullAccNo) accIn.value = sug.fullAccNo;
              if (ifscIn && sug.ifsc) ifscIn.value = sug.ifsc;
            }
          }
        };
      } else {
        currentRejectionAction = null;
        rejectionActionBtn.style.display = 'none';
      }
    } else {
      rejectionActionBtn.style.display = 'none';
      currentRejectionAction = null;
    }
  }

  statementRejectionModal.style.display = 'flex';
}

function closeStatementRejectionPopup(isDismiss = false) {
  if (statementRejectionModal) {
    statementRejectionModal.style.display = 'none';
  }
  if (bankCsvInput) {
    try { bankCsvInput.value = ''; } catch (e) {}
  }
  if (isDismiss) {
    showToast('Statement upload rejected. No ledger entries were modified.', 'amber');
  }
  currentRejectionAction = null;
}


function detectMonthFromCsvLines(lines) {
  const monthCounts = {};
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthAbbrs = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };

  const sampleLines = lines.slice(0, Math.min(lines.length, 120));
  for (const line of sampleLines) {
    if (isSummaryOrFooterLine(line)) continue;

    // 1. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (supports 2-digit & 4-digit years)
    const dmy = line.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/);
    if (dmy) {
      let m = parseInt(dmy[2], 10);
      let y = parseInt(dmy[3], 10);
      if (y < 100) y = 2000 + y;
      if (m > 12 && parseInt(dmy[1], 10) <= 12) {
        m = parseInt(dmy[1], 10);
      }
      if (m >= 1 && m <= 12 && y >= 2000 && y <= 2100) {
        const key = `${y}-${String(m).padStart(2, '0')}`;
        monthCounts[key] = (monthCounts[key] || 0) + 1;
        continue;
      }
    }

    // 2. YYYY-MM-DD or YYYY/MM/DD
    const ymd = line.match(/\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);
    if (ymd) {
      const y = parseInt(ymd[1], 10);
      const m = parseInt(ymd[2], 10);
      if (m >= 1 && m <= 12 && y >= 2000 && y <= 2100) {
        const key = `${y}-${String(m).padStart(2, '0')}`;
        monthCounts[key] = (monthCounts[key] || 0) + 1;
        continue;
      }
    }

    // 3. DD-MMM-YYYY or DD MMM YYYY or DD/MMM/YYYY or DD-MMM-YY
    const dMmmY = line.match(/\b\d{1,2}[\s\/\-]([A-Za-z]{3})[\s\/\-](\d{2,4})\b/);
    if (dMmmY) {
      const monStr = dMmmY[1].toLowerCase();
      const m = monthAbbrs[monStr];
      let y = parseInt(dMmmY[2], 10);
      if (y < 100) y = 2000 + y;
      if (m && y >= 2000 && y <= 2100) {
        const key = `${y}-${String(m).padStart(2, '0')}`;
        monthCounts[key] = (monthCounts[key] || 0) + 1;
        continue;
      }
    }

    // 4. Month Name DD, YYYY (e.g. September 19, 2026)
    const mmmDy = line.match(/\b([A-Za-z]{3,9})\s+\d{1,2},?\s+(\d{4})\b/i);
    if (mmmDy) {
      const monStr = mmmDy[1].toLowerCase().slice(0, 3);
      const m = monthAbbrs[monStr];
      const y = parseInt(mmmDy[2], 10);
      if (m && y >= 2000 && y <= 2100) {
        const key = `${y}-${String(m).padStart(2, '0')}`;
        monthCounts[key] = (monthCounts[key] || 0) + 1;
      }
    }
  }

  let bestMonth = null;
  let maxCount = 0;
  for (const [key, count] of Object.entries(monthCounts)) {
    if (count > maxCount) {
      maxCount = count;
      bestMonth = key;
    }
  }

  if (bestMonth) {
    const [yStr, mStr] = bestMonth.split('-');
    const mIdx = parseInt(mStr, 10) - 1;
    const mName = monthNames[mIdx] || 'September';
    return {
      monthId: bestMonth,
      label: `${mName} ${yStr}`,
      year: parseInt(yStr, 10),
      monthName: mName
    };
  }

  const now = new Date();
  const defYear = now.getFullYear();
  const defMonthIdx = now.getMonth();
  const defMonthName = monthNames[defMonthIdx] || 'September';
  const defMonthId = `${defYear}-${String(defMonthIdx + 1).padStart(2, '0')}`;

  return {
    monthId: defMonthId,
    label: `${defMonthName} ${defYear}`,
    year: defYear,
    monthName: defMonthName
  };
}

async function uploadRawStatementFile(fileName, csvContent) {
  try {
    const res = await fetch('/api/supabase/upload-statement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, csvContent })
    });
    if (res.ok) {
      const data = await res.json();
      console.log('Statement successfully archived in Supabase Cloud Storage:', data.storageKey);
      return data;
    }
  } catch (e) {
    console.warn('Notice: Raw statement file archival skipped:', e.message);
  }
  return null;
}

async function processBankStatementCsv(csvText, fileName = '', options = {}) {
  if (!csvText || !csvText.trim()) {
    showToast('The statement file appears to be completely empty.', 'amber');
    return;
  }

  // Strip BOM if present
  if (csvText.charCodeAt(0) === 0xFEFF) {
    csvText = csvText.slice(1);
  }

  if (isGstOrSalesRegisterFile(fileName, csvText)) {
    showToast('Detected sales register / book — importing as customer invoices.', 'info');
    await processInvoiceCsv(csvText);
    switchView('invoices');
    return;
  }
  if (isPurchaseRegister(fileName, csvText)) {
    showToast('Detected purchase register / book — importing as vendor bills.', 'info');
    await processVendorBillCsv(csvText);
    switchView('bank-statements');
    switchMappingMode('debit');
    return;
  }

  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    showToast('Statement file contains only a single line or no transaction data.', 'amber');
    return;
  }

  // STRICT VALIDATION: Check whether the present bank statement matches the active corporate bank desk
  const validation = validateStatementMatchesSavedBank(csvText, fileName, options);
  if (!validation.valid) {
    if (bankCsvInput) {
      try { bankCsvInput.value = ''; } catch (e) {}
    }
    showStatementRejectionPopup(validation);
    return;
  }

  const bank = validation.bank;
  const detectionResult = { bank, isNew: false, confidence: 'high', reason: 'Verified matching active bank desk', extracted: validation.extracted };
  if (!bank.sheets) bank.sheets = [];


  const existingCreditSet = new Set();
  const existingDebitSet = new Set();
  (bank.sheets || []).forEach(sheet => {
    (sheet.records || []).forEach(r => existingCreditSet.add(`${r.date}|${r.amount}|${r.type}|${r.bankRef}`.toLowerCase()));
    (sheet.debitRecords || []).forEach(r => existingDebitSet.add(`${r.date}|${r.amount}|${r.type}|${r.bankRef}`.toLowerCase()));
  });

  const parsedTxns = [];

  // 5. Discover Column Headers with Scoring
  const delimiter = detectCsvDelimiter(csvText);
  const headerInfo = findStatementHeaders(lines, delimiter);

  let startLine = 1;
  let dateCol = -1, narrationCol = -1, refCol = -1, creditCol = -1, debitCol = -1, amountCol = -1, typeCol = -1, drCrCol = -1, payerCol = -1;

  if (headerInfo) {
    startLine = headerInfo.headerIndex + 1;
    dateCol = headerInfo.dateCol;
    narrationCol = headerInfo.narrationCol;
    refCol = headerInfo.refCol;
    creditCol = headerInfo.creditCol;
    debitCol = headerInfo.debitCol;
    amountCol = headerInfo.amountCol;
    drCrCol = headerInfo.drCrCol;
    payerCol = headerInfo.payerCol;
  } else {
    // Fallback: detect first row with a real date and a separate money column
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      if (isSummaryOrFooterLine(lines[i])) continue;
      const cols = parseCsvLine(lines[i], delimiter);
      const dIdx = cols.findIndex(c => isValidTransactionDate(c));
      const aIdx = cols.findIndex((c, idx) => idx !== dIdx && !isDateLikeValue(c) && isPlausibleMoneyAmount(parseAmount(c)));
      if (dIdx !== -1 && aIdx !== -1) {
        startLine = i;
        dateCol = dIdx;
        amountCol = aIdx;
        narrationCol = (dIdx === 0 ? 1 : 0);
        break;
      }
    }
  }

  const hasDualColumns = creditCol !== -1 && debitCol !== -1;

  let addedCredits = 0;
  let addedDebits = 0;
  let skipped = 0;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    if (isSummaryOrFooterLine(line)) continue;

    const cols = parseCsvLine(line, delimiter);
    if (cols.length < 2) continue;

    const dated = extractRowDateAndMonth(cols, dateCol);
    if (!dated || !dated.monthId) continue;
    const date = dated.date;
    const rowMonthId = dated.monthId;
    if (!isValidTransactionDate(date) && !rowMonthId) continue;
    const narration = (narrationCol >= 0 && cols[narrationCol]) ? cols[narrationCol].trim() : (cols[1] || 'Bank Transaction');
    const ref = (refCol >= 0 && cols[refCol]) ? cols[refCol].trim() : (cols[2] || `TXN-${Date.now()}-${i}`);
    
    let type = (typeCol >= 0 && cols[typeCol]) ? cols[typeCol].trim() : '';
    if (!type) {
      const upperNarr = narration.toUpperCase();
      if (upperNarr.includes('UPI')) type = 'UPI';
      else if (upperNarr.includes('RTGS')) type = 'RTGS';
      else if (upperNarr.includes('NEFT')) type = 'NEFT';
      else if (upperNarr.includes('IMPS')) type = 'IMPS';
      else if (upperNarr.includes('CHQ') || upperNarr.includes('CHEQUE') || upperNarr.includes('CLG')) type = 'CHEQUE';
      else type = 'TRANSFER';
    }

    const payer = (payerCol >= 0 && cols[payerCol]) ? cols[payerCol].trim() : extractPartyFromNarration(narration);

    if (hasDualColumns) {
      const crVal = parseAmount(cols[creditCol]);
      const drVal = parseAmount(cols[debitCol]);

      if (isPlausibleMoneyAmount(crVal) && !amountLooksLikeDateDigits(crVal, date)) {
        const key = `${date}|${crVal}|${type}|${ref}`.toLowerCase();
        if (existingCreditSet.has(key)) {
          skipped++;
        } else {
          existingCreditSet.add(key);
          addedCredits++;
          parsedTxns.push({
            flow: 'credit',
            monthId: rowMonthId,
            record: {
              id: `CR-IMP-${Date.now()}-${addedCredits}`,
              date: date,
              narration: narration,
              payer: payer,
              type: type,
              bankRef: ref,
              amount: crVal,
              status: 'unmapped',
              mapping: null
            }
          });
        }
      }

      if (isPlausibleMoneyAmount(drVal) && !amountLooksLikeDateDigits(drVal, date)) {
        const key = `${date}|${drVal}|${type}|${ref}`.toLowerCase();
        if (existingDebitSet.has(key)) {
          skipped++;
        } else {
          existingDebitSet.add(key);
          addedDebits++;
          parsedTxns.push({
            flow: 'debit',
            monthId: rowMonthId,
            record: {
              id: `DR-IMP-${Date.now()}-${addedDebits}`,
              date: date,
              narration: narration,
              payer: payer || 'Vendor',
              type: type,
              bankRef: ref,
              amount: drVal,
              status: 'unmapped',
              mapping: null
            }
          });
        }
      }
    } else {
      // Single amount column
      const amtIdx = amountCol >= 0 ? amountCol : (creditCol >= 0 ? creditCol : (debitCol >= 0 ? debitCol : -1));
      let parsedAmt = amtIdx >= 0 ? parseAmount(cols[amtIdx]) : 0;
      if (!isPlausibleMoneyAmount(parsedAmt) || amountLooksLikeDateDigits(parsedAmt, date) || isDateLikeValue(amtIdx >= 0 ? cols[amtIdx] : '')) {
        parsedAmt = findPlausibleAmountInRow(cols, [dateCol, narrationCol, refCol, payerCol]);
      }
      const amt = Math.abs(parsedAmt);
      if (!isPlausibleMoneyAmount(amt) || amountLooksLikeDateDigits(amt, date)) continue;

      let isDebitRow = false;
      if (drCrCol >= 0 && cols[drCrCol]) {
        const ind = cols[drCrCol].trim().toLowerCase();
        if (ind === 'dr' || ind === 'd' || ind.startsWith('dr') || ind.includes('debit') || ind === 'w' || ind.includes('withdrawal') || ind.includes('outflow')) {
          isDebitRow = true;
        } else if (ind === 'cr' || ind === 'c' || ind.startsWith('cr') || ind.includes('credit') || ind.includes('deposit') || ind.includes('inflow')) {
          isDebitRow = false;
        } else {
          isDebitRow = activeMappingMode === 'debit';
        }
      } else if (parsedAmt < 0) {
        isDebitRow = true;
      } else {
        const upperNarr = narration.toUpperCase();
        if (upperNarr.includes('/DR/') || upperNarr.startsWith('TO ') || upperNarr.includes(' PAID TO') || upperNarr.includes(' CHARGES') || upperNarr.includes(' WITHDRAWAL') || upperNarr.includes(' DEBIT')) {
          isDebitRow = true;
        } else if (upperNarr.includes('/CR/') || upperNarr.startsWith('BY ') || upperNarr.includes(' RECEIVED FROM') || upperNarr.includes(' DEPOSIT') || upperNarr.includes(' CREDIT')) {
          isDebitRow = false;
        } else {
          isDebitRow = activeMappingMode === 'debit';
        }
      }

      const key = `${date}|${amt}|${type}|${ref}`.toLowerCase();
      if (isDebitRow) {
        if (existingDebitSet.has(key)) {
          skipped++;
        } else {
          existingDebitSet.add(key);
          addedDebits++;
          parsedTxns.push({
            flow: 'debit',
            monthId: rowMonthId,
            record: {
              id: `DR-IMP-${Date.now()}-${addedDebits}`,
              date: date,
              narration: narration,
              payer: payer || 'Vendor',
              type: type,
              bankRef: ref,
              amount: amt,
              status: 'unmapped',
              mapping: null
            }
          });
        }
      } else {
        if (existingCreditSet.has(key)) {
          skipped++;
        } else {
          existingCreditSet.add(key);
          addedCredits++;
          parsedTxns.push({
            flow: 'credit',
            monthId: rowMonthId,
            record: {
              id: `CR-IMP-${Date.now()}-${addedCredits}`,
              date: date,
              narration: narration,
              payer: payer,
              type: type,
              bankRef: ref,
              amount: amt,
              status: 'unmapped',
              mapping: null
            }
          });
        }
      }
    }
  }

  const datedTxns = parsedTxns.filter(txn => {
    if (!txn.monthId && txn.record) txn.monthId = parseDateToMonthId(txn.record.date);
    return !!txn.monthId;
  });
  skipped += parsedTxns.length - datedTxns.length;

  if (datedTxns.length === 0) {
    showToast('No valid dated transactions found in this statement.', 'amber');
    return;
  }

  const monthsMap = {};
  datedTxns.forEach(txn => {
    if (!monthsMap[txn.monthId]) {
      monthsMap[txn.monthId] = { monthId: txn.monthId, label: monthLabelFromId(txn.monthId), credits: 0, debits: 0, records: [], debitRecords: [] };
    }
    if (txn.flow === 'debit') {
      monthsMap[txn.monthId].debits += 1;
      monthsMap[txn.monthId].debitRecords.push(txn.record);
    } else {
      monthsMap[txn.monthId].credits += 1;
      monthsMap[txn.monthId].records.push(txn.record);
    }
  });

  const draft = {
    fileName,
    csvText,
    bank,
    detection: detectionResult,
    months: Object.values(monthsMap).sort((a, b) => a.monthId.localeCompare(b.monthId)),
    addedCredits,
    addedDebits,
    skipped
  };

  const approved = options.autoApprove ? true : await askUserToApproveStatement(draft);
  if (!approved) {
    showToast('Upload cancelled. Nothing was saved.', 'info');
    return;
  }

  await commitStatementImport(draft);
}

let pendingApproveResolver = null;
let pendingUploadDraft = null;
let pendingDeletedSheets = [];
let persistQueued = false;
const DELETED_SHEETS_KEY = 'ifimed_deleted_statement_sheets';

function readDeletedSheetTombstones() {
  try {
    const raw = localStorage.getItem(DELETED_SHEETS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function rememberDeletedSheet(bankId, monthId) {
  if (!bankId || !monthId) return;
  const list = readDeletedSheetTombstones();
  const key = `${bankId}::${monthId}`;
  if (list.some(d => `${d.bankId}::${d.monthId}` === key)) return;
  list.push({ bankId, monthId, at: Date.now() });
  try { localStorage.setItem(DELETED_SHEETS_KEY, JSON.stringify(list)); } catch (e) {}
}

function forgetDeletedSheet(bankId, monthId) {
  const next = readDeletedSheetTombstones().filter(d => !(d.bankId === bankId && d.monthId === monthId));
  try { localStorage.setItem(DELETED_SHEETS_KEY, JSON.stringify(next)); } catch (e) {}
}

function stripTombstonedSheets(banks) {
  const tombs = readDeletedSheetTombstones();
  if (!tombs.length || !Array.isArray(banks)) return banks;
  const keys = new Set(tombs.map(d => `${d.bankId}::${d.monthId}`));
  return banks.map(b => Object.assign({}, b, {
    sheets: (b.sheets || []).filter(s => s && !keys.has(`${b.id}::${s.monthId}`))
  }));
}

function askUserToApproveStatement(draft) {
  pendingUploadDraft = draft;
  return new Promise((resolve) => {
    pendingApproveResolver = resolve;
    const modal = document.getElementById('approveUploadModal');
    const bankSelect = document.getElementById('approveBankSelect');
    const reasonEl = document.getElementById('approveDetectReason');
    const fileMeta = document.getElementById('approveFileMeta');
    const monthBox = document.getElementById('approveMonthSummary');
    const totalsEl = document.getElementById('approveTotals');
    if (bankSelect) {
      bankSelect.innerHTML = corporateBanks.map(b =>
        `<option value="${escapeHtml(b.id)}" ${b.id === draft.bank.id ? 'selected' : ''}>${escapeHtml(b.name)} ${escapeHtml(b.accNo || '')}</option>`
      ).join('');
    }
    if (reasonEl) {
      reasonEl.textContent = draft.detection.reason || '';
      reasonEl.classList.toggle('is-low', draft.detection.confidence === 'low');
    }
    const extracted = (draft.detection && draft.detection.extracted) || {};
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || '—';
    };
    setText('approveExtractedName', extracted.name || draft.bank.name);
    setText('approveExtractedAcc', extracted.fullAccNo || 'Not printed on this statement');
    setText('approveExtractedIfsc', extracted.ifsc || 'Not printed on this statement');
    setText('approveExtractedBranch', extracted.branch || extracted.holder || 'Not printed on this statement');
    if (fileMeta) {
      fileMeta.textContent = `File: ${draft.fileName || 'statement'} · ${draft.months.length} month${draft.months.length === 1 ? '' : 's'} detected from transaction dates`;
    }
    if (monthBox) {
      monthBox.innerHTML = draft.months.map(m =>
        `<div class="approve-month-row" role="listitem"><strong>${escapeHtml(m.label)}</strong><span>${m.credits} credits · ${m.debits} debits</span></div>`
      ).join('');
    }
    if (totalsEl) {
      totalsEl.textContent = `${draft.addedCredits} credits and ${draft.addedDebits} debits will be saved (${draft.skipped} duplicates skipped).`;
    }
    if (modal) modal.style.display = 'flex';
  });
}

function closeApproveUploadModal(approved) {
  const modal = document.getElementById('approveUploadModal');
  if (modal) modal.style.display = 'none';
  if (pendingApproveResolver) {
    const resolve = pendingApproveResolver;
    pendingApproveResolver = null;
    resolve(!!approved);
  }
}

function getOrCreateBankSheet(bank, monthId, fileName, sourceHeader) {
  if (!bank.sheets) bank.sheets = [];
  let sheet = bank.sheets.find(s => s.monthId === monthId);
  const uploadedOn = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  if (!sheet) {
    sheet = {
      monthId,
      label: monthLabelFromId(monthId),
      fileName: fileName || `${(bank.name || 'Bank').replace(/\s+/g, '_')}_${monthId}.csv`,
      uploadedOn,
      sourceHeader: sourceHeader || '',
      creditsCount: 0,
      debitsCount: 0,
      records: [],
      debitRecords: []
    };
    bank.sheets.unshift(sheet);
  } else {
    sheet.fileName = fileName || sheet.fileName;
    sheet.uploadedOn = uploadedOn;
    if (sourceHeader) sheet.sourceHeader = sourceHeader;
    if (!sheet.records) sheet.records = [];
    if (!sheet.debitRecords) sheet.debitRecords = [];
  }
  return sheet;
}

async function commitStatementImport(draft) {
  const modal = document.getElementById('approveUploadModal');
  const modalOpen = modal && modal.style.display === 'flex';
  const bankSelect = document.getElementById('approveBankSelect');
  const chosenId = (modalOpen && bankSelect && bankSelect.value) ? bankSelect.value : draft.bank.id;
  let bank = corporateBanks.find(b => b.id === chosenId) || draft.bank;
  if (!corporateBanks.some(b => b.id === bank.id)) {
    corporateBanks.push(bank);
  }
  if (!bank.sheets) bank.sheets = [];
  const extracted = draft.detection && draft.detection.extracted;
  if (extracted) {
    const sameAccount = !extracted.fullAccNo || accountsEqual(bank.fullAccNo, extracted.fullAccNo) || !digitsOnly(bank.fullAccNo);
    if (sameAccount && extracted.fullAccNo && extracted.fullAccNo.length >= 6) {
      bank.fullAccNo = extracted.fullAccNo;
      bank.accNo = `••••${extracted.fullAccNo.slice(-4)}`;
    }
    if (sameAccount && extracted.ifsc) bank.ifsc = extracted.ifsc;
    if (sameAccount && extracted.name) bank.name = extracted.name;
    if (sameAccount && (extracted.branch || extracted.holder)) bank.branch = extracted.branch || extracted.holder;
  }

  const sourceHeader = statementSourceHeader(draft.csvText);
  draft.months.forEach(month => {
    forgetDeletedSheet(bank.id, month.monthId);
    const sheet = getOrCreateBankSheet(bank, month.monthId, draft.fileName, sourceHeader);
    sheet.records = (month.records || []).concat(sheet.records || []);
    sheet.debitRecords = (month.debitRecords || []).concat(sheet.debitRecords || []);
    sheet.creditsCount = sheet.records.length;
    sheet.debitsCount = sheet.debitRecords.length;
  });

  selectedBankId = bank.id;
  selectedMonthId = draft.months[draft.months.length - 1].monthId;

  if (draft.addedCredits > 0 && draft.addedDebits > 0) {
    switchMappingMode('all', { silent: true, autoPersist: false });
  } else if (draft.addedDebits > 0 && draft.addedCredits === 0) {
    switchMappingMode('debit', { silent: true, autoPersist: false });
  } else {
    switchMappingMode('credit', { silent: true, autoPersist: false });
  }

  autoMatchAllStatementData(false);

  const monthLabels = draft.months.map(m => m.label).join(', ');
  recentActivities.unshift({
    text: `Imported statement (${draft.addedCredits} credits, ${draft.addedDebits} debits)`,
    meta: `${bank.name} ${bank.accNo} · ${monthLabels}`
  });

  renderAll(false);
  const persisted = await persistToSupabase();
  if (draft.fileName && persisted) {
    uploadRawStatementFile(draft.fileName, draft.csvText);
  }

  const totalAdded = draft.addedCredits + draft.addedDebits;
  if (persisted) {
    showToast(
      `Saved ${totalAdded} transactions to ${bank.name} (${bank.accNo}) across ${draft.months.length} month${draft.months.length === 1 ? '' : 's'}: ${monthLabels}.`,
      totalAdded > 0 ? 'success' : 'amber'
    );
  }
}

function collectDeletionPayload() {
  const seen = new Set();
  const all = [];
  pendingDeletedSheets.concat(readDeletedSheetTombstones()).forEach(d => {
    if (!d || !d.bankId || !d.monthId) return;
    const key = `${d.bankId}::${d.monthId}`;
    if (seen.has(key)) return;
    seen.add(key);
    all.push(d);
  });
  return all;
}

function banksWithoutDeletedSheets(banks, deletions) {
  const keys = new Set((deletions || []).map(d => `${d.bankId}::${d.monthId}`));
  if (!keys.size) return banks;
  return (banks || []).map(b => Object.assign({}, b, {
    sheets: (b.sheets || []).filter(s => s && !keys.has(`${b.id}::${s.monthId}`))
  }));
}

async function deleteSheetViaSupabaseClient(del) {
  const client = getSupabaseClient();
  if (!client || !del || !del.bankId || !del.monthId) return false;
  try {
    await client.from('bank_transactions').delete().eq('bank_id', del.bankId).eq('month_id', del.monthId);
    if (Array.isArray(del.txnIds) && del.txnIds.length > 0) {
      for (let i = 0; i < del.txnIds.length; i += 80) {
        await client.from('bank_transactions').delete().in('id', del.txnIds.slice(i, i + 80));
      }
    }
    const { data: bank } = await client.from('corporate_banks').select('sheets').eq('id', del.bankId).maybeSingle();
    if (bank) {
      const sheets = (Array.isArray(bank.sheets) ? bank.sheets : []).filter(s => String(s.monthId) !== String(del.monthId));
      const { error } = await client.from('corporate_banks').update({
        sheets,
        updated_at: new Date().toISOString()
      }).eq('id', del.bankId);
      if (error) throw error;
    }
    if (del.fileName) {
      const safeName = String(del.fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
      await client.storage.from('reconciliation-data').remove([`statements/${safeName}`]);
    }
    return true;
  } catch (err) {
    console.warn('Client sheet delete failed:', err);
    return false;
  }
}

async function deleteStatementSheetFromBackend(del) {
  try {
    const res = await fetch('/api/supabase/delete-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(del)
    });
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      const data = await res.json();
      if (data && data.success) return true;
    }
  } catch (err) {}
  return deleteSheetViaSupabaseClient(del);
}

async function deleteStatementSheet(bankId, monthId) {
  const bank = corporateBanks.find(b => b.id === bankId);
  if (!bank || !Array.isArray(bank.sheets)) return;
  const sheet = bank.sheets.find(s => s.monthId === monthId);
  const label = sheet ? sheet.label : monthId;
  const fileName = sheet ? sheet.fileName : '';
  const txnIds = [
    ...((sheet && sheet.records) || []).map(r => r.id).filter(Boolean),
    ...((sheet && sheet.debitRecords) || []).map(r => r.id).filter(Boolean)
  ];
  bank.sheets = bank.sheets.filter(s => s.monthId !== monthId);
  const deletion = { bankId, monthId, txnIds, fileName };
  pendingDeletedSheets.push(deletion);
  rememberDeletedSheet(bankId, monthId);
  if (selectedMonthId === monthId) {
    selectedMonthId = bank.sheets[0] ? bank.sheets[0].monthId : '';
  }
  recentActivities.unshift({
    text: `Removed statement file (${label})`,
    meta: `${bank.name} ${bank.accNo}`
  });
  renderAll(false);

  const dbDeleted = await deleteStatementSheetFromBackend(deletion);
  await persistToSupabase();
  showToast(
    dbDeleted
      ? `Deleted ${label} from ${bank.name} and the database.`
      : `Removed ${label} locally. Database delete will retry on the next sync.`,
    dbDeleted ? 'success' : 'amber'
  );
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

  if (filtered.length === 0) {
    catalogInvoicesTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 32px 16px; color: var(--text-tertiary); font-size: 13px;">
          No customer invoices in catalog. Add an invoice manually or upload a CSV.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(inv => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong class="font-mono">${escapeHtml(inv.invoiceNo)}</strong></td>
      <td>
        <div style="font-weight: 500;">${escapeHtml(inv.guestName)}</div>
        ${inv.gstin ? `<div style="font-size: 11px; color: var(--text-tertiary); font-family: var(--font-mono);">GSTIN: ${escapeHtml(inv.gstin)}</div>` : ''}
      </td>
      <td class="font-mono font-bold">${formatINR(inv.amount)}</td>
      <td>${escapeHtml(inv.date || '—')}</td>
      <td><span class="status-pill status-pill-mapped" style="font-size: 11px;">${escapeHtml(inv.category || 'Regular B2B')}</span></td>
    `;
    catalogInvoicesTableBody.appendChild(tr);
  });
}

async function processInvoiceCsv(csvText) {
  if (!csvText || !csvText.trim()) {
    showToast('The uploaded invoice file appears to be empty.', 'amber');
    return;
  }
  if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);

  const delimiter = detectCsvDelimiter(csvText);
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    showToast('Sales book / CSV file is empty or missing data rows', 'amber');
    return;
  }

  // Column header auto-discovery with scoring across up to 50 lines (supporting Tally, Marg ERP, Busy, SAP)
  let headerIndex = -1;
  let invNoCol = -1, custCol = -1, amtCol = -1, dateCol = -1, catCol = -1, gCol = -1;

  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const lineLower = lines[i].toLowerCase();
    const rawCols = parseCsvLine(lines[i], delimiter).map(c => c.trim().toLowerCase().replace(/[_\-\/\.\(\)\s]+/g, ' '));

    // Skip pure report title or pagination metadata rows
    if (lineLower.startsWith('sales register for period') || lineLower.startsWith('statement period') || lineLower.startsWith('page ')) {
      continue;
    }

    const iIdx = rawCols.findIndex(c =>
      c === 'invoice' || c === 'inv' || c === 'invoice no' || c === 'inv no' || c === 'bill no' ||
      c === 'vch no' || c === 'voucher no' || c === 'doc no' || c === 'vch number' || c === 'voucher number' ||
      c === 'bill number' || c === 'inv number' || c === 'ref no' || c === 'reference no' ||
      c.includes('invoice no') || c.includes('inv no') || c.includes('bill no') || c.includes('vch no') ||
      c.includes('voucher no') || c === 'invoice #' || c === 'inv #' || c === 'bill #' || c === 'tax invoice no'
    );

    const cIdx = rawCols.findIndex(c =>
      c === 'customer' || c === 'party' || c === 'party name' || c === 'customer name' ||
      c === 'client' || c === 'guest' || c === 'particulars' || c === 'party particulars' ||
      c === 'buyer' || c === 'buyer name' || c === 'consignee' || c === 'consignee name' ||
      c === 'account name' || c === 'ledger name' || c === 'debtor' ||
      c.includes('customer') || c.includes('party') || c.includes('particulars') || c.includes('buyer') || c.includes('consignee') || (c.includes('name') && !c.includes('item') && !c.includes('product') && !c.includes('user'))
    );

    const dIdx = rawCols.findIndex(c =>
      c === 'date' || c === 'dt' || c === 'inv date' || c === 'invoice date' || c === 'vch date' ||
      c === 'voucher date' || c === 'bill date' || c === 'doc date' || c.includes('date')
    );

    const gIdx = rawCols.findIndex(c =>
      c === 'gstin' || c === 'gstin uin' || c === 'gstin/uin' || c === 'gst no' || c === 'gst number' ||
      c.includes('gstin') || c.includes('gst no')
    );

    const kIdx = rawCols.findIndex(c =>
      (c === 'category' || c === 'division' || c === 'vch type' || c === 'voucher type' || c === 'type') &&
      !c.includes('amount') && !c.includes('date')
    );

    // Prioritized Amount column in pharma sales register: Net Total / Bill Amt > Debit > Gross > Generic > Taxable
    let aIdx = rawCols.findIndex(c =>
      c === 'net amount' || c === 'net amt' || c === 'bill amount' || c === 'bill amt' ||
      c === 'total amount' || c === 'total amt' || c === 'net total' || c === 'invoice value' ||
      c === 'inv value' || c === 'invoice total' || c === 'grand total' || c === 'final amount' ||
      c === 'total bill amt' || c === 'total value' || c === 'total' || c === 'net'
    );
    if (aIdx === -1) {
      // Tally Columnar Sales Register standard: Debit column
      aIdx = rawCols.findIndex(c =>
        c === 'debit' || c === 'debit amount' || c === 'debit amt' || c === 'dr amount' ||
        c === 'dr amt' || c === 'debit rs' || c === 'dr rs' || c === 'dr'
      );
    }
    if (aIdx === -1) {
      aIdx = rawCols.findIndex(c =>
        c === 'gross total' || c === 'gross amount' || c === 'gross amt' || c === 'gross value' || c === 'gross'
      );
    }
    if (aIdx === -1) {
      aIdx = rawCols.findIndex(c =>
        (c === 'amount' || c === 'amt' || c === 'value' || c.includes('amount') || c.includes('total')) &&
        !c.includes('tax') && !c.includes('cgst') && !c.includes('sgst') && !c.includes('igst') &&
        !c.includes('cess') && !c.includes('tds') && !c.includes('tcs') && !c.includes('discount') &&
        !c.includes('round') && !c.includes('paid')
      );
    }
    if (aIdx === -1) {
      aIdx = rawCols.findIndex(c =>
        c === 'taxable value' || c === 'taxable amount' || c === 'taxable amt' || c === 'taxable'
      );
    }

    if (iIdx !== -1 || (cIdx !== -1 && (aIdx !== -1 || dIdx !== -1)) || (dIdx !== -1 && aIdx !== -1)) {
      headerIndex = i;
      invNoCol = iIdx;
      custCol = cIdx;
      amtCol = aIdx;
      dateCol = dIdx;
      catCol = kIdx;
      gCol = gIdx;
      break;
    }
  }

  const startLine = headerIndex >= 0 ? headerIndex + 1 : 1;
  let added = 0;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    if (isSummaryOrFooterLine(line)) continue;

    const cols = parseCsvLine(line, delimiter);
    if (cols.length < 2) continue;

    // Detect footer/total row
    const lineLower = line.toLowerCase();
    if (lineLower.startsWith('total') || lineLower.startsWith('grand total') || lineLower.startsWith('count ') || lineLower.includes('closing balance')) {
      continue;
    }

    let invoiceNo = (invNoCol >= 0 && cols[invNoCol]) ? cols[invNoCol].trim() : '';
    if (!invoiceNo) {
      const ifbCol = cols.find(c => /\bIFB[-_\s]?\d{3,}\b/i.test(c));
      invoiceNo = ifbCol ? (ifbCol.match(/\bIFB[-_\s]?\d{3,}\b/i)[0].toUpperCase()) : (cols[0] || `INV-${Date.now()}-${i}`);
    }

    const customer = (custCol >= 0 && cols[custCol]) ? cols[custCol].trim() : (cols[1] || 'Corporate Client');
    const date = (dateCol >= 0 && cols[dateCol]) ? cols[dateCol].trim() : (cols.find(c => isValidTransactionDate(c)) || '19 Sep 2026');

    let gstin = (gCol >= 0 && cols[gCol]) ? cols[gCol].trim().toUpperCase() : '';
    if (!gstin) {
      const gMatch = cols.find(c => /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/i.test(c));
      if (gMatch) gstin = gMatch.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/i)[0].toUpperCase();
    }

    let category = (catCol >= 0 && cols[catCol]) ? cols[catCol].trim() : '';
    if (!category || !isNaN(parseFloat(category)) || category.length < 2) {
      category = 'General Pharma Supply';
    }

    // Extract amount: prioritize detected amount column, fall back to max plausible monetary value in row
    let amount = amtCol >= 0 ? Math.abs(parseAmount(cols[amtCol])) : 0;
    if (!isPlausibleMoneyAmount(amount) || amountLooksLikeDateDigits(amount, date) || isDateLikeValue(amtCol >= 0 ? cols[amtCol] : '')) {
      amount = findMaxPlausibleAmountInRow(cols, [dateCol, invNoCol, custCol, gCol]);
    }

    if (!isPlausibleMoneyAmount(amount)) continue;
    if (isDateLikeValue(invoiceNo) || /^\d{1,2}$/.test(invoiceNo)) continue;

    // Check for existing invoice
    const existingIdx = appInvoices.findIndex(inv => inv.invoiceNo.toLowerCase() === invoiceNo.toLowerCase());
    if (existingIdx !== -1) {
      // Update with real details if existing had 0 or missing amount
      if (appInvoices[existingIdx].amount <= 0 && amount > 0) {
        appInvoices[existingIdx].amount = amount;
        appInvoices[existingIdx].guestName = customer;
        if (gstin) appInvoices[existingIdx].gstin = gstin;
      }
    } else {
      appInvoices.unshift({
        invoiceNo,
        guestName: customer,
        gstin,
        amount,
        date,
        category,
        status: 'Unpaid',
        settledAmount: 0
      });
      added++;
    }
  }

  renderAll(false);
  await persistToSupabase();
  showToast(`Successfully processed sales book: imported ${added} customer invoices into database!`, added > 0 ? 'success' : 'info');
}

// ---------------------------------------------------------------------------
// Real-time Reconciliation Settlement Calculation for Invoices
// ---------------------------------------------------------------------------

function getInvoiceReconciliationData(inv) {
  if (!inv || !inv.invoiceNo) {
    return {
      linkedTransactions: [],
      settledAmount: 0,
      balance: 0,
      percent: 0,
      status: 'Unreconciled'
    };
  }

  const targetNo = String(inv.invoiceNo).trim().toLowerCase();
  const linked = [];

  (corporateBanks || []).forEach(bank => {
    (bank.sheets || []).forEach(sheet => {
      (sheet.records || []).forEach(row => {
        if (row.status === 'mapped' && row.mapping) {
          const mappedDoc = String(row.mapping.invoiceNo || row.mapping.billNo || '').trim().toLowerCase();
          if (mappedDoc === targetNo) {
            linked.push({
              bankId: bank.id,
              bankName: bank.name,
              bankAccNo: bank.accNo,
              monthId: sheet.id,
              monthName: sheet.month,
              rowId: row.id,
              date: row.date,
              amount: parseFloat(row.amount) || 0,
              narration: row.narration || '',
              bankRef: row.bankRef || '',
              type: row.type || 'TRANSFER',
              mappedAt: row.mapping.mappedAt || '',
              mappedBy: row.mapping.mappedBy || 'Accounts Controller'
            });
          }
        }
      });
    });
  });

  const invAmount = Math.max(0, parseFloat(inv.amount) || 0);
  const totalSettled = linked.reduce((sum, item) => sum + item.amount, 0);
  const balance = Math.max(0, invAmount - totalSettled);
  const percent = invAmount > 0 ? Math.min(100, Math.round((totalSettled / invAmount) * 100)) : (totalSettled > 0 ? 100 : 0);

  let status = 'Unreconciled';
  if (totalSettled >= invAmount && invAmount > 0) {
    status = 'Reconciled';
  } else if (totalSettled > 0) {
    status = 'Partially Paid';
  } else if (inv.status && (inv.status === 'Reconciled' || inv.status === 'Partially Paid' || inv.status === 'Paid')) {
    status = inv.status;
  }

  // Update invoice object properties
  inv.settledAmount = totalSettled;
  inv.status = status;

  return {
    linkedTransactions: linked,
    settledAmount: totalSettled,
    balance: balance,
    percent: percent,
    status: status
  };
}

function updateInvoicesBadge() {
  const badge = document.getElementById('navInvoicesBadge');
  if (badge) {
    badge.textContent = String(appInvoices.length);
  }
}

// ---------------------------------------------------------------------------
// Render Customer Invoices Desk
// ---------------------------------------------------------------------------

function renderInvoicesView() {
  const tableBody = document.getElementById('invoicesTableBody');
  const emptyState = document.getElementById('invoicesEmptyState');
  const tableFooter = document.getElementById('invoicesTableFooter');
  if (!tableBody) return;

  updateInvoicesBadge();

  // 1. Calculate KPI Metrics & Filter Counts
  let totalInvoicedSum = 0;
  let totalSettledSum = 0;
  let totalPendingSum = 0;
  let countReconciled = 0;
  let countPartial = 0;
  let countUnreconciled = 0;

  const invoiceDataList = appInvoices.map(inv => {
    const recon = getInvoiceReconciliationData(inv);
    const amt = parseFloat(inv.amount) || 0;
    totalInvoicedSum += amt;
    totalSettledSum += recon.settledAmount;
    totalPendingSum += recon.balance;

    if (recon.status === 'Reconciled') {
      countReconciled++;
    } else if (recon.status === 'Partially Paid') {
      countPartial++;
    } else {
      countUnreconciled++;
    }

    return {
      inv,
      recon
    };
  });

  // Update KPI Cards
  const invTotalValueEl = document.getElementById('invTotalValue');
  const invTotalCountSubEl = document.getElementById('invTotalCountSub');
  const invSettledValueEl = document.getElementById('invSettledValue');
  const invSettledRateSubEl = document.getElementById('invSettledRateSub');
  const invPendingValueEl = document.getElementById('invPendingValue');
  const invPendingCountSubEl = document.getElementById('invPendingCountSub');
  const invMatchRateEl = document.getElementById('invMatchRate');
  const invMatchCountSubEl = document.getElementById('invMatchCountSub');

  if (invTotalValueEl) invTotalValueEl.textContent = formatINR(totalInvoicedSum);
  if (invTotalCountSubEl) invTotalCountSubEl.textContent = `${appInvoices.length} invoices registered`;
  if (invSettledValueEl) invSettledValueEl.textContent = formatINR(totalSettledSum);
  const settledPct = totalInvoicedSum > 0 ? ((totalSettledSum / totalInvoicedSum) * 100).toFixed(1) : '0.0';
  if (invSettledRateSubEl) invSettledRateSubEl.textContent = `${settledPct}% collected via bank credits`;
  if (invPendingValueEl) invPendingValueEl.textContent = formatINR(totalPendingSum);
  if (invPendingCountSubEl) invPendingCountSubEl.textContent = `${countPartial + countUnreconciled} invoices pending collection`;
  if (invMatchRateEl) invMatchRateEl.textContent = `${settledPct}%`;
  if (invMatchCountSubEl) invMatchCountSubEl.textContent = `${countReconciled} of ${appInvoices.length} fully reconciled`;

  // Update Filter Counts Badges
  const filterCountAll = document.getElementById('invFilterCountAll');
  const filterCountReconciled = document.getElementById('invFilterCountReconciled');
  const filterCountPartial = document.getElementById('invFilterCountPartial');
  const filterCountUnreconciled = document.getElementById('invFilterCountUnreconciled');
  if (filterCountAll) filterCountAll.textContent = String(appInvoices.length);
  if (filterCountReconciled) filterCountReconciled.textContent = String(countReconciled);
  if (filterCountPartial) filterCountPartial.textContent = String(countPartial);
  if (filterCountUnreconciled) filterCountUnreconciled.textContent = String(countUnreconciled);

  // 2. Filter & Search
  const query = (invoicesSearch || '').toLowerCase().trim();
  let displayed = invoiceDataList.filter(({ inv, recon }) => {
    // Filter by tab
    if (invoicesFilter === 'reconciled' && recon.status !== 'Reconciled') return false;
    if (invoicesFilter === 'partial' && recon.status !== 'Partially Paid') return false;
    if (invoicesFilter === 'unreconciled' && recon.status !== 'Unreconciled') return false;

    // Filter by query
    if (query) {
      const matchInvNo = (inv.invoiceNo || '').toLowerCase().includes(query);
      const matchCust = (inv.guestName || '').toLowerCase().includes(query);
      const matchCat = (inv.category || '').toLowerCase().includes(query);
      const matchGstin = (inv.gstin || '').toLowerCase().includes(query);
      const matchAmount = String(inv.amount || '').includes(query);
      const matchStatus = recon.status.toLowerCase().includes(query);
      if (!matchInvNo && !matchCust && !matchCat && !matchGstin && !matchAmount && !matchStatus) {
        return false;
      }
    }
    return true;
  });

  // 3. Sort
  displayed.sort((a, b) => {
    if (invoicesSort === 'amount-desc') {
      return (parseFloat(b.inv.amount) || 0) - (parseFloat(a.inv.amount) || 0);
    }
    if (invoicesSort === 'amount-asc') {
      return (parseFloat(a.inv.amount) || 0) - (parseFloat(b.inv.amount) || 0);
    }
    if (invoicesSort === 'invoice-asc') {
      return (a.inv.invoiceNo || '').localeCompare(b.inv.invoiceNo || '');
    }
    if (invoicesSort === 'customer-asc') {
      return (a.inv.guestName || '').localeCompare(b.inv.guestName || '');
    }
    if (invoicesSort === 'date-asc') {
      return new Date(a.inv.date || 0) - new Date(b.inv.date || 0);
    }
    // date-desc default
    return new Date(b.inv.date || 0) - new Date(a.inv.date || 0);
  });

  // 4. Render Table
  tableBody.innerHTML = '';
  if (displayed.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    if (tableFooter) tableFooter.style.display = 'none';
    const emptyDesc = document.getElementById('invoicesEmptyDesc');
    if (emptyDesc) {
      if (appInvoices.length === 0) {
        emptyDesc.textContent = 'No customer invoices in the database yet. Click "+ Add Invoice" or "Import CSV" to register real sales invoices.';
      } else {
        emptyDesc.textContent = `No invoices match your search query "${query}" or filter.`;
      }
    }
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (tableFooter) tableFooter.style.display = 'flex';

  let filteredTotalSum = 0;
  let filteredSettledSum = 0;
  let filteredBalanceSum = 0;

  displayed.forEach(({ inv, recon }) => {
    const tr = document.createElement('tr');
    tr.id = `inv-row-${encodeURIComponent(inv.invoiceNo)}`;

    const amt = parseFloat(inv.amount) || 0;
    const settled = recon.settledAmount;
    const balance = recon.balance;

    filteredTotalSum += amt;
    filteredSettledSum += settled;
    filteredBalanceSum += balance;

    // Progress bar fill class
    let fillClass = 'fill-slate';
    if (recon.status === 'Reconciled') fillClass = 'fill-green';
    else if (recon.status === 'Partially Paid') fillClass = 'fill-amber';

    // Status pill HTML
    let statusPillHtml = '';
    if (recon.status === 'Reconciled') {
      statusPillHtml = `<span class="status-pill-reconciled"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Reconciled</span>`;
    } else if (recon.status === 'Partially Paid') {
      statusPillHtml = `<span class="status-pill-partial"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#f59e0b;margin-right:2px;"></span> ${recon.percent}% Paid</span>`;
    } else {
      statusPillHtml = `<span class="status-pill-unreconciled"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#94a3b8;margin-right:2px;"></span> Awaiting Credit</span>`;
    }

    // Bank Evidence HTML
    let evidenceHtml = '';
    if (recon.linkedTransactions.length > 0) {
      const first = recon.linkedTransactions[0];
      const count = recon.linkedTransactions.length;
      evidenceHtml = `
        <button type="button" class="bank-evidence-pill" data-inv="${escapeHtml(inv.invoiceNo)}" title="View linked bank transactions (${count} credits mapped)">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          <span>${escapeHtml(first.bankName.replace(' Bank', ''))}: ${formatINR(first.amount)}${count > 1 ? ` (+${count - 1})` : ''}</span>
        </button>
      `;
    } else {
      evidenceHtml = `
        <button type="button" class="btn-quick-reconcile" data-inv="${escapeHtml(inv.invoiceNo)}" data-cust="${escapeHtml(inv.guestName)}" title="Open Bank Statements Credit Desk to match this invoice">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          <span>Match in Desk &rarr;</span>
        </button>
      `;
    }

    tr.innerHTML = `
      <td>
        <span class="inv-num-pill" data-action="view" data-inv="${escapeHtml(inv.invoiceNo)}" title="Click to view invoice details">
          ${escapeHtml(inv.invoiceNo)}
        </span>
      </td>
      <td>
        <span class="inv-date-text">${escapeHtml(inv.date || '—')}</span>
      </td>
      <td class="inv-customer-col">
        <div class="inv-customer-name">${escapeHtml(inv.guestName || 'Corporate Client')}</div>
        <div class="inv-customer-meta">
          <span class="inv-category-pill">${escapeHtml(inv.category || 'Pharma Supply')}</span>
          ${inv.gstin ? `<span class="font-mono" style="font-size: 10.5px;">GSTIN: ${escapeHtml(inv.gstin)}</span>` : ''}
        </div>
      </td>
      <td class="font-mono font-bold text-right" style="font-size: 13px;">
        ${formatINR(amt)}
      </td>
      <td class="text-right">
        <div class="inv-settlement-wrap">
          <span class="font-mono font-bold ${settled > 0 ? 'text-success' : 'text-muted'}" style="${settled > 0 ? 'color: #059669;' : ''}">${formatINR(settled)}</span>
          <div class="inv-progress-track" title="${recon.percent}% settled">
            <div class="inv-progress-fill ${fillClass}" style="width: ${recon.percent}%;"></div>
          </div>
        </div>
      </td>
      <td class="font-mono font-bold text-right" style="color: ${balance > 0 ? '#d97706' : 'var(--text-muted)'};">
        ${formatINR(balance)}
      </td>
      <td>
        ${statusPillHtml}
      </td>
      <td>
        ${evidenceHtml}
      </td>
      <td>
        <div class="table-actions-cell">
          <button type="button" class="btn-table-action" data-action="view" data-inv="${escapeHtml(inv.invoiceNo)}" title="View details & audit trail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
          <button type="button" class="btn-table-action" data-action="edit" data-inv="${escapeHtml(inv.invoiceNo)}" title="Edit invoice">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          <button type="button" class="btn-table-action action-delete" data-action="delete" data-inv="${escapeHtml(inv.invoiceNo)}" title="Delete invoice">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    `;

    // Bind item events
    tr.querySelectorAll('[data-action="view"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openInvoiceDetailsModal(inv);
      });
    });

    tr.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditInvoiceModal(inv);
      });
    });

    tr.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDeleteInvoice(inv);
      });
    });

    tr.querySelectorAll('.bank-evidence-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openInvoiceDetailsModal(inv);
      });
    });

    tr.querySelectorAll('.btn-quick-reconcile').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        quickJumpToReconcile(inv);
      });
    });

    tableBody.appendChild(tr);
  });

  // Update Footer totals
  const footerCount = document.getElementById('invoicesFooterCount');
  const footerSum = document.getElementById('invoicesFooterSum');
  const footerSettled = document.getElementById('invoicesFooterSettled');
  const footerBalance = document.getElementById('invoicesFooterBalance');
  if (footerCount) footerCount.textContent = `Showing ${displayed.length} of ${appInvoices.length} invoices`;
  if (footerSum) footerSum.textContent = formatINR(filteredTotalSum);
  if (footerSettled) footerSettled.textContent = formatINR(filteredSettledSum);
  if (footerBalance) footerBalance.textContent = formatINR(filteredBalanceSum);
}

// ---------------------------------------------------------------------------
// Invoice Details, Add/Edit & Action Modals
// ---------------------------------------------------------------------------

function openInvoiceDetailsModal(inv) {
  if (!inv) return;
  const modal = document.getElementById('invoiceDetailsModal');
  const title = document.getElementById('invDetailTitle');
  const body = document.getElementById('invoiceDetailsBody');
  const editBtn = document.getElementById('invDetailEditBtn');
  const deleteBtn = document.getElementById('invDetailDeleteBtn');
  if (!modal || !body) return;

  const recon = getInvoiceReconciliationData(inv);
  if (title) title.textContent = `Invoice ${inv.invoiceNo}`;

  let evidenceRowsHtml = '';
  if (recon.linkedTransactions.length > 0) {
    evidenceRowsHtml = recon.linkedTransactions.map(tx => `
      <tr>
        <td>
          <div style="font-weight: 600;">${escapeHtml(tx.bankName)}</div>
          <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">${escapeHtml(tx.bankAccNo)} · ${escapeHtml(tx.monthName || '')}</div>
        </td>
        <td>${escapeHtml(tx.date)}</td>
        <td class="font-mono font-bold text-success" style="color: #059669;">${formatINR(tx.amount)}</td>
        <td>
          <div class="font-mono" style="font-size: 11px;">${escapeHtml(tx.bankRef || '—')}</div>
          <div style="font-size: 11px; color: var(--text-secondary); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(tx.narration || '')}</div>
        </td>
        <td>
          <span style="font-size: 11px; color: var(--text-muted);">${escapeHtml(tx.mappedBy || 'Controller')}</span>
        </td>
        <td style="text-align: right;">
          <button type="button" class="btn btn-outline btn-sm" onclick="jumpToStatementRow('${escapeHtml(tx.bankId)}', '${escapeHtml(tx.monthId)}', '${escapeHtml(tx.rowId)}')">
            View Row &rarr;
          </button>
        </td>
      </tr>
    `).join('');
  } else {
    evidenceRowsHtml = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;">
          No bank statement credits matched yet. 
          <button type="button" class="btn btn-outline btn-sm" style="margin-left: 8px;" onclick="quickJumpToReconcileByNo('${escapeHtml(inv.invoiceNo)}')">
            Match in Desk &rarr;
          </button>
        </td>
      </tr>
    `;
  }

  body.innerHTML = `
    <!-- Top KPI Highlights -->
    <div class="inv-detail-kpis">
      <div class="inv-detail-kpi-card">
        <div class="inv-detail-kpi-label">INVOICED AMOUNT</div>
        <div class="inv-detail-kpi-val">${formatINR(inv.amount)}</div>
      </div>
      <div class="inv-detail-kpi-card">
        <div class="inv-detail-kpi-label">SETTLED VIA BANK CREDITS</div>
        <div class="inv-detail-kpi-val" style="color: #059669;">${formatINR(recon.settledAmount)}</div>
      </div>
      <div class="inv-detail-kpi-card">
        <div class="inv-detail-kpi-label">OUTSTANDING BALANCE</div>
        <div class="inv-detail-kpi-val" style="color: ${recon.balance > 0 ? '#d97706' : 'var(--text-muted)'};">${formatINR(recon.balance)}</div>
      </div>
    </div>

    <!-- Metadata Grid -->
    <div class="inv-detail-meta-grid">
      <div class="inv-meta-item">
        <label>Customer / Buyer</label>
        <span>${escapeHtml(inv.guestName || 'Corporate Client')}</span>
      </div>
      <div class="inv-meta-item">
        <label>Invoice Date</label>
        <span>${escapeHtml(inv.date || '—')}</span>
      </div>
      <div class="inv-meta-item">
        <label>Category / Product Batch</label>
        <span>${escapeHtml(inv.category || 'Pharma Distribution')}</span>
      </div>
      <div class="inv-meta-item">
        <label>Customer GSTIN</label>
        <span class="font-mono">${escapeHtml(inv.gstin || '—')}</span>
      </div>
      <div class="inv-meta-item">
        <label>Reconciliation Status</label>
        <div>
          ${recon.status === 'Reconciled' 
            ? '<span class="status-pill-reconciled">✓ Fully Reconciled (100%)</span>' 
            : (recon.status === 'Partially Paid' 
              ? `<span class="status-pill-partial">${recon.percent}% Partially Paid</span>` 
              : '<span class="status-pill-unreconciled">Pending Bank Matching</span>')}
        </div>
      </div>
      <div class="inv-meta-item">
        <label>Settlement Progress</label>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="inv-progress-track" style="width: 120px; height: 7px;">
            <div class="inv-progress-fill ${recon.status === 'Reconciled' ? 'fill-green' : (recon.status === 'Partially Paid' ? 'fill-amber' : 'fill-slate')}" style="width: ${recon.percent}%;"></div>
          </div>
          <span class="font-mono font-bold" style="font-size: 11.5px;">${recon.percent}%</span>
        </div>
      </div>
    </div>

    <!-- Bank Statement Linkage Evidence -->
    <div class="inv-evidence-section-title">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
      <span>Bank Statement Reconciliation Evidence (${recon.linkedTransactions.length} Credits Linked)</span>
    </div>

    <div style="overflow-x: auto; border: 1px solid var(--border-default); border-radius: var(--radius-md);">
      <table class="credit-mapping-table" style="margin: 0;">
        <thead>
          <tr>
            <th>BANK ACCOUNT</th>
            <th>DATE</th>
            <th>CREDIT AMT</th>
            <th>UTR / NARRATION</th>
            <th>RECONCILED BY</th>
            <th style="text-align: right;">ACTION</th>
          </tr>
        </thead>
        <tbody>
          ${evidenceRowsHtml}
        </tbody>
      </table>
    </div>
  `;

  if (editBtn) {
    editBtn.onclick = () => {
      modal.style.display = 'none';
      openEditInvoiceModal(inv);
    };
  }

  if (deleteBtn) {
    deleteBtn.onclick = () => {
      modal.style.display = 'none';
      confirmDeleteInvoice(inv);
    };
  }

  modal.style.display = 'flex';
}

function openAddInvoiceModal() {
  const modal = document.getElementById('addInvoiceModal');
  const title = document.getElementById('addInvoiceModalTitle');
  const sub = document.getElementById('addInvoiceModalSubtitle');
  const btn = document.getElementById('saveInvoiceSubmitBtn');
  const form = document.getElementById('addInvoiceForm');
  const editNo = document.getElementById('editInvoiceOriginalNo');

  if (form) form.reset();
  if (editNo) editNo.value = '';
  if (title) title.textContent = 'Add Customer Invoice Manually';
  if (sub) sub.textContent = 'Add a single invoice to the pending invoice catalog for bank matching.';
  if (btn) btn.textContent = 'Save & Add Invoice';

  const dtInput = document.getElementById('newInvDate');
  if (dtInput) dtInput.value = '19 Sep 2026';

  if (modal) modal.style.display = 'flex';
}

function openEditInvoiceModal(inv) {
  if (!inv) return;
  const modal = document.getElementById('addInvoiceModal');
  const title = document.getElementById('addInvoiceModalTitle');
  const sub = document.getElementById('addInvoiceModalSubtitle');
  const btn = document.getElementById('saveInvoiceSubmitBtn');
  const editNo = document.getElementById('editInvoiceOriginalNo');

  if (title) title.textContent = 'Edit Customer Invoice';
  if (sub) sub.textContent = 'Modify customer invoice details and receivables metadata.';
  if (btn) btn.textContent = 'Save Changes';
  if (editNo) editNo.value = inv.invoiceNo;

  const noInput = document.getElementById('newInvNo');
  const amtInput = document.getElementById('newInvAmount');
  const custInput = document.getElementById('newInvCustomer');
  const gstinInput = document.getElementById('newInvGstin');
  const dtInput = document.getElementById('newInvDate');
  const catInput = document.getElementById('newInvCategory');

  if (noInput) noInput.value = inv.invoiceNo || '';
  if (amtInput) amtInput.value = inv.amount || '';
  if (custInput) custInput.value = inv.guestName || '';
  if (gstinInput) gstinInput.value = inv.gstin || '';
  if (dtInput) dtInput.value = inv.date || '';
  if (catInput) catInput.value = inv.category || '';

  if (modal) modal.style.display = 'flex';
}

function confirmDeleteInvoice(inv) {
  if (!inv) return;
  const no = inv.invoiceNo;
  const recon = getInvoiceReconciliationData(inv);
  let msg = `Are you sure you want to delete invoice ${no} (${inv.guestName})?`;
  if (recon.linkedTransactions.length > 0) {
    msg += `\nWarning: ${recon.linkedTransactions.length} bank credit transaction(s) are mapped to this invoice and will be unlinked.`;
  }

  if (window.confirm(msg)) {
    // Unlink any matched bank credit transactions
    (corporateBanks || []).forEach(bank => {
      (bank.sheets || []).forEach(sheet => {
        (sheet.records || []).forEach(row => {
          if (row.status === 'mapped' && row.mapping && row.mapping.invoiceNo) {
            if (row.mapping.invoiceNo.toLowerCase() === no.toLowerCase()) {
              row.status = 'unmapped';
              row.mapping = null;
            }
          }
        });
      });
    });

    // Remove from appInvoices
    appInvoices = appInvoices.filter(i => i.invoiceNo.toLowerCase() !== no.toLowerCase());

    recentActivities.unshift({
      text: `Deleted Invoice ${no} (${inv.guestName})`,
      meta: `Desk Admin · Just now`
    });

    renderAll();
    if (currentActiveView === 'invoices') renderInvoicesView();
    persistToSupabase();
    showToast(`Invoice ${no} was deleted.`);
  }
}

function exportInvoicesToCsv() {
  if (appInvoices.length === 0) {
    showToast('No invoices to export.', 'amber');
    return;
  }

  const rows = [
    ['Invoice No', 'Customer Name', 'GSTIN', 'Invoice Amount', 'Invoice Date', 'Category', 'Settled Amount', 'Outstanding Balance', 'Status', 'Linked Bank Credits']
  ];

  appInvoices.forEach(inv => {
    const recon = getInvoiceReconciliationData(inv);
    const bankEvidence = recon.linkedTransactions.map(tx => `${tx.bankName} (${tx.date}: ₹${(Number(tx.amount) || 0).toLocaleString('en-IN')})`).join('; ');
    rows.push([
      inv.invoiceNo || '',
      inv.guestName || '',
      inv.gstin || '',
      inv.amount || 0,
      inv.date || '',
      inv.category || 'General Pharma Supply',
      recon.settledAmount,
      recon.balance,
      recon.status,
      bankEvidence || 'None'
    ]);
  });

  const csvContent = rows.map(r => r.map(cell => `"${String(cell != null ? cell : '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `IFIMED_Customer_Invoices_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Exported ${appInvoices.length} invoices to CSV!`, 'success');
}

function exportInvoicesToExcel() {
  if (appInvoices.length === 0) {
    showToast('No invoices to export.', 'amber');
    return;
  }

  if (typeof XLSX === 'undefined') {
    showToast('SheetJS Excel library not available. Exporting to CSV instead...', 'amber');
    exportInvoicesToCsv();
    return;
  }

  const wb = XLSX.utils.book_new();

  let totalInvoiced = 0;
  let totalSettled = 0;
  let totalBalance = 0;
  let settledCount = 0;
  let partialCount = 0;
  let unpaidCount = 0;

  const dataRows = appInvoices.map(inv => {
    const recon = getInvoiceReconciliationData(inv);
    const bankEvidence = recon.linkedTransactions.map(tx => `${tx.bankName} (${tx.date}: ₹${(Number(tx.amount) || 0).toLocaleString('en-IN')})`).join('; ');

    const invAmt = Number(inv.amount) || 0;
    const setAmt = Number(recon.settledAmount) || 0;
    const balAmt = Number(recon.balance) || 0;

    totalInvoiced += invAmt;
    totalSettled += setAmt;
    totalBalance += balAmt;

    if (recon.status === 'Settled' || recon.status === 'Fully Reconciled') settledCount++;
    else if (recon.status === 'Partially Reconciled' || recon.status === 'Partially Settled') partialCount++;
    else unpaidCount++;

    return [
      inv.invoiceNo || '',
      inv.guestName || '',
      inv.gstin || '',
      invAmt,
      inv.date || '',
      inv.category || 'General Pharma Supply',
      setAmt,
      balAmt,
      recon.status || 'Unpaid',
      bankEvidence || 'None'
    ];
  });

  const headers = [
    ['IFIMED PHARMACEUTICALS PVT. LTD. — CUSTOMER SALES INVOICES REGISTER'],
    [`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`],
    [
      `Total Invoiced: ₹ ${totalInvoiced.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Total Settled: ₹ ${totalSettled.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Total Outstanding: ₹ ${totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Total Records: ${appInvoices.length} (${settledCount} Settled, ${partialCount} Partial, ${unpaidCount} Unpaid)`
    ],
    [],
    ['Invoice No', 'Customer Name', 'GSTIN', 'Invoice Amount (₹)', 'Invoice Date', 'Category', 'Settled Amount (₹)', 'Outstanding Balance (₹)', 'Reconciliation Status', 'Linked Bank Credits (Evidence)']
  ];

  const ws = XLSX.utils.aoa_to_sheet([...headers, ...dataRows]);

  ws['!cols'] = [
    { wch: 16 },
    { wch: 32 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 22 },
    { wch: 18 },
    { wch: 20 },
    { wch: 22 },
    { wch: 45 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Customer Invoices');

  const fileName = `IFIMED_Customer_Invoices_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast(`Exported ${appInvoices.length} invoices to Excel (.xlsx)!`, 'success');
}

async function clearAllInvoices() {
  if (appInvoices.length === 0) {
    showToast('There are no invoices to clear.', 'info');
    return;
  }
  const count = appInvoices.length;
  const ok = window.confirm(`Are you sure you want to permanently delete all ${count} customer invoices from the database?\n\nAny mapped bank transactions will be unlinked.`);
  if (!ok) return;

  // Unlink any mapped credit transactions
  (corporateBanks || []).forEach(bank => {
    (bank.sheets || []).forEach(sheet => {
      (sheet.records || []).forEach(row => {
        if (row.status === 'mapped' && row.mapping && row.mapping.invoiceNo) {
          row.status = 'unmapped';
          row.mapping = null;
        }
      });
    });
  });

  appInvoices = [];

  recentActivities.unshift({
    text: `Purged all ${count} customer invoices from database`,
    meta: `Desk Admin · Just now`
  });

  renderAll();
  if (currentActiveView === 'invoices') renderInvoicesView();
  if (currentActiveView === 'virtual-ledger' || currentActiveView === 'ledger') renderVirtualLedgerView();
  await persistToSupabase();
  showToast(`Successfully deleted all ${count} invoices from database.`, 'success');
}

function quickJumpToReconcile(inv) {
  if (!inv) return;
  switchView('bank-statements');
  switchMappingMode('credit');
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = inv.invoiceNo;
    searchQuery = inv.invoiceNo;
    renderCreditTable();
  }
  showToast(`Switched to Credit Desk for invoice ${inv.invoiceNo}`, 'info');
}

function quickJumpToReconcileByNo(invNo) {
  const inv = appInvoices.find(i => i.invoiceNo.toLowerCase() === String(invNo).toLowerCase());
  if (inv) quickJumpToReconcile(inv);
  else {
    switchView('bank-statements');
    switchMappingMode('credit');
  }
  const modal = document.getElementById('invoiceDetailsModal');
  if (modal) modal.style.display = 'none';
}

function jumpToStatementRow(bankId, monthId, rowId) {
  const modal = document.getElementById('invoiceDetailsModal');
  if (modal) modal.style.display = 'none';

  switchView('bank-statements');
  switchMappingMode('credit');
  if (bankId && bankId !== selectedBankId) {
    switchBank(bankId);
  }
  if (monthId && monthId !== selectedMonthId) {
    switchMonth(monthId);
  }

  setTimeout(() => {
    const el = document.getElementById(`row-${rowId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.animation = 'highlightRow 2s ease';
    }
  }, 200);
}

window.quickJumpToReconcileByNo = quickJumpToReconcileByNo;
window.jumpToStatementRow = jumpToStatementRow;

// =============================================================================
// VIRTUAL LEDGER MODULE (Accounting-Grade Corporate Financial Workspace)
// =============================================================================

const MONTH_NAMES_MAP = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

function parseDateToTimestamp(dateStr) {
  if (!dateStr) return 0;
  const s = String(dateStr).trim();
  // Format: DD/MM/YYYY or DD-MM-YYYY
  const dmMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmMatch) {
    const d = parseInt(dmMatch[1], 10);
    const m = parseInt(dmMatch[2], 10) - 1;
    const y = parseInt(dmMatch[3], 10);
    return new Date(y, m, d).getTime() || 0;
  }
  // Format: YYYY-MM-DD
  const ymMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymMatch) {
    const y = parseInt(ymMatch[1], 10);
    const m = parseInt(ymMatch[2], 10) - 1;
    const d = parseInt(ymMatch[3], 10);
    return new Date(y, m, d).getTime() || 0;
  }
  // Format: DD Month YYYY or DD-Month-YYYY
  const dMonMatch = s.match(/^(\d{1,2})[\s\-]+([a-zA-Z]{3,9})[\s\-]+(\d{4})$/);
  if (dMonMatch) {
    const d = parseInt(dMonMatch[1], 10);
    const mStr = dMonMatch[2].slice(0, 3).toLowerCase();
    const m = MONTH_NAMES_MAP[mStr] !== undefined ? MONTH_NAMES_MAP[mStr] : 0;
    const y = parseInt(dMonMatch[3], 10);
    return new Date(y, m, d).getTime() || 0;
  }
  const parsed = new Date(s);
  return !isNaN(parsed.getTime()) ? parsed.getTime() : 0;
}

function classifyTransactionCategory(row, isDebit) {
  const narr = String(row.narration || '').toUpperCase();
  const typ = String(row.type || '').toUpperCase();

  if (isDebit) {
    if (narr.includes('CHG') || narr.includes('CHARGE') || narr.includes('FEE') || narr.includes('COMMISSION') || narr.includes('GST ON') || typ.includes('CHG')) {
      return 'BANK CHARGE';
    }
    if (narr.includes('TDS') || narr.includes('TAX') || typ.includes('TAX')) {
      return 'BANK CHARGE';
    }
    if (narr.includes('REFUND') || narr.includes('REVERSAL') || typ.includes('REFUND')) {
      return 'REFUND';
    }
    if (narr.includes('SELF') || narr.includes('TRF') || narr.includes('INTERNAL') || narr.includes('SWEEP')) {
      return 'TRANSFER';
    }
    return 'PAYMENT';
  } else {
    if (narr.includes('INT.PD') || narr.includes('INTEREST') || typ.includes('INT')) {
      return 'RECEIPT';
    }
    if (narr.includes('REFUND') || narr.includes('RTN') || narr.includes('REVERSAL') || typ.includes('REFUND')) {
      return 'REFUND';
    }
    if (narr.includes('SELF') || narr.includes('TRF') || narr.includes('INTERNAL') || narr.includes('SWEEP')) {
      return 'TRANSFER';
    }
    return 'RECEIPT';
  }
}

function deriveReconciliationStatus(row) {
  if (row.status === 'mapped') return 'Reconciled';
  if (row.status === 'matched') return 'Matched';
  if (row.status === 'exception') return 'Exception';
  return 'Pending';
}

function getVirtualLedgerData() {
  const banksToInclude = ledgerBankId === 'all'
    ? corporateBanks
    : corporateBanks.filter(b => b.id === ledgerBankId);

  // 1. Calculate Opening Balance
  let openingBalance = 0;
  if (ledgerMonthId !== 'all') {
    // Opening balance is the accumulated closing balance of all sheets prior to ledgerMonthId
    banksToInclude.forEach(bank => {
      (bank.sheets || []).forEach(sheet => {
        if (sheet.monthId && String(sheet.monthId) < String(ledgerMonthId)) {
          (sheet.records || []).forEach(r => {
            openingBalance += (parseFloat(r.amount) || 0);
          });
          (sheet.debitRecords || []).forEach(r => {
            openingBalance -= (parseFloat(r.amount) || 0);
          });
        }
      });
    });
    // Adjustments prior to selected month
    appAdjustments.forEach(adj => {
      if (banksToInclude.some(b => b.id === adj.bankId) && adj.date) {
        const adjMonth = parseDateToMonthId(adj.date);
        if (adjMonth && adjMonth < ledgerMonthId) {
          const amt = parseFloat(adj.amount) || 0;
          if (adj.debitOrCredit === 'credit') openingBalance += amt;
          else openingBalance -= amt;
        }
      }
    });
  }
  openingBalance = Math.round(openingBalance * 100) / 100;

  // 2. Collect All Current Ledger Entries
  const rawEntries = [];

  banksToInclude.forEach(bank => {
    (bank.sheets || []).forEach(sheet => {
      if (ledgerMonthId !== 'all' && sheet.monthId !== ledgerMonthId) return;

      // Inflows (Credits)
      (sheet.records || []).forEach(row => {
        const isMapped = row.status === 'mapped' && row.mapping;
        const custName = isMapped ? (row.mapping.guestName || row.mapping.customer || 'Customer') : (row.payer || 'Bank Inflow');
        const docNo = isMapped ? (row.mapping.invoiceNo || row.mapping.billNo || '—') : '—';
        const docAmt = isMapped ? (parseFloat(row.mapping.invoiceAmount || row.mapping.amount) || row.amount) : null;
        const cat = classifyTransactionCategory(row, false);
        const status = deriveReconciliationStatus(row);
        const ts = parseDateToTimestamp(row.date);

        rawEntries.push({
          id: row.id,
          date: row.date,
          timestamp: ts,
          type: cat,
          particulars: custName,
          docNo: docNo,
          docType: 'invoice',
          docAmount: docAmt,
          bankRef: row.bankRef || row.id || '—',
          inflow: parseFloat(row.amount) || 0,
          outflow: 0,
          status: status,
          bankId: bank.id,
          bankName: bank.name,
          accountNo: bank.accNo,
          narration: row.narration || '',
          sourceFile: sheet.fileName || 'Statement Upload',
          mapping: row.mapping || null,
          rawRow: row,
          isAdjustment: false
        });
      });

      // Outflows (Debits)
      (sheet.debitRecords || []).forEach(row => {
        const isMapped = row.status === 'mapped' && row.mapping;
        const vendorName = isMapped ? (row.mapping.vendorName || row.mapping.payee || 'Vendor') : (row.payer || 'Bank Outflow');
        const docNo = isMapped ? (row.mapping.billNo || row.mapping.invoiceNo || '—') : '—';
        const docAmt = isMapped ? (parseFloat(row.mapping.billAmount || row.mapping.amount) || row.amount) : null;
        const cat = classifyTransactionCategory(row, true);
        const status = deriveReconciliationStatus(row);
        const ts = parseDateToTimestamp(row.date);

        rawEntries.push({
          id: row.id,
          date: row.date,
          timestamp: ts,
          type: cat,
          particulars: vendorName,
          docNo: docNo,
          docType: 'bill',
          docAmount: docAmt,
          bankRef: row.bankRef || row.id || '—',
          inflow: 0,
          outflow: parseFloat(row.amount) || 0,
          status: status,
          bankId: bank.id,
          bankName: bank.name,
          accountNo: bank.accNo,
          narration: row.narration || '',
          sourceFile: sheet.fileName || 'Statement Upload',
          mapping: row.mapping || null,
          rawRow: row,
          isAdjustment: false
        });
      });
    });
  });

  // Adjustments in selected period
  appAdjustments.forEach(adj => {
    if (ledgerBankId !== 'all' && adj.bankId && adj.bankId !== ledgerBankId) return;
    if (ledgerMonthId !== 'all') {
      const adjMonth = parseDateToMonthId(adj.date);
      if (adjMonth && adjMonth !== ledgerMonthId) return;
    }
    const isCredit = adj.debitOrCredit === 'credit';
    const amt = parseFloat(adj.amount) || 0;
    const bank = corporateBanks.find(b => b.id === adj.bankId) || { name: 'Corporate Account', accNo: '••••0000' };

    rawEntries.push({
      id: adj.id,
      date: adj.date,
      timestamp: parseDateToTimestamp(adj.date),
      type: 'ADJUSTMENT',
      particulars: `${adj.adjustmentType}: ${adj.description}`,
      docNo: adj.reference || '—',
      docType: 'adjustment',
      docAmount: amt,
      bankRef: adj.reference || adj.id,
      inflow: isCredit ? amt : 0,
      outflow: !isCredit ? amt : 0,
      status: adj.status || 'Approved',
      bankId: adj.bankId,
      bankName: bank.name,
      accountNo: bank.accNo,
      narration: adj.description || 'General Ledger Adjustment',
      sourceFile: `Journal Adjustment (${adj.createdBy || 'Controller'})`,
      mapping: null,
      rawRow: adj,
      isAdjustment: true
    });
  });

  // 3. Chronological Order for Accurate Accounting Running Balance
  rawEntries.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return String(a.id).localeCompare(String(b.id));
  });

  let running = openingBalance;
  let periodInflow = 0;
  let periodOutflow = 0;
  let countReceipts = 0;
  let countPayments = 0;
  let countAdjustments = 0;
  let countTransfers = 0;

  rawEntries.forEach(entry => {
    periodInflow += entry.inflow;
    periodOutflow += entry.outflow;
    running = Math.round((running + entry.inflow - entry.outflow) * 100) / 100;
    entry.runningBalance = running;

    if (entry.type === 'RECEIPT' || entry.type === 'REFUND') countReceipts++;
    else if (entry.type === 'PAYMENT' || entry.type === 'BANK CHARGE') countPayments++;
    else if (entry.type === 'ADJUSTMENT') countAdjustments++;
    else if (entry.type === 'TRANSFER') countTransfers++;
  });

  periodInflow = Math.round(periodInflow * 100) / 100;
  periodOutflow = Math.round(periodOutflow * 100) / 100;
  const closingBalance = running;
  const netMovement = Math.round((periodInflow - periodOutflow) * 100) / 100;

  // 4. Sub-view Tab and Toolbar Filtering
  const q = (ledgerSearchQuery || '').toLowerCase().trim();
  const dateFromTs = ledgerDateFrom ? new Date(ledgerDateFrom).setHours(0, 0, 0, 0) : null;
  const dateToTs = ledgerDateTo ? new Date(ledgerDateTo).setHours(23, 59, 59, 999) : null;

  let filteredEntries = rawEntries.filter(e => {
    // Filter by Tab
    if (ledgerTab === 'receipts' && e.type !== 'RECEIPT' && e.type !== 'REFUND') return false;
    if (ledgerTab === 'payments' && e.type !== 'PAYMENT' && e.type !== 'BANK CHARGE') return false;
    if (ledgerTab === 'adjustments' && e.type !== 'ADJUSTMENT') return false;
    if (ledgerTab === 'transfers' && e.type !== 'TRANSFER') return false;

    // Filter by Status
    if (ledgerStatusFilter !== 'all') {
      if (e.status.toLowerCase() !== ledgerStatusFilter.toLowerCase()) return false;
    }

    // Filter by Search Query
    if (q) {
      const matchPart = (e.particulars || '').toLowerCase().includes(q);
      const matchDoc = (e.docNo || '').toLowerCase().includes(q);
      const matchRef = (e.bankRef || '').toLowerCase().includes(q);
      const matchNarr = (e.narration || '').toLowerCase().includes(q);
      const matchBank = (e.bankName || '').toLowerCase().includes(q);
      const matchAmt = String(e.inflow || e.outflow || '').includes(q);
      if (!matchPart && !matchDoc && !matchRef && !matchNarr && !matchBank && !matchAmt) return false;
    }

    // Filter by Date Range
    if (dateFromTs && e.timestamp < dateFromTs) return false;
    if (dateToTs && e.timestamp > dateToTs) return false;

    // Filter by Amount Range
    const amt = e.inflow || e.outflow || 0;
    if (ledgerMinAmount !== null && !isNaN(ledgerMinAmount) && amt < ledgerMinAmount) return false;
    if (ledgerMaxAmount !== null && !isNaN(ledgerMaxAmount) && amt > ledgerMaxAmount) return false;

    return true;
  });

  // Display Sort (Newest first by default for convenient browsing, while retaining the exact running balance)
  filteredEntries.sort((a, b) => {
    if (ledgerSortColumn === 'date') {
      return ledgerSortDir === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
    }
    if (ledgerSortColumn === 'amount') {
      const amtA = a.inflow || a.outflow;
      const amtB = b.inflow || b.outflow;
      return ledgerSortDir === 'asc' ? amtA - amtB : amtB - amtA;
    }
    return b.timestamp - a.timestamp;
  });

  return {
    rawCount: rawEntries.length,
    filteredEntries,
    openingBalance,
    totalInflow: periodInflow,
    totalOutflow: periodOutflow,
    closingBalance,
    netMovement,
    countReceipts,
    countPayments,
    countAdjustments,
    countTransfers
  };
}

function calculateAgeInDays(dateStr, timestamp) {
  let ts = timestamp;
  if (!ts && dateStr) ts = parseDateToTimestamp(dateStr);
  if (!ts) return 0;
  const now = Date.now();
  const diffMs = now - ts;
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getAgeingBracket(ageDays) {
  if (ageDays <= 30) return { key: 'current', label: '0-30 Days', class: 'ageing-current' };
  if (ageDays <= 60) return { key: 'due', label: '31-60 Days', class: 'ageing-due' };
  if (ageDays <= 90) return { key: 'overdue', label: '61-90 Days', class: 'ageing-overdue' };
  return { key: 'critical', label: '90+ Days', class: 'ageing-critical' };
}

function getVendorBillReconciliationData(bill) {
  if (!bill || !bill.billNo) {
    return {
      linkedTransactions: [],
      settledAmount: 0,
      balance: 0,
      percent: 0,
      status: 'Unreconciled'
    };
  }

  const targetNo = String(bill.billNo).trim().toLowerCase();
  const linked = [];

  (corporateBanks || []).forEach(bank => {
    (bank.sheets || []).forEach(sheet => {
      (sheet.records || []).forEach(row => {
        if (row.status === 'mapped' && row.mapping) {
          const mappedDoc = String(row.mapping.billNo || row.mapping.invoiceNo || '').trim().toLowerCase();
          if (mappedDoc === targetNo) {
            linked.push({
              bankId: bank.id,
              bankName: bank.name,
              bankAccNo: bank.accNo,
              monthId: sheet.id,
              monthName: sheet.month,
              rowId: row.id,
              date: row.date,
              amount: parseFloat(row.amount) || 0,
              narration: row.narration || '',
              bankRef: row.bankRef || '',
              type: row.type || 'PAYMENT',
              mappedAt: row.mapping.mappedAt || '',
              mappedBy: row.mapping.mappedBy || 'Accounts Controller'
            });
          }
        }
      });
    });
  });

  const billAmount = Math.max(0, parseFloat(bill.amount) || 0);
  const totalSettled = linked.reduce((sum, item) => sum + item.amount, 0);
  const balance = Math.max(0, billAmount - totalSettled);
  const percent = billAmount > 0 ? Math.min(100, Math.round((totalSettled / billAmount) * 100)) : (totalSettled > 0 ? 100 : 0);

  let status = 'Unreconciled';
  if (totalSettled >= billAmount && billAmount > 0) {
    status = 'Paid';
  } else if (totalSettled > 0) {
    status = 'Partial';
  } else if (bill.status && (bill.status === 'Paid' || bill.status === 'Partial' || bill.status === 'Reconciled')) {
    status = bill.status === 'Reconciled' ? 'Paid' : bill.status;
  }

  return {
    linkedTransactions: linked,
    settledAmount: totalSettled,
    balance: balance,
    percent: percent,
    status: status
  };
}

function getVirtualReceivablesData() {
  const q = (ledgerSearchQuery || '').toLowerCase().trim();
  const dateFromTs = ledgerDateFrom ? new Date(ledgerDateFrom).setHours(0, 0, 0, 0) : null;
  const dateToTs = ledgerDateTo ? new Date(ledgerDateTo).setHours(23, 59, 59, 999) : null;

  let totalInvoiced = 0;
  let totalReceived = 0;
  let totalOutstanding = 0;

  const items = appInvoices.map(inv => {
    const recon = getInvoiceReconciliationData(inv);
    const invAmt = parseFloat(inv.amount) || 0;
    const received = recon.settledAmount;
    const outstanding = Math.max(0, invAmt - received);
    const ts = parseDateToTimestamp(inv.date);
    const age = calculateAgeInDays(inv.date, ts);
    const bracket = getAgeingBracket(age);

    totalInvoiced += invAmt;
    totalReceived += received;
    totalOutstanding += outstanding;

    let status = 'Unpaid';
    if (outstanding <= 0.01) status = 'Paid';
    else if (received > 0) status = 'Partial';

    return {
      id: inv.invoiceNo,
      customer: inv.guestName || 'Customer',
      invoiceNo: inv.invoiceNo,
      invoiceDate: inv.date || '—',
      timestamp: ts,
      invoiceAmount: invAmt,
      amountReceived: received,
      outstanding: outstanding,
      dueDate: inv.dueDate || inv.date || '—',
      age: age,
      bracket: bracket,
      status: status,
      raw: inv
    };
  });

  const filtered = items.filter(item => {
    if (ledgerStatusFilter !== 'all') {
      if (item.status.toLowerCase() !== ledgerStatusFilter.toLowerCase()) return false;
    }
    if (q) {
      const matchCust = item.customer.toLowerCase().includes(q);
      const matchNo = item.invoiceNo.toLowerCase().includes(q);
      const matchAmt = String(item.invoiceAmount).includes(q);
      if (!matchCust && !matchNo && !matchAmt) return false;
    }
    if (dateFromTs && item.timestamp < dateFromTs) return false;
    if (dateToTs && item.timestamp > dateToTs) return false;
    if (ledgerMinAmount !== null && !isNaN(ledgerMinAmount) && item.invoiceAmount < ledgerMinAmount) return false;
    if (ledgerMaxAmount !== null && !isNaN(ledgerMaxAmount) && item.invoiceAmount > ledgerMaxAmount) return false;
    return true;
  });

  return {
    items: filtered,
    totalCount: items.length,
    totalInvoiced: Math.round(totalInvoiced * 100) / 100,
    totalReceived: Math.round(totalReceived * 100) / 100,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100
  };
}

function getVirtualPayablesData() {
  const q = (ledgerSearchQuery || '').toLowerCase().trim();
  const dateFromTs = ledgerDateFrom ? new Date(ledgerDateFrom).setHours(0, 0, 0, 0) : null;
  const dateToTs = ledgerDateTo ? new Date(ledgerDateTo).setHours(23, 59, 59, 999) : null;

  let totalBilled = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;

  const items = appVendorBills.map(bill => {
    const recon = getVendorBillReconciliationData(bill);
    const billAmt = parseFloat(bill.amount) || 0;
    const paid = recon.settledAmount;
    const outstanding = Math.max(0, billAmt - paid);
    const ts = parseDateToTimestamp(bill.date);
    const age = calculateAgeInDays(bill.date, ts);
    const bracket = getAgeingBracket(age);

    totalBilled += billAmt;
    totalPaid += paid;
    totalOutstanding += outstanding;

    let status = 'Unpaid';
    if (outstanding <= 0.01) status = 'Paid';
    else if (paid > 0) status = 'Partial';

    return {
      id: bill.billNo,
      supplier: bill.vendorName || 'Supplier',
      billNo: bill.billNo,
      billDate: bill.date || '—',
      timestamp: ts,
      billAmount: billAmt,
      amountPaid: paid,
      outstanding: outstanding,
      dueDate: bill.dueDate || bill.date || '—',
      age: age,
      bracket: bracket,
      status: status,
      raw: bill
    };
  });

  const filtered = items.filter(item => {
    if (ledgerStatusFilter !== 'all') {
      if (item.status.toLowerCase() !== ledgerStatusFilter.toLowerCase()) return false;
    }
    if (q) {
      const matchSup = item.supplier.toLowerCase().includes(q);
      const matchNo = item.billNo.toLowerCase().includes(q);
      const matchAmt = String(item.billAmount).includes(q);
      if (!matchSup && !matchNo && !matchAmt) return false;
    }
    if (dateFromTs && item.timestamp < dateFromTs) return false;
    if (dateToTs && item.timestamp > dateToTs) return false;
    if (ledgerMinAmount !== null && !isNaN(ledgerMinAmount) && item.billAmount < ledgerMinAmount) return false;
    if (ledgerMaxAmount !== null && !isNaN(ledgerMaxAmount) && item.billAmount > ledgerMaxAmount) return false;
    return true;
  });

  return {
    items: filtered,
    totalCount: items.length,
    totalBilled: Math.round(totalBilled * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100
  };
}

function getAllPartiesList() {
  const parties = [];
  const seen = new Set();

  appInvoices.forEach(inv => {
    const name = (inv.guestName || '').trim();
    if (name && !seen.has('cust:' + name.toLowerCase())) {
      seen.add('cust:' + name.toLowerCase());
      parties.push({
        name: name,
        type: 'Customer',
        gstin: inv.rawRow && inv.rawRow.gstin ? inv.rawRow.gstin : (inv.gstin || '')
      });
    }
  });

  appVendorBills.forEach(bill => {
    const name = (bill.vendorName || '').trim();
    if (name && !seen.has('vend:' + name.toLowerCase())) {
      seen.add('vend:' + name.toLowerCase());
      parties.push({
        name: name,
        type: 'Supplier',
        gstin: bill.rawRow && bill.rawRow.gstin ? bill.rawRow.gstin : (bill.gstin || '')
      });
    }
  });

  return parties.sort((a, b) => a.name.localeCompare(b.name));
}

function getPartyLedgerStatement(partyName) {
  if (!partyName) {
    return {
      partyName: '—',
      partyType: 'Customer',
      gstin: '—',
      entries: [],
      totalInvoiced: 0,
      totalSettled: 0,
      netBalance: 0,
      netBalanceDrCr: 'Dr'
    };
  }

  const pLower = partyName.trim().toLowerCase();
  let partyType = 'Customer';
  let gstin = '—';

  // Check customer invoices
  const customerInvoices = appInvoices.filter(inv => (inv.guestName || '').trim().toLowerCase() === pLower);
  // Check supplier bills
  const supplierBills = appVendorBills.filter(bill => (bill.vendorName || '').trim().toLowerCase() === pLower);

  if (supplierBills.length > 0 && customerInvoices.length === 0) {
    partyType = 'Supplier';
  }

  const rawEntries = [];

  // Invoices for customer
  customerInvoices.forEach(inv => {
    if (gstin === '—' && inv.rawRow && inv.rawRow.gstin) gstin = inv.rawRow.gstin;
    else if (gstin === '—' && inv.gstin) gstin = inv.gstin;

    const invAmt = parseFloat(inv.amount) || 0;
    const ts = parseDateToTimestamp(inv.date);
    rawEntries.push({
      date: inv.date || '—',
      timestamp: ts,
      voucherType: 'Sales Invoice',
      refNo: inv.invoiceNo || '—',
      particulars: `To Sales: Inv #${inv.invoiceNo}`,
      narration: inv.guestName || '',
      debit: invAmt,
      credit: 0
    });

    // Check linked bank credits (Receipts from this customer)
    const recon = getInvoiceReconciliationData(inv);
    (recon.linkedTransactions || []).forEach(lt => {
      rawEntries.push({
        date: lt.date || inv.date || '—',
        timestamp: parseDateToTimestamp(lt.date) || (ts + 1000),
        voucherType: 'Bank Receipt',
        refNo: lt.bankRef || lt.rowId || 'UTR',
        particulars: `By Bank Receipt: ${lt.bankName} ${lt.bankAccNo}`,
        narration: lt.narration || `Payment against #${inv.invoiceNo}`,
        debit: 0,
        credit: lt.amount
      });
    });
  });

  // Bills for supplier
  supplierBills.forEach(bill => {
    if (gstin === '—' && bill.rawRow && bill.rawRow.gstin) gstin = bill.rawRow.gstin;
    else if (gstin === '—' && bill.gstin) gstin = bill.gstin;

    const billAmt = parseFloat(bill.amount) || 0;
    const ts = parseDateToTimestamp(bill.date);
    rawEntries.push({
      date: bill.date || '—',
      timestamp: ts,
      voucherType: 'Purchase Bill',
      refNo: bill.billNo || '—',
      particulars: `By Purchase: Bill #${bill.billNo}`,
      narration: bill.vendorName || '',
      debit: 0,
      credit: billAmt
    });

    // Check linked bank debits (Payments to this supplier)
    const recon = getVendorBillReconciliationData(bill);
    (recon.linkedTransactions || []).forEach(lt => {
      rawEntries.push({
        date: lt.date || bill.date || '—',
        timestamp: parseDateToTimestamp(lt.date) || (ts + 1000),
        voucherType: 'Bank Payment',
        refNo: lt.bankRef || lt.rowId || 'UTR',
        particulars: `To Bank Payment: ${lt.bankName} ${lt.bankAccNo}`,
        narration: lt.narration || `Disbursement for #${bill.billNo}`,
        debit: lt.amount,
        credit: 0
      });
    });
  });

  // Check adjustments referencing this party
  (appAdjustments || []).forEach(adj => {
    const desc = (adj.description || '').toLowerCase();
    const ref = (adj.reference || '').toLowerCase();
    if (desc.includes(pLower) || ref.includes(pLower)) {
      const isDr = adj.debitOrCredit === 'debit';
      const amt = parseFloat(adj.amount) || 0;
      rawEntries.push({
        date: adj.date || '—',
        timestamp: parseDateToTimestamp(adj.date) || 0,
        voucherType: `JV: ${adj.adjustmentType}`,
        refNo: adj.reference || 'JV',
        particulars: adj.adjustmentType,
        narration: adj.description,
        debit: isDr ? amt : 0,
        credit: !isDr ? amt : 0
      });
    }
  });

  // Sort entries chronologically
  rawEntries.sort((a, b) => a.timestamp - b.timestamp);

  let running = 0;
  let totalInvoiced = 0;
  let totalSettled = 0;

  const entries = rawEntries.map(e => {
    if (partyType === 'Customer') {
      totalInvoiced += e.debit;
      totalSettled += e.credit;
      running += (e.debit - e.credit);
      const drCr = running >= 0 ? 'Dr' : 'Cr';
      return {
        ...e,
        runningBalance: Math.abs(running),
        drCr: drCr
      };
    } else {
      totalInvoiced += e.credit;
      totalSettled += e.debit;
      running += (e.credit - e.debit);
      const drCr = running >= 0 ? 'Cr' : 'Dr';
      return {
        ...e,
        runningBalance: Math.abs(running),
        drCr: drCr
      };
    }
  });

  const netBalance = Math.abs(running);
  const netBalanceDrCr = partyType === 'Customer' ? (running >= 0 ? 'Dr' : 'Cr') : (running >= 0 ? 'Cr' : 'Dr');

  return {
    partyName,
    partyType,
    gstin,
    entries,
    totalInvoiced: Math.round(totalInvoiced * 100) / 100,
    totalSettled: Math.round(totalSettled * 100) / 100,
    netBalance: Math.round(netBalance * 100) / 100,
    netBalanceDrCr
  };
}

function exportPartyLedgerToExcel(partyName) {
  if (!partyName) {
    if (typeof showCorporateToast === 'function') showCorporateToast('No party selected to export', 'error');
    return;
  }
  const statement = getPartyLedgerStatement(partyName);
  if (!statement || statement.entries.length === 0) {
    if (typeof showCorporateToast === 'function') showCorporateToast(`No transactions found for ${partyName}`, 'error');
    return;
  }

  try {
    if (typeof XLSX === 'undefined') {
      if (typeof showCorporateToast === 'function') showCorporateToast('Excel export library not loaded', 'error');
      return;
    }

    const rows = [
      ['IFIMED PHARMACEUTICALS PRIVATE LIMITED'],
      ['VIRTUAL LEDGER — STATEMENT OF ACCOUNT'],
      ['Party Name:', statement.partyName],
      ['Account Type:', statement.partyType],
      ['GSTIN:', statement.gstin || 'Unspecified'],
      ['Generated At:', new Date().toLocaleString('en-IN')],
      [],
      ['Total Invoiced / Billed (₹):', statement.totalInvoiced],
      ['Total Settled / Paid (₹):', statement.totalSettled],
      ['Net Outstanding Balance (₹):', `${statement.netBalance} ${statement.netBalanceDrCr}`],
      [],
      ['Date', 'Voucher Type', 'Ref / Vch #', 'Particulars', 'Narration', 'Debit (Dr ₹)', 'Credit (Cr ₹)', 'Running Balance (₹)', 'Dr/Cr']
    ];

    statement.entries.forEach(e => {
      rows.push([
        e.date,
        e.voucherType,
        e.refNo,
        e.particulars,
        e.narration || '',
        e.debit > 0 ? e.debit : 0,
        e.credit > 0 ? e.credit : 0,
        e.runningBalance,
        e.drCr
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Party Statement');

    const cleanName = partyName.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `${cleanName}_Statement_IFIMED.xlsx`);
    if (typeof showCorporateToast === 'function') showCorporateToast(`Exported statement for ${partyName}`, 'success');
  } catch (err) {
    console.error('Error exporting party statement:', err);
    if (typeof showCorporateToast === 'function') showCorporateToast('Failed to export statement: ' + err.message, 'error');
  }
}

function getPharmaAgeingData(type = 'receivables') {
  const isDebtor = type === 'receivables';
  const partyMap = new Map();

  let total0_30 = 0;
  let total31_60 = 0;
  let total61_90 = 0;
  let total90Plus = 0;
  let grandTotalDue = 0;
  let grandTotalInvoiced = 0;
  let grandTotalSettled = 0;

  if (isDebtor) {
    // Process Customer Invoices
    appInvoices.forEach(inv => {
      const custName = (inv.guestName || 'Customer').trim();
      const recon = getInvoiceReconciliationData(inv);
      const invAmt = parseFloat(inv.amount) || 0;
      const settled = recon.settledAmount;
      const due = Math.max(0, invAmt - settled);
      const gstin = inv.rawRow && inv.rawRow.gstin ? inv.rawRow.gstin : (inv.gstin || '—');

      const ts = parseDateToTimestamp(inv.date);
      const ageDays = calculateAgeInDays(inv.date, ts);

      grandTotalInvoiced += invAmt;
      grandTotalSettled += settled;
      grandTotalDue += due;

      if (!partyMap.has(custName)) {
        partyMap.set(custName, {
          partyName: custName,
          gstin: gstin,
          type: 'Customer',
          totalInvoiced: 0,
          totalSettled: 0,
          bucket0_30: 0,
          bucket31_60: 0,
          bucket61_90: 0,
          bucket90Plus: 0,
          totalDue: 0
        });
      }

      const p = partyMap.get(custName);
      if (p.gstin === '—' && gstin !== '—') p.gstin = gstin;
      p.totalInvoiced += invAmt;
      p.totalSettled += settled;
      p.totalDue += due;

      if (due > 0) {
        if (ageDays <= 30) {
          p.bucket0_30 += due;
          total0_30 += due;
        } else if (ageDays <= 60) {
          p.bucket31_60 += due;
          total31_60 += due;
        } else if (ageDays <= 90) {
          p.bucket61_90 += due;
          total61_90 += due;
        } else {
          p.bucket90Plus += due;
          total90Plus += due;
        }
      }
    });
  } else {
    // Process Vendor Bills
    appVendorBills.forEach(bill => {
      const supName = (bill.vendorName || 'Supplier').trim();
      const recon = getVendorBillReconciliationData(bill);
      const billAmt = parseFloat(bill.amount) || 0;
      const paid = recon.settledAmount;
      const due = Math.max(0, billAmt - paid);
      const gstin = bill.rawRow && bill.rawRow.gstin ? bill.rawRow.gstin : (bill.gstin || '—');

      const ts = parseDateToTimestamp(bill.date);
      const ageDays = calculateAgeInDays(bill.date, ts);

      grandTotalInvoiced += billAmt;
      grandTotalSettled += paid;
      grandTotalDue += due;

      if (!partyMap.has(supName)) {
        partyMap.set(supName, {
          partyName: supName,
          gstin: gstin,
          type: 'Supplier',
          totalInvoiced: 0,
          totalSettled: 0,
          bucket0_30: 0,
          bucket31_60: 0,
          bucket61_90: 0,
          bucket90Plus: 0,
          totalDue: 0
        });
      }

      const p = partyMap.get(supName);
      if (p.gstin === '—' && gstin !== '—') p.gstin = gstin;
      p.totalInvoiced += billAmt;
      p.totalSettled += paid;
      p.totalDue += due;

      if (due > 0) {
        if (ageDays <= 30) {
          p.bucket0_30 += due;
          total0_30 += due;
        } else if (ageDays <= 60) {
          p.bucket31_60 += due;
          total31_60 += due;
        } else if (ageDays <= 90) {
          p.bucket61_90 += due;
          total61_90 += due;
        } else {
          p.bucket90Plus += due;
          total90Plus += due;
        }
      }
    });
  }

  const parties = Array.from(partyMap.values()).sort((a, b) => b.totalDue - a.totalDue);

  return {
    type,
    parties,
    total0_30: Math.round(total0_30 * 100) / 100,
    total31_60: Math.round(total31_60 * 100) / 100,
    total61_90: Math.round(total61_90 * 100) / 100,
    total90Plus: Math.round(total90Plus * 100) / 100,
    grandTotalDue: Math.round(grandTotalDue * 100) / 100,
    grandTotalInvoiced: Math.round(grandTotalInvoiced * 100) / 100,
    grandTotalSettled: Math.round(grandTotalSettled * 100) / 100
  };
}

function openPartyLedger(partyName) {
  ledgerTab = 'party-ledgers';
  ledgerSelectedParty = partyName;
  renderVirtualLedgerView();
}

function renderVirtualAgeingTable(type) {
  const ageingData = getPharmaAgeingData(type);
  const tbody = document.getElementById('ledgerAgeingTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Update Toggle Button styles
  const btnRec = document.getElementById('ageingToggleReceivablesBtn');
  const btnPay = document.getElementById('ageingTogglePayablesBtn');
  if (btnRec && btnPay) {
    if (type === 'receivables') {
      btnRec.className = 'btn btn-sm btn-primary';
      btnPay.className = 'btn btn-sm btn-outline';
    } else {
      btnRec.className = 'btn btn-sm btn-outline';
      btnPay.className = 'btn btn-sm btn-primary';
    }
  }

  // Update 4 KPI Cards
  const curAmtEl = document.getElementById('ageingBucketCurrentAmt');
  const curSubEl = document.getElementById('ageingBucketCurrentSub');
  const dueAmtEl = document.getElementById('ageingBucketDueAmt');
  const dueSubEl = document.getElementById('ageingBucketDueSub');
  const ovrAmtEl = document.getElementById('ageingBucketOverdueAmt');
  const ovrSubEl = document.getElementById('ageingBucketOverdueSub');
  const critAmtEl = document.getElementById('ageingBucketCriticalAmt');
  const critSubEl = document.getElementById('ageingBucketCriticalSub');

  const totalDue = ageingData.grandTotalDue || 1;
  const pctCur = Math.round((ageingData.total0_30 / totalDue) * 100);
  const pctDue = Math.round((ageingData.total31_60 / totalDue) * 100);
  const pctOvr = Math.round((ageingData.total61_90 / totalDue) * 100);
  const pctCrit = Math.round((ageingData.total90Plus / totalDue) * 100);

  if (curAmtEl) curAmtEl.textContent = formatINR(ageingData.total0_30);
  if (curSubEl) curSubEl.textContent = `${pctCur}% of total due • Normal credit terms`;
  if (dueAmtEl) dueAmtEl.textContent = formatINR(ageingData.total31_60);
  if (dueSubEl) dueSubEl.textContent = `${pctDue}% of total due • Stockist payment due`;
  if (ovrAmtEl) ovrAmtEl.textContent = formatINR(ageingData.total61_90);
  if (ovrSubEl) ovrSubEl.textContent = `${pctOvr}% of total due • Credit hold notice`;
  if (critAmtEl) critAmtEl.textContent = formatINR(ageingData.total90Plus);
  if (critSubEl) critSubEl.textContent = `${pctCrit}% of total due • High default / return risk`;

  if (ageingData.parties.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="10" class="text-center" style="padding: 32px; color: var(--text-muted);">No outstanding accounts for this category.</td>`;
    tbody.appendChild(tr);
    return;
  }

  ageingData.parties.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(p.partyName)}</strong></td>
      <td class="font-mono" style="font-size: 11.5px; color: var(--text-secondary);">${escapeHtml(p.gstin)}</td>
      <td class="text-right font-mono">${formatINR(p.totalInvoiced)}</td>
      <td class="text-right font-mono" style="color: #059669;">${formatINR(p.totalSettled)}</td>
      <td class="text-right font-mono" style="color: #059669;">${p.bucket0_30 > 0 ? formatINR(p.bucket0_30) : '—'}</td>
      <td class="text-right font-mono" style="color: #d97706;">${p.bucket31_60 > 0 ? formatINR(p.bucket31_60) : '—'}</td>
      <td class="text-right font-mono" style="color: #ea580c;">${p.bucket61_90 > 0 ? formatINR(p.bucket61_90) : '—'}</td>
      <td class="text-right font-mono font-bold" style="color: #e11d48;">${p.bucket90Plus > 0 ? formatINR(p.bucket90Plus) : '—'}</td>
      <td class="text-right font-mono font-bold" style="color: ${p.totalDue > 0 ? '#d97706' : '#059669'};">${formatINR(p.totalDue)}</td>
      <td class="text-center">
        <button type="button" class="btn btn-outline btn-sm ageing-khata-btn" style="padding: 2px 7px; font-size: 11px;">
          View Khata
        </button>
      </td>
    `;

    const khataBtn = tr.querySelector('.ageing-khata-btn');
    if (khataBtn) {
      khataBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPartyLedger(p.partyName);
      });
    }

    tbody.appendChild(tr);
  });
}

function renderVirtualPartyLedgerView() {
  const partySelect = document.getElementById('ledgerPartySelect');
  const allParties = getAllPartiesList();

  if (partySelect) {
    partySelect.innerHTML = '';
    if (allParties.length === 0) {
      partySelect.innerHTML = '<option value="">No customer or supplier records found</option>';
    } else {
      const custGroup = document.createElement('optgroup');
      custGroup.label = 'Customers (Debtors / Stockists)';
      const suppGroup = document.createElement('optgroup');
      suppGroup.label = 'Suppliers (Creditors / Vendors)';

      allParties.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = `${p.name} (${p.type})`;
        if (p.name === ledgerSelectedParty) opt.selected = true;

        if (p.type === 'Customer') custGroup.appendChild(opt);
        else suppGroup.appendChild(opt);
      });

      if (custGroup.children.length > 0) partySelect.appendChild(custGroup);
      if (suppGroup.children.length > 0) partySelect.appendChild(suppGroup);

      if (!ledgerSelectedParty && allParties.length > 0) {
        ledgerSelectedParty = allParties[0].name;
        partySelect.value = ledgerSelectedParty;
      }
    }
  }

  if (!ledgerSelectedParty) return;

  const statement = getPartyLedgerStatement(ledgerSelectedParty);

  // Update Header Summary Card
  const nameEl = document.getElementById('partyCardName');
  const typeBadge = document.getElementById('partyCardType');
  const gstinEl = document.getElementById('partyCardGstin');
  const countEl = document.getElementById('partyCardCount');
  const totalBilledEl = document.getElementById('partyCardTotalBilled');
  const totalSettledEl = document.getElementById('partyCardTotalSettled');
  const netBalEl = document.getElementById('partyCardNetBalance');

  if (nameEl) nameEl.textContent = statement.partyName;
  if (typeBadge) {
    typeBadge.textContent = statement.partyType;
    typeBadge.style.background = statement.partyType === 'Customer' ? 'rgba(37, 99, 235, 0.1)' : 'rgba(217, 119, 6, 0.1)';
    typeBadge.style.color = statement.partyType === 'Customer' ? '#2563eb' : '#d97706';
  }
  if (gstinEl) gstinEl.textContent = `GSTIN: ${statement.gstin || 'Unspecified'}`;
  if (countEl) countEl.textContent = `${statement.entries.length} Transactions`;
  if (totalBilledEl) totalBilledEl.textContent = formatINR(statement.totalInvoiced);
  if (totalSettledEl) totalSettledEl.textContent = formatINR(statement.totalSettled);
  if (netBalEl) {
    netBalEl.textContent = `${formatINR(statement.netBalance)} ${statement.netBalanceDrCr}`;
    netBalEl.style.color = statement.netBalance > 0 ? (statement.partyType === 'Customer' ? '#d97706' : '#2563eb') : '#059669';
  }

  // Render Statement Table
  const tbody = document.getElementById('ledgerPartyStatementTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (statement.entries.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="8" class="text-center" style="padding: 32px; color: var(--text-muted);">No transactions recorded for ${escapeHtml(statement.partyName)}.</td>`;
    tbody.appendChild(tr);
    return;
  }

  statement.entries.forEach(entry => {
    const tr = document.createElement('tr');
    const isDr = entry.debit > 0;
    const isCr = entry.credit > 0;

    let vchBadgeClass = 'badge-reconciled';
    if (entry.voucherType.includes('Invoice')) vchBadgeClass = 'badge-receipt';
    else if (entry.voucherType.includes('Bill')) vchBadgeClass = 'badge-payment';
    else if (entry.voucherType.includes('Receipt')) vchBadgeClass = 'badge-green';
    else if (entry.voucherType.includes('Payment')) vchBadgeClass = 'badge-rose';

    tr.innerHTML = `
      <td class="font-mono">${escapeHtml(entry.date)}</td>
      <td><span class="ledger-type-badge ${vchBadgeClass}">${escapeHtml(entry.voucherType)}</span></td>
      <td class="font-mono font-bold">${escapeHtml(entry.refNo)}</td>
      <td>
        <div style="font-weight: 500;">${escapeHtml(entry.particulars)}</div>
        ${entry.narration ? `<div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(entry.narration)}</div>` : ''}
      </td>
      <td class="text-right font-mono" style="color: ${isDr ? '#0f172a' : 'inherit'}; font-weight: ${isDr ? '600' : 'normal'};">${isDr ? formatINR(entry.debit) : '—'}</td>
      <td class="text-right font-mono" style="color: ${isCr ? '#0f172a' : 'inherit'}; font-weight: ${isCr ? '600' : 'normal'};">${isCr ? formatINR(entry.credit) : '—'}</td>
      <td class="text-right font-mono font-bold">${formatINR(entry.runningBalance)}</td>
      <td class="text-center"><span class="badge ${entry.drCr === 'Dr' ? 'badge-amber' : 'badge-green'}" style="font-size: 10.5px; padding: 2px 6px;">${entry.drCr}</span></td>
    `;

    tbody.appendChild(tr);
  });
}

function updateVirtualLedgerBadge() {
  // Can be used if a badge is added to the top navbar
}

function renderVirtualLedgerView() {
  renderVirtualLedgerHeader();

  const ledgerData = getVirtualLedgerData();
  const receivablesData = getVirtualReceivablesData();
  const payablesData = getVirtualPayablesData();

  // 1. Render 5 KPI Cards
  const openBalEl = document.getElementById('ledgerOpeningBalance');
  const inflowEl = document.getElementById('ledgerTotalInflow');
  const inflowSubEl = document.getElementById('ledgerTotalInflowSub');
  const outflowEl = document.getElementById('ledgerTotalOutflow');
  const outflowSubEl = document.getElementById('ledgerTotalOutflowSub');
  const closeBalEl = document.getElementById('ledgerClosingBalance');
  const netMovEl = document.getElementById('ledgerNetMovement');
  const netMovSubEl = document.getElementById('ledgerNetMovementSub');

  if (openBalEl) openBalEl.textContent = formatINR(ledgerData.openingBalance);
  if (inflowEl) inflowEl.textContent = formatINR(ledgerData.totalInflow);
  if (inflowSubEl) inflowSubEl.textContent = `${ledgerData.countReceipts} receipts & credits`;
  if (outflowEl) outflowEl.textContent = formatINR(ledgerData.totalOutflow);
  if (outflowSubEl) outflowSubEl.textContent = `${ledgerData.countPayments} payments & debits`;
  if (closeBalEl) closeBalEl.textContent = formatINR(ledgerData.closingBalance);
  if (netMovEl) {
    const netSign = ledgerData.netMovement > 0 ? '+' : '';
    netMovEl.textContent = `${netSign}${formatINR(ledgerData.netMovement)}`;
    netMovEl.style.color = ledgerData.netMovement >= 0 ? '#059669' : '#be123c';
  }
  if (netMovSubEl) {
    netMovSubEl.textContent = ledgerData.netMovement >= 0 ? 'Net Cash Accumulation' : 'Net Cash Outflow';
  }

  // 2. Render Tab Badges
  const tabAllCount = document.getElementById('ledgerTabAllCount');
  const tabReceiptsCount = document.getElementById('ledgerTabReceiptsCount');
  const tabPaymentsCount = document.getElementById('ledgerTabPaymentsCount');
  const tabAdjustmentsCount = document.getElementById('ledgerTabAdjustmentsCount');
  const tabTransfersCount = document.getElementById('ledgerTabTransfersCount');
  const tabReceivablesCount = document.getElementById('ledgerTabReceivablesCount');
  const tabPayablesCount = document.getElementById('ledgerTabPayablesCount');
  const tabPartyCount = document.getElementById('ledgerTabPartyLedgersCount');
  const tabAgeingCount = document.getElementById('ledgerTabAgeingCount');
  const allParties = getAllPartiesList();

  if (tabAllCount) tabAllCount.textContent = String(ledgerData.rawCount);
  if (tabReceiptsCount) tabReceiptsCount.textContent = String(ledgerData.countReceipts);
  if (tabPaymentsCount) tabPaymentsCount.textContent = String(ledgerData.countPayments);
  if (tabAdjustmentsCount) tabAdjustmentsCount.textContent = String(ledgerData.countAdjustments);
  if (tabTransfersCount) tabTransfersCount.textContent = String(ledgerData.countTransfers);
  if (tabReceivablesCount) tabReceivablesCount.textContent = String(receivablesData.totalCount);
  if (tabPayablesCount) tabPayablesCount.textContent = String(payablesData.totalCount);
  if (tabPartyCount) tabPartyCount.textContent = String(allParties.length);
  if (tabAgeingCount) tabAgeingCount.textContent = String(receivablesData.totalCount + payablesData.totalCount);

  // Update tab active classes
  document.querySelectorAll('.ledger-nav-tab').forEach(tabBtn => {
    tabBtn.classList.toggle('active', tabBtn.dataset.tab === ledgerTab);
  });

  // Toggle "+ Add Adjustment" button visibility
  const addAdjBtn = document.getElementById('ledgerAddAdjustmentBtn');
  if (addAdjBtn) {
    addAdjBtn.style.display = ledgerTab === 'adjustments' ? 'inline-flex' : 'none';
  }

  // 3. Render Respective Table
  const tableContainer = document.getElementById('ledgerTableContainer');
  const recContainer = document.getElementById('ledgerReceivablesContainer');
  const payContainer = document.getElementById('ledgerPayablesContainer');
  const adjContainer = document.getElementById('ledgerAdjustmentsContainer');
  const partyContainer = document.getElementById('ledgerPartyLedgersContainer');
  const ageingContainer = document.getElementById('ledgerAgeingContainer');

  const emptyState = document.getElementById('ledgerEmptyState');
  const recEmptyState = document.getElementById('ledgerReceivablesEmptyState');
  const payEmptyState = document.getElementById('ledgerPayablesEmptyState');
  const adjEmptyState = document.getElementById('ledgerAdjustmentsEmptyState');

  [tableContainer, recContainer, payContainer, adjContainer, partyContainer, ageingContainer, emptyState, recEmptyState, payEmptyState, adjEmptyState].forEach(el => {
    if (el) el.style.display = 'none';
  });

  if (ledgerTab === 'receivables') {
    if (receivablesData.items.length === 0) {
      if (recEmptyState) recEmptyState.style.display = 'flex';
    } else {
      if (recContainer) recContainer.style.display = 'block';
      renderVirtualReceivablesTable(receivablesData.items);
    }
    renderVirtualLedgerFooterInfo(receivablesData.items.length, 'Receivables');
  } else if (ledgerTab === 'payables') {
    if (payablesData.items.length === 0) {
      if (payEmptyState) payEmptyState.style.display = 'flex';
    } else {
      if (payContainer) payContainer.style.display = 'block';
      renderVirtualPayablesTable(payablesData.items);
    }
    renderVirtualLedgerFooterInfo(payablesData.items.length, 'Payables');
  } else if (ledgerTab === 'party-ledgers') {
    if (partyContainer) partyContainer.style.display = 'flex';
    renderVirtualPartyLedgerView();
    renderVirtualLedgerFooterInfo(allParties.length, 'Party Accounts');
  } else if (ledgerTab === 'ageing') {
    if (ageingContainer) ageingContainer.style.display = 'flex';
    renderVirtualAgeingTable(ledgerAgeingType);
    renderVirtualLedgerFooterInfo(receivablesData.items.length + payablesData.items.length, 'Accounts Analyzed');
  } else if (ledgerTab === 'adjustments') {
    const adjItems = ledgerData.filteredEntries.filter(e => e.type === 'ADJUSTMENT');
    if (adjItems.length === 0) {
      if (adjEmptyState) adjEmptyState.style.display = 'flex';
    } else {
      if (adjContainer) adjContainer.style.display = 'block';
      renderVirtualAdjustmentsTable(adjItems);
    }
    renderVirtualLedgerFooterInfo(adjItems.length, 'Adjustments');
  } else {
    // All, Receipts, Payments, Transfers
    if (ledgerData.filteredEntries.length === 0) {
      if (emptyState) {
        emptyState.style.display = 'flex';
        const emptyTitle = document.getElementById('ledgerEmptyTitle');
        const emptyDesc = document.getElementById('ledgerEmptyDesc');
        if (emptyTitle && emptyDesc) {
          if (ledgerData.rawCount === 0) {
            emptyTitle.textContent = 'No reconciled transactions yet.';
            emptyDesc.textContent = 'Transactions will appear here once bank activity has been processed and reconciled.';
          } else {
            emptyTitle.textContent = 'No transactions match filters';
            emptyDesc.textContent = 'Try adjusting your search keywords, status filter, or date range.';
          }
        }
      }
    } else {
      if (tableContainer) tableContainer.style.display = 'block';
      renderVirtualLedgerTable(ledgerData.filteredEntries);
    }
    renderVirtualLedgerFooterInfo(ledgerData.filteredEntries.length, 'Transactions');
  }
}

function renderVirtualLedgerHeader() {
  const activeBank = corporateBanks.find(b => b.id === ledgerBankId);
  const activeBankText = document.getElementById('ledgerActiveBankName');
  if (activeBankText) {
    if (corporateBanks.length === 0) {
      activeBankText.textContent = 'No bank accounts available';
    } else if (ledgerBankId === 'all') {
      activeBankText.textContent = 'All Accounts';
    } else if (activeBank) {
      activeBankText.textContent = `${activeBank.name} ${activeBank.accNo}`;
    }
  }

  const activePeriodText = document.getElementById('ledgerActivePeriodName');
  if (activePeriodText) {
    if (ledgerMonthId === 'all') {
      activePeriodText.textContent = 'All Periods';
    } else {
      activePeriodText.textContent = monthLabelFromId(ledgerMonthId);
    }
  }

  // Populate Bank Options List
  const bankOptionsList = document.getElementById('ledgerBankOptionsList');
  if (bankOptionsList) {
    bankOptionsList.innerHTML = '';
    if (corporateBanks.length === 0) {
      bankOptionsList.innerHTML = '<div style="padding: 12px; font-size: 12px; color: var(--text-muted); text-align: center;">No bank accounts available</div>';
    } else {
      // "All Accounts" option
      const allItem = document.createElement('div');
      allItem.className = `bank-option-item ${ledgerBankId === 'all' ? 'active' : ''}`;
      allItem.innerHTML = `
        <div class="bank-option-info">
          <div class="bank-option-title">All Corporate Accounts</div>
          <div class="bank-option-sub">Consolidated Treasury View (${corporateBanks.length} desks)</div>
        </div>
        <span class="bank-option-badge">${ledgerBankId === 'all' ? 'Active' : 'Select'}</span>
      `;
      allItem.addEventListener('click', () => {
        ledgerBankId = 'all';
        const menu = document.getElementById('ledgerBankDropdownMenu');
        if (menu) menu.style.display = 'none';
        renderVirtualLedgerView();
      });
      bankOptionsList.appendChild(allItem);

      corporateBanks.forEach(b => {
        const isSelected = b.id === ledgerBankId;
        const item = document.createElement('div');
        item.className = `bank-option-item ${isSelected ? 'active' : ''}`;
        item.innerHTML = `
          <div class="bank-option-info">
            <div class="bank-option-title">${escapeHtml(b.name)}</div>
            <div class="bank-option-sub">${escapeHtml(b.type)} · ${escapeHtml(b.accNo)}</div>
          </div>
          <span class="bank-option-badge">${isSelected ? 'Active' : 'Select'}</span>
        `;
        item.addEventListener('click', () => {
          ledgerBankId = b.id;
          const menu = document.getElementById('ledgerBankDropdownMenu');
          if (menu) menu.style.display = 'none';
          renderVirtualLedgerView();
        });
        bankOptionsList.appendChild(item);
      });
    }
  }

  // Populate Period Options List
  const periodOptionsList = document.getElementById('ledgerPeriodOptionsList');
  if (periodOptionsList) {
    periodOptionsList.innerHTML = '';
    // Collect all unique months from statement sheets
    const monthSet = new Set();
    corporateBanks.forEach(b => {
      (b.sheets || []).forEach(s => {
        if (s.monthId) monthSet.add(s.monthId);
      });
    });

    const months = Array.from(monthSet).sort().reverse();

    // "All Periods" option
    const allItem = document.createElement('div');
    allItem.className = `bank-option-item ${ledgerMonthId === 'all' ? 'active' : ''}`;
    allItem.innerHTML = `
      <div class="bank-option-info">
        <div class="bank-option-title">All Periods</div>
        <div class="bank-option-sub">Lifetime Cumulative General Ledger</div>
      </div>
      <span class="bank-option-badge">${ledgerMonthId === 'all' ? 'Active' : 'Select'}</span>
    `;
    allItem.addEventListener('click', () => {
      ledgerMonthId = 'all';
      const menu = document.getElementById('ledgerPeriodDropdownMenu');
      if (menu) menu.style.display = 'none';
      renderVirtualLedgerView();
    });
    periodOptionsList.appendChild(allItem);

    months.forEach(m => {
      const isSelected = m === ledgerMonthId;
      const item = document.createElement('div');
      item.className = `bank-option-item ${isSelected ? 'active' : ''}`;
      item.innerHTML = `
        <div class="bank-option-info">
          <div class="bank-option-title">${escapeHtml(monthLabelFromId(m))}</div>
          <div class="bank-option-sub">${escapeHtml(m)} Statement Cycle</div>
        </div>
        <span class="bank-option-badge">${isSelected ? 'Active' : 'Select'}</span>
      `;
      item.addEventListener('click', () => {
        ledgerMonthId = m;
        const menu = document.getElementById('ledgerPeriodDropdownMenu');
        if (menu) menu.style.display = 'none';
        renderVirtualLedgerView();
      });
      periodOptionsList.appendChild(item);
    });
  }
}

function renderVirtualLedgerTable(entries) {
  const tbody = document.getElementById('ledgerTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const totalPages = Math.ceil(entries.length / ledgerPageSize) || 1;
  if (ledgerCurrentPage > totalPages) ledgerCurrentPage = totalPages;
  if (ledgerCurrentPage < 1) ledgerCurrentPage = 1;

  const startIdx = (ledgerCurrentPage - 1) * ledgerPageSize;
  const pageEntries = entries.slice(startIdx, startIdx + ledgerPageSize);

  pageEntries.forEach(entry => {
    const tr = document.createElement('tr');
    tr.id = `ledger-row-${entry.id}`;

    let typeBadgeClass = 'badge-receipt';
    if (entry.type === 'PAYMENT') typeBadgeClass = 'badge-payment';
    else if (entry.type === 'TRANSFER') typeBadgeClass = 'badge-transfer';
    else if (entry.type === 'BANK CHARGE') typeBadgeClass = 'badge-bank-charge';
    else if (entry.type === 'ADJUSTMENT') typeBadgeClass = 'badge-adjustment';
    else if (entry.type === 'REFUND') typeBadgeClass = 'badge-refund';

    let statusBadgeClass = 'badge-reconciled';
    if (entry.status === 'Pending') statusBadgeClass = 'badge-pending';
    else if (entry.status === 'Matched') statusBadgeClass = 'badge-matched';
    else if (entry.status === 'Exception') statusBadgeClass = 'badge-exception';

    let docHtml = '—';
    if (entry.docNo && entry.docNo !== '—') {
      const isBill = entry.docType === 'bill';
      docHtml = `<span class="ledger-doc-pill ${isBill ? 'doc-pill-bill' : ''}" title="${isBill ? 'Linked Vendor Bill' : 'Linked Customer Invoice'}">${escapeHtml(entry.docNo)}</span>`;
    }

    const inflowText = entry.inflow > 0 ? `<span style="color: #059669; font-weight: 600;" class="font-mono">${formatINR(entry.inflow)}</span>` : '—';
    const outflowText = entry.outflow > 0 ? `<span style="color: #be123c; font-weight: 600;" class="font-mono">${formatINR(entry.outflow)}</span>` : '—';

    tr.innerHTML = `
      <td class="font-mono">${escapeHtml(entry.date)}</td>
      <td><span class="ledger-type-badge ${typeBadgeClass}">${escapeHtml(entry.type)}</span></td>
      <td>
        <div style="font-weight: 600; color: var(--text-primary);">${escapeHtml(entry.particulars)}</div>
        <div style="font-size: 11px; color: var(--text-muted); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(entry.narration)}">${escapeHtml(entry.narration)}</div>
      </td>
      <td>${docHtml}</td>
      <td class="font-mono" style="font-size: 11.5px; color: var(--text-secondary);">${escapeHtml(entry.bankRef)}</td>
      <td class="text-right">${inflowText}</td>
      <td class="text-right">${outflowText}</td>
      <td class="text-right font-mono font-bold" style="color: var(--text-primary);">${formatINR(entry.runningBalance)}</td>
      <td><span class="ledger-status-badge ${statusBadgeClass}">${escapeHtml(entry.status)}</span></td>
      <td class="text-center">
        <button type="button" class="btn btn-outline btn-sm" style="padding: 3px 8px; font-size: 11px;" title="View complete banking and reconciliation evidence">
          View
        </button>
      </td>
    `;

    tr.addEventListener('click', () => {
      openLedgerDetailDrawer(entry);
    });

    tbody.appendChild(tr);
  });
}

function renderVirtualReceivablesTable(items) {
  const tbody = document.getElementById('ledgerReceivablesTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  items.forEach(item => {
    const tr = document.createElement('tr');
    tr.id = `rec-row-${item.id}`;

    let statusPill = `<span class="ledger-status-badge badge-pending">Unpaid</span>`;
    if (item.status === 'Paid') statusPill = `<span class="ledger-status-badge badge-reconciled">Settled</span>`;
    else if (item.status === 'Partial') statusPill = `<span class="ledger-status-badge badge-matched">Partially Paid</span>`;

    const bClass = item.bracket ? item.bracket.class : 'ageing-current';
    const bLabel = item.bracket ? item.bracket.label : '0-30 Days';

    tr.innerHTML = `
      <td><strong>${escapeHtml(item.customer)}</strong></td>
      <td><span class="ledger-doc-pill font-mono">${escapeHtml(item.invoiceNo)}</span></td>
      <td class="font-mono">${escapeHtml(item.invoiceDate)}</td>
      <td class="text-right font-mono">${formatINR(item.invoiceAmount)}</td>
      <td class="text-right font-mono" style="color: #059669;">${formatINR(item.amountReceived)}</td>
      <td class="text-right font-mono font-bold" style="color: ${item.outstanding > 0 ? '#d97706' : '#059669'};">${formatINR(item.outstanding)}</td>
      <td class="text-right font-mono" style="font-size: 11.5px;">${item.age || 0}d</td>
      <td><span class="ageing-badge ${bClass}">${escapeHtml(bLabel)}</span></td>
      <td>${statusPill}</td>
      <td class="text-center">
        <button type="button" class="btn btn-outline btn-sm rec-khata-btn" style="padding: 2px 7px; font-size: 11px;" title="Open customer statement of account">
          Khata
        </button>
      </td>
    `;

    const khataBtn = tr.querySelector('.rec-khata-btn');
    if (khataBtn) {
      khataBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPartyLedger(item.customer);
      });
    }

    tr.addEventListener('click', () => {
      if (typeof openInvoiceDetailsModal === 'function') {
        openInvoiceDetailsModal(item.raw);
      }
    });

    tbody.appendChild(tr);
  });
}

function renderVirtualPayablesTable(items) {
  const tbody = document.getElementById('ledgerPayablesTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  items.forEach(item => {
    const tr = document.createElement('tr');
    tr.id = `pay-row-${item.id}`;

    let statusPill = `<span class="ledger-status-badge badge-pending">Unpaid</span>`;
    if (item.status === 'Paid') statusPill = `<span class="ledger-status-badge badge-reconciled">Paid</span>`;
    else if (item.status === 'Partial') statusPill = `<span class="ledger-status-badge badge-matched">Partially Paid</span>`;

    const bClass = item.bracket ? item.bracket.class : 'ageing-current';
    const bLabel = item.bracket ? item.bracket.label : '0-30 Days';

    tr.innerHTML = `
      <td><strong>${escapeHtml(item.supplier)}</strong></td>
      <td><span class="ledger-doc-pill doc-pill-bill font-mono">${escapeHtml(item.billNo)}</span></td>
      <td class="font-mono">${escapeHtml(item.billDate)}</td>
      <td class="text-right font-mono">${formatINR(item.billAmount)}</td>
      <td class="text-right font-mono" style="color: #be123c;">${formatINR(item.amountPaid)}</td>
      <td class="text-right font-mono font-bold" style="color: ${item.outstanding > 0 ? '#d97706' : '#059669'};">${formatINR(item.outstanding)}</td>
      <td class="text-right font-mono" style="font-size: 11.5px;">${item.age || 0}d</td>
      <td><span class="ageing-badge ${bClass}">${escapeHtml(bLabel)}</span></td>
      <td>${statusPill}</td>
      <td class="text-center">
        <button type="button" class="btn btn-outline btn-sm pay-khata-btn" style="padding: 2px 7px; font-size: 11px;" title="Open supplier statement of account">
          Khata
        </button>
      </td>
    `;

    const khataBtn = tr.querySelector('.pay-khata-btn');
    if (khataBtn) {
      khataBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPartyLedger(item.supplier);
      });
    }

    tbody.appendChild(tr);
  });
}

function renderVirtualAdjustmentsTable(items) {
  const tbody = document.getElementById('ledgerAdjustmentsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  items.forEach(entry => {
    const tr = document.createElement('tr');
    const isCredit = entry.inflow > 0;
    const amt = isCredit ? entry.inflow : entry.outflow;

    tr.innerHTML = `
      <td class="font-mono">${escapeHtml(entry.date)}</td>
      <td><span class="ledger-type-badge badge-adjustment">${escapeHtml(entry.type)}</span></td>
      <td>
        <div style="font-weight: 600;">${escapeHtml(entry.particulars)}</div>
        <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(entry.narration)}</div>
      </td>
      <td class="font-mono" style="font-size: 11.5px;">${escapeHtml(entry.bankRef)}</td>
      <td class="text-right font-mono" style="color: #be123c;">${!isCredit ? formatINR(amt) : '—'}</td>
      <td class="text-right font-mono" style="color: #059669;">${isCredit ? formatINR(amt) : '—'}</td>
      <td class="text-right font-mono font-bold">${formatINR(amt)}</td>
      <td style="font-size: 11.5px;">${escapeHtml(entry.rawRow.createdBy || 'Controller')}</td>
      <td><span class="ledger-status-badge badge-reconciled">${escapeHtml(entry.status)}</span></td>
    `;

    tr.addEventListener('click', () => {
      openLedgerDetailDrawer(entry);
    });

    tbody.appendChild(tr);
  });
}

function renderVirtualLedgerFooterInfo(totalCount, label) {
  const countText = document.getElementById('ledgerVisibleCountText');
  const periodText = document.getElementById('ledgerPeriodFooterText');
  const bankText = document.getElementById('ledgerBankFooterText');

  if (countText) countText.innerHTML = `Showing <strong>${totalCount}</strong> ${escapeHtml(label.toLowerCase())}`;
  if (periodText) periodText.textContent = ledgerMonthId === 'all' ? 'All Periods' : monthLabelFromId(ledgerMonthId);
  if (bankText) {
    const activeBank = corporateBanks.find(b => b.id === ledgerBankId);
    bankText.textContent = ledgerBankId === 'all' ? 'All Accounts' : (activeBank ? `${activeBank.name} ${activeBank.accNo}` : 'Corporate Desk');
  }

  // Update pagination controls
  const totalPages = Math.ceil(totalCount / ledgerPageSize) || 1;
  const pageInfo = document.getElementById('ledgerPageCurrentInfo');
  const prevBtn = document.getElementById('ledgerPrevPageBtn');
  const nextBtn = document.getElementById('ledgerNextPageBtn');

  if (pageInfo) pageInfo.textContent = `Page ${ledgerCurrentPage} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = ledgerCurrentPage <= 1;
  if (nextBtn) nextBtn.disabled = ledgerCurrentPage >= totalPages;
}

// Transaction Detail Drawer Interactions
function openLedgerDetailDrawer(entry) {
  activeDrawerTxn = entry;
  const drawer = document.getElementById('ledgerDetailDrawer');
  if (!drawer) return;

  const isCredit = entry.inflow > 0;
  const amt = isCredit ? entry.inflow : entry.outflow;

  const amtEl = document.getElementById('ledgerDrawerAmount');
  const dirLabel = document.getElementById('ledgerDrawerDirectionLabel');
  const typeBadge = document.getElementById('ledgerDrawerTypeBadge');
  const statusBadge = document.getElementById('ledgerDrawerStatusBadge');

  if (amtEl) {
    amtEl.textContent = `${isCredit ? '+' : '-'} ${formatINR(amt)}`;
    amtEl.style.color = isCredit ? '#059669' : '#be123c';
  }
  if (dirLabel) {
    dirLabel.textContent = isCredit ? 'INCOMING FINANCIAL EVIDENCE (INFLOW)' : 'OUTGOING FINANCIAL DISBURSEMENT (OUTFLOW)';
  }

  let typeBadgeClass = 'badge-receipt';
  if (entry.type === 'PAYMENT') typeBadgeClass = 'badge-payment';
  else if (entry.type === 'TRANSFER') typeBadgeClass = 'badge-transfer';
  else if (entry.type === 'BANK CHARGE') typeBadgeClass = 'badge-bank-charge';
  else if (entry.type === 'ADJUSTMENT') typeBadgeClass = 'badge-adjustment';
  else if (entry.type === 'REFUND') typeBadgeClass = 'badge-refund';

  let statusBadgeClass = 'badge-reconciled';
  if (entry.status === 'Pending') statusBadgeClass = 'badge-pending';
  else if (entry.status === 'Matched') statusBadgeClass = 'badge-matched';
  else if (entry.status === 'Exception') statusBadgeClass = 'badge-exception';

  if (typeBadge) {
    typeBadge.className = `ledger-type-badge ${typeBadgeClass}`;
    typeBadge.textContent = entry.type;
  }
  if (statusBadge) {
    statusBadge.className = `ledger-status-badge ${statusBadgeClass}`;
    statusBadge.textContent = entry.status;
  }

  // Banking Info
  const dateEl = document.getElementById('ledgerDrawerDate');
  const valDateEl = document.getElementById('ledgerDrawerValueDate');
  const bankEl = document.getElementById('ledgerDrawerBank');
  const refEl = document.getElementById('ledgerDrawerBankRef');
  const narrEl = document.getElementById('ledgerDrawerNarration');
  const sourceEl = document.getElementById('ledgerDrawerSourceFile');

  if (dateEl) dateEl.textContent = entry.date || '—';
  if (valDateEl) valDateEl.textContent = entry.rawRow.valueDate || entry.date || '—';
  if (bankEl) bankEl.textContent = `${entry.bankName} (${entry.accountNo})`;
  if (refEl) refEl.textContent = entry.bankRef || '—';
  if (narrEl) narrEl.textContent = entry.narration || 'No bank narration provided.';
  if (sourceEl) sourceEl.textContent = entry.sourceFile || 'Statement Upload';

  // Accounting Linkage
  const docNoEl = document.getElementById('ledgerDrawerDocNo');
  const partyEl = document.getElementById('ledgerDrawerParty');
  const docAmtEl = document.getElementById('ledgerDrawerDocAmount');
  const diffEl = document.getElementById('ledgerDrawerDifference');
  const reconResEl = document.getElementById('ledgerDrawerReconResult');

  if (docNoEl) docNoEl.textContent = entry.docNo || '—';
  if (partyEl) partyEl.textContent = entry.particulars || '—';
  if (docAmtEl) docAmtEl.textContent = entry.docAmount ? formatINR(entry.docAmount) : '—';
  if (diffEl) {
    if (entry.docAmount) {
      const diff = Math.abs(entry.docAmount - amt);
      diffEl.textContent = formatINR(diff);
      diffEl.style.color = diff === 0 ? '#059669' : '#d97706';
    } else {
      diffEl.textContent = '₹ 0';
      diffEl.style.color = 'var(--text-muted)';
    }
  }
  if (reconResEl) {
    if (entry.status === 'Reconciled') {
      reconResEl.innerHTML = `<span style="color: #059669; font-weight: 600;">✓ Explicitly matched with accounting ledger</span>`;
    } else if (entry.status === 'Matched') {
      reconResEl.innerHTML = `<span style="color: var(--ifimed-primary); font-weight: 600;">System Auto-Matched (Pending confirmation)</span>`;
    } else if (entry.status === 'Exception') {
      reconResEl.innerHTML = `<span style="color: var(--ifimed-red); font-weight: 600;">Discrepancy / Exception flagged</span>`;
    } else {
      reconResEl.innerHTML = `<span style="color: #d97706; font-weight: 600;">Pending mapping to invoice or bill</span>`;
    }
  }

  // Audit Timeline (Genuine Events)
  const timelineEl = document.getElementById('ledgerDrawerAuditTimeline');
  if (timelineEl) {
    timelineEl.innerHTML = '';
    const events = [];

    if (entry.mapping) {
      events.push({
        text: `Reconciled with ${entry.docNo} by ${entry.mapping.mappedBy || 'Accounts Controller'}`,
        time: entry.mapping.mappedAt || 'Completed'
      });
    }

    if (entry.isAdjustment) {
      events.push({
        text: `Journal adjustment posted by ${entry.rawRow.createdBy || 'Corporate Controller'}: ${entry.particulars}`,
        time: entry.rawRow.createdAt ? new Date(entry.rawRow.createdAt).toLocaleString('en-GB') : entry.date
      });
    }

    // Matching recent activities
    const refUpper = String(entry.bankRef || '').toUpperCase();
    const docUpper = String(entry.docNo || '').toUpperCase();
    recentActivities.forEach(act => {
      const txt = typeof act === 'string' ? act : (act.text || '');
      if ((refUpper && txt.toUpperCase().includes(refUpper)) || (docUpper && docUpper !== '—' && txt.toUpperCase().includes(docUpper))) {
        events.push({
          text: txt,
          time: act.meta || act.time || 'Logged'
        });
      }
    });

    if (events.length === 0) {
      timelineEl.innerHTML = `<div class="timeline-empty-msg">No audit activity recorded.</div>`;
    } else {
      events.forEach(evt => {
        const item = document.createElement('div');
        item.className = 'timeline-event-item';
        item.innerHTML = `
          <div class="timeline-dot"></div>
          <div>
            <div style="font-weight: 500; color: var(--text-primary);">${escapeHtml(evt.text)}</div>
            <div class="timeline-meta">${escapeHtml(evt.time)}</div>
          </div>
        `;
        timelineEl.appendChild(item);
      });
    }
  }

  drawer.style.display = 'flex';
}

function closeLedgerDetailDrawer() {
  activeDrawerTxn = null;
  const drawer = document.getElementById('ledgerDetailDrawer');
  if (drawer) drawer.style.display = 'none';
}

// Add Adjustment Modal Handlers
function openAddAdjustmentModal() {
  const modal = document.getElementById('addAdjustmentModal');
  const bankSelect = document.getElementById('adjBankSelect');
  const dateInput = document.getElementById('adjDate');
  const form = document.getElementById('addAdjustmentForm');

  if (form) form.reset();

  if (bankSelect) {
    bankSelect.innerHTML = '';
    corporateBanks.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.name} (${b.accNo})`;
      if (b.id === selectedBankId || b.id === ledgerBankId) opt.selected = true;
      bankSelect.appendChild(opt);
    });
  }

  if (dateInput) {
    const today = new Date().toISOString().slice(0, 10);
    dateInput.value = today;
  }

  if (modal) modal.style.display = 'flex';
}

function closeAddAdjustmentModal() {
  const modal = document.getElementById('addAdjustmentModal');
  if (modal) modal.style.display = 'none';
}

async function handleAdjustmentSubmit(e) {
  e.preventDefault();
  const bankId = document.getElementById('adjBankSelect').value;
  const dateStr = document.getElementById('adjDate').value;
  const type = document.getElementById('adjType').value;
  const debitOrCredit = document.querySelector('input[name="adjDebitOrCredit"]:checked').value;
  const amount = parseFloat(document.getElementById('adjAmount').value) || 0;
  const reference = document.getElementById('adjReference').value.trim();
  const description = document.getElementById('adjDescription').value.trim();

  if (!bankId || !dateStr || !type || amount <= 0 || !description) {
    showToast('Please provide bank, date, amount (> 0), and description reason', 'amber');
    return;
  }

  const createdBy = currentAuthUser ? (currentAuthUser.user_metadata?.name || currentAuthUser.email) : 'IFIMED Treasury Controller';
  const newAdj = {
    id: `ADJ-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    bankId: bankId,
    date: dateStr,
    adjustmentType: type,
    description: description,
    reference: reference || `ADJ-${Date.now().toString().slice(-4)}`,
    debitOrCredit: debitOrCredit,
    amount: Math.round(amount * 100) / 100,
    createdBy: createdBy,
    status: 'Approved',
    createdAt: new Date().toISOString()
  };

  appAdjustments.unshift(newAdj);

  recentActivities.unshift({
    text: `Adjustment posted: ${type} of ₹ ${amount.toLocaleString('en-IN')} (${debitOrCredit.toUpperCase()})`,
    meta: `Audit Trail · Just now`
  });

  closeAddAdjustmentModal();
  renderVirtualLedgerView();
  await persistToSupabase();
  showToast(`Adjustment of ₹ ${amount.toLocaleString('en-IN')} posted to General Ledger!`, 'success');
}

// Export Virtual Ledger
function exportVirtualLedger(format) {
  const ledgerData = getVirtualLedgerData();
  const activeBank = corporateBanks.find(b => b.id === ledgerBankId);
  const bankName = ledgerBankId === 'all' ? 'All_Accounts' : (activeBank ? activeBank.name.replace(/\s+/g, '_') : 'Corporate_Bank');
  const periodLabel = ledgerMonthId === 'all' ? 'All_Periods' : ledgerMonthId;

  if (format === 'excel') {
    if (typeof XLSX === 'undefined') {
      showToast('SheetJS Excel library is loading. Please try again.', 'amber');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Reconciled Transactions Ledger
    const headers = [
      ['IFIMED PHARMACEUTICALS PVT. LTD. — RECONCILED VIRTUAL LEDGER'],
      [`Bank Account: ${ledgerBankId === 'all' ? 'All Corporate Desks' : (activeBank ? `${activeBank.name} (${activeBank.accNo})` : '')}`],
      [`Period: ${ledgerMonthId === 'all' ? 'All Periods' : monthLabelFromId(ledgerMonthId)}`],
      [`Opening Balance: ₹ ${ledgerData.openingBalance.toLocaleString('en-IN')}`, `Total Inflow: ₹ ${ledgerData.totalInflow.toLocaleString('en-IN')}`, `Total Outflow: ₹ ${ledgerData.totalOutflow.toLocaleString('en-IN')}`, `Closing Balance: ₹ ${ledgerData.closingBalance.toLocaleString('en-IN')}`],
      [],
      ['Date', 'Type', 'Particulars', 'Linked Document', 'Bank Reference', 'Inflow (₹)', 'Outflow (₹)', 'Running Balance (₹)', 'Status', 'Narration']
    ];

    const rows = ledgerData.filteredEntries.map(e => [
      e.date,
      e.type,
      e.particulars,
      e.docNo,
      e.bankRef,
      e.inflow || '',
      e.outflow || '',
      e.runningBalance,
      e.status,
      e.narration
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Virtual Ledger');

    // Sheet 2: Receivables
    const recData = getVirtualReceivablesData();
    const recRows = [
      ['CUSTOMER RECEIVABLES REGISTER'],
      ['Total Invoiced: ₹ ' + recData.totalInvoiced.toLocaleString('en-IN'), 'Total Received: ₹ ' + recData.totalReceived.toLocaleString('en-IN'), 'Outstanding: ₹ ' + recData.totalOutstanding.toLocaleString('en-IN')],
      [],
      ['Customer', 'Invoice #', 'Invoice Date', 'Invoice Amount (₹)', 'Amount Received (₹)', 'Outstanding (₹)', 'Due Date', 'Status'],
      ...recData.items.map(r => [
        r.customer,
        r.invoiceNo,
        r.invoiceDate,
        r.invoiceAmount,
        r.amountReceived,
        r.outstanding,
        r.dueDate,
        r.status
      ])
    ];
    const wsRec = XLSX.utils.aoa_to_sheet(recRows);
    XLSX.utils.book_append_sheet(wb, wsRec, 'Receivables');

    // Sheet 3: Payables
    const payData = getVirtualPayablesData();
    const payRows = [
      ['VENDOR PAYABLES REGISTER'],
      ['Total Billed: ₹ ' + payData.totalBilled.toLocaleString('en-IN'), 'Total Paid: ₹ ' + payData.totalPaid.toLocaleString('en-IN'), 'Outstanding: ₹ ' + payData.totalOutstanding.toLocaleString('en-IN')],
      [],
      ['Supplier', 'Bill #', 'Bill Date', 'Bill Amount (₹)', 'Amount Paid (₹)', 'Outstanding (₹)', 'Due Date', 'Status'],
      ...payData.items.map(p => [
        p.supplier,
        p.billNo,
        p.billDate,
        p.billAmount,
        p.amountPaid,
        p.outstanding,
        p.dueDate,
        p.status
      ])
    ];
    const wsPay = XLSX.utils.aoa_to_sheet(payRows);
    XLSX.utils.book_append_sheet(wb, wsPay, 'Payables');

    const fileName = `IFIMED_Virtual_Ledger_${bankName}_${periodLabel}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast(`Exported Virtual Ledger to ${fileName}!`, 'success');
  } else if (format === 'pdf') {
    window.print();
  }
}

function renderVendorBillsCatalogModal() {
  if (!catalogBillsTableBody) return;
  catalogBillsTableBody.innerHTML = '';

  const q = (billCatalogSearch ? billCatalogSearch.value : '').toLowerCase().trim();
  const filtered = appVendorBills.filter(bill => {
    if (!q) return true;
    return bill.billNo.toLowerCase().includes(q) ||
           bill.vendorName.toLowerCase().includes(q) ||
           (bill.gstin && bill.gstin.toLowerCase().includes(q)) ||
           (bill.category && bill.category.toLowerCase().includes(q));
  });

  if (filtered.length === 0) {
    catalogBillsTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 32px 16px; color: var(--text-tertiary); font-size: 13px;">
          No vendor bills in catalog. Add a vendor bill manually or upload a CSV.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(bill => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong class="font-mono text-debit">${escapeHtml(bill.billNo)}</strong></td>
      <td>
        <div style="font-weight: 500;">${escapeHtml(bill.vendorName)}</div>
        ${bill.gstin ? `<div style="font-size: 11px; color: var(--text-tertiary); font-family: var(--font-mono);">GSTIN: ${escapeHtml(bill.gstin)}</div>` : ''}
      </td>
      <td class="font-bold text-debit">${formatINR(bill.amount)}</td>
      <td>${escapeHtml(bill.date || '—')}</td>
      <td><span class="status-pill status-pill-noted" style="font-size: 11px;">${escapeHtml(bill.category || 'Claim Voucher')}</span></td>
    `;
    catalogBillsTableBody.appendChild(tr);
  });
}

async function processVendorBillCsv(csvText) {
  if (!csvText || !csvText.trim()) {
    showToast('The uploaded vendor bills file appears to be empty.', 'amber');
    return;
  }
  if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);

  const delimiter = detectCsvDelimiter(csvText);
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    showToast('CSV file is empty or missing data rows', 'amber');
    return;
  }

  // Column header auto-discovery
  let headerIndex = -1;
  let billNoCol = -1, vendorCol = -1, amtCol = -1, dateCol = -1, catCol = -1;

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    if (isSummaryOrFooterLine(lines[i])) continue;
    const rawCols = parseCsvLine(lines[i], delimiter).map(c => c.trim().toLowerCase().replace(/[_\-\/\.\(\)\s]+/g, ' '));
    const bIdx = rawCols.findIndex(c => c === 'bill no' || c === 'bill' || c === 'voucher no' || c === 'vch no' || c === 'inv no' || c.includes('bill') || c.includes('voucher'));
    const vIdx = rawCols.findIndex(c => c === 'vendor' || c === 'supplier' || c === 'party' || c === 'party name' || c === 'payee' || c === 'particulars' || c.includes('vendor') || c.includes('supplier') || c.includes('party'));
    const aIdx = rawCols.findIndex(c => c === 'amount' || c === 'amt' || c === 'total' || c === 'net total' || c === 'gross total' || c === 'net amount' || c.includes('amount') || c.includes('total'));
    const dIdx = rawCols.findIndex(c => c === 'date' || c === 'dt' || c === 'bill date' || c === 'vch date' || c.includes('date'));
    const kIdx = rawCols.findIndex(c => c === 'category' || c === 'type' || c === 'vch type' || c === 'voucher type' || c.includes('category') || c.includes('type'));

    if (bIdx !== -1 || (vIdx !== -1 && aIdx !== -1) || (dIdx !== -1 && aIdx !== -1)) {
      headerIndex = i;
      billNoCol = bIdx;
      vendorCol = vIdx;
      amtCol = aIdx;
      dateCol = dIdx;
      catCol = kIdx;
      break;
    }
  }

  const startLine = headerIndex >= 0 ? headerIndex + 1 : 1;
  let added = 0;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    if (isSummaryOrFooterLine(line)) continue;

    const cols = parseCsvLine(line, delimiter);
    if (cols.length < 2) continue;

    const billNo = (billNoCol >= 0 && cols[billNoCol]) ? cols[billNoCol].trim() : (cols[0] || `BILL-${Date.now()}-${i}`);
    const vendor = (vendorCol >= 0 && cols[vendorCol]) ? cols[vendorCol].trim() : (cols[1] || 'Pharma Vendor');
    let amount = parseAmount(amtCol >= 0 ? cols[amtCol] : '');
    const date = (dateCol >= 0 && cols[dateCol]) ? cols[dateCol].trim() : (cols.find(c => isValidTransactionDate(c)) || '18 Sep 2026');
    const category = (catCol >= 0 && cols[catCol]) ? cols[catCol].trim() : (cols[4] || 'Operating Expense');

    if (!isPlausibleMoneyAmount(amount) || amountLooksLikeDateDigits(amount, date) || isDateLikeValue(amtCol >= 0 ? cols[amtCol] : '')) {
      amount = findPlausibleAmountInRow(cols, [dateCol, billNoCol, vendorCol]);
    }
    if (!isPlausibleMoneyAmount(amount) || amountLooksLikeDateDigits(amount, date)) continue;
    if (isDateLikeValue(billNo) || /^\d{1,3}$/.test(billNo)) continue;

    if (!appVendorBills.some(b => b.billNo.toLowerCase() === billNo.toLowerCase())) {
      appVendorBills.unshift({
        billNo,
        vendorName: vendor,
        amount,
        date,
        category,
        status: 'Unpaid',
        settledAmount: 0
      });
      added++;
    }
  }

  renderAll(false);
  await persistToSupabase();
  showToast(`Imported ${added} vendor bills from CSV & stored in Supabase DB!`, added > 0 ? 'success' : 'amber');
}

// =============================================================================
// 10. Dashboard & Audit Trail Renderers
// =============================================================================

function renderDashboardView() {
  const dashInflowEl = document.getElementById('dashCorporateInflow');
  const dashInflowSubEl = document.getElementById('dashCorporateInflowSub');
  const dashReconRateEl = document.getElementById('dashReconRate');
  const dashReconRateSubEl = document.getElementById('dashReconRateSub');
  const dashInvoicesCountEl = document.getElementById('dashTotalInvoicesCount');

  let allBanksInflow = 0;
  let totalAllCredits = 0;
  let totalMappedCredits = 0;

  corporateBanks.forEach(b => {
    (b.sheets || []).forEach(s => {
      (s.records || []).forEach(r => {
        allBanksInflow += (r.amount || 0);
        totalAllCredits++;
        if (r.status === 'mapped') {
          totalMappedCredits++;
        }
      });
    });
  });

  if (dashInflowEl) dashInflowEl.textContent = formatINR(allBanksInflow);
  if (dashInflowSubEl) dashInflowSubEl.textContent = `Across ${corporateBanks.length} corporate bank desk${corporateBanks.length !== 1 ? 's' : ''}`;
  const ratePct = totalAllCredits > 0 ? ((totalMappedCredits / totalAllCredits) * 100).toFixed(1) : '0.0';
  if (dashReconRateEl) dashReconRateEl.textContent = `${ratePct}%`;
  if (dashReconRateSubEl) dashReconRateSubEl.textContent = `${totalMappedCredits} of ${totalAllCredits} transactions linked`;

  if (dashInvoicesCountEl) dashInvoicesCountEl.textContent = `${appInvoices.length} Invoices`;

  const dashBankList = document.getElementById('dashboardBankList');
  if (dashBankList) {
    dashBankList.innerHTML = '';
    const canDelete = corporateBanks.length > 1;

    corporateBanks.forEach(b => {
      const isSelected = b.id === selectedBankId;
      const activeSheet = (b.sheets && b.sheets[0]) ? b.sheets[0] : { records: [], debitRecords: [] };
      const totalInflow = (activeSheet.records || []).reduce((acc, r) => acc + (r.amount || 0), 0);
      const totalOutflow = (activeSheet.debitRecords || []).reduce((acc, r) => acc + (r.amount || 0), 0);
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
        <div class="bank-dashboard-row-right">
          <div style="text-align: right;">
            <div style="font-weight: 700; font-size: 14px;">In: ${formatINR(totalInflow)} <span class="text-debit" style="font-size: 12px; font-weight: 600;">| Out: ${formatINR(totalOutflow)}</span></div>
            <div class="text-credit" style="font-size: 11px; font-weight: 600;">${pct}% Credits Reconciled (${mappedCredits}/${totalCredits})</div>
          </div>
          <div class="bank-dash-actions">
            <button type="button" class="btn btn-outline btn-sm bank-dash-switch-btn" title="Switch to ${escapeHtml(b.name)}">
              ${isSelected ? 'Active' : 'Switch'}
            </button>
            <button type="button" class="bank-dash-delete-btn ${canDelete ? '' : 'disabled'}" title="${canDelete ? `Delete ${escapeHtml(b.name)} account` : 'Cannot delete sole remaining bank account'}" aria-label="Delete ${escapeHtml(b.name)}" ${canDelete ? '' : 'disabled'}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `;

      const switchBtn = row.querySelector('.bank-dash-switch-btn');
      if (switchBtn) {
        switchBtn.addEventListener('click', () => {
          switchBank(b.id);
          switchView('bank-statements');
        });
      }

      const dashDelBtn = row.querySelector('.bank-dash-delete-btn');
      if (dashDelBtn && canDelete) {
        dashDelBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          promptDeleteBank(b.id, e);
        });
      }

      dashBankList.appendChild(row);
    });
  }

  const dashFeed = document.getElementById('dashboardActivityFeed');
  if (dashFeed) {
    dashFeed.innerHTML = '';
    if (recentActivities.length === 0) {
      dashFeed.innerHTML = `
        <div style="text-align: center; padding: 24px 12px; color: var(--text-tertiary); font-size: 13px;">
          No recent reconciliation activity recorded.
        </div>
      `;
    } else {
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
    { title: 'View Virtual Ledger', desc: 'Inspect reconciled transactions, running balances & accounting ledger', action: () => switchView('virtual-ledger') },
    { title: 'Post Accounting Adjustment', desc: 'Create auditable journal adjustment affecting General Ledger', action: () => { switchView('virtual-ledger'); openAddAdjustmentModal(); } },
    { title: 'View Customer Invoices Desk', desc: 'Jump to sales invoices register & reconciliation settlement tracking', action: () => switchView('invoices') },
    { title: 'View Financial Dashboard', desc: 'Jump to executive analytics', action: () => switchView('dashboard') },
    { title: 'Add Invoice Manually', desc: 'Create new pending customer sales invoice', action: () => openAddInvoiceModal() },
    { title: 'Add Vendor Bill Manually', desc: 'Create new pending supplier purchase bill', action: () => { if (openAddBillModalBtn) openAddBillModalBtn.click(); } },
    { title: 'View Invoices Catalog', desc: 'Inspect available customer invoice records', action: () => switchView('invoices') },
    { title: 'View Vendor Bills Catalog', desc: 'Inspect available vendor bills & expenses', action: () => { if (viewBillsBtn) viewBillsBtn.click(); } }
  ];

  corporateBanks.forEach(b => {
    actions.push({
      title: `Switch Bank: ${b.name}`,
      desc: `${b.type} · ${b.accNo}`,
      action: () => switchBank(b.id)
    });
    if (corporateBanks.length > 1) {
      actions.push({
        title: `Delete Bank: ${b.name}`,
        desc: `Remove ${b.type} · ${b.accNo} from workspace`,
        action: () => promptDeleteBank(b.id)
      });
    }
  });

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

function getTrendMonths() {
  const ids = new Set();
  corporateBanks.forEach(b => {
    (b.sheets || []).forEach(s => { if (s && s.monthId) ids.add(s.monthId); });
  });
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    ids.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return [...ids].sort().slice(-6).map(id => {
    const [y, m] = id.split('-');
    const name = MONTH_NAMES_LONG[Math.max(0, parseInt(m, 10) - 1)] || 'Month';
    return { monthId: id, label: `${name} ${y}`, shortName: name.slice(0, 3) };
  });
}

function renderCreditTrendChart() {
  if (!miniBarChart) return;
  miniBarChart.innerHTML = '';

  const bank = getActiveBank();
  const isDebit = activeMappingMode === 'debit';
  const isAll = activeMappingMode === 'all';

  // Compute live monthly volumes for active bank and active mode (no synthetic dummy values)
  const data = getTrendMonths().map(m => {
    const sheet = (bank && bank.sheets) ? bank.sheets.find(s => s.monthId === m.monthId) : null;
    let total = 0;
    let count = 0;
    if (sheet) {
      if (isAll) {
        const crRecords = sheet.records || [];
        const drRecords = sheet.debitRecords || [];
        const crTotal = crRecords.reduce((acc, r) => acc + (r.amount || 0), 0);
        const drTotal = drRecords.reduce((acc, r) => acc + (r.amount || 0), 0);
        total = crTotal + drTotal;
        count = crRecords.length + drRecords.length;
      } else if (isDebit) {
        const records = sheet.debitRecords || [];
        total = records.reduce((acc, r) => acc + (r.amount || 0), 0);
        count = records.length;
      } else {
        const records = sheet.records || [];
        total = records.reduce((acc, r) => acc + (r.amount || 0), 0);
        count = records.length;
      }
    }
    return {
      ...m,
      total,
      count
    };
  });

  const maxTotal = Math.max(...data.map(d => d.total), 0);

  if (maxTotal <= 0) {
    const empty = document.createElement('p');
    empty.className = 'chart-empty-state';
    empty.setAttribute('role', 'status');
    empty.textContent = 'No data available for this period';
    miniBarChart.appendChild(empty);
    return;
  }

  data.forEach(d => {
    const isCurrent = d.monthId === selectedMonthId;
    const heightPct = maxTotal > 0 ? Math.max(8, Math.round((d.total / maxTotal) * 95)) : 8;

    const col = document.createElement('div');
    col.className = `chart-col ${isCurrent ? 'active' : ''}`;
    const flowLabel = isAll ? 'Total Flow' : (isDebit ? 'Debits' : 'Credits');
    col.title = `${d.label} (${flowLabel}): ${formatINR(d.total)} (${d.count} transactions)`;

    col.innerHTML = `
      <div class="chart-bar ${isCurrent ? 'bar-active' : ''} ${isDebit ? 'bar-debit' : (isAll ? 'bar-all' : '')}" style="height: ${heightPct}%;"></div>
      <span class="chart-label ${isCurrent ? 'label-active' : ''}">${d.shortName}</span>
    `;

    col.addEventListener('click', () => {
      const sheet = (bank && bank.sheets) ? bank.sheets.find(s => s.monthId === d.monthId) : null;
      if (sheet) {
        selectedMonthId = d.monthId;
        activeConfirmingRowId = null;
        renderAll();
        showToast(`Switched to ${d.label} statement (${formatINR(d.total)})`);
      } else {
        showToast(`No statement uploaded for ${d.label}. Upload a CSV to add transactions.`, 'info');
      }
    });

    miniBarChart.appendChild(col);
  });
}

// =============================================================================
// Supabase Cloud Database Persistence & Live Synchronization
// =============================================================================
let isSupabaseSyncing = false;
let lastSupabaseSyncTime = null;
let supabaseSyncDebounceTimer = null;
let isInitialSupabaseLoadDone = false;

function updateSupabaseSyncBadge(status, text) {
  const dot = document.getElementById('supabaseDbDot');
  const badgeText = document.getElementById('supabaseDbSyncText');
  if (dot) {
    if (status === 'syncing') {
      dot.className = 'supabase-db-dot syncing';
    } else if (status === 'synced') {
      dot.className = 'supabase-db-dot';
      dot.style.background = '#10b981';
      dot.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.25)';
    } else if (status === 'error') {
      dot.className = 'supabase-db-dot';
      dot.style.background = '#ef4444';
      dot.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.25)';
    }
  }
  if (badgeText && text) {
    badgeText.textContent = text;
  }
}

function buildSupabaseBankRows() {
  return corporateBanks.map(b => ({
    id: b.id,
    name: b.name || 'Bank',
    type: b.type || 'Current A/c',
    acc_no: b.accNo || '',
    full_acc_no: b.fullAccNo || null,
    ifsc: b.ifsc || null,
    branch: b.branch || null,
    sheets: b.sheets || [],
    updated_at: new Date().toISOString()
  }));
}

function buildSupabaseTxnRowsFromBanks(banks) {
  const txnRows = [];
  (banks || []).forEach(b => {
    (b.sheets || []).forEach(s => {
      (s.records || []).forEach(r => {
        if (!r || !r.id) return;
        txnRows.push({
          id: r.id,
          bank_id: b.id,
          month_id: s.monthId,
          transaction_date: r.date || '',
          narration: r.narration || 'Bank Inflow',
          payer: r.payer || null,
          bank_ref: r.bankRef || r.id,
          type: r.type || 'TRANSFER',
          transaction_type: 'credit',
          amount: parseFloat(r.amount) || 0,
          status: r.status || 'unmapped',
          mapping: r.mapping || null
        });
      });
      (s.debitRecords || []).forEach(r => {
        if (!r || !r.id) return;
        txnRows.push({
          id: r.id,
          bank_id: b.id,
          month_id: s.monthId,
          transaction_date: r.date || '',
          narration: r.narration || 'Bank Outflow',
          payer: r.payer || null,
          bank_ref: r.bankRef || r.id,
          type: r.type || 'TRANSFER',
          transaction_type: 'debit',
          amount: parseFloat(r.amount) || 0,
          status: r.status || 'unmapped',
          mapping: r.mapping || null
        });
      });
    });
  });
  return txnRows;
}

function buildSupabaseTxnRows() {
  return buildSupabaseTxnRowsFromBanks(corporateBanks);
}

async function persistViaSupabaseClient(deletions = pendingDeletedSheets) {
  const client = getSupabaseClient();
  if (!client) return false;

  for (const del of deletions) {
    await deleteSheetViaSupabaseClient(del);
  }

  const { error: bankErr } = await client.from('corporate_banks').upsert(buildSupabaseBankRows(), { onConflict: 'id' });
  if (bankErr) throw bankErr;

  const txnRows = buildSupabaseTxnRows();
  if (txnRows.length > 0) {
    const { error: txnErr } = await client.from('bank_transactions').upsert(txnRows, { onConflict: 'id' });
    if (txnErr) throw txnErr;
  }

  if (appInvoices.length > 0) {
    await client.from('invoices').upsert(appInvoices.map(inv => ({
      id: inv.id || inv.invoiceNo,
      invoice_no: inv.invoiceNo,
      guest_name: inv.guestName || inv.customer || 'Customer',
      amount: parseFloat(inv.amount) || 0,
      date: inv.date || '',
      status: inv.status || 'Unpaid',
      settled_amount: parseFloat(inv.settledAmount) || 0
    })), { onConflict: 'id' });
  }
  if (appVendorBills.length > 0) {
    await client.from('vendor_bills').upsert(appVendorBills.map(b => ({
      id: b.id || b.billNo,
      bill_no: b.billNo,
      vendor_name: b.vendorName || b.vendor || 'Vendor',
      amount: parseFloat(b.amount) || 0,
      date: b.date || '',
      status: b.status || 'Unpaid',
      settled_amount: parseFloat(b.settledAmount) || 0
    })), { onConflict: 'id' });
  }
  if (appAdjustments.length > 0) {
    try {
      await client.from('adjustments').upsert(appAdjustments.map(adj => ({
        id: adj.id,
        bank_id: adj.bankId,
        date: adj.date,
        adjustment_type: adj.adjustmentType,
        description: adj.description,
        reference: adj.reference,
        debit_or_credit: adj.debitOrCredit,
        amount: parseFloat(adj.amount) || 0,
        created_by: adj.createdBy,
        status: adj.status || 'Approved',
        created_at: adj.createdAt || new Date().toISOString()
      })), { onConflict: 'id' });
    } catch (e) {
      console.warn('Direct client adjustments upsert warning:', e);
    }
  }

  return true;
}

async function persistToSupabase() {
  if (isSupabaseSyncing) {
    persistQueued = true;
    const started = Date.now();
    while (isSupabaseSyncing && Date.now() - started < 20000) {
      await new Promise(resolve => setTimeout(resolve, 60));
    }
    if (isSupabaseSyncing) return false;
  }
  isSupabaseSyncing = true;
  updateSupabaseSyncBadge('syncing', 'Syncing to Supabase...');
  let persistOk = false;
  try {
    do {
      persistQueued = false;
      const deletions = collectDeletionPayload();
      const banksToSave = banksWithoutDeletedSheets(corporateBanks, deletions);
      const txnRows = buildSupabaseTxnRowsFromBanks(banksToSave);
      const payload = {
        banks: banksToSave,
        transactions: txnRows,
        invoices: appInvoices,
        bills: appVendorBills,
        adjustments: appAdjustments,
        activities: recentActivities,
        deletedSheets: deletions,
        updatedAt: new Date().toISOString()
      };

      let saved = false;
      let saveError = '';
      try {
        const res = await fetch('/api/supabase/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await res.json();
          const written = data && data.restSync ? Number(data.restSync.transactions) || 0 : 0;
          saved = !!(res.ok && data && data.success && (txnRows.length === 0 || written > 0));
          if (!saved) saveError = (data && data.error) || `Save failed (${res.status})`;
        } else {
          saveError = `Save failed (${res.status})`;
        }
      } catch (e) {
        saved = false;
        saveError = e.message || 'Save request failed';
      }

      if (!saved) {
        saved = await persistViaSupabaseClient(deletions);
      }

      if (saved) {
        persistOk = true;
        pendingDeletedSheets = pendingDeletedSheets.filter(d =>
          !deletions.some(x => x.bankId === d.bankId && x.monthId === d.monthId)
        );
        lastSupabaseSyncTime = new Date();
        const timeStr = lastSupabaseSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        updateSupabaseSyncBadge('synced', `Supabase Synced · ${timeStr}`);
      } else {
        updateSupabaseSyncBadge('error', 'Supabase Sync Error');
        showToast(saveError || 'Could not save transactions to the database. Check Vercel env vars and Redeploy.', 'amber');
      }
    } while (persistQueued);
    return persistOk;
  } catch (err) {
    console.warn('Supabase persist error:', err);
    updateSupabaseSyncBadge('error', 'Supabase Offline');
    return false;
  } finally {
    isSupabaseSyncing = false;
    if (persistQueued) persistToSupabase();
  }
}

function debouncedPersistToSupabase() {
  if (!isInitialSupabaseLoadDone) return;
  clearTimeout(supabaseSyncDebounceTimer);
  supabaseSyncDebounceTimer = setTimeout(() => {
    persistToSupabase();
  }, 1000);
}

async function applyLoadedSupabaseState(state) {
  if (!state) return false;
  if (Array.isArray(state.banks) && state.banks.length > 0) {
    corporateBanks = stripTombstonedSheets(state.banks.map(b => Object.assign({}, b, {
      accNo: sanitizeMaskedAccNo(b.accNo || b.acc_no, b.fullAccNo || b.full_acc_no, b.id),
      sheets: Array.isArray(b.sheets) ? b.sheets : []
    })));
  }
  if (Array.isArray(state.invoices)) appInvoices = state.invoices;
  if (Array.isArray(state.bills)) appVendorBills = state.bills;
  if (Array.isArray(state.adjustments)) appAdjustments = state.adjustments;
  if (Array.isArray(state.activities)) recentActivities = state.activities;
  return true;
}

async function loadViaSupabaseClient() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data: banks, error } = await client.from('corporate_banks').select('*').order('id');
  if (error || !banks) return null;
  const { data: txns } = await client.from('bank_transactions').select('*');
  const formatted = banks.map(b => ({
    id: b.id,
    name: b.name,
    type: b.type,
    accNo: sanitizeMaskedAccNo(b.acc_no, b.full_acc_no, b.id),
    fullAccNo: b.full_acc_no,
    ifsc: b.ifsc,
    branch: b.branch,
    sheets: Array.isArray(b.sheets) ? b.sheets : []
  }));
  if (Array.isArray(txns) && txns.length) {
    txns.forEach(t => {
      const bank = formatted.find(b => b.id === t.bank_id);
      if (!bank) return;
      const monthId = t.month_id || parseDateToMonthId(t.transaction_date) || 'unknown';
      let sheet = bank.sheets.find(s => s.monthId === monthId);
      if (!sheet) return;
      if (!sheet.records) sheet.records = [];
      if (!sheet.debitRecords) sheet.debitRecords = [];
      const row = {
        id: t.id,
        date: t.transaction_date,
        narration: t.narration,
        payer: t.payer,
        type: t.type || 'TRANSFER',
        bankRef: t.bank_ref,
        amount: parseFloat(t.amount) || 0,
        status: t.status || 'unmapped',
        mapping: t.mapping || null
      };
      const bucket = t.transaction_type === 'debit' ? sheet.debitRecords : sheet.records;
      if (!bucket.some(r => String(r.id) === String(row.id))) bucket.push(row);
      sheet.creditsCount = sheet.records.length;
      sheet.debitsCount = sheet.debitRecords.length;
    });
  }
  const { data: invoices } = await client.from('invoices').select('*');
  const { data: bills } = await client.from('vendor_bills').select('*');
  let adjustments = [];
  try {
    const { data: adjData } = await client.from('adjustments').select('*').order('date', { ascending: false });
    if (adjData) adjustments = adjData;
  } catch (e) {}

  return {
    banks: formatted,
    invoices: (invoices || []).map(inv => ({
      id: inv.id,
      invoiceNo: inv.invoice_no,
      guestName: inv.guest_name,
      amount: parseFloat(inv.amount) || 0,
      date: inv.date,
      status: inv.status,
      settledAmount: parseFloat(inv.settled_amount) || 0
    })),
    bills: (bills || []).map(b => ({
      id: b.id,
      billNo: b.bill_no,
      vendorName: b.vendor_name,
      amount: parseFloat(b.amount) || 0,
      date: b.date,
      status: b.status,
      settledAmount: parseFloat(b.settled_amount) || 0
    })),
    adjustments: (adjustments || []).map(adj => ({
      id: adj.id,
      bankId: adj.bank_id,
      date: adj.date,
      adjustmentType: adj.adjustment_type,
      description: adj.description,
      reference: adj.reference,
      debitOrCredit: adj.debit_or_credit,
      amount: parseFloat(adj.amount) || 0,
      createdBy: adj.created_by,
      status: adj.status,
      createdAt: adj.created_at
    })),
    activities: []
  };
}

async function loadFromSupabase(showToastNotification = false) {
  updateSupabaseSyncBadge('syncing', 'Connecting Supabase...');
  try {
    let state = null;
    try {
      const res = await fetch('/api/supabase/data');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) state = json.data;
      }
    } catch (e) {}
    if (!state) {
      state = await loadViaSupabaseClient();
    }
    if (state) {
      await applyLoadedSupabaseState(state);

      const currentActive = corporateBanks.find(b => b.id === selectedBankId);
      const currentHasRecords = currentActive && Array.isArray(currentActive.sheets) && currentActive.sheets.some(s => (s.records && s.records.length > 0) || (s.debitRecords && s.debitRecords.length > 0));
      if (!currentHasRecords) {
        const bankWithRecords = corporateBanks.find(b => Array.isArray(b.sheets) && b.sheets.some(s => (s.records && s.records.length > 0) || (s.debitRecords && s.debitRecords.length > 0)));
        if (bankWithRecords) selectedBankId = bankWithRecords.id;
      }

      const activeBank = getActiveBank();
      if (activeBank && Array.isArray(activeBank.sheets) && activeBank.sheets.length > 0) {
        const sheetWithRecords = activeBank.sheets.find(s => (s.records && s.records.length > 0) || (s.debitRecords && s.debitRecords.length > 0)) || activeBank.sheets[0];
        selectedMonthId = sheetWithRecords.monthId;
        const crCount = (sheetWithRecords.records || []).length;
        const drCount = (sheetWithRecords.debitRecords || []).length;
        if (drCount > 0 && crCount === 0) {
          switchMappingMode('debit', { silent: true, autoPersist: false });
        } else {
          switchMappingMode('credit', { silent: true, autoPersist: false });
        }
      }

      isInitialSupabaseLoadDone = true;
      renderAll(false);
      lastSupabaseSyncTime = new Date();
      const timeStr = lastSupabaseSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      updateSupabaseSyncBadge('synced', `Supabase Synced · ${timeStr}`);
      if (showToastNotification) {
        showToast('Workspace data synchronized with Supabase Cloud Database');
      }
      return true;
    }
    isInitialSupabaseLoadDone = true;
    updateSupabaseSyncBadge('synced', 'Supabase Connected');
  } catch (e) {
    console.warn('Failed to load initial data from Supabase:', e);
    isInitialSupabaseLoadDone = true;
    updateSupabaseSyncBadge('error', 'Supabase Offline');
  }
  return false;
}

// =============================================================================
// 13. Main Re-render Coordinator
// =============================================================================

function renderAll(autoPersist = true) {
  renderBankSelector();
  renderStatementFilesTable();
  renderCreditTable();
  renderCreditTrendChart();
  if (totalInvoicesCountBadge) totalInvoicesCountBadge.textContent = `${appInvoices.length} Invoices`;
  if (totalBillsCountBadge) totalBillsCountBadge.textContent = `${appVendorBills.length} Vendor Bills`;
  updateInvoicesBadge();
  if (currentActiveView === 'invoices') {
    renderInvoicesView();
  } else if (currentActiveView === 'dashboard') {
    renderDashboardView();
  } else if (currentActiveView === 'virtual-ledger' || currentActiveView === 'ledger') {
    renderVirtualLedgerView();
  }
  if (autoPersist) {
    debouncedPersistToSupabase();
  }
}

// =============================================================================
// 14. Event Listeners & Binding
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Sidebar Nav
  const confirmApproveUploadBtn = document.getElementById('confirmApproveUploadBtn');
  const cancelApproveUploadBtn = document.getElementById('cancelApproveUploadBtn');
  const closeApproveUploadBtn = document.getElementById('closeApproveUploadBtn');
  if (confirmApproveUploadBtn) {
    confirmApproveUploadBtn.addEventListener('click', () => closeApproveUploadModal(true));
  }
  if (cancelApproveUploadBtn) {
    cancelApproveUploadBtn.addEventListener('click', () => closeApproveUploadModal(false));
  }
  if (closeApproveUploadBtn) {
    closeApproveUploadBtn.addEventListener('click', () => closeApproveUploadModal(false));
  }

  if (navDashboard) navDashboard.addEventListener('click', () => switchView('dashboard'));
  if (navInvoices) navInvoices.addEventListener('click', () => switchView('invoices'));
  if (navBankStatements) navBankStatements.addEventListener('click', () => switchView('bank-statements'));
  if (navVirtualLedger) navVirtualLedger.addEventListener('click', () => switchView('virtual-ledger'));

  const breadcrumbDashboard = document.getElementById('breadcrumbDashboard');
  if (breadcrumbDashboard) {
    breadcrumbDashboard.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('dashboard');
    });
  }

  const breadcrumbDashboardFromInv = document.getElementById('breadcrumbDashboardFromInv');
  if (breadcrumbDashboardFromInv) {
    breadcrumbDashboardFromInv.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('dashboard');
    });
  }

  const breadcrumbDashboardFromLedger = document.getElementById('breadcrumbDashboardFromLedger');
  if (breadcrumbDashboardFromLedger) {
    breadcrumbDashboardFromLedger.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('dashboard');
    });
  }

  const dashInvoicesKpiCard = document.getElementById('dashInvoicesKpiCard');
  if (dashInvoicesKpiCard) {
    dashInvoicesKpiCard.addEventListener('click', () => switchView('invoices'));
  }

  // 2. Desk Mode Switcher Tabs (Credits vs Debits)
  const handleTabSwitch = (mode) => {
    switchMappingMode(mode);
  };

  if (tabAllMode) {
    tabAllMode.addEventListener('click', (e) => {
      e.preventDefault();
      handleTabSwitch('all');
    });
  }
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
  [tabAllMode, tabCreditMode, tabDebitMode].forEach(btn => {
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

  // Statement Rejection Modal listeners
  if (closeRejectionModalBtn) {
    closeRejectionModalBtn.addEventListener('click', () => closeStatementRejectionPopup(true));
  }
  if (rejectionDismissBtn) {
    rejectionDismissBtn.addEventListener('click', () => closeStatementRejectionPopup(true));
  }
  if (statementRejectionModal) {
    statementRejectionModal.addEventListener('click', (e) => {
      if (e.target === statementRejectionModal) closeStatementRejectionPopup(true);
    });
  }
  if (rejectionActionBtn) {
    rejectionActionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof currentRejectionAction === 'function') {
        currentRejectionAction();
      } else {
        closeStatementRejectionPopup(true);
      }
    });
  }


  document.addEventListener('click', (e) => {
    if (bankDropdownMenu && !bankDropdownMenu.contains(e.target) && e.target !== bankSelectorBtn) {
      bankDropdownMenu.style.display = 'none';
    }
    if (filterMenuPopover && !filterMenuPopover.contains(e.target) && e.target !== filterDropdownBtn) {
      filterMenuPopover.style.display = 'none';
      if (filterDropdownBtn) filterDropdownBtn.setAttribute('aria-expanded', 'false');
    }
    const mappingMoreBtnEl = document.getElementById('mappingMoreBtn');
    const mappingMoreMenuEl = document.getElementById('mappingMoreMenu');
    if (mappingMoreMenuEl && mappingMoreBtnEl && !mappingMoreMenuEl.contains(e.target) && e.target !== mappingMoreBtnEl && !mappingMoreBtnEl.contains(e.target)) {
      mappingMoreMenuEl.style.display = 'none';
      mappingMoreBtnEl.setAttribute('aria-expanded', 'false');
    }
  });

  // 4. Filter Popover
  if (filterDropdownBtn) {
    filterDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = filterMenuPopover.style.display === 'block';
      filterMenuPopover.style.display = open ? 'none' : 'block';
      filterDropdownBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
      const mappingMoreMenuEl = document.getElementById('mappingMoreMenu');
      const mappingMoreBtnEl = document.getElementById('mappingMoreBtn');
      if (mappingMoreMenuEl) mappingMoreMenuEl.style.display = 'none';
      if (mappingMoreBtnEl) mappingMoreBtnEl.setAttribute('aria-expanded', 'false');
    });
  }

  const mappingMoreBtn = document.getElementById('mappingMoreBtn');
  const mappingMoreMenu = document.getElementById('mappingMoreMenu');
  if (mappingMoreBtn && mappingMoreMenu) {
    mappingMoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = mappingMoreMenu.style.display === 'block';
      mappingMoreMenu.style.display = open ? 'none' : 'block';
      mappingMoreBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (filterMenuPopover) filterMenuPopover.style.display = 'none';
      if (filterDropdownBtn) filterDropdownBtn.setAttribute('aria-expanded', 'false');
    });
    mappingMoreMenu.addEventListener('click', (e) => {
      if (e.target.closest('button')) {
        mappingMoreMenu.style.display = 'none';
        mappingMoreBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function setFilter(type, label) {
    activeFilter = type;
    if (activeFilterLabel) activeFilterLabel.textContent = label;
    [filterAll, filterUnmapped, filterMapped].forEach(btn => {
      if (btn) btn.classList.toggle('active', btn.dataset.filter === type);
    });
    if (filterMenuPopover) filterMenuPopover.style.display = 'none';
    if (filterDropdownBtn) filterDropdownBtn.setAttribute('aria-expanded', 'false');
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

  // 6. Statement CSV & Excel Upload & Dropzone
  if (uploadCsvBtn && bankCsvInput) {
    uploadCsvBtn.addEventListener('click', () => bankCsvInput.click());
  }

  if (dropZone && bankCsvInput) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        showToast(`Reading statement: ${file.name}...`, 'info');
        readStatementFile(file, async (content, fileName, meta) => {
          try {
            await processBankStatementCsv(content, fileName, meta);
          } catch (err) {
            console.error('Error processing bank statement:', err);
            showToast(`Error processing statement: ${err.message}`, 'amber');
          }
        });
      }
    });
  }

  if (bankCsvInput) {
    bankCsvInput.addEventListener('change', () => {
      if (bankCsvInput.files && bankCsvInput.files.length > 0) {
        const file = bankCsvInput.files[0];
        showToast(`Reading statement: ${file.name}...`, 'info');
        readStatementFile(file, async (content, fileName, meta) => {
          try {
            await processBankStatementCsv(content, fileName, meta);
          } catch (err) {
            console.error('Error processing bank statement:', err);
            showToast(`Error processing statement: ${err.message}`, 'amber');
          }
        });
        setTimeout(() => {
          try { bankCsvInput.value = ''; } catch (e) {}
        }, 500);
      }
    });
  }

  // 7. Manual Customer Invoice Modal (Add / Edit)
  if (openAddInvoiceModalBtn) {
    openAddInvoiceModalBtn.addEventListener('click', () => openAddInvoiceModal());
  }

  const closeInvModal = () => { if (addInvoiceModal) addInvoiceModal.style.display = 'none'; };
  if (closeAddInvoiceModalBtn) closeAddInvoiceModalBtn.addEventListener('click', closeInvModal);
  if (cancelAddInvoiceBtn) cancelAddInvoiceBtn.addEventListener('click', closeInvModal);

  if (addInvoiceForm) {
    addInvoiceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const origNo = document.getElementById('editInvoiceOriginalNo') ? document.getElementById('editInvoiceOriginalNo').value.trim() : '';
      const no = document.getElementById('newInvNo').value.trim();
      const amt = parseFloat(document.getElementById('newInvAmount').value) || 0;
      const cust = document.getElementById('newInvCustomer').value.trim();
      const gstin = document.getElementById('newInvGstin') ? document.getElementById('newInvGstin').value.trim() : '';
      const dt = document.getElementById('newInvDate').value.trim() || '19 Sep 2026';
      const cat = document.getElementById('newInvCategory').value.trim() || 'General Pharma Supply';

      if (!no || !amt || !cust) {
        showToast('Please enter Invoice #, Amount and Customer Name', 'amber');
        return;
      }

      if (origNo) {
        // Edit mode
        const existingIdx = appInvoices.findIndex(i => i.invoiceNo.toLowerCase() === origNo.toLowerCase());
        if (existingIdx !== -1) {
          appInvoices[existingIdx].invoiceNo = no;
          appInvoices[existingIdx].guestName = cust;
          appInvoices[existingIdx].amount = amt;
          appInvoices[existingIdx].date = dt;
          appInvoices[existingIdx].category = cat;
          if (gstin) appInvoices[existingIdx].gstin = gstin;

          // If invoice number changed, propagate to linked transactions
          if (origNo.toLowerCase() !== no.toLowerCase()) {
            (corporateBanks || []).forEach(bank => {
              (bank.sheets || []).forEach(sheet => {
                (sheet.records || []).forEach(row => {
                  if (row.status === 'mapped' && row.mapping) {
                    const doc = String(row.mapping.invoiceNo || row.mapping.billNo || '').toLowerCase();
                    if (doc === origNo.toLowerCase()) {
                      row.mapping.invoiceNo = no;
                      row.mapping.guestName = cust;
                    }
                  }
                });
              });
            });
          }
          showToast(`Invoice ${no} updated successfully!`);
        }
      } else {
        // Create mode
        if (appInvoices.some(i => i.invoiceNo.toLowerCase() === no.toLowerCase())) {
          showToast(`Invoice ${no} already exists in catalog!`, 'amber');
          return;
        }
        appInvoices.unshift({
          id: no,
          invoiceNo: no,
          guestName: cust,
          amount: amt,
          date: dt,
          category: cat,
          gstin: gstin,
          status: 'Unpaid',
          settledAmount: 0
        });
        showToast(`Invoice ${no} (${cust}) successfully registered!`);
      }

      closeInvModal();
      renderAll();
      if (currentActiveView === 'invoices') renderInvoicesView();
      await persistToSupabase();
    });
  }

  // 8. Invoices Desk Header & Empty Actions
  const invoicesAddNewBtn = document.getElementById('invoicesAddNewBtn');
  const emptyAddInvoiceBtn = document.getElementById('emptyAddInvoiceBtn');
  if (invoicesAddNewBtn) invoicesAddNewBtn.addEventListener('click', openAddInvoiceModal);
  if (emptyAddInvoiceBtn) emptyAddInvoiceBtn.addEventListener('click', openAddInvoiceModal);

  const invoicesUploadCsvBtn = document.getElementById('invoicesUploadCsvBtn');
  const emptyUploadInvoiceBtn = document.getElementById('emptyUploadInvoiceBtn');
  if (invoicesUploadCsvBtn && invoiceCsvInput) {
    invoicesUploadCsvBtn.addEventListener('click', () => invoiceCsvInput.click());
  }
  if (emptyUploadInvoiceBtn && invoiceCsvInput) {
    emptyUploadInvoiceBtn.addEventListener('click', () => invoiceCsvInput.click());
  }

  // Invoices Desk Export Dropdown (Excel & CSV)
  const invoicesExportDropdownBtn = document.getElementById('invoicesExportDropdownBtn');
  const invoicesExportMenu = document.getElementById('invoicesExportMenu');
  const invoicesExportExcelBtn = document.getElementById('invoicesExportExcelBtn');
  const invoicesExportCsvBtn = document.getElementById('invoicesExportCsvBtn');

  if (invoicesExportDropdownBtn && invoicesExportMenu) {
    invoicesExportDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = invoicesExportMenu.style.display !== 'none';
      invoicesExportMenu.style.display = isVisible ? 'none' : 'block';
      invoicesExportDropdownBtn.setAttribute('aria-expanded', String(!isVisible));
    });
  }

  if (invoicesExportExcelBtn) {
    invoicesExportExcelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (invoicesExportMenu) invoicesExportMenu.style.display = 'none';
      if (invoicesExportDropdownBtn) invoicesExportDropdownBtn.setAttribute('aria-expanded', 'false');
      exportInvoicesToExcel();
    });
  }

  if (invoicesExportCsvBtn) {
    invoicesExportCsvBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (invoicesExportMenu) invoicesExportMenu.style.display = 'none';
      if (invoicesExportDropdownBtn) invoicesExportDropdownBtn.setAttribute('aria-expanded', 'false');
      exportInvoicesToCsv();
    });
  }

  // Invoices Desk Toolbar: Search, Filters, Sort
  const invoicesSearchInput = document.getElementById('invoicesSearchInput');
  const invoicesSearchClear = document.getElementById('invoicesSearchClear');
  if (invoicesSearchInput) {
    invoicesSearchInput.addEventListener('input', () => {
      invoicesSearch = invoicesSearchInput.value;
      if (invoicesSearchClear) invoicesSearchClear.style.display = invoicesSearch ? 'block' : 'none';
      renderInvoicesView();
    });
  }
  if (invoicesSearchClear) {
    invoicesSearchClear.addEventListener('click', () => {
      invoicesSearch = '';
      if (invoicesSearchInput) invoicesSearchInput.value = '';
      invoicesSearchClear.style.display = 'none';
      renderInvoicesView();
    });
  }

  const invoicesSortSelect = document.getElementById('invoicesSortSelect');
  if (invoicesSortSelect) {
    invoicesSortSelect.addEventListener('change', () => {
      invoicesSort = invoicesSortSelect.value;
      renderInvoicesView();
    });
  }

  const invFilterBtns = document.querySelectorAll('.inv-filter-btn');
  invFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      invFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      invoicesFilter = btn.getAttribute('data-filter') || 'all';
      renderInvoicesView();
    });
  });

  // Invoice Details Modal Close
  const closeInvoiceDetailsBtn = document.getElementById('closeInvoiceDetailsBtn');
  const doneInvoiceDetailsBtn = document.getElementById('doneInvoiceDetailsBtn');
  const closeDetailsModal = () => {
    const modal = document.getElementById('invoiceDetailsModal');
    if (modal) modal.style.display = 'none';
  };
  if (closeInvoiceDetailsBtn) closeInvoiceDetailsBtn.addEventListener('click', closeDetailsModal);
  if (doneInvoiceDetailsBtn) doneInvoiceDetailsBtn.addEventListener('click', closeDetailsModal);

  // 9. Invoice CSV Upload
  if (openUploadInvoiceCsvBtn && invoiceCsvInput) {
    openUploadInvoiceCsvBtn.addEventListener('click', () => invoiceCsvInput.click());
  }

  if (invoiceCsvInput) {
    invoiceCsvInput.addEventListener('change', () => {
      if (invoiceCsvInput.files && invoiceCsvInput.files.length > 0) {
        const file = invoiceCsvInput.files[0];
        const isXls = /\.(xlsx|xls|xlsm|xlsb)$/i.test(file.name);
        showToast(`Reading customer invoices (${isXls ? 'Excel' : 'CSV'}): ${file.name}...`, 'info');
        readStatementFile(file, async (content) => {
          try {
            await processInvoiceCsv(content);
            if (typeof renderInvoicesCatalogModal === 'function') renderInvoicesCatalogModal();
            if (typeof renderInvoicesView === 'function') renderInvoicesView();
          } catch (err) {
            console.error('Error processing customer invoices:', err);
            showToast(`Error processing invoice file: ${err.message}`, 'amber');
          }
        });
        setTimeout(() => {
          try { invoiceCsvInput.value = ''; } catch (e) {}
        }, 500);
      }
    });
  }

  // 10. Invoices Catalog Modal
  if (viewInvoicesBtn) {
    viewInvoicesBtn.addEventListener('click', () => {
      switchView('invoices');
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
      if (billCsvInput.files && billCsvInput.files.length > 0) {
        const file = billCsvInput.files[0];
        showToast(`Reading vendor bills: ${file.name}...`, 'info');
        readStatementFile(file, async (content) => {
          try {
            await processVendorBillCsv(content);
            if (typeof renderVendorBillsCatalogModal === 'function') renderVendorBillsCatalogModal();
          } catch (err) {
            console.error('Error processing vendor bills:', err);
            showToast(`Error processing vendor bills CSV: ${err.message}`, 'amber');
          }
        });
        setTimeout(() => {
          try { billCsvInput.value = ''; } catch (e) {}
        }, 500);
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
  const invoiceDetailsModal = document.getElementById('invoiceDetailsModal');
  const addAdjustmentModal = document.getElementById('addAdjustmentModal');
  [addInvoiceModal, invoiceDetailsModal, addBillModal, addBankModal, invoicesCatalogModal, billsCatalogModal, unlinkModal, commandPaletteModal, addAdjustmentModal].forEach(modal => {
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
            monthId: '2026-07',
            label: 'July 2026',
            fileName: `${name.replace(/\s+/g, '_')}_July_2026.xlsx`,
            uploadedOn: '31 Jul 2026',
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

  // 14B. Delete Corporate Bank Account Dialog
  if (closeDeleteBankModalBtn) closeDeleteBankModalBtn.addEventListener('click', closeDeleteBankModal);
  if (cancelDeleteBankBtn) cancelDeleteBankBtn.addEventListener('click', closeDeleteBankModal);
  if (confirmDeleteBankBtn) confirmDeleteBankBtn.addEventListener('click', confirmDeleteBank);

  // 15. Command Palette Trigger & Keyboard Shortcut
  if (globalSearchTrigger) globalSearchTrigger.addEventListener('click', openCommandPalette);

  document.addEventListener('keydown', (e) => {
    // ⌘K or Ctrl+K: Open Command Palette
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      openCommandPalette();
    }
    if (e.key === 'Escape') {
      closeCommandPalette();
      if (addInvoiceModal) addInvoiceModal.style.display = 'none';
      if (invoiceDetailsModal) invoiceDetailsModal.style.display = 'none';
      if (addBillModal) addBillModal.style.display = 'none';
      if (addBankModal) addBankModal.style.display = 'none';
      if (invoicesCatalogModal) invoicesCatalogModal.style.display = 'none';
      if (billsCatalogModal) billsCatalogModal.style.display = 'none';
      if (unlinkModal) unlinkModal.style.display = 'none';
      if (addAdjustmentModal) addAdjustmentModal.style.display = 'none';
      closeLedgerDetailDrawer();
      if (deleteBankModal) closeDeleteBankModal();
      const sampleStatementsModal = document.getElementById('sampleStatementsModal');
      if (sampleStatementsModal) sampleStatementsModal.style.display = 'none';
    }
  });

  // Sample Statements Modal Event Listeners
  const sampleStatementsBtn = document.getElementById('sampleStatementsBtn');
  const quickSampleTrigger = document.getElementById('quickSampleTrigger');
  const sampleStatementsModal = document.getElementById('sampleStatementsModal');
  const closeSampleStatementsModalBtn = document.getElementById('closeSampleStatementsModalBtn');
  const doneSampleStatementsBtn = document.getElementById('doneSampleStatementsBtn');

  const openSampleModal = () => {
    if (sampleStatementsModal) sampleStatementsModal.style.display = 'flex';
  };
  const closeSampleModal = () => {
    if (sampleStatementsModal) sampleStatementsModal.style.display = 'none';
  };

  if (sampleStatementsBtn) sampleStatementsBtn.addEventListener('click', openSampleModal);
  if (quickSampleTrigger) quickSampleTrigger.addEventListener('click', openSampleModal);
  if (closeSampleStatementsModalBtn) closeSampleStatementsModalBtn.addEventListener('click', closeSampleModal);
  if (doneSampleStatementsBtn) doneSampleStatementsBtn.addEventListener('click', closeSampleModal);

  // 1-Click Load Sample Handler
  document.querySelectorAll('.btn-quick-load-sample').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fileName = btn.getAttribute('data-sample');
      const fileType = btn.getAttribute('data-type');
      if (!fileName) return;

      const originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '⏳ Loading...';

      try {
        const res = await fetch(`/sample_statements/${fileName}`);
        if (!res.ok) throw new Error(`Could not load sample file (${res.status})`);
        const text = await res.text();

        closeSampleModal();

        if (fileType === 'statement') {
          await processBankStatementCsv(text, fileName);
          switchView('bank-statements');
        } else if (fileType === 'invoice') {
          processInvoiceCsv(text);
          if (typeof renderInvoicesCatalogModal === 'function') renderInvoicesCatalogModal();
        } else if (fileType === 'bill') {
          processVendorBillCsv(text);
          if (typeof renderVendorBillsCatalogModal === 'function') renderVendorBillsCatalogModal();
        }
      } catch (err) {
        console.error('Failed to load sample CSV:', err);
        showToast(`Could not load ${fileName}: ${err.message}`, 'amber');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    });
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
      let mapped = [];
      let csv = '';
      let downloadFileName = '';

      if (activeMappingMode === 'all') {
        const crMapped = (sheet.records || []).filter(r => r.status === 'mapped').map(r => ({
          ...r,
          flowType: 'Credit (Inflow)',
          docNo: r.mapping ? (r.mapping.invoiceNo || '') : '',
          party: r.mapping ? (r.mapping.guestName || '') : ''
        }));
        const drMapped = (sheet.debitRecords || []).filter(r => r.status === 'mapped').map(r => ({
          ...r,
          flowType: 'Debit (Outflow)',
          docNo: r.mapping ? (r.mapping.billNo || '') : '',
          party: r.mapping ? (r.mapping.vendorName || '') : ''
        }));
        mapped = [...crMapped, ...drMapped];
        if (mapped.length === 0) {
          showToast('No reconciled transactions to export for this month', 'amber');
          return;
        }
        csv = 'Date,Flow Type,Bank Reference,Amount,Narration,Linked Document,Customer / Vendor,Mapped By,Mapped At\n';
        mapped.forEach(r => {
          csv += `"${r.date}","${r.flowType}","${r.bankRef}","${r.amount}","${(r.narration || '').replace(/"/g, '""')}","${r.docNo}","${(r.party || '').replace(/"/g, '""')}","${r.mapping ? r.mapping.mappedBy : ''}","${r.mapping ? r.mapping.mappedAt : ''}"\n`;
        });
        downloadFileName = `Reconciled_All_Transactions_${sheet.label.replace(/\s+/g, '_')}.csv`;
      } else {
        const isDebit = activeMappingMode === 'debit';
        const records = isDebit ? (sheet.debitRecords || []) : (sheet.records || []);
        mapped = records.filter(r => r.status === 'mapped');
        if (mapped.length === 0) {
          showToast(`No reconciled ${isDebit ? 'debits' : 'credits'} to export for this month`, 'amber');
          return;
        }

        csv = isDebit
          ? 'Date,Bank Reference,Debit Amount,Narration,Bill No,Vendor / Payee,Mapped By,Mapped At\n'
          : 'Date,Bank Reference,Credit Amount,Narration,Invoice No,Customer,Mapped By,Mapped At\n';

        mapped.forEach(r => {
          const docNo = r.mapping ? (r.mapping.billNo || r.mapping.invoiceNo || '') : '';
          const party = r.mapping ? (r.mapping.vendorName || r.mapping.guestName || '') : '';
          csv += `"${r.date}","${r.bankRef}","${r.amount}","${(r.narration || '').replace(/"/g, '""')}","${docNo}","${party.replace(/"/g, '""')}","${r.mapping.mappedBy}","${r.mapping.mappedAt}"\n`;
        });
        downloadFileName = `Reconciled_${isDebit ? 'Debits' : 'Credits'}_${sheet.label.replace(/\s+/g, '_')}.csv`;
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = downloadFileName;
      link.click();
      showToast(`Exported ${mapped.length} reconciled transactions to CSV!`);
    });
  }

  // 16b. Auto-Match All Records Toolbar Button
  const autoMatchAllBtn = document.getElementById('autoMatchAllBtn');
  if (autoMatchAllBtn) {
    autoMatchAllBtn.addEventListener('click', () => {
      autoMatchAllBtn.disabled = true;
      try { autoMatchAllStatementData(true); }
      finally { autoMatchAllBtn.disabled = false; }
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

  // 18. Initialize Virtual Ledger Listeners & Controls
  setupVirtualLedgerListeners();

  // Initial Boot
  renderAll(false);
  parseInitialRoute(false);

  // Initialize Supabase Auth Desk Listeners
  setupSupabaseAuthListeners();

  // Load live database state from Supabase Cloud Database
  loadFromSupabase(false);

  // Supabase Manual Sync Badge Click Listener
  const supabaseDbSyncBtn = document.getElementById('supabaseDbSyncBtn');
  if (supabaseDbSyncBtn) {
    supabaseDbSyncBtn.addEventListener('click', () => {
      loadFromSupabase(true);
    });
  }
});

// Setup Virtual Ledger Listeners & User Interactions
function setupVirtualLedgerListeners() {
  // 1. Bank Selector Dropdown
  const ledgerBankSelectorBtn = document.getElementById('ledgerBankSelectorBtn');
  const ledgerBankDropdownMenu = document.getElementById('ledgerBankDropdownMenu');
  if (ledgerBankSelectorBtn && ledgerBankDropdownMenu) {
    ledgerBankSelectorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = ledgerBankDropdownMenu.style.display === 'block';
      ledgerBankDropdownMenu.style.display = open ? 'none' : 'block';
      ledgerBankSelectorBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
      const periodMenu = document.getElementById('ledgerPeriodDropdownMenu');
      const exportMenu = document.getElementById('ledgerExportMenu');
      if (periodMenu) periodMenu.style.display = 'none';
      if (exportMenu) exportMenu.style.display = 'none';
      if (!open) renderVirtualLedgerHeader();
    });
  }

  // 2. Period Selector Dropdown
  const ledgerPeriodSelectorBtn = document.getElementById('ledgerPeriodSelectorBtn');
  const ledgerPeriodDropdownMenu = document.getElementById('ledgerPeriodDropdownMenu');
  if (ledgerPeriodSelectorBtn && ledgerPeriodDropdownMenu) {
    ledgerPeriodSelectorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = ledgerPeriodDropdownMenu.style.display === 'block';
      ledgerPeriodDropdownMenu.style.display = open ? 'none' : 'block';
      ledgerPeriodSelectorBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
      const bankMenu = document.getElementById('ledgerBankDropdownMenu');
      const exportMenu = document.getElementById('ledgerExportMenu');
      if (bankMenu) bankMenu.style.display = 'none';
      if (exportMenu) exportMenu.style.display = 'none';
      if (!open) renderVirtualLedgerHeader();
    });
  }

  // 3. Export Menu
  const ledgerExportBtn = document.getElementById('ledgerExportBtn');
  const ledgerExportMenu = document.getElementById('ledgerExportMenu');
  const ledgerExportExcelBtn = document.getElementById('ledgerExportExcelBtn');
  const ledgerExportPdfBtn = document.getElementById('ledgerExportPdfBtn');

  if (ledgerExportBtn && ledgerExportMenu) {
    ledgerExportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = ledgerExportMenu.style.display === 'block';
      ledgerExportMenu.style.display = open ? 'none' : 'block';
      ledgerExportBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
      const bankMenu = document.getElementById('ledgerBankDropdownMenu');
      const periodMenu = document.getElementById('ledgerPeriodDropdownMenu');
      if (bankMenu) bankMenu.style.display = 'none';
      if (periodMenu) periodMenu.style.display = 'none';
    });
  }

  if (ledgerExportExcelBtn) {
    ledgerExportExcelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (ledgerExportMenu) ledgerExportMenu.style.display = 'none';
      if (ledgerExportBtn) ledgerExportBtn.setAttribute('aria-expanded', 'false');
      exportVirtualLedger('excel');
    });
  }

  if (ledgerExportPdfBtn) {
    ledgerExportPdfBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (ledgerExportMenu) ledgerExportMenu.style.display = 'none';
      if (ledgerExportBtn) ledgerExportBtn.setAttribute('aria-expanded', 'false');
      exportVirtualLedger('pdf');
    });
  }

  // Close dropdown menus on outside click
  document.addEventListener('click', (e) => {
    if (invoicesExportMenu && !invoicesExportMenu.contains(e.target) && e.target !== invoicesExportDropdownBtn && (!invoicesExportDropdownBtn || !invoicesExportDropdownBtn.contains(e.target))) {
      invoicesExportMenu.style.display = 'none';
      if (invoicesExportDropdownBtn) invoicesExportDropdownBtn.setAttribute('aria-expanded', 'false');
    }
    if (ledgerBankDropdownMenu && !ledgerBankDropdownMenu.contains(e.target) && e.target !== ledgerBankSelectorBtn && (!ledgerBankSelectorBtn || !ledgerBankSelectorBtn.contains(e.target))) {
      ledgerBankDropdownMenu.style.display = 'none';
      if (ledgerBankSelectorBtn) ledgerBankSelectorBtn.setAttribute('aria-expanded', 'false');
    }
    if (ledgerPeriodDropdownMenu && !ledgerPeriodDropdownMenu.contains(e.target) && e.target !== ledgerPeriodSelectorBtn && (!ledgerPeriodSelectorBtn || !ledgerPeriodSelectorBtn.contains(e.target))) {
      ledgerPeriodDropdownMenu.style.display = 'none';
      if (ledgerPeriodSelectorBtn) ledgerPeriodSelectorBtn.setAttribute('aria-expanded', 'false');
    }
    if (ledgerExportMenu && !ledgerExportMenu.contains(e.target) && e.target !== ledgerExportBtn && (!ledgerExportBtn || !ledgerExportBtn.contains(e.target))) {
      ledgerExportMenu.style.display = 'none';
      if (ledgerExportBtn) ledgerExportBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // 4. Sub-view Tabs (All, Receipts, Payments, Adjustments, Transfers, Receivables, Payables)
  document.querySelectorAll('.ledger-nav-tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      ledgerTab = tabBtn.dataset.tab || 'all';
      ledgerCurrentPage = 1;
      renderVirtualLedgerView();
    });
  });

  // 5. Toolbar & Filters
  const searchInput = document.getElementById('ledgerSearchInput');
  const searchClear = document.getElementById('ledgerSearchClear');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      ledgerSearchQuery = searchInput.value;
      if (searchClear) searchClear.style.display = ledgerSearchQuery ? 'block' : 'none';
      ledgerCurrentPage = 1;
      renderVirtualLedgerView();
    });
  }
  if (searchClear && searchInput) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      ledgerSearchQuery = '';
      searchClear.style.display = 'none';
      ledgerCurrentPage = 1;
      renderVirtualLedgerView();
    });
  }

  const statusSelect = document.getElementById('ledgerStatusSelect');
  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      ledgerStatusFilter = statusSelect.value;
      ledgerCurrentPage = 1;
      renderVirtualLedgerView();
    });
  }

  const dateFrom = document.getElementById('ledgerDateFrom');
  const dateTo = document.getElementById('ledgerDateTo');
  if (dateFrom) {
    dateFrom.addEventListener('change', () => {
      ledgerDateFrom = dateFrom.value;
      ledgerCurrentPage = 1;
      renderVirtualLedgerView();
    });
  }
  if (dateTo) {
    dateTo.addEventListener('change', () => {
      ledgerDateTo = dateTo.value;
      ledgerCurrentPage = 1;
      renderVirtualLedgerView();
    });
  }

  const minAmt = document.getElementById('ledgerMinAmount');
  const maxAmt = document.getElementById('ledgerMaxAmount');
  if (minAmt) {
    minAmt.addEventListener('input', () => {
      ledgerMinAmount = minAmt.value ? parseFloat(minAmt.value) : null;
      ledgerCurrentPage = 1;
      renderVirtualLedgerView();
    });
  }
  if (maxAmt) {
    maxAmt.addEventListener('input', () => {
      ledgerMaxAmount = maxAmt.value ? parseFloat(maxAmt.value) : null;
      ledgerCurrentPage = 1;
      renderVirtualLedgerView();
    });
  }

  const resetFiltersBtn = document.getElementById('ledgerResetFiltersBtn');
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      ledgerSearchQuery = '';
      ledgerStatusFilter = 'all';
      ledgerDateFrom = '';
      ledgerDateTo = '';
      ledgerMinAmount = null;
      ledgerMaxAmount = null;
      ledgerCurrentPage = 1;
      if (searchInput) searchInput.value = '';
      if (searchClear) searchClear.style.display = 'none';
      if (statusSelect) statusSelect.value = 'all';
      if (dateFrom) dateFrom.value = '';
      if (dateTo) dateTo.value = '';
      if (minAmt) minAmt.value = '';
      if (maxAmt) maxAmt.value = '';
      renderVirtualLedgerView();
    });
  }

  const addAdjBtn = document.getElementById('ledgerAddAdjustmentBtn');
  if (addAdjBtn) {
    addAdjBtn.addEventListener('click', openAddAdjustmentModal);
  }

  const retryBtn = document.getElementById('ledgerRetryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      const errBanner = document.getElementById('ledgerErrorState');
      if (errBanner) errBanner.style.display = 'none';
      renderVirtualLedgerView();
    });
  }

  // 6. Pagination
  const prevPageBtn = document.getElementById('ledgerPrevPageBtn');
  const nextPageBtn = document.getElementById('ledgerNextPageBtn');
  const pageSizeSelect = document.getElementById('ledgerPageSizeSelect');

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (ledgerCurrentPage > 1) {
        ledgerCurrentPage--;
        renderVirtualLedgerView();
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      ledgerCurrentPage++;
      renderVirtualLedgerView();
    });
  }

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', () => {
      ledgerPageSize = parseInt(pageSizeSelect.value) || 25;
      ledgerCurrentPage = 1;
      renderVirtualLedgerView();
    });
  }

  // 7. Transaction Detail Drawer
  const drawerCloseIcon = document.getElementById('ledgerDrawerCloseIcon');
  const drawerCloseBtn = document.getElementById('ledgerDrawerCloseBtn');
  const detailDrawer = document.getElementById('ledgerDetailDrawer');
  const goSourceBtn = document.getElementById('ledgerDrawerGoSourceBtn');
  const copyRefBtn = document.getElementById('ledgerDrawerCopyRefBtn');

  if (drawerCloseIcon) drawerCloseIcon.addEventListener('click', closeLedgerDetailDrawer);
  if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeLedgerDetailDrawer);

  if (detailDrawer) {
    detailDrawer.addEventListener('click', (e) => {
      if (e.target === detailDrawer) closeLedgerDetailDrawer();
    });
  }

  if (goSourceBtn) {
    goSourceBtn.addEventListener('click', () => {
      if (activeDrawerTxn && activeDrawerTxn.bankId) {
        selectedBankId = activeDrawerTxn.bankId;
      }
      closeLedgerDetailDrawer();
      switchView('bank-statements');
    });
  }

  if (copyRefBtn) {
    copyRefBtn.addEventListener('click', () => {
      if (activeDrawerTxn && activeDrawerTxn.bankRef && activeDrawerTxn.bankRef !== '—') {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(activeDrawerTxn.bankRef).then(() => {
            showToast(`Copied Bank Reference: ${activeDrawerTxn.bankRef}`);
          }).catch(() => {
            showToast(`Reference: ${activeDrawerTxn.bankRef}`);
          });
        } else {
          showToast(`Reference: ${activeDrawerTxn.bankRef}`);
        }
      }
    });
  }

  // 8. Add Adjustment Modal
  const closeAddAdjModalBtn = document.getElementById('closeAddAdjustmentModalBtn');
  const cancelAddAdjBtn = document.getElementById('cancelAddAdjustmentBtn');
  const addAdjModal = document.getElementById('addAdjustmentModal');
  const addAdjForm = document.getElementById('addAdjustmentForm');

  if (closeAddAdjModalBtn) closeAddAdjModalBtn.addEventListener('click', closeAddAdjustmentModal);
  if (cancelAddAdjBtn) cancelAddAdjBtn.addEventListener('click', closeAddAdjustmentModal);

  if (addAdjModal) {
    addAdjModal.addEventListener('click', (e) => {
      if (e.target === addAdjModal) closeAddAdjustmentModal();
    });
  }

  if (addAdjForm) {
    addAdjForm.addEventListener('submit', handleAdjustmentSubmit);
  }

  // 9. Party Ledgers & Pharma Ageing Listeners
  const partySelect = document.getElementById('ledgerPartySelect');
  if (partySelect) {
    partySelect.addEventListener('change', () => {
      ledgerSelectedParty = partySelect.value;
      renderVirtualPartyLedgerView();
    });
  }

  const partyExportBtn = document.getElementById('ledgerPartyExportBtn');
  if (partyExportBtn) {
    partyExportBtn.addEventListener('click', () => {
      exportPartyLedgerToExcel(ledgerSelectedParty);
    });
  }

  const partyPrintBtn = document.getElementById('ledgerPartyPrintBtn');
  if (partyPrintBtn) {
    partyPrintBtn.addEventListener('click', () => {
      window.print();
    });
  }

  const ageingToggleRecBtn = document.getElementById('ageingToggleReceivablesBtn');
  const ageingTogglePayBtn = document.getElementById('ageingTogglePayablesBtn');
  if (ageingToggleRecBtn) {
    ageingToggleRecBtn.addEventListener('click', () => {
      ledgerAgeingType = 'receivables';
      renderVirtualAgeingTable('receivables');
    });
  }
  if (ageingTogglePayBtn) {
    ageingTogglePayBtn.addEventListener('click', () => {
      ledgerAgeingType = 'payables';
      renderVirtualAgeingTable('payables');
    });
  }

  // 9. Empty States Action Buttons
  const emptyGoBankBtn = document.getElementById('ledgerEmptyGoBankBtn');
  const emptyGoInvoicesBtn = document.getElementById('ledgerEmptyGoInvoicesBtn');
  const emptyGoInvoicesFromRecBtn = document.getElementById('ledgerEmptyGoInvoicesFromRecBtn');
  const emptyGoBillsBtn = document.getElementById('ledgerEmptyGoBillsBtn');
  const emptyAddAdjBtn = document.getElementById('ledgerEmptyAddAdjBtn');

  if (emptyGoBankBtn) emptyGoBankBtn.addEventListener('click', () => switchView('bank-statements'));
  if (emptyGoInvoicesBtn) emptyGoInvoicesBtn.addEventListener('click', () => switchView('invoices'));
  if (emptyGoInvoicesFromRecBtn) emptyGoInvoicesFromRecBtn.addEventListener('click', () => switchView('invoices'));
  if (emptyGoBillsBtn) {
    emptyGoBillsBtn.addEventListener('click', () => {
      if (billsCatalogModal) billsCatalogModal.style.display = 'flex';
      renderVendorBillsCatalogModal();
    });
  }
  if (emptyAddAdjBtn) emptyAddAdjBtn.addEventListener('click', openAddAdjustmentModal);

  // 10. Browser History Navigation
  window.addEventListener('popstate', () => {
    parseInitialRoute(false);
  });
}

function parseInitialRoute(updateHistory = false) {
  const path = (window.location.pathname || '').toLowerCase();
  const hash = (window.location.hash || '').toLowerCase();
  const search = (window.location.search || '').toLowerCase();

  if (path.includes('virtual-ledger') || hash.includes('virtual-ledger') || search.includes('virtual-ledger') || path.includes('ledger') || hash.includes('ledger')) {
    switchView('virtual-ledger', updateHistory);
  } else if (path.includes('invoices') || hash.includes('invoices') || search.includes('invoices')) {
    switchView('invoices', updateHistory);
  } else if (path.includes('dashboard') || hash.includes('dashboard') || search.includes('dashboard')) {
    switchView('dashboard', updateHistory);
  } else {
    switchView('bank-statements', updateHistory);
  }
}

// Setup Authentication Listeners & Session Handling (Pure Enterprise Sign In)
function setupSupabaseAuthListeners() {
  const authGateOverlay = document.getElementById('authGateOverlay');
  const authForm = document.getElementById('authForm');
  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  const authRememberMe = document.getElementById('authRememberMe');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authBtnSpinner = document.getElementById('authBtnSpinner');
  const authBtnText = document.getElementById('authBtnText');
  const authAlertBox = document.getElementById('authAlertBox');
  const authAlertText = document.getElementById('authAlertText');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const userProfileBtn = document.getElementById('userProfileBtn');
  const userProfileDropdown = document.getElementById('userProfileDropdown');
  const logoutBtn = document.getElementById('logoutBtn');
  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
  const btnForgotPass = document.getElementById('btnForgotPass');

  function showAlert(msg, isSuccess = false) {
    if (!authAlertBox || !authAlertText) return;
    authAlertBox.className = `auth-alert-box ${isSuccess ? 'alert-success' : 'alert-error'}`;
    authAlertText.textContent = msg;
    authAlertBox.style.display = 'flex';
  }

  function hideAlert() {
    if (authAlertBox) authAlertBox.style.display = 'none';
  }

  // 1. Password Visibility Toggle
  if (togglePasswordBtn && authPassword) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = authPassword.type === 'password';
      authPassword.type = isPassword ? 'text' : 'password';
      const eyeOpen = togglePasswordBtn.querySelector('.eye-open-icon');
      const eyeClosed = togglePasswordBtn.querySelector('.eye-closed-icon');
      if (eyeOpen && eyeClosed) {
        eyeOpen.style.display = isPassword ? 'none' : 'block';
        eyeClosed.style.display = isPassword ? 'block' : 'none';
      }
    });
  }

  // 2. Forgot Password Helper
  if (btnForgotPass) {
    btnForgotPass.addEventListener('click', () => {
      showAlert('Password reset: Please contact your IFIMED corporate IT administrator for password resets.', false);
    });
  }

  // 3. Form Submission (Secure Sign In)
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const email = authEmail ? authEmail.value.trim() : '';
      const password = authPassword ? authPassword.value : '';

      if (!email || !password) {
        showAlert('Please enter both your corporate email and password.');
        return;
      }

      // Show loading spinner
      if (authSubmitBtn) authSubmitBtn.disabled = true;
      if (authBtnSpinner) authBtnSpinner.style.display = 'inline-block';
      if (authBtnText) authBtnText.textContent = 'Verifying...';

      try {
        const res = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success || !data.user) {
          throw new Error(data.error || 'Invalid email or password. Please try again.');
        }

        if (authRememberMe && authRememberMe.checked) {
          localStorage.setItem('ifimed_auth_user', JSON.stringify(data.user));
        } else {
          sessionStorage.setItem('ifimed_auth_user', JSON.stringify(data.user));
        }
        updateAuthUI(data.user);
        showToast(`Welcome back, ${data.user.user_metadata && data.user.user_metadata.name ? data.user.user_metadata.name : data.user.email}!`);
      } catch (err) {
        console.error('Auth error:', err);
        showAlert(err.message || 'Invalid email or password. Please try again.');
      } finally {
        if (authSubmitBtn) authSubmitBtn.disabled = false;
        if (authBtnSpinner) authBtnSpinner.style.display = 'none';
        if (authBtnText) authBtnText.textContent = 'Sign In';
      }
    });
  }

  // 4. User Profile Dropdown Toggle
  if (userProfileBtn && userProfileDropdown) {
    userProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = userProfileDropdown.style.display === 'block';
      userProfileDropdown.style.display = isOpen ? 'none' : 'block';
      userProfileBtn.classList.toggle('active', !isOpen);
    });

    document.addEventListener('click', (e) => {
      if (userProfileDropdown && !userProfileDropdown.contains(e.target) && e.target !== userProfileBtn) {
        userProfileDropdown.style.display = 'none';
        userProfileBtn.classList.remove('active');
      }
    });
  }

  // 5. Sign Out Triggers
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleSignOut();
    });
  }

  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleSignOut();
    });
  }

  // 6. Session Restoration on Load
  const initSession = async () => {
    try {
      const savedUserStr = localStorage.getItem('ifimed_auth_user') || sessionStorage.getItem('ifimed_auth_user');
      if (savedUserStr) {
        try {
          const user = JSON.parse(savedUserStr);
          updateAuthUI(user);
          return;
        } catch (e) {}
      }

      // If no session exists, display the login gate
      updateAuthUI(null);
    } catch (e) {
      console.warn('Session restoration exception:', e);
      updateAuthUI(null);
    }
  };

  initSession();
}

// Expose bank deletion, detection, auto-match, and auth functions globally
window.promptDeleteBank = promptDeleteBank;
window.confirmDeleteBank = confirmDeleteBank;
window.closeDeleteBankModal = closeDeleteBankModal;
window.autoDetectBankAccounts = autoDetectBankAccounts;
window.autoMatchAllStatementData = autoMatchAllStatementData;
window.handleSignOut = handleSignOut;
window.updateAuthUI = updateAuthUI;
window.getSupabaseClient = getSupabaseClient;
window.loadFromSupabase = loadFromSupabase;
window.persistToSupabase = persistToSupabase;
window.renderVirtualLedgerView = renderVirtualLedgerView;
window.getVirtualLedgerData = getVirtualLedgerData;
window.getVirtualReceivablesData = getVirtualReceivablesData;
window.getVirtualPayablesData = getVirtualPayablesData;
window.openLedgerDetailDrawer = openLedgerDetailDrawer;
window.closeLedgerDetailDrawer = closeLedgerDetailDrawer;
window.openAddAdjustmentModal = openAddAdjustmentModal;
window.closeAddAdjustmentModal = closeAddAdjustmentModal;
window.exportVirtualLedger = exportVirtualLedger;
window.parseInitialRoute = parseInitialRoute;
window.clearAllInvoices = clearAllInvoices;
window.exportInvoicesToExcel = exportInvoicesToExcel;
window.exportInvoicesToCsv = exportInvoicesToCsv;
window.getPharmaAgeingData = getPharmaAgeingData;
window.renderVirtualAgeingTable = renderVirtualAgeingTable;
window.getPartyLedgerStatement = getPartyLedgerStatement;
window.renderVirtualPartyLedgerView = renderVirtualPartyLedgerView;
window.openPartyLedger = openPartyLedger;
window.exportPartyLedgerToExcel = exportPartyLedgerToExcel;
window.getVendorBillReconciliationData = getVendorBillReconciliationData;
window.validateStatementMatchesSavedBank = validateStatementMatchesSavedBank;
window.showStatementRejectionPopup = showStatementRejectionPopup;
window.closeStatementRejectionPopup = closeStatementRejectionPopup;
window.getActiveBank = getActiveBank;
window.setSelectedBankId = (id) => { selectedBankId = id; };
window.getSelectedBankId = () => selectedBankId;
window.getCorporateBanks = () => corporateBanks;
window.detectBankFromCsv = detectBankFromCsv;





