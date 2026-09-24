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
const autoDetectBanksBtn = document.getElementById('autoDetectBanksBtn');
const detectStatementsBtn = document.getElementById('detectStatementsBtn');

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
  try {
    await waitForInitialWorkspaceLoad();
    const localFiles = await fetchLocalStatementFiles();
    const beforeIds = new Set(corporateBanks.map(b => b.id));
    const detectedLabels = [];
    let registered = 0;

    localFiles.forEach(file => {
      const detection = registerBankFromSource(file.csvText, file.fileName);
      if (!detection || !detection.bank) return;
      if (!beforeIds.has(detection.bank.id)) {
        registered++;
        beforeIds.add(detection.bank.id);
      }
      const acc = detection.extracted && detection.extracted.fullAccNo
        ? detection.extracted.fullAccNo
        : (detection.bank.fullAccNo || detection.bank.accNo);
      detectedLabels.push(`${detection.bank.name} ${acc}`);
    });

    const { moved, updated } = rehomeUploadedSheetsBySource();

    let imported = 0;
    if (!workspaceHasStatementRows() && localFiles.length) {
      for (const file of localFiles) {
        await processBankStatementCsv(file.csvText, file.fileName, { autoApprove: true });
        imported++;
      }
    }

    const active = getActiveBank();
    if (active) {
      selectedBankId = active.id;
      if (active.sheets && active.sheets[0]) selectedMonthId = active.sheets[0].monthId;
    }
    activeConfirmingRowId = null;
    if (bankDropdownMenu) bankDropdownMenu.style.display = 'none';

    renderAll(false);
    await persistToSupabase();

    if (interactive) {
      const parts = [];
      if (detectedLabels.length) parts.push(detectedLabels.join(', '));
      if (registered) parts.push(`${registered} new account${registered === 1 ? '' : 's'} added`);
      if (updated) parts.push(`${updated} uploaded sheet${updated === 1 ? '' : 's'} re-read`);
      if (moved) parts.push(`${moved} sheet${moved === 1 ? '' : 's'} moved to the matching A/c`);
      if (imported) parts.push(`${imported} local file${imported === 1 ? '' : 's'} imported`);
      if (parts.length) {
        showToast(`Auto-detected accounts from statement files: ${parts[0]}${parts.length > 1 ? ` · ${parts.slice(1).join(' · ')}` : ''}.`);
      } else if (!localFiles.length && !workspaceHasStatementRows()) {
        showToast('No local statement files found. Upload a bank statement first.', 'amber');
      } else {
        showToast('Accounts already match the uploaded statement files.', 'info');
      }
    }
    return true;
  } catch (err) {
    console.error('Auto-detect accounts failed:', err);
    if (interactive) showToast('Could not auto-detect accounts from the statement files.', 'amber');
    return false;
  }
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

