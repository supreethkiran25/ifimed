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
let selectedMonthId = '2026-07';
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
const themeToggleBtn = document.getElementById('themeToggleBtn');

// =============================================================================
// Theme Manager (Dark & Light Mode Engine)
// =============================================================================

function getActiveTheme() {
  return document.documentElement.getAttribute('data-theme') ||
    localStorage.getItem('ifimed_theme') ||
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function setTheme(theme, save = true) {
  document.documentElement.setAttribute('data-theme', theme);
  if (save) {
    try {
      localStorage.setItem('ifimed_theme', theme);
    } catch (e) {}
  }
  if (themeToggleBtn) {
    themeToggleBtn.setAttribute('title', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode (Ctrl+D)`);
    themeToggleBtn.setAttribute('aria-label', `Theme: ${theme}. Click to switch.`);
  }
  if (typeof renderCreditTrendChart === 'function') {
    renderCreditTrendChart();
  }
  showToast(`Switched to ${theme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info');
}

function toggleTheme() {
  const current = getActiveTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next, true);
}

// Expose globally
window.setTheme = setTheme;
window.toggleTheme = toggleTheme;
window.getActiveTheme = getActiveTheme;

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
  return bank.sheets.find(s => s.monthId === selectedMonthId) || bank.sheets[0] || {
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
      <tr>
        <td colspan="4" style="text-align: center; padding: 28px 16px; color: var(--text-tertiary); font-size: 13px;">
          No statement sheets uploaded yet. Upload a CSV file above to create your first statement.
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

  // Update KPI Headers (Human-friendly Title Case)
  if (kpiTotalHeader) {
    kpiTotalHeader.textContent = mode === 'credit' ? 'Total Credits (This Month)' : 'Total Debits (This Month)';
  }
  if (kpiMappedHeader) {
    kpiMappedHeader.textContent = mode === 'credit' ? 'Mapped Credits' : 'Mapped Debits';
  }
  if (kpiUnmappedHeader) {
    kpiUnmappedHeader.textContent = mode === 'credit' ? 'Unmapped Credits' : 'Unmapped Debits';
  }
  if (kpiTrendHeader) {
    kpiTrendHeader.textContent = mode === 'credit' ? 'Credit Trend' : 'Debit Trend';
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
// 8. Bank Statement CSV Upload with Strict Deduplication (Credits & Debits)
// =============================================================================

function processBankStatementCsv(csvText) {
  const bank = getActiveBank();
  if (!bank) return;
  if (!bank.sheets) bank.sheets = [];

  const isDebit = activeMappingMode === 'debit';
  let currentSheet;

  if (bank.sheets.length === 0) {
    const now = new Date();
    const monthName = now.toLocaleString('en-US', { month: 'long' });
    const year = now.getFullYear();
    const monthId = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    currentSheet = {
      monthId: monthId,
      label: `${monthName} ${year}`,
      fileName: `${bank.name.replace(/\s+/g, '_')}_${monthName}_${year}.csv`,
      uploadedOn: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      creditsCount: 0,
      debitsCount: 0,
      records: [],
      debitRecords: []
    };
    bank.sheets.push(currentSheet);
    selectedMonthId = monthId;
  } else {
    currentSheet = getCurrentSheet();
  }

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

  currentSheet.creditsCount = currentSheet.records.length;
  currentSheet.debitsCount = currentSheet.debitRecords.length;

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
    const category = cols[4] || 'Regular B2B Tax Invoice';

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
    { title: 'Toggle Dark / Light Theme', desc: 'Switch appearance theme (Ctrl+D)', action: () => toggleTheme() },
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

  // Compute live monthly volumes for active bank and active mode (no synthetic dummy values)
  const data = TREND_MONTHS.map(m => {
    const sheet = (bank && bank.sheets) ? bank.sheets.find(s => s.monthId === m.monthId) : null;
    let total = 0;
    let count = 0;
    if (sheet) {
      const records = isDebit ? (sheet.debitRecords || []) : (sheet.records || []);
      total = records.reduce((acc, r) => acc + (r.amount || 0), 0);
      count = records.length;
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
    col.title = `${d.label} (${isDebit ? 'Debits' : 'Credits'}): ${formatINR(d.total)} (${d.count} transactions)`;

    col.innerHTML = `
      <div class="chart-bar ${isCurrent ? 'bar-active' : ''} ${isDebit ? 'bar-debit' : ''}" style="height: ${heightPct}%;"></div>
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

  // Theme Toggle Button
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleTheme();
    });
  }

  // OS Dark Mode Preference Listener
  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('ifimed_theme')) {
          setTheme(e.matches ? 'dark' : 'light', false);
        }
      });
    } catch (err) {}
  }

  document.addEventListener('keydown', (e) => {
    // ⌘K or Ctrl+K: Open Command Palette
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      openCommandPalette();
    }
    // ⌘D or Ctrl+D: Toggle Theme
    if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      toggleTheme();
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
  renderAll();
});

// Expose bank deletion, detection, and auto-match functions globally
window.promptDeleteBank = promptDeleteBank;
window.confirmDeleteBank = confirmDeleteBank;
window.closeDeleteBankModal = closeDeleteBankModal;
window.autoDetectBankAccounts = autoDetectBankAccounts;
window.autoMatchAllStatementData = autoMatchAllStatementData;

