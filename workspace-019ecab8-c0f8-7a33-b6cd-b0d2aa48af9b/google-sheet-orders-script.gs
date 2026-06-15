// Google Apps Script for Kashmir Weaves order logging
// Paste this into Extensions → Apps Script in your Google Sheet.
// Set SECRET_TOKEN to match Admin → Settings → Sheet Security Token.

var SECRET_TOKEN = 'change-this-secret-token';
var SHEET_NAME = 'Orders';

var HEADERS = [
  'Order ID',
  'Date',
  'Customer Name',
  'Phone',
  'Email',
  'Address',
  'Items',
  'Items JSON',
  'Item Count',
  'Total',
  'Total Number',
  'Payment',
  'Payment Reference',
  'Source',
  'Status',
  'Status Updated At'
];

function getOrdersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  var firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  var needsHeaders = firstRow.join('').trim() === '' || firstRow[0] !== HEADERS[0];
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return json_({ status: 'active', sheet: SHEET_NAME });
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents || '{}');

    if (data.token !== SECRET_TOKEN) {
      return json_({ result: 'unauthorised' });
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      var sheet = getOrdersSheet_();

      if (data.action === 'updateStatus') {
        updateStatus_(sheet, data.orderId, data.status, data.statusUpdatedAt);
        return json_({ result: 'status-updated' });
      }

      appendOrder_(sheet, data);
      return json_({ result: 'success' });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ result: 'error', message: String(err) });
  }
}

function appendOrder_(sheet, data) {
  // Prevent duplicate order numbers if the browser retries the request.
  if (data.orderId) {
    var existingRow = findOrderRow_(sheet, data.orderId);
    if (existingRow > 0) {
      updateStatus_(sheet, data.orderId, data.status || 'New Order', data.statusUpdatedAt || new Date().toISOString());
      return;
    }
  }

  sheet.appendRow([
    data.orderId || '',
    data.date || new Date(),
    data.name || '',
    data.phone || '',
    data.email || '',
    data.address || '',
    data.items || '',
    data.itemsJson || '',
    data.itemCount || '',
    data.total || '',
    data.totalNumber || '',
    data.payment || '',
    data.paymentReference || '',
    data.source || '',
    data.status || 'New Order',
    data.statusUpdatedAt || ''
  ]);
}

function updateStatus_(sheet, orderId, status, updatedAt) {
  var row = findOrderRow_(sheet, orderId);
  if (row <= 0) return;

  var statusCol = HEADERS.indexOf('Status') + 1;
  var updatedCol = HEADERS.indexOf('Status Updated At') + 1;
  sheet.getRange(row, statusCol).setValue(status || '');
  sheet.getRange(row, updatedCol).setValue(updatedAt || new Date().toISOString());
}

function findOrderRow_(sheet, orderId) {
  if (!orderId) return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(orderId)) {
      return i + 2;
    }
  }
  return -1;
}