function findAutoMatchDoc(row, catalog, used, isDebit) {
  const haystack = `${row.narration || ''} ${row.bankRef || ''} ${row.payer || ''}`;
  const hay = haystack.toLowerCase();

  const catalogHits = (catalog || []).filter(doc => {
    const no = docNumberOf(doc);
    return no && no.length >= 4 && !used.has(no.toLowerCase()) && hay.includes(no.toLowerCase());
  });
  if (catalogHits.length === 1) {
    return { doc: catalogHits[0], reason: 'System (Reconciled from Statement)' };
  }
  if (catalogHits.length > 1) {
    const named = catalogHits.filter(doc => partyNamesMatch(row.payer || row.narration, partyNameOf(doc)));
    if (named.length === 1) return { doc: named[0], reason: 'System (Reconciled from Statement)' };
  }

  const codes = extractStatementDocCodes(haystack);
  const preferred = isDebit
    ? codes.filter(c => /^CNB|^BILL/.test(c)).concat(codes)
    : codes.filter(c => /^IFB|^INV/.test(c)).concat(codes);
  for (const code of preferred) {
    if (used.has(code.toLowerCase())) continue;
    const existing = (catalog || []).find(doc => docNumberOf(doc).toLowerCase() === code.toLowerCase());
    return { doc: existing || ensureCatalogDoc(code, row, isDebit), reason: 'System (Reconciled from Statement)' };
  }

  const amountHits = (catalog || []).filter(doc =>
    !used.has(docNumberOf(doc).toLowerCase()) &&
    Math.abs(Number(doc.amount) - Number(row.amount)) < 0.01
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

function parseAmount(val) {
  if (val === undefined || val === null) return 0;
  let str = String(val).trim();
  if (!str || str === '-' || str === '--' || str.toLowerCase() === 'nil' || str.toLowerCase() === 'na') return 0;
  if (isDateLikeValue(str)) return 0;
  const isNegative = (str.startsWith('(') && str.endsWith(')')) || str.endsWith('-') || str.toLowerCase().endsWith('dr');
  str = str.replace(/[^0-9.-]/g, '');
  if (!str || str === '-' || str === '.' || str === '-.') return 0;
  let num = parseFloat(str) || 0;
  if (isNegative) num = -Math.abs(num);
  return num;
}

function findPlausibleAmountInRow(cols, skipCols) {
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
  if (normalized.startsWith('total') ||
      normalized.includes('t o t a l') ||
      normalized.includes('closing balance') ||
      normalized.includes('opening balance') ||
      normalized.includes('end of statement') ||
      normalized.includes('generated on') ||
      normalized.includes('statement summary') ||
      normalized.includes('statement period') ||
      normalized.includes('page ') ||
      normalized.startsWith('count ') ||
      normalized.startsWith('grand total') ||
      normalized.includes('marg erp') ||
      normalized.includes('sales book') ||
      normalized.includes('purchase book') ||
      normalized.includes('online purchase import') ||
      /call\s*0\d{8,}/.test(normalized) ||
      /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\s*[-–to]+\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/i.test(normalized)) {
    return true;
  }
  return false;
}

function isGstOrSalesRegisterFile(fileName, csvText) {
  const sample = `${fileName || ''} ${(csvText || '').slice(0, 8000)}`.toLowerCase();
  if (/gstr|gst[_\s-]?r(?:eturn)?|gstr-?1|gst r-?1|e-?invoice|einvoice/.test(sample)) return true;
  if (/sales\s*book|sales\s*register|invoice\s*register|invoice\s*book|marg\s*erp/.test(sample)) return true;
  const invoiceHits = ((csvText || '').match(/\bIFB\d{4,}\b/gi) || []).length;
  const hasBankCue = /ifsc|a\/c no|account no|withdrawal|deposit \(cr\)|bank statement|\butr\b|cheque no/i.test(sample);
  return invoiceHits >= 5 && !hasBankCue;
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

function detectBankFromCsv(csvText, fileName = '', options = {}) {
  if (!Array.isArray(corporateBanks) || corporateBanks.length === 0) {
    corporateBanks = [
      {
        id: 'icici-3021',
        name: 'ICICI Bank',
        type: 'Current A/c',
        accNo: '••••3021',
        fullAccNo: '000205003021',
        ifsc: 'ICIC0000002',
        branch: 'Mysore Main Branch, Karnataka',
        sheets: []
      }
    ];
  }

  const sheetNames = (options && options.sheetNames) || [];
  const extracted = extractStatementBankDetails(csvText, fileName, sheetNames);
  const meta = statementMetadataText(csvText);
  const fileMeta = `${fileName || ''} ${sheetNames.join(' ')} ${meta}`;

  const brands = [
    { idPrefix: 'icici', name: 'ICICI Bank', fileRe: /(?:^|[^a-z0-9])icici(?:[^a-z0-9]|$)/i, metaRe: /(?:^|[^a-z0-9])icici(?:[^a-z0-9]|$)/i, ifscRe: /\bicic0[a-z0-9]{6}\b/i, defaultIfsc: '' },
    { idPrefix: 'axis', name: 'Axis Bank', fileRe: /(?:^|[^a-z0-9])axis(?:[^a-z0-9]|$)/i, metaRe: /\baxis\s+bank\b|\butib0/i, ifscRe: /\butib0[a-z0-9]{6}\b/i, defaultIfsc: '' },
    { idPrefix: 'kotak', name: 'Kotak Mahindra Bank', fileRe: /(?:^|[^a-z0-9])kotak(?:[^a-z0-9]|$)/i, metaRe: /(?:^|[^a-z0-9])kotak(?:[^a-z0-9]|$)/i, ifscRe: /\bkkbk0[a-z0-9]{6}\b/i, defaultIfsc: '' },
    { idPrefix: 'canara', name: 'Canara Bank', fileRe: /(?:^|[^a-z0-9])canara(?:[^a-z0-9]|$)/i, metaRe: /(?:^|[^a-z0-9])canara(?:[^a-z0-9]|$)/i, ifscRe: /\bcnrb0[a-z0-9]{6}\b/i, defaultIfsc: '' },
    { idPrefix: 'hdfc', name: 'HDFC Bank', fileRe: /(?:^|[^a-z0-9])hdfc(?:[^a-z0-9]|$)/i, metaRe: /(?:^|[^a-z0-9])hdfc(?:[^a-z0-9]|$)/i, ifscRe: /\bhdfc0[a-z0-9]{6}\b/i, defaultIfsc: '' },
    { idPrefix: 'sbi', name: 'State Bank of India', fileRe: /\b(?:sbi|state[_\s-]?bank)\b/i, metaRe: /\bstate bank\b|\bsbin0/i, ifscRe: /\bsbin0[a-z0-9]{6}\b/i, defaultIfsc: '' },
    { idPrefix: 'pnb', name: 'Punjab National Bank', fileRe: /\bpnb\b|punjab\s+national/i, metaRe: /\bpunjab national\b|\bpunb0/i, ifscRe: /\bpunb0[a-z0-9]{6}\b/i, defaultIfsc: '' },
    { idPrefix: 'bob', name: 'Bank of Baroda', fileRe: /\bbaroda\b/i, metaRe: /\bbank of baroda\b|\bbarb0/i, ifscRe: /\bbarb0[a-z0-9]{6}\b/i, defaultIfsc: '' },
    { idPrefix: 'indusind', name: 'IndusInd Bank', fileRe: /\bindusind\b/i, metaRe: /\bindusind\b|\bindb0/i, ifscRe: /\bindb0[a-z0-9]{6}\b/i, defaultIfsc: '' },
    { idPrefix: 'yes', name: 'YES Bank', fileRe: /\byes[_\s-]?bank\b/i, metaRe: /\byes bank\b|\byesb0/i, ifscRe: /\byesb0[a-z0-9]{6}\b/i, defaultIfsc: '' },
    { idPrefix: 'union', name: 'Union Bank of India', fileRe: /\bunion[_\s-]?bank\b/i, metaRe: /\bunion bank\b|\bubin0/i, ifscRe: /\bubin0[a-z0-9]{6}\b/i, defaultIfsc: '' },
    { idPrefix: 'federal', name: 'Federal Bank', fileRe: /\bfederal\s+bank\b/i, metaRe: /\bfederal bank\b|\bfdrl0/i, ifscRe: /\bfdrl0[a-z0-9]{6}\b/i, defaultIfsc: '' },
    { idPrefix: 'idfc', name: 'IDFC First Bank', fileRe: /\bidfc\b/i, metaRe: /\bidfc\b|\bidfb0/i, ifscRe: /\bidfb0[a-z0-9]{6}\b/i, defaultIfsc: '' },
    { idPrefix: 'scb', name: 'Standard Chartered', fileRe: /\bstandard[_\s-]?chartered\b/i, metaRe: /\bstandard chartered\b|\bscbl0/i, ifscRe: /\bscbl0[a-z0-9]{6}\b/i, defaultIfsc: '' }
  ];

  function findBrand(idPrefix, name) {
    return brands.find(b => b.idPrefix === idPrefix) ||
      brands.find(b => name && b.name.toLowerCase() === String(name).toLowerCase()) ||
      { idPrefix: idPrefix || 'bank', name: name || 'Corporate Bank', defaultIfsc: '' };
  }

  function registerBankFromExtracted(brand, reason, confidence) {
    const foundAcc = extracted.fullAccNo || '';
    const accSuffix = foundAcc ? foundAcc.slice(-4) : String(Math.floor(1000 + Math.random() * 9000));
    const existingId = `${brand.idPrefix}-${accSuffix}`;
    const already = corporateBanks.find(b => b.id === existingId || accountsEqual(b.fullAccNo, foundAcc));
    if (already) {
      return { bank: already, isNew: false, confidence, reason, extracted };
    }
    const newBank = {
      id: existingId,
      name: brand.name,
      type: 'Current A/c',
      accNo: `••••${accSuffix}`,
      fullAccNo: foundAcc || '',
      ifsc: extracted.ifsc || brand.defaultIfsc || '',
      branch: extracted.branch || extracted.holder || '',
      sheets: []
    };
    corporateBanks.push(newBank);
    return {
      bank: newBank,
      isNew: true,
      confidence,
      reason: reason || `Registered ${brand.name} A/c ${newBank.accNo} from the statement`,
      extracted
    };
  }

  if (extracted.fullAccNo && extracted.fullAccNo.length >= 8) {
    const byAcc = corporateBanks.find(b => accountsEqual(b.fullAccNo, extracted.fullAccNo));
    if (byAcc) {
      return { bank: byAcc, isNew: false, confidence: 'high', reason: `Read A/c ${extracted.fullAccNo} from the statement header`, extracted };
    }
  }

  if (extracted.ifsc) {
    const byIfsc = corporateBanks.find(b => String(b.ifsc || '').toUpperCase() === extracted.ifsc);
    if (byIfsc && (!extracted.fullAccNo || accountsEqual(byIfsc.fullAccNo, extracted.fullAccNo))) {
      return { bank: byIfsc, isNew: false, confidence: 'high', reason: `Read IFSC ${extracted.ifsc} from the statement header`, extracted };
    }
  }

  if (extracted.idPrefix || extracted.name) {
    const brand = findBrand(extracted.idPrefix, extracted.name);
    if (extracted.fullAccNo) {
      return registerBankFromExtracted(brand, extracted.idPrefix ? `Identified ${brand.name} from the statement layout and A/c ${extracted.fullAccNo}` : `Identified ${brand.name}`, 'high');
    }
    const sameBrand = corporateBanks.filter(b =>
      String(b.id || '').toLowerCase().includes(brand.idPrefix) ||
      String(b.name || '').toLowerCase().includes(brand.idPrefix)
    );
    if (sameBrand.length === 1) {
      return { bank: sameBrand[0], isNew: false, confidence: 'medium', reason: `Identified ${brand.name}; confirm the account`, extracted };
    }
    return registerBankFromExtracted(brand, `Identified ${brand.name}`, 'medium');
  }

  const named = brands.find(brand => brand.fileRe.test(fileName || '') || brand.metaRe.test(fileMeta) || brand.ifscRe.test(meta));
  if (named) {
    extracted.name = extracted.name || named.name;
    extracted.idPrefix = extracted.idPrefix || named.idPrefix;
    if (extracted.fullAccNo) {
      return registerBankFromExtracted(named, `Filename/header matches ${named.name} A/c ${extracted.fullAccNo}`, 'high');
    }
    const sameBrand = corporateBanks.filter(b =>
      String(b.id || '').toLowerCase().includes(named.idPrefix) ||
      String(b.name || '').toLowerCase().includes(named.idPrefix)
    );
    if (sameBrand.length === 1) {
      return { bank: sameBrand[0], isNew: false, confidence: 'medium', reason: `Filename/header matches ${named.name}`, extracted };
    }
    return registerBankFromExtracted(named, `Filename/header matches ${named.name}`, 'medium');
  }

  const active = getActiveBank() || corporateBanks[0];
  if (active) {
    return { bank: active, isNew: false, confidence: 'low', reason: `Could not read a bank name or A/c from the file. Suggested: ${active.name} ${active.accNo}`, extracted };
  }

  const defaultBank = {
    id: 'corp-bank-01',
    name: 'Primary Corporate Bank',
    type: 'Current A/c',
    accNo: '••••0001',
    fullAccNo: '000000000001',
    ifsc: '',
    branch: '',
    sheets: []
  };
  corporateBanks.push(defaultBank);
  return { bank: defaultBank, isNew: true, confidence: 'low', reason: 'Created default corporate bank', extracted };
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
    showToast('Detected a sales / GST register — saving as customer invoices.', 'info');
    await processInvoiceCsv(csvText);
    return;
  }
  if (isPurchaseRegister(fileName, csvText)) {
    showToast('Detected a purchase register — saving as vendor bills.', 'info');
    await processVendorBillCsv(csvText);
    return;
  }

  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    showToast('Statement file contains only a single line or no transaction data.', 'amber');
    return;
  }

  const detectionResult = detectBankFromCsv(csvText, fileName, options);
  const bank = detectionResult.bank;
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
    showToast('CSV file is empty or missing data rows', 'amber');
    return;
  }

  // Column header auto-discovery with scoring
  let headerIndex = -1;
  let invNoCol = -1, custCol = -1, amtCol = -1, dateCol = -1, catCol = -1;

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    if (isSummaryOrFooterLine(lines[i])) continue;
    const rawCols = parseCsvLine(lines[i], delimiter).map(c => c.trim().toLowerCase().replace(/[_\-\/\.\(\)\s]+/g, ' '));
    const iIdx = rawCols.findIndex(c => c === 'invoice' || c === 'inv' || c === 'invoice no' || c === 'inv no' || c === 'bill no' || c === 'vch no' || c === 'voucher no' || c === 'doc no' || c.includes('inv') || c.includes('bill no'));
    const cIdx = rawCols.findIndex(c => c === 'customer' || c === 'party' || c === 'party name' || c === 'customer name' || c === 'client' || c === 'guest' || c === 'particulars' || c.includes('customer') || c.includes('party') || c.includes('name'));
    const aIdx = rawCols.findIndex(c => c === 'amount' || c === 'amt' || c === 'total' || c === 'net total' || c === 'gross total' || c === 'net amount' || c === 'invoice value' || c.includes('amount') || c.includes('total'));
    const dIdx = rawCols.findIndex(c => c === 'date' || c === 'dt' || c === 'inv date' || c === 'invoice date' || c === 'vch date' || c.includes('date'));
    const kIdx = rawCols.findIndex(c => c === 'category' || c === 'type' || c === 'vch type' || c === 'voucher type' || c.includes('category') || c.includes('type'));

    if (iIdx !== -1 || (cIdx !== -1 && aIdx !== -1) || (dIdx !== -1 && aIdx !== -1)) {
      headerIndex = i;
      invNoCol = iIdx;
      custCol = cIdx;
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

    let invoiceNo = (invNoCol >= 0 && cols[invNoCol]) ? cols[invNoCol].trim() : '';
    if (!invoiceNo) {
      const ifbCol = cols.find(c => /\bIFB\d{4,}\b/i.test(c));
      invoiceNo = ifbCol ? (ifbCol.match(/\bIFB\d{4,}\b/i)[0].toUpperCase()) : (cols[0] || `INV-${Date.now()}-${i}`);
    }
    const customer = (custCol >= 0 && cols[custCol]) ? cols[custCol].trim() : (cols[1] || 'Corporate Client');
    let amount = parseAmount(amtCol >= 0 ? cols[amtCol] : '');
    const date = (dateCol >= 0 && cols[dateCol]) ? cols[dateCol].trim() : (cols.find(c => isValidTransactionDate(c)) || '19 Sep 2026');
    const category = (catCol >= 0 && cols[catCol]) ? cols[catCol].trim() : (cols[4] || 'Regular B2B Tax Invoice');

    if (!isPlausibleMoneyAmount(amount) || amountLooksLikeDateDigits(amount, date) || isDateLikeValue(amtCol >= 0 ? cols[amtCol] : '')) {
      amount = findPlausibleAmountInRow(cols, [dateCol, invNoCol, custCol]);
    }
    if (!isPlausibleMoneyAmount(amount) || amountLooksLikeDateDigits(amount, date)) continue;
    if (isDateLikeValue(invoiceNo) || /^\d{1,3}$/.test(invoiceNo)) continue;

    if (!appInvoices.some(inv => inv.invoiceNo.toLowerCase() === invoiceNo.toLowerCase())) {
      appInvoices.unshift({
        invoiceNo,
        guestName: customer,
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
  showToast(`Imported ${added} customer invoices from CSV & stored in Supabase DB!`, added > 0 ? 'success' : 'amber');
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
    { title: 'View Financial Dashboard', desc: 'Jump to executive analytics', action: () => switchView('dashboard') },
    { title: 'Add Invoice Manually', desc: 'Create new pending customer sales invoice', action: () => { if (openAddInvoiceModalBtn) openAddInvoiceModalBtn.click(); } },
    { title: 'Add Vendor Bill Manually', desc: 'Create new pending supplier purchase bill', action: () => { if (openAddBillModalBtn) openAddBillModalBtn.click(); } },
    { title: 'View Invoices Catalog', desc: 'Inspect available customer invoice records', action: () => { if (viewInvoicesBtn) viewInvoicesBtn.click(); } },
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
  if (navBankStatements) navBankStatements.addEventListener('click', () => switchView('bank-statements'));
  const breadcrumbDashboard = document.getElementById('breadcrumbDashboard');
  if (breadcrumbDashboard) {
    breadcrumbDashboard.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('dashboard');
    });
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

  if (autoDetectBanksBtn) {
    autoDetectBanksBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      autoDetectBanksBtn.disabled = true;
      try { await autoDetectBankAccounts(true); }
      finally { autoDetectBanksBtn.disabled = false; }
    });
  }

  if (detectStatementsBtn) {
    detectStatementsBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      detectStatementsBtn.disabled = true;
      try { await autoDetectBankAccounts(true); }
      finally { detectStatementsBtn.disabled = false; }
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
      if (invoiceCsvInput.files && invoiceCsvInput.files.length > 0) {
        const file = invoiceCsvInput.files[0];
        showToast(`Reading customer invoices: ${file.name}...`, 'info');
        readStatementFile(file, async (content) => {
          try {
            await processInvoiceCsv(content);
            if (typeof renderInvoicesCatalogModal === 'function') renderInvoicesCatalogModal();
          } catch (err) {
            console.error('Error processing customer invoices:', err);
            showToast(`Error processing invoice CSV: ${err.message}`, 'amber');
          }
        });
        setTimeout(() => {
          try { invoiceCsvInput.value = ''; } catch (e) {}
        }, 500);
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
      if (addBillModal) addBillModal.style.display = 'none';
      if (addBankModal) addBankModal.style.display = 'none';
      if (invoicesCatalogModal) invoicesCatalogModal.style.display = 'none';
      if (billsCatalogModal) billsCatalogModal.style.display = 'none';
      if (unlinkModal) unlinkModal.style.display = 'none';
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

  // Initial Boot
  renderAll(false);

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


