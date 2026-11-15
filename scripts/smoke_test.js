/**
 * HSCMS Smoke Test Suite
 * Plain Node 18+ (using global fetch)
 *
 * Usage:
 *   node scripts/smoke_test.js [BASE_URL]
 *   npm run smoke
 */

const rawBaseUrl = process.argv[2] || process.env.BASE_URL || 'http://localhost:3000';
const BASE_URL = rawBaseUrl.replace(/\/+$/, '');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function logPass(description) {
  totalChecks++;
  passedChecks++;
  console.log(`[PASS] ${description}`);
}

function logFail(description, details) {
  totalChecks++;
  failedChecks++;
  console.error(`[FAIL] ${description}${details ? ' - ' + details : ''}`);
}

async function request(path, options = {}, cookie = null) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {})
  };
  if (cookie) {
    headers['Cookie'] = cookie;
  }
  if (options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, { ...options, headers });
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (e) {
      // ignore json parse errors
    }
  } else {
    data = await res.text();
  }

  // Extract session cookie from set-cookie header
  let setCookie = null;
  if (res.headers.getSetCookie) {
    const cookies = res.headers.getSetCookie();
    if (cookies.length > 0) {
      setCookie = cookies.map(c => c.split(';')[0]).join('; ');
    }
  }
  if (!setCookie) {
    const rawCookie = res.headers.get('set-cookie');
    if (rawCookie) {
      setCookie = rawCookie.split(';')[0];
    }
  }

  return { res, status: res.status, data, cookie: setCookie };
}

async function loginUser(email, password, expectedRole) {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password }
  });

  if (res.status === 200 && res.cookie && res.data && res.data.user && res.data.user.role === expectedRole) {
    logPass(`Login successful for ${expectedRole} (${email})`);
    return { cookie: res.cookie, user: res.data.user };
  } else {
    logFail(`Login failed for ${expectedRole} (${email})`, `Status: ${res.status}, Body: ${JSON.stringify(res.data)}`);
    return null;
  }
}

