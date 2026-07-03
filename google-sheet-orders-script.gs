// Google Apps Script for Kashmir Weaves order logging
// Paste this into Extensions → Apps Script in your Google Sheet.
// Set SECRET_TOKEN to match Admin → Settings → Sheet Security Token.

var SECRET_TOKEN = 'change-this-secret-token';
var SHEET_NAME = 'Orders';
var DELETED_SHEET_NAME = 'Deleted Orders';
var DELIVERED_SHEET_NAME = 'Delivered Orders';

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

var DELETED_HEADERS = HEADERS.concat([
  'Deleted At',
  'Deleted By',
  'Delete Note'
]);

var DELIVERED_HEADERS = HEADERS.concat([
  'Delivered At'
]);

function getSheetWithHeaders_(sheetName, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  var firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var needsHeaders = firstRow.join('').trim() === '' || firstRow[0] !== headers[0] || firstRow.length < headers.length;
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getOrdersSheet_() {
  return getSheetWithHeaders_(SHEET_NAME, HEADERS);
}

function getDeletedOrdersSheet_() {
  return getSheetWithHeaders_(DELETED_SHEET_NAME, DELETED_HEADERS);
}

function getDeliveredOrdersSheet_() {
  return getSheetWithHeaders_(DELIVERED_SHEET_NAME, DELIVERED_HEADERS);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var ordersSheet = getOrdersSheet_();
  var deletedSheet = getDeletedOrdersSheet_();
  var deliveredSheet = getDeliveredOrdersSheet_();

  // Open Web App URL with ?action=repair to move any existing rows already marked
  // Delivered/Deleted out of the main Orders sheet.
  if (e && e.parameter && e.parameter.action === 'repair') {
    var moved = repairMovedOrders_(ordersSheet, deliveredSheet, deletedSheet);
    return json_({ status: 'repair-complete', moved: moved, sheets: [SHEET_NAME, DELETED_SHEET_NAME, DELIVERED_SHEET_NAME] });
  }

  return json_({ status: 'active', sheets: [SHEET_NAME, DELETED_SHEET_NAME, DELIVERED_SHEET_NAME], tip: 'Use ?action=repair to move existing Delivered/Deleted rows.' });
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
        if (String(data.status || '').toLowerCase() === 'delivered') {
          archiveDeliveredOrder_(sheet, getDeliveredOrdersSheet_(), data);
          return json_({ result: 'order-moved-to-delivered' });
        }
        updateStatus_(sheet, data.orderId, data.status, data.statusUpdatedAt);
        return json_({ result: 'status-updated' });
      }

      if (data.action === 'deleteOrder') {
        archiveDeletedOrder_(sheet, getDeliveredOrdersSheet_(), getDeletedOrdersSheet_(), data);
        return json_({ result: 'order-archived-as-deleted' });
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

function fallbackOrderRow_(data, status, updatedAt) {
  return [
    data.orderId || data.order_number || '',
    data.date || '',
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
    status || data.status || '',
    updatedAt || data.statusUpdatedAt || new Date().toISOString()
  ];
}

function archiveDeliveredOrder_(ordersSheet, deliveredSheet, data) {
  var orderId = data.orderId || data.order_number || '';
  var deliveredAt = data.statusUpdatedAt || data.deliveredAt || new Date().toISOString();

  if (!orderId) {
    throw new Error('Missing orderId for delivered status update');
  }

  var sourceRow = findOrderRow_(ordersSheet, orderId);
  var rowValues = sourceRow > 0
    ? ordersSheet.getRange(sourceRow, 1, 1, HEADERS.length).getValues()[0]
    : fallbackOrderRow_(data, 'Delivered', deliveredAt);

  var statusCol = HEADERS.indexOf('Status');
  var updatedCol = HEADERS.indexOf('Status Updated At');
  if (statusCol >= 0) rowValues[statusCol] = 'Delivered';
  if (updatedCol >= 0) rowValues[updatedCol] = deliveredAt;

  var existingDelivered = findOrderRow_(deliveredSheet, orderId);
  if (existingDelivered > 0) {
    deliveredSheet.getRange(existingDelivered, 1, 1, DELIVERED_HEADERS.length)
      .setValues([rowValues.concat([deliveredAt])]);
  } else {
    deliveredSheet.appendRow(rowValues.concat([deliveredAt]));
  }

  // User requested: move delivered orders out of main Orders sheet.
  if (sourceRow > 0) {
    ordersSheet.deleteRow(sourceRow);
  }
}

function archiveDeletedOrder_(ordersSheet, deliveredSheet, deletedSheet, data) {
  var orderId = data.orderId || data.order_number || '';
  var deletedAt = data.deletedAt || new Date().toISOString();
  var deletedBy = data.deletedBy || 'Admin Panel';
  var deleteNote = data.deleteNote || 'Deleted from Kashmir Weaves Admin Panel';

  if (!orderId) {
    throw new Error('Missing orderId for deleteOrder action');
  }

  var sourceSheet = ordersSheet;
  var sourceRow = findOrderRow_(ordersSheet, orderId);
  var rowValues = null;

  if (sourceRow > 0) {
    rowValues = ordersSheet.getRange(sourceRow, 1, 1, HEADERS.length).getValues()[0];
  } else {
    sourceRow = findOrderRow_(deliveredSheet, orderId);
    if (sourceRow > 0) {
      sourceSheet = deliveredSheet;
      rowValues = deliveredSheet.getRange(sourceRow, 1, 1, HEADERS.length).getValues()[0];
    } else {
      // Fallback if the row is missing from both sheets, so the deletion is still recorded.
      rowValues = fallbackOrderRow_(data, 'Deleted', deletedAt);
    }
  }

  // Mark archived copy as Deleted, regardless of original status.
  var statusCol = HEADERS.indexOf('Status');
  var updatedCol = HEADERS.indexOf('Status Updated At');
  if (statusCol >= 0) rowValues[statusCol] = 'Deleted';
  if (updatedCol >= 0) rowValues[updatedCol] = deletedAt;

  var existingDeleted = findOrderRow_(deletedSheet, orderId);
  if (existingDeleted > 0) {
    // If it was archived before, replace the archived row with latest available details.
    deletedSheet.getRange(existingDeleted, 1, 1, DELETED_HEADERS.length)
      .setValues([rowValues.concat([deletedAt, deletedBy, deleteNote])]);
  } else {
    deletedSheet.appendRow(rowValues.concat([deletedAt, deletedBy, deleteNote]));
  }

  // User requested: remove deleted orders from active sheets and move them to Deleted Orders.
  if (sourceRow > 0) {
    sourceSheet.deleteRow(sourceRow);
  }
}

function updateStatus_(sheet, orderId, status, updatedAt) {
  var row = findOrderRow_(sheet, orderId);
  if (row <= 0) return;

  var statusCol = HEADERS.indexOf('Status') + 1;
  var updatedCol = HEADERS.indexOf('Status Updated At') + 1;
  sheet.getRange(row, statusCol).setValue(status || '');
  sheet.getRange(row, updatedCol).setValue(updatedAt || new Date().toISOString());
}

function repairMovedOrders_(ordersSheet, deliveredSheet, deletedSheet) {
  var moved = { delivered: 0, deleted: 0 };
  var lastRow = ordersSheet.getLastRow();
  if (lastRow < 2) return moved;

  var statusCol = HEADERS.indexOf('Status') + 1;
  var updatedCol = HEADERS.indexOf('Status Updated At') + 1;
  var values = ordersSheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();

  // Walk bottom-up so deleting rows does not shift upcoming row indexes.
  for (var i = values.length - 1; i >= 0; i--) {
    var rowNumber = i + 2;
    var rowValues = values[i];
    var status = String(rowValues[statusCol - 1] || '').toLowerCase();
    var updatedAt = rowValues[updatedCol - 1] || new Date().toISOString();
    var orderId = rowValues[0];

    if (status === 'delivered') {
      var existingDelivered = findOrderRow_(deliveredSheet, orderId);
      if (existingDelivered > 0) {
        deliveredSheet.getRange(existingDelivered, 1, 1, DELIVERED_HEADERS.length)
          .setValues([rowValues.concat([updatedAt])]);
      } else {
        deliveredSheet.appendRow(rowValues.concat([updatedAt]));
      }
      ordersSheet.deleteRow(rowNumber);
      moved.delivered++;
    }

    if (status === 'deleted') {
      var existingDeleted = findOrderRow_(deletedSheet, orderId);
      var deletedAt = updatedAt || new Date().toISOString();
      if (existingDeleted > 0) {
        deletedSheet.getRange(existingDeleted, 1, 1, DELETED_HEADERS.length)
          .setValues([rowValues.concat([deletedAt, 'Repair Tool', 'Moved from Orders sheet by repair action'])]);
      } else {
        deletedSheet.appendRow(rowValues.concat([deletedAt, 'Repair Tool', 'Moved from Orders sheet by repair action']));
      }
      ordersSheet.deleteRow(rowNumber);
      moved.deleted++;
    }
  }

  return moved;
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
