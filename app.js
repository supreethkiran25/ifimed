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
const SUPABASE_URL = 'https://bdvktgrehxwjovhycvsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5UIETbqIx6cB_-GcicQqUg_KcjPysFm';

let supabaseClient = null;
let currentAuthUser = null;

function getSupabaseClient() {
  if (!supabaseClient && typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    } catch (e) {
      console.warn('Supabase initialization error:', e);
    }
  }
  return supabaseClient;
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
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
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
  if (type) {
    const prefixRegex = new RegExp(`^${type}[-_/\\s]+`, 'i');
    if (prefixRegex.test(bankRef)) {
      return bankRef.replace(prefixRegex, '');
    }
  }
  return bankRef;
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

async function autoDetectBankAccounts(interactive = true) {
  try {
    const res = await fetch('/api/detect-banks');
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      const data = await res.json();
      if (data.success && data.accounts && data.accounts.length > 0) {
        corporateBanks = data.accounts;
        if (data.invoices && Array.isArray(data.invoices)) {
          appInvoices = data.invoices;
        }
        if (data.bills && Array.isArray(data.bills)) {
          appVendorBills = data.bills;
        }
        selectedBankId = corporateBanks[0].id;
        selectedMonthId = (corporateBanks[0].sheets && corporateBanks[0].sheets[0]) ? corporateBanks[0].sheets[0].monthId : '2026-07';
        activeConfirmingRowId = null;
        if (bankDropdownMenu) bankDropdownMenu.style.display = 'none';
        renderAll();
        if (interactive) {
          showToast(`⚡ Successfully detected & loaded ${data.accounts.length} bank accounts from statements!`);
        }
        return true;
      }
    }
  } catch (err) {}

  if (typeof REAL_CORPORATE_BANKS !== 'undefined' && Array.isArray(REAL_CORPORATE_BANKS)) {
    corporateBanks = JSON.parse(JSON.stringify(REAL_CORPORATE_BANKS));
    selectedBankId = corporateBanks[0].id;
    selectedMonthId = (corporateBanks[0].sheets && corporateBanks[0].sheets[0]) ? corporateBanks[0].sheets[0].monthId : '2026-07';
    activeConfirmingRowId = null;
    if (bankDropdownMenu) bankDropdownMenu.style.display = 'none';
    renderAll();
    if (interactive) {
      showToast(`⚡ Detected and loaded 3 corporate bank accounts from IFIMED statement files!`);
    }
    return true;
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
  if (footerBankDetails) footerBankDetails.textContent = `${bank.name} ${bank.type} (${bank.fullAccNo || bank.accNo}) · IFSC: ${bank.ifsc}`;

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
        <td colspan="4">
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
    if (mode === 'all') {
      thAmountLabel.textContent = 'AMOUNT (INFLOW / OUTFLOW)';
    } else if (mode === 'credit') {
      thAmountLabel.textContent = 'CREDIT AMOUNT';
    } else {
      thAmountLabel.textContent = 'DEBIT AMOUNT';
    }
  }
  if (thMappingLabel) {
    if (mode === 'all') {
      thMappingLabel.textContent = 'MATCHING RECORD (INVOICE / BILL)';
    } else if (mode === 'credit') {
      thMappingLabel.textContent = 'INVOICE MAPPING';
    } else {
      thMappingLabel.textContent = 'VENDOR BILL MAPPING';
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
      <td class="col-date">${escapeHtml(row.date)}</td>
      <td class="col-narration">
        <div class="narration-primary">${escapeHtml(row.narration)}</div>
        ${row.payer ? `<div class="narration-secondary">${escapeHtml(row.payer)}</div>` : ''}
      </td>
      <td class="col-ref">
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

function autoMatchAllStatementData(interactive = true) {
  const currentSheet = getCurrentSheet();
  if (!currentSheet) return;

  const invMap = new Map();
  appInvoices.forEach(i => invMap.set(i.invoiceNo.toLowerCase(), i));
  const billMap = new Map();
  appVendorBills.forEach(b => billMap.set(b.billNo.toLowerCase(), b));

  let matchedCredits = 0;
  (currentSheet.records || []).forEach(r => {
    if (r.status !== 'mapped') {
      const match = (r.narration && r.narration.match(/IFB\d+/i)) || 
                    (r.narration && r.narration.match(/CNB?\d+/i)) ||
                    (r.bankRef && r.bankRef.match(/IFB\d+/i)) ||
                    (r.bankRef && r.bankRef.match(/CNB?\d+/i));
      const code = match ? match[0].toLowerCase() : null;
      const doc = code ? (invMap.get(code) || billMap.get(code)) : null;

      if (doc) {
        r.status = 'mapped';
        r.mapping = {
          invoiceNo: doc.invoiceNo || doc.billNo,
          billNo: doc.billNo || doc.invoiceNo,
          guestName: doc.guestName || doc.vendorName,
          vendorName: doc.vendorName || doc.guestName,
          mappedAt: (r.date || '31 Jul 2026') + ' 04:30 PM',
          mappedBy: 'System (Reconciled from Statement)',
          isNote: false
        };
        matchedCredits++;
      } else {
        const amtMatch = appInvoices.find(d => Math.abs(d.amount - r.amount) < 0.01);
        if (amtMatch) {
          r.status = 'mapped';
          r.mapping = {
            invoiceNo: amtMatch.invoiceNo,
            billNo: amtMatch.invoiceNo,
            guestName: amtMatch.guestName,
            vendorName: amtMatch.guestName,
            mappedAt: (r.date || '31 Jul 2026') + ' 04:30 PM',
            mappedBy: 'System (Auto-Matched by Amount)',
            isNote: false
          };
          matchedCredits++;
        }
      }
    }
  });

  let matchedDebits = 0;
  (currentSheet.debitRecords || []).forEach(r => {
    if (r.status !== 'mapped') {
      const match = (r.narration && r.narration.match(/CNB?\d+/i)) ||
                    (r.bankRef && r.bankRef.match(/CNB?\d+/i)) ||
                    (r.narration && r.narration.match(/IFB\d+/i)) ||
                    (r.bankRef && r.bankRef.match(/IFB\d+/i));
      const code = match ? match[0].toLowerCase() : null;
      const doc = code ? (billMap.get(code) || invMap.get(code)) : null;

      if (doc) {
        r.status = 'mapped';
        r.mapping = {
          billNo: doc.billNo || doc.invoiceNo,
          invoiceNo: doc.invoiceNo || doc.billNo,
          vendorName: doc.vendorName || doc.guestName,
          guestName: doc.guestName || doc.vendorName,
          mappedAt: (r.date || '31 Jul 2026') + ' 05:15 PM',
          mappedBy: 'System (Reconciled from Statement)',
          isNote: false
        };
        matchedDebits++;
      } else {
        const amtMatch = appVendorBills.find(d => Math.abs(d.amount - r.amount) < 0.01);
        if (amtMatch) {
          r.status = 'mapped';
          r.mapping = {
            billNo: amtMatch.billNo,
            invoiceNo: amtMatch.billNo,
            vendorName: amtMatch.vendorName,
            guestName: amtMatch.vendorName,
            mappedAt: (r.date || '31 Jul 2026') + ' 05:15 PM',
            mappedBy: 'System (Auto-Matched by Amount)',
            isNote: false
          };
          matchedDebits++;
        }
      }
    }
  });

  const totalMatched = matchedCredits + matchedDebits;
  renderAll();

  if (interactive) {
    if (totalMatched > 0) {
      showToast(`⚡ Auto-matched & reconciled ${totalMatched} statement record${totalMatched !== 1 ? 's' : ''}!`);
    } else {
      showToast('All statement records are already reconciled according to the statement files.');
    }
  }
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
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(str)) return true;
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(str)) return true;
  if (/^\d{1,2}[\s\-\/][A-Za-z]{3,9}[\s\-\/,]+\d{2,4}$/.test(str)) return true;
  if (/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}$/.test(str)) return true;
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\s*[-–to]+\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/i.test(str)) return true;
  return false;
}

