/**
 * Clean Corporate Master Data for IFIMED Reconciliation Desk
 * All dummy and sample data cleared to 0. Ready for real CSV uploads.
 */

var REAL_INVOICES = [];
var REAL_VENDOR_BILLS = [];

var REAL_CORPORATE_BANKS = [
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

var REAL_ACTIVITIES = [];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { REAL_INVOICES, REAL_VENDOR_BILLS, REAL_CORPORATE_BANKS, REAL_ACTIVITIES };
}

if (typeof window !== 'undefined') {
  window.REAL_INVOICES = REAL_INVOICES;
  window.REAL_VENDOR_BILLS = REAL_VENDOR_BILLS;
  window.REAL_CORPORATE_BANKS = REAL_CORPORATE_BANKS;
  window.REAL_ACTIVITIES = REAL_ACTIVITIES;
}