async function runSmokeTests() {
  console.log(`====================================================`);
  console.log(`Running HSCMS Smoke Tests against: ${BASE_URL}`);
  console.log(`====================================================\n`);

  // 1. Hospital Administrator
  console.log('--- Testing Role: Hospital Administrator ---');
  const admin = await loginUser('admin@hscms.test', 'Admin@123', 'Hospital Administrator');
  if (admin) {
    const usersRes = await request('/api/users', {}, admin.cookie);
    if (usersRes.status === 200 && usersRes.data && Array.isArray(usersRes.data.users)) {
      logPass(`Admin GET /api/users returned ${usersRes.data.users.length} users`);
    } else {
      logFail(`Admin GET /api/users`, `Status ${usersRes.status}`);
    }

    const settingsRes = await request('/api/settings', {}, admin.cookie);
    if (settingsRes.status === 200 && settingsRes.data && settingsRes.data.settings) {
      logPass(`Admin GET /api/settings returned system settings`);
    } else {
      logFail(`Admin GET /api/settings`, `Status ${settingsRes.status}`);
    }

    const invReportRes = await request('/api/reports/inventory', {}, admin.cookie);
    if (invReportRes.status === 200 && invReportRes.data && invReportRes.data.summary) {
      logPass(`Admin GET /api/reports/inventory returned summary (items: ${invReportRes.data.summary.total_items})`);
    } else {
      logFail(`Admin GET /api/reports/inventory`, `Status ${invReportRes.status}`);
    }

    const procReportRes = await request('/api/reports/procurement', {}, admin.cookie);
    if (procReportRes.status === 200 && procReportRes.data && procReportRes.data.summary) {
      logPass(`Admin GET /api/reports/procurement returned summary (orders: ${procReportRes.data.summary.total_orders})`);
    } else {
      logFail(`Admin GET /api/reports/procurement`, `Status ${procReportRes.status}`);
    }

    const alertsRes = await request('/api/alerts', {}, admin.cookie);
    if (alertsRes.status === 200 && alertsRes.data && Array.isArray(alertsRes.data.alerts)) {
      logPass(`Admin GET /api/alerts returned active alerts`);
    } else {
      logFail(`Admin GET /api/alerts`, `Status ${alertsRes.status}`);
    }

    const dashRes = await request('/api/dashboard/stats', {}, admin.cookie);
    if (dashRes.status === 200 && dashRes.data && dashRes.data.stats) {
      logPass(`Admin GET /api/dashboard/stats returned administrator metrics`);
    } else {
      logFail(`Admin GET /api/dashboard/stats`, `Status ${dashRes.status}`);
    }
  }
  console.log('');

  // 2. Inventory Manager
  console.log('--- Testing Role: Inventory Manager ---');
  const inventory = await loginUser('inventory@hscms.test', 'Inventory@123', 'Inventory Manager');
  if (inventory) {
    const suppliesRes = await request('/api/supplies', {}, inventory.cookie);
    if (suppliesRes.status === 200 && suppliesRes.data && Array.isArray(suppliesRes.data.supplies)) {
      logPass(`Inventory Manager GET /api/supplies returned ${suppliesRes.data.supplies.length} supplies`);
    } else {
      logFail(`Inventory Manager GET /api/supplies`, `Status ${suppliesRes.status}`);
    }

    const requestsRes = await request('/api/requests', {}, inventory.cookie);
    if (requestsRes.status === 200 && requestsRes.data && Array.isArray(requestsRes.data.requests)) {
      logPass(`Inventory Manager GET /api/requests returned ${requestsRes.data.requests.length} requests`);
    } else {
      logFail(`Inventory Manager GET /api/requests`, `Status ${requestsRes.status}`);
    }

    const disposalsRes = await request('/api/disposals', {}, inventory.cookie);
    if (disposalsRes.status === 200 && disposalsRes.data && Array.isArray(disposalsRes.data.disposals)) {
      logPass(`Inventory Manager GET /api/disposals returned ${disposalsRes.data.disposals.length} disposals`);
    } else {
      logFail(`Inventory Manager GET /api/disposals`, `Status ${disposalsRes.status}`);
    }

    const alertsRes = await request('/api/alerts', {}, inventory.cookie);
    if (alertsRes.status === 200 && alertsRes.data && Array.isArray(alertsRes.data.alerts)) {
      logPass(`Inventory Manager GET /api/alerts returned role alerts`);
    } else {
      logFail(`Inventory Manager GET /api/alerts`, `Status ${alertsRes.status}`);
    }

    const dashRes = await request('/api/dashboard/stats', {}, inventory.cookie);
    if (dashRes.status === 200 && dashRes.data && dashRes.data.stats) {
      logPass(`Inventory Manager GET /api/dashboard/stats returned stock metrics`);
    } else {
      logFail(`Inventory Manager GET /api/dashboard/stats`, `Status ${dashRes.status}`);
    }
  }
  console.log('');

  // 3. Procurement Officer
  console.log('--- Testing Role: Procurement Officer ---');
  const procure = await loginUser('procurement@hscms.test', 'Procure@123', 'Procurement Officer');
  if (procure) {
    const suppliersRes = await request('/api/suppliers', {}, procure.cookie);
    if (suppliersRes.status === 200 && suppliersRes.data && Array.isArray(suppliersRes.data.suppliers)) {
      logPass(`Procurement Officer GET /api/suppliers returned ${suppliersRes.data.suppliers.length} suppliers`);
    } else {
      logFail(`Procurement Officer GET /api/suppliers`, `Status ${suppliersRes.status}`);
    }

    const ordersRes = await request('/api/orders', {}, procure.cookie);
    if (ordersRes.status === 200 && ordersRes.data && Array.isArray(ordersRes.data.orders)) {
      logPass(`Procurement Officer GET /api/orders returned ${ordersRes.data.orders.length} orders`);
    } else {
      logFail(`Procurement Officer GET /api/orders`, `Status ${ordersRes.status}`);
    }

    const alertsRes = await request('/api/alerts', {}, procure.cookie);
    if (alertsRes.status === 200 && alertsRes.data && Array.isArray(alertsRes.data.alerts)) {
      logPass(`Procurement Officer GET /api/alerts returned delayed delivery alerts`);
    } else {
      logFail(`Procurement Officer GET /api/alerts`, `Status ${alertsRes.status}`);
    }

    const dashRes = await request('/api/dashboard/stats', {}, procure.cookie);
    if (dashRes.status === 200 && dashRes.data && dashRes.data.stats) {
      logPass(`Procurement Officer GET /api/dashboard/stats returned procurement metrics`);
    } else {
      logFail(`Procurement Officer GET /api/dashboard/stats`, `Status ${dashRes.status}`);
    }
  }
  console.log('');

  // 4. Hospital Department Staff
  console.log('--- Testing Role: Hospital Department Staff ---');
  const staff = await loginUser('staff@hscms.test', 'Staff@123', 'Hospital Department Staff');
  if (staff) {
    const suppliesRes = await request('/api/supplies', {}, staff.cookie);
    if (suppliesRes.status === 200 && suppliesRes.data && Array.isArray(suppliesRes.data.supplies)) {
      logPass(`Staff GET /api/supplies returned available catalog`);
    } else {
      logFail(`Staff GET /api/supplies`, `Status ${suppliesRes.status}`);
    }

    const requestsRes = await request('/api/requests/my', {}, staff.cookie);
    if (requestsRes.status === 200 && requestsRes.data && Array.isArray(requestsRes.data.requests)) {
      logPass(`Staff GET /api/requests/my returned ${requestsRes.data.requests.length} own department requests`);
    } else {
      logFail(`Staff GET /api/requests/my`, `Status ${requestsRes.status}`);
    }

    const dashRes = await request('/api/dashboard/stats', {}, staff.cookie);
    if (dashRes.status === 200 && dashRes.data && dashRes.data.stats) {
      logPass(`Staff GET /api/dashboard/stats returned staff overview`);
    } else {
      logFail(`Staff GET /api/dashboard/stats`, `Status ${dashRes.status}`);
    }

    // RBAC Security Check: Staff forbidden from /api/users (Admin only)
    const forbiddenUsers = await request('/api/users', {}, staff.cookie);
    if (forbiddenUsers.status === 403) {
      logPass(`RBAC Enforcement: Staff forbidden (403) from accessing /api/users`);
    } else {
      logFail(`RBAC Enforcement: Staff accessed /api/users with status ${forbiddenUsers.status} (expected 403)`);
    }

    // RBAC Security Check: Staff forbidden from /api/reports/inventory
    const forbiddenReports = await request('/api/reports/inventory', {}, staff.cookie);
    if (forbiddenReports.status === 403) {
      logPass(`RBAC Enforcement: Staff forbidden (403) from accessing /api/reports/inventory`);
    } else {
      logFail(`RBAC Enforcement: Staff accessed /api/reports/inventory with status ${forbiddenReports.status} (expected 403)`);
    }
  }
  console.log('');

  // 5. Supplier / Vendor
  console.log('--- Testing Role: Supplier / Vendor ---');
  const supplier = await loginUser('supplier@hscms.test', 'Supplier@123', 'Supplier / Vendor');
  if (supplier) {
    const ordersRes = await request('/api/orders', {}, supplier.cookie);
    if (ordersRes.status === 200 && ordersRes.data && Array.isArray(ordersRes.data.orders)) {
      logPass(`Supplier GET /api/orders returned ${ordersRes.data.orders.length} orders`);

      // Data Isolation Check: All orders must belong to this supplier only
      const vendorSupplierId = supplier.user.supplier_id;
      const allOwned = ordersRes.data.orders.every(o => o.supplier_id === vendorSupplierId);
      if (allOwned) {
        logPass(`Data Isolation: Supplier only sees orders matching supplier_id ${vendorSupplierId}`);
      } else {
        logFail(`Data Isolation: Supplier orders contain foreign supplier records!`);
      }
    } else {
      logFail(`Supplier GET /api/orders`, `Status ${ordersRes.status}`);
    }

    const dashRes = await request('/api/dashboard/stats', {}, supplier.cookie);
    if (dashRes.status === 200 && dashRes.data && dashRes.data.stats) {
      logPass(`Supplier GET /api/dashboard/stats returned vendor metrics`);
    } else {
      logFail(`Supplier GET /api/dashboard/stats`, `Status ${dashRes.status}`);
    }
  }

  console.log('\n====================================================');
  console.log(`Smoke Test Results: ${passedChecks}/${totalChecks} passed (${failedChecks} failed)`);
  console.log('====================================================');

  if (failedChecks > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSmokeTests().catch(err => {
  console.error('[FATAL ERROR IN SMOKE TEST]', err);
  process.exit(1);
});