function isValidTransactionDate(dateStr) {
  const str = String(dateStr == null ? '' : dateStr).trim();
  if (!str || str.length > 28) return false;
  if (/^\d{1,3}$/.test(str)) return false;
  if (/\s[-–]\s/.test(str) || /\s+to\s+/i.test(str)) return false;
  return isDateLikeValue(str);
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
    let score = 0;

    rawCols.forEach((c, idx) => {
      const clean = c.replace(/[_\-\/\.\(\)\s]+/g, ' ').trim();

      // Date column
      if (dateCol === -1 && (
        clean === 'date' || clean === 'dt' || clean === 'txn date' || clean === 'trans date' ||
        clean === 'transaction date' || clean === 'value date' || clean === 'booking date' ||
        clean === 'posting date' || clean === 'entry date' || clean === 'vch date' || clean === 'bill date' ||
        clean.includes('date') || clean.includes('txn dt')
      )) {
        dateCol = idx;
        score += 4;
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
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csvText = XLSX.utils.sheet_to_csv(worksheet);
        onLoaded(csvText, fileName);
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
    onLoaded(text, fileName);
  };
  reader.onerror = (err) => {
    console.error('FileReader error on CSV:', err);
    showToast('Error reading CSV statement from disk', 'error');
  };
  reader.readAsText(file);
}

function detectBankFromCsv(csvText, fileName = '') {
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

  const textSample = (fileName + ' ' + csvText.slice(0, 8000)).toLowerCase();

  // 1. Check existing corporate banks first
  for (const b of corporateBanks) {
    if (b.fullAccNo && textSample.includes(b.fullAccNo.toLowerCase())) {
      return { bank: b, isNew: false, reason: `Matched full account number ${b.fullAccNo}` };
    }
    if (b.ifsc && textSample.includes(b.ifsc.toLowerCase())) {
      return { bank: b, isNew: false, reason: `Matched IFSC ${b.ifsc}` };
    }
    const suffix = (b.accNo || '').replace(/[^\d]/g, '');
    if (suffix && suffix.length >= 4) {
      const suffixRegex = new RegExp(`(?:a\\/c|acct|acc|account|no|no\\.|#)[^\\w\\d]{0,6}\\d*${suffix}`, 'i');
      if (suffixRegex.test(textSample) || (fileName && fileName.toLowerCase().includes(suffix))) {
        return { bank: b, isNew: false, reason: `Matched account suffix ••••${suffix}` };
      }
    }
    const bName = b.name.toLowerCase();
    const cleanBName = bName.replace(/\s+bank/g, '').trim();
    if (textSample.includes(bName) || (fileName && fileName.toLowerCase().includes(cleanBName))) {
      return { bank: b, isNew: false, reason: `Matched bank name "${b.name}"` };
    }
  }

  // 2. Signature match for known Indian Commercial Banks
  const bankSignatures = [
    { name: 'ICICI Bank', keywords: ['icici', 'icic', 'icic0', '000205003021'], ifscPrefix: 'ICIC', defaultIfsc: 'ICIC0000002', idPrefix: 'icici' },
    { name: 'Axis Bank', keywords: ['axis', 'utib', 'utib0', '921020007419821'], ifscPrefix: 'UTIB', defaultIfsc: 'UTIB0000042', idPrefix: 'axis' },
    { name: 'Kotak Mahindra Bank', keywords: ['kotak', 'kkbk', 'kkbk0', '711200988502'], ifscPrefix: 'KKBK', defaultIfsc: 'KKBK0000421', idPrefix: 'kotak' },
    { name: 'Canara Bank', keywords: ['canara', 'cnrb', 'cnrb0', '129088192019'], ifscPrefix: 'CNRB', defaultIfsc: 'CNRB0001928', idPrefix: 'canara' },
    { name: 'HDFC Bank', keywords: ['hdfc', 'hdfc0'], ifscPrefix: 'HDFC', defaultIfsc: 'HDFC0000128', idPrefix: 'hdfc' },
    { name: 'State Bank of India', keywords: ['sbi', 'sbin', 'state bank'], ifscPrefix: 'SBIN', defaultIfsc: 'SBIN0000412', idPrefix: 'sbi' },
    { name: 'Punjab National Bank', keywords: ['punjab national', 'pnb', 'punb'], ifscPrefix: 'PUNB', defaultIfsc: 'PUNB0002100', idPrefix: 'pnb' },
    { name: 'Bank of Baroda', keywords: ['bank of baroda', 'bob', 'barb'], ifscPrefix: 'BARB', defaultIfsc: 'BARB0000010', idPrefix: 'bob' },
    { name: 'IndusInd Bank', keywords: ['indusind', 'indb'], ifscPrefix: 'INDB', defaultIfsc: 'INDB0000050', idPrefix: 'indusind' },
    { name: 'YES Bank', keywords: ['yes bank', 'yesb'], ifscPrefix: 'YESB', defaultIfsc: 'YESB0000001', idPrefix: 'yes' },
    { name: 'Union Bank of India', keywords: ['union bank', 'ubin'], ifscPrefix: 'UBIN', defaultIfsc: 'UBIN0000001', idPrefix: 'union' },
    { name: 'Federal Bank', keywords: ['federal bank', 'fdrl'], ifscPrefix: 'FDRL', defaultIfsc: 'FDRL0000101', idPrefix: 'federal' },
    { name: 'IDFC First Bank', keywords: ['idfc', 'idfb'], ifscPrefix: 'IDFB', defaultIfsc: 'IDFB0000101', idPrefix: 'idfc' },
    { name: 'Standard Chartered', keywords: ['standard chartered', 'scbl'], ifscPrefix: 'SCBL', defaultIfsc: 'SCBL0000101', idPrefix: 'scb' }
  ];

  for (const sig of bankSignatures) {
    const matched = sig.keywords.find(kw => textSample.includes(kw));
    if (matched) {
      const existing = corporateBanks.find(b =>
        b.name.toLowerCase().includes(sig.idPrefix) || b.id.toLowerCase().includes(sig.idPrefix)
      );
      if (existing) {
        return { bank: existing, isNew: false, reason: `Identified ${existing.name} via "${matched}"` };
      }

      // Auto-register new bank
      let foundAcc = '';
      const accMatch = textSample.match(/(?:a\/c|account|acct|acc|no|#)[^\d]{0,8}(\d{9,18})/i);
      if (accMatch) {
        foundAcc = accMatch[1];
      } else {
        const digitMatch = csvText.slice(0, 3000).match(/\b\d{10,16}\b/);
        if (digitMatch) foundAcc = digitMatch[0];
      }

      const accSuffix = foundAcc ? foundAcc.slice(-4) : String(Math.floor(1000 + Math.random() * 9000));
      const fullAcc = foundAcc || `00000000${accSuffix}`;
      const newBankId = `${sig.idPrefix}-${accSuffix}`;

      const ifscMatch = textSample.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/i);
      const ifsc = ifscMatch ? ifscMatch[1].toUpperCase() : sig.defaultIfsc;

      const newBank = {
        id: newBankId,
        name: sig.name,
        type: 'Current A/c',
        accNo: `••••${accSuffix}`,
        fullAccNo: fullAcc,
        ifsc: ifsc,
        branch: 'Corporate Commercial Branch',
        sheets: []
      };

      corporateBanks.push(newBank);
      return { bank: newBank, isNew: true, reason: `Auto-registered new account ${sig.name} (${newBank.accNo})` };
    }
  }

  // 3. Fallback to active bank or first bank
  const active = getActiveBank() || corporateBanks[0];
  if (active) {
    return { bank: active, isNew: false, reason: `Defaulted to current active bank (${active.name})` };
  }

  // Fallback create default bank if list was completely empty
  const defaultBank = {
    id: 'corp-bank-01',
    name: 'Primary Corporate Bank',
    type: 'Current A/c',
    accNo: '••••0001',
    fullAccNo: '000000000001',
    ifsc: 'CORP0000001',
    branch: 'Corporate Finance Branch',
    sheets: []
  };
  corporateBanks.push(defaultBank);
  return { bank: defaultBank, isNew: true, reason: 'Created default corporate bank' };
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
      if (m >= 1 && m <= 12 && y >= 2020 && y <= 2035) {
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
      if (m >= 1 && m <= 12 && y >= 2020 && y <= 2035) {
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
      if (m && y >= 2020 && y <= 2035) {
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
      if (m && y >= 2020 && y <= 2035) {
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

async function processBankStatementCsv(csvText, fileName = '') {
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

  // 1. Detect Bank Account
  const detectionResult = detectBankFromCsv(csvText, fileName);
  const bank = detectionResult.bank;
  if (!bank.sheets) bank.sheets = [];

  // 2. Detect Statement Month & Year
  const detectedMonth = detectMonthFromCsvLines(lines);

  // 3. Locate or create monthly sheet for this bank
  let targetSheet = bank.sheets.find(s => s.monthId === detectedMonth.monthId);
  if (!targetSheet) {
    targetSheet = {
      monthId: detectedMonth.monthId,
      label: detectedMonth.label,
      fileName: fileName || `${bank.name.replace(/\s+/g, '_')}_${detectedMonth.monthName}_${detectedMonth.year}.csv`,
      uploadedOn: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      creditsCount: 0,
      debitsCount: 0,
      records: [],
      debitRecords: []
    };
    bank.sheets.unshift(targetSheet);
  } else {
    // Bring active sheet to front of list
    targetSheet.fileName = fileName || targetSheet.fileName;
    targetSheet.uploadedOn = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  if (!targetSheet.records) targetSheet.records = [];
  if (!targetSheet.debitRecords) targetSheet.debitRecords = [];

  // 4. Build deduplication sets
  const existingCreditSet = new Set(
    targetSheet.records.map(r => `${r.date}|${r.amount}|${r.type}|${r.bankRef}`.toLowerCase())
  );
  const existingDebitSet = new Set(
    targetSheet.debitRecords.map(r => `${r.date}|${r.amount}|${r.type}|${r.bankRef}`.toLowerCase())
  );

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

    // Extract fields
    const date = (dateCol >= 0 && cols[dateCol]) ? cols[dateCol].trim() : (cols[0] || '');
    if (!isValidTransactionDate(date)) continue;
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
          targetSheet.records.unshift({
            id: `CR-IMP-${Date.now()}-${addedCredits}`,
            date: date,
            narration: narration,
            payer: payer,
            type: type,
            bankRef: ref,
            amount: crVal,
            status: 'unmapped',
            mapping: null
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
          targetSheet.debitRecords.unshift({
            id: `DR-IMP-${Date.now()}-${addedDebits}`,
            date: date,
            narration: narration,
            payer: payer || 'Vendor',
            type: type,
            bankRef: ref,
            amount: drVal,
            status: 'unmapped',
            mapping: null
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
          targetSheet.debitRecords.unshift({
            id: `DR-IMP-${Date.now()}-${addedDebits}`,
            date: date,
            narration: narration,
            payer: payer || 'Vendor',
            type: type,
            bankRef: ref,
            amount: amt,
            status: 'unmapped',
            mapping: null
          });
        }
      } else {
        if (existingCreditSet.has(key)) {
          skipped++;
        } else {
          existingCreditSet.add(key);
          addedCredits++;
          targetSheet.records.unshift({
            id: `CR-IMP-${Date.now()}-${addedCredits}`,
            date: date,
            narration: narration,
            payer: payer,
            type: type,
            bankRef: ref,
            amount: amt,
            status: 'unmapped',
            mapping: null
          });
        }
      }
    }
  }

  // 6. Update Counts
  targetSheet.creditsCount = targetSheet.records.length;
  targetSheet.debitsCount = targetSheet.debitRecords.length;

  // 7. Auto-switch Active Bank and Month View
  selectedBankId = bank.id;
  selectedMonthId = targetSheet.monthId;

  // Determine desk mode and visually switch tabs
  if (addedCredits > 0 && addedDebits > 0) {
    switchMappingMode('all', { silent: true, autoPersist: false });
  } else if (addedDebits > 0 && addedCredits === 0) {
    switchMappingMode('debit', { silent: true, autoPersist: false });
  } else {
    switchMappingMode('credit', { silent: true, autoPersist: false });
  }

  // 8. Auto-match open transactions with statement data
  autoMatchAllStatementData(false);

  // 9. Desk Audit Activity
  const totalAdded = addedCredits + addedDebits;
  recentActivities.unshift({
    text: `Imported statement (${addedCredits} credits, ${addedDebits} debits)`,
    meta: `${bank.name} ${bank.accNo} · ${targetSheet.label} · Synced with Supabase DB`
  });

  // 10. Re-render entire UI immediately
  renderAll(false);

  // 11. Backend Database Persistence directly into Supabase PostgreSQL
  await persistToSupabase();

  // 12. Archive raw statement file in Supabase Cloud Storage
  if (fileName) {
    uploadRawStatementFile(fileName, csvText);
  }

  // 13. Feedback Toast
  let toastMsg = '';
  if (addedCredits > 0 && addedDebits > 0) {
    toastMsg = `✔ Auto-detected ${bank.name} (${bank.accNo}) · ${targetSheet.label} · Detected ${addedCredits} Credits & ${addedDebits} Debits (${totalAdded} imported, ${skipped} skipped) · Uploaded to Frontend & Supabase Cloud DB!`;
  } else if (addedDebits > 0) {
    toastMsg = `✔ Auto-detected ${bank.name} (${bank.accNo}) · ${targetSheet.label} · Detected ${addedDebits} Debits (${totalAdded} imported, ${skipped} skipped) · Uploaded to Frontend & Supabase Cloud DB!`;
  } else {
    toastMsg = `✔ Auto-detected ${bank.name} (${bank.accNo}) · ${targetSheet.label} · Detected ${addedCredits} Credits (${totalAdded} imported, ${skipped} skipped) · Uploaded to Frontend & Supabase Cloud DB!`;
  }
  showToast(toastMsg, totalAdded > 0 ? 'success' : 'amber');
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

const TREND_MONTHS = [
  { monthId: '2026-04', label: 'April 2026', shortName: 'Apr' },
  { monthId: '2026-05', label: 'May 2026', shortName: 'May' },
  { monthId: '2026-06', label: 'June 2026', shortName: 'Jun' },
  { monthId: '2026-07', label: 'July 2026', shortName: 'Jul' },
  { monthId: '2026-08', label: 'August 2026', shortName: 'Aug' },
  { monthId: '2026-09', label: 'September 2026', shortName: 'Sep' }
];

function renderCreditTrendChart() {
  if (!miniBarChart) return;
  miniBarChart.innerHTML = '';

  const bank = getActiveBank();
  const isDebit = activeMappingMode === 'debit';
  const isAll = activeMappingMode === 'all';

  // Compute live monthly volumes for active bank and active mode (no synthetic dummy values)
  const data = TREND_MONTHS.map(m => {
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

async function persistToSupabase() {
  if (isSupabaseSyncing) return;
  isSupabaseSyncing = true;
  updateSupabaseSyncBadge('syncing', 'Syncing to Supabase...');
  try {
    const payload = {
      banks: corporateBanks,
      invoices: appInvoices,
      bills: appVendorBills,
      activities: recentActivities,
      updatedAt: new Date().toISOString()
    };

    const res = await fetch('/api/supabase/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      lastSupabaseSyncTime = new Date();
      const timeStr = lastSupabaseSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      updateSupabaseSyncBadge('synced', `Supabase Synced · ${timeStr}`);
    } else {
      updateSupabaseSyncBadge('error', 'Supabase Sync Error');
    }
  } catch (err) {
    console.warn('Supabase persist error:', err);
    updateSupabaseSyncBadge('error', 'Supabase Offline');
  } finally {
    isSupabaseSyncing = false;
  }
}

function debouncedPersistToSupabase() {
  if (!isInitialSupabaseLoadDone) return;
  clearTimeout(supabaseSyncDebounceTimer);
  supabaseSyncDebounceTimer = setTimeout(() => {
    persistToSupabase();
  }, 1000);
}

async function loadFromSupabase(showToastNotification = false) {
  updateSupabaseSyncBadge('syncing', 'Connecting Supabase...');
  try {
    const res = await fetch('/api/supabase/data');
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const state = json.data;
        if (Array.isArray(state.banks) && state.banks.length > 0) {
          corporateBanks = state.banks.map(b => Object.assign({}, b, {
            accNo: sanitizeMaskedAccNo(b.accNo || b.acc_no, b.fullAccNo || b.full_acc_no, b.id),
            sheets: Array.isArray(b.sheets) ? b.sheets : []
          }));
        }
        if (Array.isArray(state.invoices)) {
          appInvoices = state.invoices;
        }
        if (Array.isArray(state.bills)) {
          appVendorBills = state.bills;
        }
        if (Array.isArray(state.activities)) {
          recentActivities = state.activities;
        }

        // Smart Initial Bank and Sheet Selection:
        // If current bank has no records, focus on the bank that HAS records!
        const currentActive = corporateBanks.find(b => b.id === selectedBankId);
        const currentHasRecords = currentActive && Array.isArray(currentActive.sheets) && currentActive.sheets.some(s => (s.records && s.records.length > 0) || (s.debitRecords && s.debitRecords.length > 0));

        if (!currentHasRecords) {
          const bankWithRecords = corporateBanks.find(b => Array.isArray(b.sheets) && b.sheets.some(s => (s.records && s.records.length > 0) || (s.debitRecords && s.debitRecords.length > 0)));
          if (bankWithRecords) {
            selectedBankId = bankWithRecords.id;
          }
        }

        // Auto-select sheet with records and set active mapping mode
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
    autoDetectBanksBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      autoDetectBankAccounts(true);
    });
  }

  if (detectStatementsBtn) {
    detectStatementsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      autoDetectBankAccounts(true);
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
        readStatementFile(file, async (content, fileName) => {
          try {
            await processBankStatementCsv(content, fileName);
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
        readStatementFile(file, async (content, fileName) => {
          try {
            await processBankStatementCsv(content, fileName);
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
      autoMatchAllStatementData(true);
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
  const client = getSupabaseClient();
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
        const activeClient = getSupabaseClient();
        if (!activeClient) {
          // If Supabase CDN is unreachable, provide fallback authentication
          if (email === 'admin@ifimed.com' && password === 'Admin@123456') {
            const mockUser = {
              email: 'admin@ifimed.com',
              user_metadata: { name: 'IFIMED Admin', role: 'Corporate Controller' }
            };
            localStorage.setItem('ifimed_auth_user', JSON.stringify(mockUser));
            updateAuthUI(mockUser);
            showToast('Authenticated as Corporate Controller (Local Fallback)');
            return;
          } else if (email === 'controller@ifimed.com' && password === 'Ifimed@2026!') {
            const mockUser = {
              email: 'controller@ifimed.com',
              user_metadata: { name: 'Chief Financial Controller', role: 'Treasury Controller' }
            };
            localStorage.setItem('ifimed_auth_user', JSON.stringify(mockUser));
            updateAuthUI(mockUser);
            showToast('Authenticated as Chief Financial Controller (Local Fallback)');
            return;
          }
          throw new Error('Supabase client could not connect. Check internet access.');
        }

        const { data, error } = await activeClient.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          throw error;
        }

        if (data && data.user) {
          if (authRememberMe && authRememberMe.checked) {
            localStorage.setItem('ifimed_auth_user', JSON.stringify(data.user));
          } else {
            sessionStorage.setItem('ifimed_auth_user', JSON.stringify(data.user));
          }
          updateAuthUI(data.user);
          showToast(`Welcome back, ${data.user.user_metadata?.name || data.user.email}!`);
        }
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
      if (client) {
        client.auth.onAuthStateChange((event, session) => {
          if (session && session.user) {
            updateAuthUI(session.user);
          } else if (event === 'SIGNED_OUT') {
            updateAuthUI(null);
          }
        });

        const { data } = await client.auth.getSession();
        if (data && data.session && data.session.user) {
          updateAuthUI(data.session.user);
          return;
        }
      }

      // Check saved user in storage
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


