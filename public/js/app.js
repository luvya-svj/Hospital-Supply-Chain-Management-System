// HSCMS Main Application Controller

let currentUser = null;
let currentView = '';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Authenticate user
  try {
    const authData = await API.get('/api/auth/me');
    if (!authData || !authData.authenticated) {
      window.location.href = '/login.html';
      return;
    }
    currentUser = authData.user;
    setupUserInterface();
  } catch (err) {
    window.location.href = '/login.html';
    return;
  }

  // 2. Setup Logout handler
  document.getElementById('btn-logout').onclick = () => {
    UI.confirm({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out of the Hospital Supply Chain Management System?',
      confirmText: 'Sign Out',
      confirmClass: 'btn-secondary',
      onConfirm: async () => {
        try {
          await API.post('/api/auth/logout');
          window.location.href = '/login.html';
        } catch (e) {
          window.location.href = '/login.html';
        }
      }
    });
  };

  // 3. Mobile menu toggle
  const mobileToggle = document.getElementById('mobile-toggle');
  const sidebar = document.getElementById('app-sidebar');
  if (mobileToggle && sidebar) {
    mobileToggle.onclick = () => {
      sidebar.classList.toggle('open');
    };
  }

  // 4. Hash Router
  window.addEventListener('hashchange', handleRoute);
});

function setupUserInterface() {
  // If supplier role, ensure display name is Sahyadri Pharma Distributors
  if (currentUser && currentUser.role === 'Supplier / Vendor') {
    currentUser.name = 'Sahyadri Pharma Distributors';
  }

  // Update header and footer user information
  document.getElementById('user-name').innerText = currentUser.name;
  document.getElementById('user-role-badge').innerText = currentUser.role;
  document.getElementById('user-avatar').innerText = currentUser.name.charAt(0).toUpperCase();

  const footerName = document.getElementById('footer-user-name');
  const footerRole = document.getElementById('footer-user-role');
  if (footerName) footerName.innerText = currentUser.name;
  if (footerRole) footerRole.innerText = currentUser.role;

  // Build Role-Specific Navigation Menu
  buildSidebarNav();

  // Initialise and start polling alert bell
  updateAlertBell();
  setInterval(updateAlertBell, 60000); // refresh every 60s

  // Initial Route
  handleRoute();
}

function buildSidebarNav() {
  const navContainer = document.getElementById('sidebar-nav');
  navContainer.innerHTML = '';

  const role = currentUser.role;

  // Navigation schema per role strictly matching PROJECT_BRIEF.md
  let navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>'
    }
  ];

  if (role === 'Hospital Administrator') {
    navItems.push(
      {
        id: 'users',
        label: 'Manage User Accounts',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
      },
      {
        id: 'settings',
        label: 'System Settings',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
      },
      {
        id: 'alerts',
        label: 'Alerts',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
      },
      {
        id: 'activity-monitor',
        label: 'Activity Monitor',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'
      },
      {
        id: 'reports',
        label: 'View Reports',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'
      }
    );
  } else if (role === 'Inventory Manager') {
    navItems.push(
      {
        id: 'inventory',
        label: 'Manage Inventory',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>'
      },
      {
        id: 'stock-monitoring',
        label: 'Monitor Stock Levels',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'
      },
      {
        id: 'expiry-monitoring',
        label: 'Monitor Expiry Dates',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
      },
      {
        id: 'disposal-management',
        label: 'Manage Disposal Records',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'
      },
      {
        id: 'manage-requests',
        label: 'Department Requests',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
      },
      {
        id: 'alerts',
        label: 'Alerts',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
      }
    );
  } else if (role === 'Hospital Department Staff') {
    navItems.push(
      {
        id: 'browse-supplies',
        label: 'Search Supplies',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
      },
      {
        id: 'request-supplies',
        label: 'Request Supplies',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
      },
      {
        id: 'my-requests',
        label: 'My Supply Requests',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>'
      }
    );
  } else if (role === 'Procurement Officer') {
    navItems.push(
      {
        id: 'manage-suppliers',
        label: 'Manage Suppliers',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
      },
      {
        id: 'purchase-orders',
        label: 'Purchase Orders',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>'
      },
      {
        id: 'alerts',
        label: 'Alerts',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
      }
    );
  } else if (role === 'Supplier / Vendor') {
    navItems.push(
      {
        id: 'vendor-orders',
        label: 'Purchase Orders',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-2z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>'
      },
      {
        id: 'vendor-deliveries',
        label: 'Delivery Tracking',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>'
      }
    );
  }

  navItems.forEach(item => {
    const a = document.createElement('a');
    a.href = `#${item.id}`;
    a.className = 'nav-item';
    a.id = `nav-${item.id}`;
    a.innerHTML = `${item.icon}<span>${item.label}</span>`;
    navContainer.appendChild(a);
  });
}

function handleRoute() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  currentView = hash;

  // Update active state in sidebar
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.getElementById(`nav-${hash}`);
  if (activeNav) activeNav.classList.add('active');

  // Close mobile sidebar if open
  document.getElementById('app-sidebar').classList.remove('open');

  // Route Dispatcher
  const main = document.getElementById('main-content');
  const heading = document.getElementById('page-heading');

  switch (hash) {
    case 'dashboard':
      heading.innerText = 'Dashboard Overview';
      renderDashboard(main);
      break;
    case 'users':
      heading.innerText = 'Manage User Accounts';
      if (currentUser.role !== 'Hospital Administrator') return renderAccessDenied(main);
      renderUsers(main);
      break;
    case 'settings':
      heading.innerText = 'Manage System Settings';
      if (currentUser.role !== 'Hospital Administrator') return renderAccessDenied(main);
      renderSettings(main);
      break;
    case 'inventory':
      heading.innerText = 'Manage Medical Inventory';
      if (currentUser.role !== 'Inventory Manager') return renderAccessDenied(main);
      renderInventory(main);
      break;
    case 'stock-monitoring':
      heading.innerText = 'Monitor Stock Levels';
      if (currentUser.role !== 'Inventory Manager') return renderAccessDenied(main);
      renderStockMonitoring(main);
      break;
    case 'browse-supplies':
      heading.innerText = 'Search & View Medical Supplies';
      renderBrowseSupplies(main);
      break;
    case 'request-supplies':
      heading.innerText = 'Request Department Supplies';
      if (currentUser.role !== 'Hospital Department Staff') return renderAccessDenied(main);
      renderRequestSupplies(main);
      break;
    case 'my-requests':
      heading.innerText = 'My Supply Requests';
      if (currentUser.role !== 'Hospital Department Staff') return renderAccessDenied(main);
      renderMyRequests(main);
      break;
    case 'manage-requests':
      heading.innerText = 'Review Department Supply Requests';
      if (currentUser.role !== 'Inventory Manager' && currentUser.role !== 'Hospital Administrator') return renderAccessDenied(main);
      renderManageRequests(main);
      break;
    case 'manage-suppliers':
      heading.innerText = 'Manage Medical Suppliers';
      if (currentUser.role !== 'Procurement Officer' && currentUser.role !== 'Hospital Administrator') return renderAccessDenied(main);
      renderSuppliers(main);
      break;
    case 'purchase-orders':
      heading.innerText = 'Purchase Orders & Procurement';
      if (currentUser.role !== 'Procurement Officer' && currentUser.role !== 'Hospital Administrator') return renderAccessDenied(main);
      renderPurchaseOrders(main);
      break;
    case 'vendor-orders':
      heading.innerText = 'Vendor Purchase Orders';
      if (currentUser.role !== 'Supplier / Vendor') return renderAccessDenied(main);
      renderVendorOrders(main);
      break;
    case 'vendor-deliveries':
      heading.innerText = 'Delivery Tracking & Fulfillment';
      if (currentUser.role !== 'Supplier / Vendor') return renderAccessDenied(main);
      renderVendorDeliveries(main);
      break;
    case 'expiry-monitoring':
      heading.innerText = 'Monitor Expiry Dates';
      if (currentUser.role !== 'Inventory Manager' && currentUser.role !== 'Hospital Administrator') return renderAccessDenied(main);
      renderExpiryMonitoring(main);
      break;
    case 'disposal-management':
      heading.innerText = 'Manage Disposal Records';
      if (currentUser.role !== 'Inventory Manager' && currentUser.role !== 'Hospital Administrator') return renderAccessDenied(main);
      renderDisposalManagement(main);
      break;
    case 'alerts':
      heading.innerText = 'System Alerts';
      renderAlerts(main);
      break;
    case 'activity-monitor':
      heading.innerText = 'Cross-Role Activity Monitor';
      if (currentUser.role !== 'Hospital Administrator') return renderAccessDenied(main);
      renderCrossRoleActivityMonitor(main);
      break;
    case 'reports':
      heading.innerText = 'View Reports';
      if (currentUser.role !== 'Hospital Administrator') return renderAccessDenied(main);
      renderReports(main);
      break;
    default:
      heading.innerText = 'Dashboard Overview';
      renderDashboard(main);
  }
}

function renderAccessDenied(container) {
  container.innerHTML = `
    <div class="card" style="text-align: center; padding: 3rem 1.5rem;">
      <div style="width: 56px; height: 56px; margin: 0 auto 1.25rem; border-radius: 50%; background: var(--color-danger-bg); color: var(--color-danger); display: flex; align-items: center; justify-content: center;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
      </div>
      <h2 style="font-size: var(--font-size-xl); font-weight: 700; margin-bottom: 0.5rem;">Access Denied</h2>
      <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); max-width: 440px; margin: 0 auto 1.5rem;">
        Your role (<strong>${currentUser.role}</strong>) does not have authorization to view this module. Permissions are enforced on both client and server.
      </p>
      <a href="#dashboard" class="btn btn-primary">Return to Dashboard</a>
    </div>
  `;
}



/* ==========================================================================
   VIEW: DASHBOARD
   ========================================================================== */
async function renderDashboard(container) {
  container.innerHTML = '<div class="skeleton" style="height: 120px; margin-bottom: 1.5rem;"></div><div class="skeleton" style="height: 280px;"></div>';

  try {
    const data = await API.get('/api/dashboard/stats');
    const stats = data.stats;

    let statsHtml = '';

    if (currentUser.role === 'Inventory Manager') {
      statsHtml = `
        <div class="stats-grid">
          <div class="stat-card">
            <div>
              <div class="stat-title">Total Cataloged Items</div>
              <div class="stat-value">${stats.totalSupplies}</div>
              <div class="stat-desc">Main Store inventory items</div>
            </div>
            <div class="stat-icon primary">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            </div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Low Stock Items</div>
              <div class="stat-value" style="color: var(--color-warning);">${stats.lowStockCount}</div>
              <div class="stat-desc">At or below minimum stock</div>
            </div>
            <div class="stat-icon warning">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Expired Items</div>
              <div class="stat-value" style="color: var(--color-danger);">${stats.expiredCount}</div>
              <div class="stat-desc">Excluded from available stock</div>
            </div>
            <div class="stat-icon danger">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Pending Requests</div>
              <div class="stat-value" style="color: var(--color-info);">${stats.pendingRequests}</div>
              <div class="stat-desc">Awaiting manager approval</div>
            </div>
            <div class="stat-icon info">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Quick Actions</h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <a href="#inventory" class="btn btn-secondary" style="justify-content: flex-start;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add / Update Medical Supply
              </a>
              <a href="#stock-monitoring" class="btn btn-secondary" style="justify-content: flex-start;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                View Low-Stock Alert Items (${stats.lowStockCount})
              </a>
              <a href="#manage-requests" class="btn btn-secondary" style="justify-content: flex-start;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
                Process Department Requests (${stats.pendingRequests})
              </a>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Stock Status Rules & Policy</h3>
            </div>
            <ul style="font-size: var(--font-size-sm); color: var(--color-text-muted); line-height: 1.8; padding-left: 1.25rem;">
              <li><strong>Available Stock:</strong> ${stats.availableTotalStock} total units across all categories.</li>
              <li><strong>Low Stock:</strong> Triggered when <code>quantity &le; min_stock_level</code>.</li>
              <li><strong>Expiry Policy:</strong> Supplies past expiry date are flagged <span class="badge badge-expired"><span class="badge-dot"></span>Expired</span> and barred from distribution.</li>
              <li><strong>Near Expiry:</strong> Items with &le; 30 days remaining are highlighted for proactive inventory dispatch.</li>
            </ul>
          </div>
        </div>
      `;
    } else if (currentUser.role === 'Hospital Administrator') {
      statsHtml = `
        <div class="stats-grid">
          <div class="stat-card">
            <div>
              <div class="stat-title">Total System Accounts</div>
              <div class="stat-value">${stats.totalUsers}</div>
              <div class="stat-desc">Configured user accounts</div>
            </div>
            <div class="stat-icon primary">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Active Users</div>
              <div class="stat-value" style="color: var(--color-success);">${stats.activeUsers}</div>
              <div class="stat-desc">Can authenticate into system</div>
            </div>
            <div class="stat-icon success">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Store Status</div>
              <div class="stat-value" style="font-size: 1.15rem; font-weight:600;">${stats.storeInfo?.name || 'Main Store'}</div>
              <div class="stat-desc">Last updated: ${stats.storeInfo?.last_updated || 'Active'}</div>
            </div>
            <div class="stat-icon info">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/></svg>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top: 1.5rem;">
          <div class="card-header">
            <h3 class="card-title">Administrative Overview & System Settings</h3>
          </div>
          <p style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: 1rem;">
            Hospital Administrators have full privileges to manage all staff and vendor accounts, configure global stock thresholds, and view cross-departmental operations.
          </p>
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <a href="#users" class="btn btn-primary">Manage User Accounts</a>
            <a href="#settings" class="btn btn-secondary">Configure System Thresholds</a>
          </div>
        </div>
      `;
    } else if (currentUser.role === 'Hospital Department Staff') {
      statsHtml = `
        <div class="stats-grid">
          <div class="stat-card">
            <div>
              <div class="stat-title">Available Supplies</div>
              <div class="stat-value">${stats.availableCatalogItems}</div>
              <div class="stat-desc">In stock & eligible for request</div>
            </div>
            <div class="stat-icon primary">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Pending Requests</div>
              <div class="stat-value" style="color: var(--color-warning);">${stats.myPendingRequests}</div>
              <div class="stat-desc">Waiting on store approval</div>
            </div>
            <div class="stat-icon warning">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/></svg>
            </div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Approved Requests</div>
              <div class="stat-value" style="color: var(--color-success);">${stats.myApprovedRequests}</div>
              <div class="stat-desc">Stock issued to ${currentUser.department || 'Department'}</div>
            </div>
            <div class="stat-icon success">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Total Requests</div>
              <div class="stat-value">${stats.myTotalRequests}</div>
              <div class="stat-desc">Lifetime requests submitted</div>
            </div>
            <div class="stat-icon info">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top: 1.5rem;">
          <div class="card-header">
            <h3 class="card-title">Department: ${currentUser.department || 'General Clinical'}</h3>
          </div>
          <p style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: 1.25rem;">
            Search medical supplies by name, category, or batch number. Expired and zero-stock supplies cannot be requested. Approved requests automatically decrement hospital inventory.
          </p>
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <a href="#request-supplies" class="btn btn-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Request Supplies
            </a>
            <a href="#browse-supplies" class="btn btn-secondary">Browse Medical Supply Catalog</a>
            <a href="#my-requests" class="btn btn-secondary">View Request History</a>
          </div>
        </div>
      `;
    } else if (currentUser.role === 'Procurement Officer') {
      statsHtml = `
        <div class="stats-grid">
          <div class="stat-card">
            <div>
              <div class="stat-title">Open Orders</div>
              <div class="stat-value" style="color: var(--color-info);">${stats.openOrders || 0}</div>
              <div class="stat-desc">Awaiting dispatch or receipt</div>
            </div>
            <div class="stat-icon info">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            </div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Delayed Orders</div>
              <div class="stat-value" style="color: var(--color-warning);">${stats.delayedOrders || 0}</div>
              <div class="stat-desc">Past expected delivery date</div>
            </div>
            <div class="stat-icon warning">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Received This Month</div>
              <div class="stat-value" style="color: var(--color-success);">${stats.receivedThisMonth || 0}</div>
              <div class="stat-desc">Orders successfully stocked</div>
            </div>
            <div class="stat-icon success">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Total Orders</div>
              <div class="stat-value">${stats.totalOrders || 0}</div>
              <div class="stat-desc">All historical purchase orders</div>
            </div>
            <div class="stat-icon primary">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Procurement Quick Actions</h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <a href="#purchase-orders" class="btn btn-primary" style="justify-content: flex-start;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Purchase Order / Track Orders
              </a>
              <a href="#manage-suppliers" class="btn btn-secondary" style="justify-content: flex-start;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Manage Medical Suppliers Directory
              </a>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Procurement Guidelines</h3>
            </div>
            <ul style="font-size: var(--font-size-sm); color: var(--color-text-muted); line-height: 1.8; padding-left: 1.25rem;">
              <li><strong>Expected Delivery Date:</strong> Cannot be backdated.</li>
              <li><strong>Inactive Suppliers:</strong> Barred from new purchase orders.</li>
              <li><strong>Inventory Stock Receipt:</strong> Marking an order Received increments medical supply inventory atomically.</li>
              <li><strong>Order Cancellation:</strong> Only orders in <code>ORDERED</code> state can be cancelled.</li>
            </ul>
          </div>
        </div>
      `;
    } else if (currentUser.role === 'Supplier / Vendor') {
      statsHtml = `
        <div class="stats-grid">
          <div class="stat-card">
            <div>
              <div class="stat-title">Awaiting Dispatch</div>
              <div class="stat-value" style="color: var(--color-warning);">${stats.ordersAwaitingDispatch || 0}</div>
              <div class="stat-desc">New orders ready for dispatch</div>
            </div>
            <div class="stat-icon warning">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Dispatched Orders</div>
              <div class="stat-value" style="color: var(--color-info);">${stats.dispatchedOrders || 0}</div>
              <div class="stat-desc">Shipments currently in transit</div>
            </div>
            <div class="stat-icon info">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            </div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Delivered & Received</div>
              <div class="stat-value" style="color: var(--color-success);">${stats.receivedOrders || 0}</div>
              <div class="stat-desc">Accepted by hospital store</div>
            </div>
            <div class="stat-icon success">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Total Orders</div>
              <div class="stat-value">${stats.totalOrders || 0}</div>
              <div class="stat-desc">All assigned purchase orders</div>
            </div>
            <div class="stat-icon primary">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-2z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top: 1.5rem;">
          <div class="card-header">
            <h3 class="card-title">Vendor Portal Management</h3>
          </div>
          <p style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: 1.25rem;">
            View purchase orders sent by the hospital. When a shipment leaves your facility, update the delivery status to Dispatched and record shipment tracking information.
          </p>
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <a href="#vendor-orders" class="btn btn-primary">
              View Purchase Orders (${stats.ordersAwaitingDispatch || 0} Awaiting)
            </a>
            <a href="#vendor-deliveries" class="btn btn-secondary">
              Track Active Deliveries (${stats.dispatchedOrders || 0} In-Transit)
            </a>
          </div>
        </div>
      `;
    } else {
      statsHtml = `
        <div class="card" style="padding: 2.5rem; text-align: center;">
          <h2 style="font-size: var(--font-size-xl); font-weight: 700; margin-bottom: 0.5rem;">Welcome, ${currentUser.name}</h2>
          <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); max-width: 500px; margin: 0 auto 1.5rem;">
            Role: <strong>${currentUser.role}</strong>
          </p>
        </div>
      `;
    }

    container.innerHTML = statsHtml;

    // Render stock-by-category bar chart for Inventory Manager and Administrator
    if (stats.categoryChartData && stats.categoryChartData.labels.length > 0) {
      const chartCard = document.createElement('div');
      chartCard.className = 'card';
      chartCard.style.marginTop = '1.5rem';
      chartCard.innerHTML = `
        <div class="card-header"><h3 class="card-title">Stock Distribution by Category</h3></div>
        <div style="position:relative; height:300px;"><canvas id="category-chart"></canvas></div>
      `;
      container.appendChild(chartCard);

      const ctx = document.getElementById('category-chart').getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: stats.categoryChartData.labels,
          datasets: [{
            label: 'Available Stock (units)',
            data: stats.categoryChartData.values,
            backgroundColor: [
              '#0F766E', '#2563EB', '#D97706', '#16A34A', '#DC2626',
              '#7C3AED', '#0891B2', '#CA8A04', '#DB2777', '#059669'
            ],
            borderRadius: 6,
            barThickness: 40,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#E5E7EB' }, ticks: { color: '#6B7280' } },
            x: { grid: { display: false }, ticks: { color: '#6B7280' } }
          }
        }
      });
    }

    // Render urgent alerts widget
    if (stats.urgentAlerts && stats.urgentAlerts.length > 0) {
      const alertsCard = document.createElement('div');
      alertsCard.className = 'card';
      alertsCard.style.marginTop = '1.5rem';

      const typeColors = { EXPIRED: 'var(--color-danger)', NEAR_EXPIRY: 'var(--color-warning)', LOW_STOCK: 'var(--color-warning)', DELAYED_DELIVERY: 'var(--color-warning)' };
      const typeLabels = { EXPIRED: 'Expired', NEAR_EXPIRY: 'Near Expiry', LOW_STOCK: 'Low Stock', DELAYED_DELIVERY: 'Delayed Delivery' };

      alertsCard.innerHTML = `
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 class="card-title">Urgent Alerts</h3>
          <a href="#alerts" class="btn btn-secondary btn-sm">View All (${stats.totalUnresolvedAlerts})</a>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.625rem;">
          ${stats.urgentAlerts.map(a => `
            <div style="display:flex; align-items:flex-start; gap:0.75rem; padding:0.625rem 0; border-bottom:1px solid var(--color-border);">
              <span class="badge ${a.type === 'EXPIRED' ? 'badge-expired' : 'badge-low-stock'}" style="flex-shrink:0; margin-top:2px;">
                <span class="badge-dot"></span>${typeLabels[a.type] || a.type}
              </span>
              <span style="font-size:var(--font-size-sm); color:var(--color-text); flex:1;">${a.message}</span>
            </div>
          `).join('')}
        </div>
      `;
      container.appendChild(alertsCard);
    }

  } catch (err) {
    container.innerHTML = `<div class="card" style="color: var(--color-danger);">Failed to load dashboard: ${err.message}</div>`;
  }
}

/* ==========================================================================
   VIEW: USERS (Hospital Administrator)
   ========================================================================== */
async function renderUsers(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
      <p style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
        Manage staff and supplier credentials, assign roles, and handle account activation.
      </p>
      <button type="button" class="btn btn-primary" id="btn-add-user">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add New User
      </button>
    </div>
    <div id="users-table-mount"></div>
  `;

  document.getElementById('btn-add-user').onclick = () => showUserModal();

  loadUsersTable();
}

async function loadUsersTable() {
  const mount = document.getElementById('users-table-mount');
  if (!mount) return;
  mount.innerHTML = '<div class="skeleton" style="height: 350px;"></div>';

  try {
    const data = await API.get('/api/users');
    const users = data.users || [];

    UI.createTable({
      container: mount,
      data: users,
      searchFields: ['name', 'email', 'role', 'department'],
      columns: [
        { key: 'user_id', label: 'ID', sortable: true },
        { 
          key: 'name', 
          label: 'User Name', 
          sortable: true,
          render: (u) => `<strong>${u.name}</strong><br><span style="font-size:0.75rem; color:var(--color-text-muted);">${u.email}</span>`
        },
        { 
          key: 'role', 
          label: 'Role', 
          sortable: true,
          render: (u) => `<span class="badge badge-info" style="font-size:0.75rem;">${u.role}</span>`
        },
        { 
          key: 'department', 
          label: 'Department', 
          sortable: true,
          render: (u) => u.department || '<span style="color:var(--color-text-muted);">-</span>'
        },
        {
          key: 'is_active',
          label: 'Status',
          sortable: true,
          render: (u) => UI.renderBadge(u.is_active ? 'ACTIVE' : 'INACTIVE')
        },
        {
          key: 'actions',
          label: 'Actions',
          sortable: false,
          render: (u) => `
            <div style="display:flex; gap:0.5rem;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="editUser(${u.user_id})">Edit</button>
              ${u.user_id !== currentUser.user_id ? `
                <button type="button" class="btn ${u.is_active ? 'btn-danger' : 'btn-secondary'} btn-sm" onclick="toggleUserStatus(${u.user_id}, ${!u.is_active})">
                  ${u.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              ` : '<span style="font-size:0.75rem; color:var(--color-text-muted); align-self:center;">(You)</span>'}
            </div>
          `
        }
      ],
      filters: [
        {
          id: 'role',
          label: 'Filter Role',
          options: [
            { value: 'Hospital Administrator', label: 'Administrator' },
            { value: 'Inventory Manager', label: 'Inventory Manager' },
            { value: 'Procurement Officer', label: 'Procurement Officer' },
            { value: 'Hospital Department Staff', label: 'Department Staff' },
            { value: 'Supplier / Vendor', label: 'Supplier / Vendor' }
          ],
          match: (row, val) => row.role === val
        },
        {
          id: 'status',
          label: 'Filter Status',
          options: [
            { value: 'true', label: 'Active Only' },
            { value: 'false', label: 'Deactivated Only' }
          ],
          match: (row, val) => String(row.is_active) === val
        }
      ]
    });
  } catch (err) {
    mount.innerHTML = `<div class="card" style="color:var(--color-danger);">Failed to load users: ${err.message}</div>`;
  }
}

window.toggleUserStatus = function(userId, newStatus) {
  UI.confirm({
    title: newStatus ? 'Reactivate User' : 'Deactivate User',
    message: `Are you sure you want to ${newStatus ? 'reactivate' : 'deactivate'} this user account? ${newStatus ? 'They will be permitted to log in.' : 'They will be barred from logging in.'}`,
    confirmText: newStatus ? 'Reactivate' : 'Deactivate',
    confirmClass: newStatus ? 'btn-primary' : 'btn-danger',
    onConfirm: async () => {
      try {
        await API.patch(`/api/users/${userId}/status`, { is_active: newStatus });
        UI.toast(`User account successfully ${newStatus ? 'reactivated' : 'deactivated'}.`, 'success');
        loadUsersTable();
      } catch (err) {
        UI.toast(err.message, 'danger');
      }
    }
  });
};

window.editUser = async function(userId) {
  try {
    const data = await API.get('/api/users');
    const user = data.users.find(u => u.user_id === userId);
    if (user) {
      showUserModal(user);
    }
  } catch (err) {
    UI.toast(err.message, 'danger');
  }
};

function showUserModal(user = null) {
  const modalWrapper = document.getElementById('app-modal-wrapper');
  const isEdit = !!user;

  modalWrapper.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'Update User Account' : 'Create New User Account'}</h3>
        <button type="button" class="btn-icon" id="user-modal-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <form id="user-form">
        <div class="modal-body">
          <div id="modal-error" style="display:none; color:var(--color-danger); font-size:var(--font-size-xs); margin-bottom:1rem; padding:0.5rem; background:var(--color-danger-bg); border-radius:var(--radius-sm);"></div>
          
          <div class="form-group">
            <label class="form-label" for="usr-name">Full Name <span class="required">*</span></label>
            <input type="text" id="usr-name" class="form-input" required value="${user ? user.name : ''}">
          </div>

          <div class="form-group">
            <label class="form-label" for="usr-email">Email Address <span class="required">*</span></label>
            <input type="email" id="usr-email" class="form-input" required value="${user ? user.email : ''}">
          </div>

          <div class="form-group">
            <label class="form-label" for="usr-role">Role <span class="required">*</span></label>
            <select id="usr-role" class="form-select" required>
              <option value="Hospital Administrator" ${user?.role === 'Hospital Administrator' ? 'selected' : ''}>Hospital Administrator</option>
              <option value="Inventory Manager" ${user?.role === 'Inventory Manager' ? 'selected' : ''}>Inventory Manager</option>
              <option value="Procurement Officer" ${user?.role === 'Procurement Officer' ? 'selected' : ''}>Procurement Officer</option>
              <option value="Hospital Department Staff" ${user?.role === 'Hospital Department Staff' || !user ? 'selected' : ''}>Hospital Department Staff</option>
              <option value="Supplier / Vendor" ${user?.role === 'Supplier / Vendor' ? 'selected' : ''}>Supplier / Vendor</option>
            </select>
          </div>

          <div class="form-group" id="dept-group">
            <label class="form-label" for="usr-dept">Department <span class="required" id="dept-req">*</span></label>
            <input type="text" id="usr-dept" class="form-input" placeholder="e.g. Emergency (Casualty), ICU, Paediatrics" value="${user?.department || ''}">
          </div>

          <div class="form-group">
            <label class="form-label" for="usr-contact">Contact Phone</label>
            <input type="text" id="usr-contact" class="form-input" placeholder="+91-98200-00100" value="${user?.contact || ''}">
          </div>

          <div class="form-group">
            <label class="form-label" for="usr-password">${isEdit ? 'New Password (leave blank to keep current)' : 'Password'} <span class="required">${isEdit ? '' : '*'}</span></label>
            <input type="password" id="usr-password" class="form-input" ${isEdit ? '' : 'required'}>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="user-modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="user-modal-submit">${isEdit ? 'Save Changes' : 'Create Account'}</button>
        </div>
      </form>
    </div>
  `;

  modalWrapper.classList.add('open');

  const close = () => modalWrapper.classList.remove('open');
  modalWrapper.querySelector('#user-modal-close').onclick = close;
  modalWrapper.querySelector('#user-modal-cancel').onclick = close;

  const roleSelect = modalWrapper.querySelector('#usr-role');
  const deptReq = modalWrapper.querySelector('#dept-req');
  roleSelect.onchange = () => {
    deptReq.style.display = roleSelect.value === 'Hospital Department Staff' ? 'inline' : 'none';
  };
  deptReq.style.display = roleSelect.value === 'Hospital Department Staff' ? 'inline' : 'none';

  modalWrapper.querySelector('#user-form').onsubmit = async (e) => {
    e.preventDefault();
    const errBox = modalWrapper.querySelector('#modal-error');
    errBox.style.display = 'none';

    const payload = {
      name: modalWrapper.querySelector('#usr-name').value.trim(),
      email: modalWrapper.querySelector('#usr-email').value.trim(),
      role: modalWrapper.querySelector('#usr-role').value,
      department: modalWrapper.querySelector('#usr-dept').value.trim(),
      contact: modalWrapper.querySelector('#usr-contact').value.trim(),
      password: modalWrapper.querySelector('#usr-password').value
    };

    try {
      if (isEdit) {
        await API.put(`/api/users/${user.user_id}`, payload);
        UI.toast('User updated successfully.', 'success');
      } else {
        await API.post('/api/users', payload);
        UI.toast('User created successfully.', 'success');
      }
      close();
      loadUsersTable();
    } catch (err) {
      errBox.innerText = err.message;
      errBox.style.display = 'block';
    }
  };
}

/* ==========================================================================
   VIEW: SETTINGS (Hospital Administrator)
   ========================================================================== */
window.saveProductThreshold = async function(supplyId) {
  const minInput = document.getElementById(`prod-min-${supplyId}`);
  const expInput = document.getElementById(`prod-exp-${supplyId}`);
  if (!minInput || !expInput) return;

  const minStock = parseInt(minInput.value, 10);
  if (isNaN(minStock) || minStock < 0) {
    return UI.toast('Minimum stock level must be a non-negative integer.', 'danger');
  }

  const expVal = expInput.value.trim();
  const nearExp = expVal !== '' ? parseInt(expVal, 10) : null;
  if (nearExp !== null && (isNaN(nearExp) || nearExp <= 0 || nearExp > 365)) {
    return UI.toast('Near expiry threshold must be between 1 and 365 days.', 'danger');
  }

  try {
    const res = await API.put(`/api/settings/product-thresholds/${supplyId}`, {
      min_stock_level: minStock,
      near_expiry_days: nearExp
    });
    UI.toast(res.message || 'Product thresholds updated successfully.', 'success');
  } catch (err) {
    UI.toast(err.message, 'danger');
  }
};

async function renderSettings(container) {
  container.innerHTML = '<div class="skeleton" style="height: 300px;"></div>';

  try {
    const data = await API.get('/api/settings');
    const settings = data.settings || {};

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        <div class="card" style="max-width: 640px;">
          <div class="card-header">
            <h3 class="card-title">Default Threshold & Policy Configuration</h3>
          </div>
          <form id="settings-form">
            <div class="form-group">
              <label class="form-label" for="set-near-expiry">Near Expiry Threshold (Days) <span class="required">*</span></label>
              <input type="number" id="set-near-expiry" class="form-input" min="1" max="365" required value="${settings.near_expiry_days || 30}">
              <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 0.375rem;">
                Default window applied across inventory items unless customized per product below.
              </p>
            </div>

            <div class="form-group">
              <label class="form-label" for="set-min-stock">Default Minimum Stock Level <span class="required">*</span></label>
              <input type="number" id="set-min-stock" class="form-input" min="1" max="10000" required value="${settings.default_min_stock_level || 20}">
              <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 0.375rem;">
                Default threshold applied when provisioning new clinical supply batches.
              </p>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
              <button type="submit" class="btn btn-primary" id="btn-save-settings">Save System Settings</button>
            </div>
          </form>
        </div>

        <div class="card">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 class="card-title">Per-Product Thresholds & Shelf Life</h3>
              <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 0.25rem;">
                Different medical supplies have different shelf lives and minimum thresholds. Customize individual alert windows below.
              </p>
            </div>
          </div>
          <div id="product-thresholds-mount" style="margin-top: 1rem;">
            <div class="skeleton" style="height: 250px;"></div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('settings-form').onsubmit = async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('btn-save-settings');
      saveBtn.disabled = true;
      saveBtn.innerText = 'Saving...';

      const nearExpiry = document.getElementById('set-near-expiry').value;
      const minStock = document.getElementById('set-min-stock').value;

      try {
        await API.put('/api/settings', {
          near_expiry_days: nearExpiry,
          default_min_stock_level: minStock
        });
        UI.toast('System settings updated successfully.', 'success');
        loadProductThresholdsTable(parseInt(nearExpiry, 10));
      } catch (err) {
        UI.toast(err.message, 'danger');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Save System Settings';
      }
    };

    loadProductThresholdsTable(parseInt(settings.near_expiry_days || 30, 10));
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--color-danger);">Failed to load settings: ${err.message}</div>`;
  }
}

async function loadProductThresholdsTable(currentDefaultDays) {
  const mount = document.getElementById('product-thresholds-mount');
  if (!mount) return;

  try {
    const data = await API.get('/api/settings/product-thresholds');
    const supplies = data.supplies || [];
    const defaultDays = data.default_near_expiry_days || currentDefaultDays || 30;

    UI.createTable({
      container: mount,
      data: supplies,
      searchFields: ['name', 'category', 'batch_no'],
      defaultSort: { key: 'name', direction: 'asc' },
      columns: [
        {
          key: 'name',
          label: 'Supply & Batch',
          sortable: true,
          render: (s) => `<strong>${s.name}</strong><br><span style="font-size:0.75rem; color:var(--color-text-muted);">Batch: ${s.batch_no} &bull; ${s.category}</span>`
        },
        {
          key: 'quantity',
          label: 'Available Stock',
          sortable: true,
          render: (s) => `<strong>${s.quantity}</strong> ${s.unit}`
        },
        {
          key: 'expiry_date',
          label: 'Expiry Date',
          sortable: true,
          render: (s) => s.expiry_date
        },
        {
          key: 'min_stock_level',
          label: 'Min Stock Level',
          sortable: true,
          render: (s) => `
            <div style="display:flex; align-items:center; gap:0.35rem;">
              <input type="number" id="prod-min-${s.supply_id}" class="form-input" style="width:85px; padding:0.25rem 0.5rem; font-size:0.85rem;" min="0" value="${s.min_stock_level}">
              <span style="font-size:0.75rem; color:var(--color-text-muted);">units</span>
            </div>
          `
        },
        {
          key: 'near_expiry_days',
          label: 'Near Expiry Window',
          sortable: true,
          render: (s) => `
            <div style="display:flex; align-items:center; gap:0.35rem;">
              <input type="number" id="prod-exp-${s.supply_id}" class="form-input" style="width:110px; padding:0.25rem 0.5rem; font-size:0.85rem;" min="1" max="365" placeholder="${defaultDays} (Default)" value="${s.near_expiry_days != null ? s.near_expiry_days : ''}">
              <span style="font-size:0.75rem; color:var(--color-text-muted);">days</span>
            </div>
          `
        },
        {
          key: 'actions',
          label: 'Action',
          sortable: false,
          render: (s) => `
            <button type="button" class="btn btn-primary btn-sm" onclick="window.saveProductThreshold(${s.supply_id})">Save</button>
          `
        }
      ],
      filters: [
        {
          id: 'category_filter',
          label: 'Category',
          options: Array.from(new Set(supplies.map(s => s.category))).sort().map(c => ({ value: c, label: c })),
          match: (row, val) => row.category === val
        }
      ]
    });
  } catch (err) {
    mount.innerHTML = `<div style="color:var(--color-danger); font-size:0.85rem;">Failed to load product thresholds: ${err.message}</div>`;
  }
}

/* ==========================================================================
   VIEW: INVENTORY (Inventory Manager)
   ========================================================================== */
async function renderInventory(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
      <p style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
        Manage clinical supplies, batches, units, and inventory records for the Central Medical Store, Jeevan Jyoti General Hospital, Mumbai.
      </p>
      <button type="button" class="btn btn-primary" id="btn-add-supply">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Medical Supply
      </button>
    </div>
    <div id="inventory-table-mount"></div>
  `;

  document.getElementById('btn-add-supply').onclick = () => showSupplyModal();

  loadInventoryTable();
}

async function loadInventoryTable() {
  const mount = document.getElementById('inventory-table-mount');
  if (!mount) return;
  mount.innerHTML = '<div class="skeleton" style="height: 380px;"></div>';

  try {
    const data = await API.get('/api/supplies');
    const supplies = data.supplies || [];

    const categories = Array.from(new Set(supplies.map(s => s.category))).sort();

    UI.createTable({
      container: mount,
      data: supplies,
      searchFields: ['name', 'category', 'batch_no', 'unit'],
      defaultSort: { key: 'name', direction: 'asc' },
      columns: [
        { key: 'supply_id', label: 'ID', sortable: true },
        { 
          key: 'name', 
          label: 'Supply Name', 
          sortable: true,
          render: (s) => `<strong>${s.name}</strong><br><span style="font-size:0.75rem; color:var(--color-text-muted);">Batch: ${s.batch_no}</span>`
        },
        { key: 'category', label: 'Category', sortable: true },
        { 
          key: 'quantity', 
          label: 'Quantity', 
          sortable: true,
          render: (s) => `<strong>${s.quantity}</strong> <span style="font-size:0.75rem; color:var(--color-text-muted);">${s.unit}</span>`
        },
        { key: 'min_stock_level', label: 'Min Level', sortable: true },
        { 
          key: 'expiry_date', 
          label: 'Expiry Date', 
          sortable: true,
          render: (s) => {
            if (s.is_expired) return `<span style="color:var(--color-danger); font-weight:600;">${s.expiry_date}</span>`;
            if (s.is_near_expiry) return `<span style="color:var(--color-warning); font-weight:600;">${s.expiry_date}</span>`;
            return s.expiry_date;
          }
        },
        {
          key: 'computed_status',
          label: 'Stock Status',
          sortable: true,
          render: (s) => UI.renderBadge(s.computed_status)
        },
        {
          key: 'actions',
          label: 'Actions',
          sortable: false,
          render: (s) => `
            <div style="display:flex; gap:0.4rem; align-items:center;">
              ${s.quantity > 0 ? `
                <button type="button" class="btn btn-danger btn-sm" onclick="window.openDisposeModal(${s.supply_id}, '${s.name.replace(/'/g, "\\'")}', '${s.batch_no}', ${s.quantity}, '${s.unit}')" title="Dispose expired or unusable stock">Dispose</button>
              ` : ''}
              <button type="button" class="btn btn-secondary btn-sm" onclick="editSupply(${s.supply_id})">Edit</button>
              <button type="button" class="btn btn-secondary btn-sm" style="color:var(--color-danger); border-color:var(--color-danger-border, #fca5a5);" onclick="deleteSupply(${s.supply_id}, '${s.name.replace(/'/g, "\\'")}')">Delete</button>
            </div>
          `
        }
      ],
      filters: [
        {
          id: 'category',
          label: 'Category',
          options: categories.map(c => ({ value: c, label: c })),
          match: (row, val) => row.category === val
        },
        {
          id: 'status',
          label: 'Status',
          options: [
            { value: 'OK', label: 'OK (Adequate)' },
            { value: 'LOW_STOCK', label: 'Low Stock' },
            { value: 'EXPIRED', label: 'Expired' }
          ],
          match: (row, val) => row.computed_status === val
        }
      ]
    });
  } catch (err) {
    mount.innerHTML = `<div class="card" style="color:var(--color-danger);">Failed to load inventory: ${err.message}</div>`;
  }
}

window.deleteSupply = function(supplyId, name) {
  UI.confirm({
    title: 'Delete Medical Supply',
    message: `Are you sure you want to permanently delete "${name}"? This action cannot be undone.`,
    confirmText: 'Delete Supply',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      try {
        await API.delete(`/api/supplies/${supplyId}`);
        UI.toast(`Supply "${name}" deleted successfully.`, 'success');
        loadInventoryTable();
      } catch (err) {
        UI.toast(err.message, 'danger');
      }
    }
  });
};

window.editSupply = async function(supplyId) {
  try {
    const data = await API.get(`/api/supplies/${supplyId}`);
    if (data && data.supply) {
      showSupplyModal(data.supply);
    }
  } catch (err) {
    UI.toast(err.message, 'danger');
  }
};

function showSupplyModal(supply = null) {
  const modalWrapper = document.getElementById('app-modal-wrapper');
  const isEdit = !!supply;

  modalWrapper.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'Edit Medical Supply' : 'Add New Medical Supply'}</h3>
        <button type="button" class="btn-icon" id="sup-modal-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <form id="supply-form">
        <div class="modal-body">
          <div id="sup-modal-error" style="display:none; color:var(--color-danger); font-size:var(--font-size-xs); margin-bottom:1rem; padding:0.5rem; background:var(--color-danger-bg); border-radius:var(--radius-sm);"></div>
          
          <div class="form-group">
            <label class="form-label" for="sup-name">Supply Name <span class="required">*</span></label>
            <input type="text" id="sup-name" class="form-input" required placeholder="e.g. Amoxicillin 500mg Capsules" value="${supply ? supply.name : ''}">
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="sup-category">Category <span class="required">*</span></label>
              <select id="sup-category" class="form-select" required>
                <option value="Medicines" ${supply?.category === 'Medicines' ? 'selected' : ''}>Medicines</option>
                <option value="Surgical" ${supply?.category === 'Surgical' ? 'selected' : ''}>Surgical</option>
                <option value="PPE" ${supply?.category === 'PPE' ? 'selected' : ''}>PPE</option>
                <option value="Diagnostics" ${supply?.category === 'Diagnostics' ? 'selected' : ''}>Diagnostics</option>
                <option value="Consumables" ${supply?.category === 'Consumables' || !supply ? 'selected' : ''}>Consumables</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="sup-batch">Batch Number <span class="required">*</span></label>
              <input type="text" id="sup-batch" class="form-input" required placeholder="e.g. BATCH-2026-X1" value="${supply ? supply.batch_no : ''}">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="sup-qty">Quantity <span class="required">*</span></label>
              <input type="number" id="sup-qty" class="form-input" min="0" required value="${supply ? supply.quantity : 100}">
            </div>

            <div class="form-group">
              <label class="form-label" for="sup-unit">Unit <span class="required">*</span></label>
              <input type="text" id="sup-unit" class="form-input" required placeholder="Box of 100, Vial, Piece" value="${supply ? supply.unit : 'Box of 100'}">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="sup-min">Min Stock Level <span class="required">*</span></label>
              <input type="number" id="sup-min" class="form-input" min="0" required value="${supply ? supply.min_stock_level : 20}">
              <span class="form-hint" style="font-size:0.75rem; color:var(--color-text-muted);">Minimum inventory reorder threshold</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="sup-near-exp">Near Expiry Threshold (Days)</label>
              <input type="number" id="sup-near-exp" class="form-input" min="1" placeholder="Default: 30 days" value="${supply?.near_expiry_days ?? ''}">
              <span class="form-hint" style="font-size:0.75rem; color:var(--color-text-muted);">Custom product shelf life warning window</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="sup-exp">Expiry Date <span class="required">*</span></label>
            <input type="date" id="sup-exp" class="form-input" required value="${supply ? supply.expiry_date : ''}">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="sup-modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="sup-modal-submit">${isEdit ? 'Save Changes' : 'Add Supply'}</button>
        </div>
      </form>
    </div>
  `;

  modalWrapper.classList.add('open');

  const close = () => modalWrapper.classList.remove('open');
  modalWrapper.querySelector('#sup-modal-close').onclick = close;
  modalWrapper.querySelector('#sup-modal-cancel').onclick = close;

  modalWrapper.querySelector('#supply-form').onsubmit = async (e) => {
    e.preventDefault();
    const errBox = modalWrapper.querySelector('#sup-modal-error');
    errBox.style.display = 'none';

    const nearExpVal = modalWrapper.querySelector('#sup-near-exp').value.trim();
    const payload = {
      name: modalWrapper.querySelector('#sup-name').value.trim(),
      category: modalWrapper.querySelector('#sup-category').value,
      batch_no: modalWrapper.querySelector('#sup-batch').value.trim(),
      quantity: modalWrapper.querySelector('#sup-qty').value,
      unit: modalWrapper.querySelector('#sup-unit').value.trim(),
      min_stock_level: modalWrapper.querySelector('#sup-min').value,
      near_expiry_days: nearExpVal ? parseInt(nearExpVal, 10) : null,
      expiry_date: modalWrapper.querySelector('#sup-exp').value
    };

    try {
      if (isEdit) {
        await API.put(`/api/supplies/${supply.supply_id}`, payload);
        UI.toast('Medical supply updated successfully.', 'success');
      } else {
        await API.post('/api/supplies', payload);
        UI.toast('Medical supply registered successfully.', 'success');
      }
      close();
      loadInventoryTable();
    } catch (err) {
      errBox.innerText = err.message;
      errBox.style.display = 'block';
    }
  };
}

/* ==========================================================================
   VIEW: STOCK MONITORING (Inventory Manager)
   ========================================================================== */
async function renderStockMonitoring(container) {
  container.innerHTML = '<div class="skeleton" style="height: 400px;"></div>';

  try {
    const data = await API.get('/api/supplies');
    const supplies = data.supplies || [];

    const lowStockItems = supplies.filter(s => s.is_low_stock);
    const expiredItems = supplies.filter(s => s.is_expired);
    const nearExpiryItems = supplies.filter(s => s.is_near_expiry);

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div>
            <div class="stat-title">Low Stock Alert</div>
            <div class="stat-value" style="color: var(--color-warning);">${lowStockItems.length}</div>
            <div class="stat-desc">Supplies requiring re-order</div>
          </div>
          <div class="stat-icon warning">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
        </div>

        <div class="stat-card">
          <div>
            <div class="stat-title">Near Expiry Alert</div>
            <div class="stat-value" style="color: var(--color-warning);">${nearExpiryItems.length}</div>
            <div class="stat-desc">&le; 30 days to expiry</div>
          </div>
          <div class="stat-icon warning">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
        </div>

        <div class="stat-card">
          <div>
            <div class="stat-title">Expired Items</div>
            <div class="stat-value" style="color: var(--color-danger);">${expiredItems.length}</div>
            <div class="stat-desc">Quarantined / cannot issue</div>
          </div>
          <div class="stat-icon danger">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
        </div>
      </div>

      <div id="monitoring-table-mount"></div>
    `;

    const mount = document.getElementById('monitoring-table-mount');

    UI.createTable({
      container: mount,
      data: supplies,
      searchFields: ['name', 'category', 'batch_no'],
      defaultSort: { key: 'quantity', direction: 'asc' }, // default sort by quantity
      columns: [
        { 
          key: 'name', 
          label: 'Supply & Batch', 
          sortable: true,
          render: (s) => `<strong>${s.name}</strong><br><span style="font-size:0.75rem; color:var(--color-text-muted);">${s.batch_no} &bull; ${s.category}</span>`
        },
        { 
          key: 'quantity', 
          label: 'Current Stock', 
          sortable: true,
          render: (s) => `<strong>${s.quantity}</strong> ${s.unit}`
        },
        { key: 'min_stock_level', label: 'Min Level', sortable: true },
        { 
          key: 'expiry_date', 
          label: 'Expiry Date', 
          sortable: true,
          render: (s) => {
            if (s.is_expired) return `<span style="color:var(--color-danger); font-weight:600;">${s.expiry_date}</span>`;
            if (s.is_near_expiry) return `<span style="color:var(--color-warning); font-weight:600;">${s.expiry_date}</span>`;
            return s.expiry_date;
          }
        },
        {
          key: 'computed_status',
          label: 'Stock Status',
          sortable: true,
          render: (s) => UI.renderBadge(s.computed_status)
        },
        {
          key: 'supplier_name',
          label: 'Supplier',
          sortable: true,
          render: (s) => s.supplier_name || '<span style="color:var(--color-text-muted);">-</span>'
        },
        {
          key: 'actions',
          label: 'Actions',
          sortable: false,
          render: (s) => `
            <div style="display:flex; gap:0.4rem; align-items:center;">
              ${s.quantity > 0 ? `
                <button type="button" class="btn btn-danger btn-sm" onclick="window.openDisposeModal(${s.supply_id}, '${s.name.replace(/'/g, "\\'")}', '${s.batch_no}', ${s.quantity}, '${s.unit}')" title="Dispose expired or damaged stock">Dispose</button>
              ` : ''}
              <button type="button" class="btn btn-secondary btn-sm" onclick="viewSupplyDrawer(${s.supply_id})">Details</button>
            </div>
          `
        }
      ],
      filters: [
        {
          id: 'stock_filter',
          label: 'Stock Alert Filter',
          options: [
            { value: 'LOW_ONLY', label: 'Low Stock Only' },
            { value: 'NEAR_EXPIRY', label: 'Near Expiry Only' },
            { value: 'EXPIRED', label: 'Expired Only' },
            { value: 'OK', label: 'Adequate Stock (OK)' }
          ],
          match: (row, val) => {
            if (val === 'LOW_ONLY') return row.is_low_stock;
            if (val === 'NEAR_EXPIRY') return row.is_near_expiry;
            if (val === 'EXPIRED') return row.is_expired;
            if (val === 'OK') return row.computed_status === 'OK';
            return true;
          }
        }
      ]
    });
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--color-danger);">Failed to load stock monitor: ${err.message}</div>`;
  }
}

/* ==========================================================================
   VIEW: BROWSE SUPPLIES (Department Staff & General View)
   ========================================================================== */
async function renderBrowseSupplies(container) {
  container.innerHTML = '<div class="skeleton" style="height: 380px;"></div>';

  try {
    const data = await API.get('/api/supplies');
    const supplies = data.supplies || [];

    const categories = Array.from(new Set(supplies.map(s => s.category))).sort();

    container.innerHTML = `
      <div style="margin-bottom: 1.25rem;">
        <p style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
          Search hospital inventory by name, category, or batch number. Click "View Details" to inspect batch and expiry details.
        </p>
      </div>
      <div id="browse-table-mount"></div>
    `;

    const mount = document.getElementById('browse-table-mount');

    UI.createTable({
      container: mount,
      data: supplies,
      searchFields: ['name', 'category', 'batch_no', 'unit'],
      columns: [
        { 
          key: 'name', 
          label: 'Medical Supply', 
          sortable: true,
          render: (s) => `<strong>${s.name}</strong><br><span style="font-size:0.75rem; color:var(--color-text-muted);">${s.category}</span>`
        },
        { key: 'batch_no', label: 'Batch No', sortable: true },
        { 
          key: 'quantity', 
          label: 'Available Stock', 
          sortable: true,
          render: (s) => s.is_expired ? '<span style="color:var(--color-danger);">0 (Expired)</span>' : `<strong>${s.quantity}</strong> ${s.unit}`
        },
        { 
          key: 'expiry_date', 
          label: 'Expiry Date', 
          sortable: true,
          render: (s) => s.is_expired ? `<span style="color:var(--color-danger);">${s.expiry_date}</span>` : s.expiry_date
        },
        {
          key: 'computed_status',
          label: 'Status',
          sortable: true,
          render: (s) => UI.renderBadge(s.computed_status)
        },
        {
          key: 'actions',
          label: 'Actions',
          sortable: false,
          render: (s) => `
            <div style="display:flex; gap:0.5rem;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="viewSupplyDrawer(${s.supply_id})">View Details</button>
              ${currentUser.role === 'Hospital Department Staff' && !s.is_expired && s.quantity > 0 ? `
                <button type="button" class="btn btn-primary btn-sm" onclick="requestSupplyPrompt(${s.supply_id})">Request</button>
              ` : ''}
            </div>
          `
        }
      ],
      filters: [
        {
          id: 'category',
          label: 'Category',
          options: categories.map(c => ({ value: c, label: c })),
          match: (row, val) => row.category === val
        }
      ]
    });
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--color-danger);">Failed to load supplies: ${err.message}</div>`;
  }
}

window.viewSupplyDrawer = async function(supplyId) {
  try {
    const data = await API.get(`/api/supplies/${supplyId}`);
    const s = data.supply;

    const modalWrapper = document.getElementById('app-modal-wrapper');
    modalWrapper.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Supply Specification & Traceability</h3>
          <button type="button" class="btn-icon" id="detail-modal-close" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 1.25rem;">
            <h4 style="font-size: var(--font-size-lg); font-weight: 700; color: var(--color-text);">${s.name}</h4>
            <div style="margin-top: 0.375rem;">${UI.renderBadge(s.computed_status)}</div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: var(--font-size-sm); background: var(--color-bg); padding: 1rem; border-radius: var(--radius); border: 1px solid var(--color-border);">
            <div>
              <span style="color:var(--color-text-muted); font-size:0.75rem;">Category:</span>
              <div style="font-weight:600;">${s.category}</div>
            </div>
            <div>
              <span style="color:var(--color-text-muted); font-size:0.75rem;">Batch Number:</span>
              <div style="font-weight:600;">${s.batch_no}</div>
            </div>
            <div>
              <span style="color:var(--color-text-muted); font-size:0.75rem;">Stock Quantity:</span>
              <div style="font-weight:600;">${s.quantity} ${s.unit}</div>
            </div>
            <div>
              <span style="color:var(--color-text-muted); font-size:0.75rem;">Minimum Stock Level:</span>
              <div style="font-weight:600;">${s.min_stock_level} units</div>
            </div>
            <div>
              <span style="color:var(--color-text-muted); font-size:0.75rem;">Expiry Date:</span>
              <div style="font-weight:600; ${s.is_expired ? 'color:var(--color-danger);' : ''}">${s.expiry_date}</div>
            </div>
            <div>
              <span style="color:var(--color-text-muted); font-size:0.75rem;">Near Expiry Warning Window:</span>
              <div style="font-weight:600;">${s.near_expiry_days ? `${s.near_expiry_days} days (Custom)` : 'System Default (30 days)'}</div>
            </div>
            <div>
              <span style="color:var(--color-text-muted); font-size:0.75rem;">Associated Supplier:</span>
              <div style="font-weight:600;">${s.supplier_name || 'Direct Procurement'}</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="detail-modal-close-btn">Close</button>
          ${(currentUser.role === 'Inventory Manager' || currentUser.role === 'Hospital Administrator') && s.quantity > 0 ? `
            <button type="button" class="btn btn-danger" id="detail-modal-dispose-btn">Dispose Stock</button>
          ` : ''}
          ${currentUser.role === 'Hospital Department Staff' && !s.is_expired && s.quantity > 0 ? `
            <button type="button" class="btn btn-primary" id="detail-modal-req-btn">Request Item</button>
          ` : ''}
        </div>
      </div>
    `;

    modalWrapper.classList.add('open');
    const close = () => modalWrapper.classList.remove('open');
    modalWrapper.querySelector('#detail-modal-close').onclick = close;
    modalWrapper.querySelector('#detail-modal-close-btn').onclick = close;

    const disposeBtn = modalWrapper.querySelector('#detail-modal-dispose-btn');
    if (disposeBtn) {
      disposeBtn.onclick = () => {
        close();
        window.openDisposeModal(s.supply_id, s.name, s.batch_no, s.quantity, s.unit);
      };
    }

    const reqBtn = modalWrapper.querySelector('#detail-modal-req-btn');
    if (reqBtn) {
      reqBtn.onclick = () => {
        close();
        window.location.hash = '#request-supplies';
      };
    }
  } catch (err) {
    UI.toast(err.message, 'danger');
  }
};

window.requestSupplyPrompt = function(supplyId) {
  window.location.hash = '#request-supplies';
};

/* ==========================================================================
   VIEW: REQUEST SUPPLIES (Hospital Department Staff)
   ========================================================================== */
async function renderRequestSupplies(container) {
  container.innerHTML = '<div class="skeleton" style="height: 300px;"></div>';

  try {
    const data = await API.get('/api/supplies');
    const eligibleSupplies = (data.supplies || []).filter(s => !s.is_expired && s.quantity > 0);

    container.innerHTML = `
      <div class="card" style="max-width: 640px;">
        <div class="card-header">
          <h3 class="card-title">Submit Department Supply Request</h3>
        </div>
        <form id="supply-request-form">
          <div id="req-form-error" style="display:none; color:var(--color-danger); font-size:var(--font-size-xs); margin-bottom:1rem; padding:0.5rem; background:var(--color-danger-bg); border-radius:var(--radius-sm);"></div>

          <div class="form-group">
            <label class="form-label" for="req-supply-id">Select Medical Supply <span class="required">*</span></label>
            <select id="req-supply-id" class="form-select" required>
              <option value="">-- Choose an eligible clinical supply --</option>
              ${eligibleSupplies.map(s => `
                <option value="${s.supply_id}" data-max="${s.quantity}" data-unit="${s.unit}">
                  ${s.name} (${s.category}) — Avail: ${s.quantity} ${s.unit} [Batch: ${s.batch_no}]
                </option>
              `).join('')}
            </select>
            <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 0.375rem;">
              Expired and zero-stock supplies are filtered out and cannot be requested.
            </p>
          </div>

          <div class="form-group">
            <label class="form-label" for="req-dept">Requesting Department <span class="required">*</span></label>
            <select id="req-dept" class="form-select" required>
              ${[
                'Emergency (Casualty)',
                'ICU',
                'OPD',
                'General Surgery',
                'Paediatrics',
                'Radiology',
                'Maternity',
                'Pathology'
              ].map(dept => `
                <option value="${dept}" ${(currentUser.department === dept || (!currentUser.department && dept === 'Emergency (Casualty)')) ? 'selected' : ''}>${dept}</option>
              `).join('')}
              ${currentUser.department && ![
                'Emergency (Casualty)',
                'ICU',
                'OPD',
                'General Surgery',
                'Paediatrics',
                'Radiology',
                'Maternity',
                'Pathology'
              ].includes(currentUser.department) ? `<option value="${currentUser.department}" selected>${currentUser.department}</option>` : ''}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="req-qty">Quantity Needed <span class="required">*</span></label>
            <input type="number" id="req-qty" class="form-input" min="1" required placeholder="Enter quantity">
            <div id="stock-feedback" style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 0.375rem;"></div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
            <a href="#my-requests" class="btn btn-secondary">View My Requests</a>
            <button type="submit" class="btn btn-primary" id="btn-submit-request">Submit Request</button>
          </div>
        </form>
      </div>
    `;

    const selectEl = document.getElementById('req-supply-id');
    const qtyEl = document.getElementById('req-qty');
    const feedback = document.getElementById('stock-feedback');

    selectEl.onchange = () => {
      const opt = selectEl.options[selectEl.selectedIndex];
      if (opt && opt.value) {
        const max = opt.getAttribute('data-max');
        const unit = opt.getAttribute('data-unit');
        qtyEl.max = max;
        feedback.innerText = `Maximum available in store: ${max} ${unit}`;
      } else {
        feedback.innerText = '';
      }
    };

    document.getElementById('supply-request-form').onsubmit = async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('req-form-error');
      errBox.style.display = 'none';

      const supplyId = selectEl.value;
      const dept = document.getElementById('req-dept').value.trim();
      const qty = parseInt(qtyEl.value, 10);

      if (!supplyId) {
        errBox.innerText = 'Please select a supply from the list.';
        errBox.style.display = 'block';
        return;
      }

      const submitBtn = document.getElementById('btn-submit-request');
      submitBtn.disabled = true;
      submitBtn.innerText = 'Submitting...';

      try {
        await API.post('/api/requests', {
          supply_id: supplyId,
          department: dept,
          quantity: qty
        });
        UI.toast('Supply request submitted successfully.', 'success');
        window.location.hash = '#my-requests';
      } catch (err) {
        errBox.innerText = err.message;
        errBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerText = 'Submit Request';
      }
    };
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--color-danger);">Failed to load request form: ${err.message}</div>`;
  }
}

/* ==========================================================================
   VIEW: MY REQUESTS (Hospital Department Staff)
   ========================================================================== */
async function renderMyRequests(container) {
  container.innerHTML = '<div class="skeleton" style="height: 380px;"></div>';

  try {
    const data = await API.get('/api/requests/my');
    const requests = data.requests || [];

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <p style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
          Track status of requisitions submitted for <strong>${currentUser.department || 'your department'}</strong>.
        </p>
        <a href="#request-supplies" class="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Request
        </a>
      </div>
      <div id="my-requests-table-mount"></div>
    `;

    const mount = document.getElementById('my-requests-table-mount');

    UI.createTable({
      container: mount,
      data: requests,
      searchFields: ['supply_name', 'category', 'batch_no'],
      columns: [
        { key: 'request_id', label: 'Req #', sortable: true },
        { 
          key: 'supply_name', 
          label: 'Supply Item', 
          sortable: true,
          render: (r) => `<strong>${r.supply_name}</strong><br><span style="font-size:0.75rem; color:var(--color-text-muted);">Batch: ${r.batch_no}</span>`
        },
        { key: 'department', label: 'Department', sortable: true },
        { 
          key: 'quantity', 
          label: 'Quantity', 
          sortable: true,
          render: (r) => `<strong>${r.quantity}</strong> ${r.unit}`
        },
        { key: 'request_date', label: 'Date Requested', sortable: true },
        {
          key: 'status',
          label: 'Status',
          sortable: true,
          render: (r) => UI.renderBadge(r.status)
        },
        {
          key: 'decided_by_name',
          label: 'Decision By',
          sortable: true,
          render: (r) => r.decided_by_name ? `${r.decided_by_name}<br><span style="font-size:0.75rem; color:var(--color-text-muted);">${r.decided_at || ''}</span>` : '<span style="color:var(--color-text-muted);">Pending Review</span>'
        }
      ],
      filters: [
        {
          id: 'status',
          label: 'Filter Status',
          options: [
            { value: 'PENDING', label: 'Pending' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'REJECTED', label: 'Rejected' }
          ],
          match: (row, val) => row.status === val
        }
      ],
      emptyMessage: 'No supply requests submitted yet.'
    });
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--color-danger);">Failed to load requests: ${err.message}</div>`;
  }
}

/* ==========================================================================
   VIEW: MANAGE REQUESTS (Inventory Manager)
   ========================================================================== */
async function renderManageRequests(container) {
  container.innerHTML = '<div class="skeleton" style="height: 380px;"></div>';

  try {
    const data = await API.get('/api/requests');
    const requests = data.requests || [];

    container.innerHTML = `
      <div style="margin-bottom: 1.25rem;">
        <p style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
          Review department supply requisitions. Approving a request automatically deducts stock from the Main Store inventory.
        </p>
      </div>
      <div id="manage-requests-table-mount"></div>
    `;

    const mount = document.getElementById('manage-requests-table-mount');

    UI.createTable({
      container: mount,
      data: requests,
      searchFields: ['supply_name', 'department', 'requested_by_name'],
      columns: [
        { key: 'request_id', label: 'Req #', sortable: true },
        { 
          key: 'supply_name', 
          label: 'Requested Supply', 
          sortable: true,
          render: (r) => `<strong>${r.supply_name}</strong><br><span style="font-size:0.75rem; color:var(--color-text-muted);">Avail in store: ${r.available_quantity} ${r.unit}</span>`
        },
        { 
          key: 'department', 
          label: 'Department & Staff', 
          sortable: true,
          render: (r) => `<strong>${r.department}</strong><br><span style="font-size:0.75rem; color:var(--color-text-muted);">${r.requested_by_name}</span>`
        },
        { 
          key: 'quantity', 
          label: 'Requested Qty', 
          sortable: true,
          render: (r) => `<strong>${r.quantity}</strong> ${r.unit}`
        },
        { key: 'request_date', label: 'Date', sortable: true },
        {
          key: 'status',
          label: 'Status',
          sortable: true,
          render: (r) => UI.renderBadge(r.status)
        },
        {
          key: 'actions',
          label: 'Actions',
          sortable: false,
          render: (r) => {
            if (r.status === 'PENDING') {
              return `
                <div style="display:flex; gap:0.5rem;">
                  <button type="button" class="btn btn-primary btn-sm" onclick="decideRequest(${r.request_id}, 'APPROVE', '${r.supply_name.replace(/'/g, "\\'")}', ${r.quantity})">Approve</button>
                  <button type="button" class="btn btn-danger btn-sm" onclick="decideRequest(${r.request_id}, 'REJECT', '${r.supply_name.replace(/'/g, "\\'")}', ${r.quantity})">Reject</button>
                </div>
              `;
            }
            return `<span style="font-size:0.75rem; color:var(--color-text-muted);">Decided by ${r.decided_by_name || 'Store'}</span>`;
          }
        }
      ],
      filters: [
        {
          id: 'status',
          label: 'Filter Status',
          options: [
            { value: 'PENDING', label: 'Pending Review Only' },
            { value: 'APPROVED', label: 'Approved Only' },
            { value: 'REJECTED', label: 'Rejected Only' }
          ],
          match: (row, val) => row.status === val
        }
      ],
      emptyMessage: 'No supply requests found.'
    });
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--color-danger);">Failed to load department requests: ${err.message}</div>`;
  }
}

window.decideRequest = function(requestId, action, supplyName, quantity) {
  const isApprove = action === 'APPROVE';
  UI.confirm({
    title: isApprove ? 'Approve Supply Request' : 'Reject Supply Request',
    message: isApprove 
      ? `Approving this requisition will deduct ${quantity} units of "${supplyName}" from available store stock. Proceed?`
      : `Are you sure you want to reject this requisition for "${supplyName}"?`,
    confirmText: isApprove ? 'Approve & Deduct Stock' : 'Reject Request',
    confirmClass: isApprove ? 'btn-primary' : 'btn-danger',
    onConfirm: async () => {
      try {
        const res = await API.post(`/api/requests/${requestId}/decide`, { action });
        UI.toast(res.message, 'success');
        handleRoute(); // Refresh view
      } catch (err) {
        UI.toast(err.message, 'danger');
      }
    }
  });
};

/* ==========================================================================
   INCREMENT 2: VIEW - SUPPLIER MANAGEMENT (Procurement Officer / Admin)
   ========================================================================== */
async function renderSuppliers(container) {
  container.innerHTML = '<div class="skeleton" style="height: 120px; margin-bottom: 1.5rem;"></div><div class="skeleton" style="height: 320px;"></div>';

  try {
    const data = await API.get('/api/suppliers');
    const suppliers = data.suppliers || [];

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <h2 style="font-size: var(--font-size-lg); font-weight: 700; margin-bottom: 0.25rem;">Medical Suppliers Directory</h2>
          <p style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
            Manage authorized medical suppliers, pharmaceutical vendors, and purchase history.
          </p>
        </div>
        <button type="button" class="btn btn-primary" onclick="openAddSupplierModal()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add New Supplier
        </button>
      </div>

      <div class="card" id="suppliers-table-card"></div>
    `;

    UI.createTable({
      container: document.getElementById('suppliers-table-card'),
      data: suppliers,
      searchFields: ['name', 'contact', 'email', 'address'],
      columns: [
        {
          key: 'name',
          label: 'Supplier Name',
          sortable: true,
          render: (row) => `
            <div>
              <div style="font-weight: 600; color: var(--color-text);">${row.name}</div>
              <div style="font-size: var(--font-size-xs); color: var(--color-text-muted);">${row.address || 'No physical address recorded'}</div>
            </div>
          `
        },
        {
          key: 'contact',
          label: 'Contact Info',
          render: (row) => `
            <div style="font-size: var(--font-size-sm);">
              <div>${row.contact || 'N/A'}</div>
              <div style="color: var(--color-text-muted); font-size: var(--font-size-xs);">${row.email}</div>
            </div>
          `
        },
        {
          key: 'total_orders',
          label: 'Purchase Orders',
          sortable: true,
          render: (row) => `<span class="badge badge-info"><span class="badge-dot"></span>${row.total_orders || 0} orders</span>`
        },
        {
          key: 'is_active',
          label: 'Status',
          sortable: true,
          render: (row) => UI.renderBadge(row.is_active ? 'ACTIVE' : 'INACTIVE')
        },
        {
          key: 'actions',
          label: 'Actions',
          render: (row) => `
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="viewSupplierDetails(${row.supplier_id})">
                Details & Orders
              </button>
              <button type="button" class="btn ${row.is_active ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="toggleSupplierStatus(${row.supplier_id}, ${row.is_active}, '${row.name.replace(/'/g, "\\'")}')">
                ${row.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          `
        }
      ],
      filters: [
        {
          id: 'status',
          label: 'Filter Status',
          options: [
            { value: 'true', label: 'Active Suppliers Only' },
            { value: 'false', label: 'Deactivated Only' }
          ],
          match: (row, val) => String(row.is_active) === val
        }
      ],
      emptyMessage: 'No suppliers registered.'
    });
  } catch (err) {
    container.innerHTML = `<div class="card" style="color: var(--color-danger);">Failed to load suppliers: ${err.message}</div>`;
  }
}

// Modal: Add Supplier
window.openAddSupplierModal = function() {
  const modal = document.getElementById('app-modal-wrapper');
  modal.innerHTML = `
    <div class="modal-card" style="max-width: 540px;">
      <div class="modal-header">
        <h3 class="modal-title">Register New Medical Supplier</h3>
        <button type="button" class="btn-icon" id="modal-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <form id="add-supplier-form">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Supplier / Company Name <span class="required">*</span></label>
            <input type="text" id="sup-name" class="form-input" placeholder="e.g. Sahyadri Pharma Distributors" required>
          </div>
          <div class="form-group">
            <label class="form-label">Contact Person / Phone Number</label>
            <input type="text" id="sup-contact" class="form-input" placeholder="e.g. +91-20-5550-0149 (Operations Desk)">
          </div>
          <div class="form-group">
            <label class="form-label">Email Address <span class="required">*</span></label>
            <input type="email" id="sup-email" class="form-input" placeholder="orders@sahyadripharma.test" required>
          </div>
          <div class="form-group">
            <label class="form-label">Facility / Mailing Address</label>
            <textarea id="sup-address" class="form-textarea" rows="2" placeholder="e.g. Plot 42, MIDC Bhosari, Pune, Maharashtra 411026"></textarea>
          </div>
          <div id="sup-form-error" style="color: var(--color-danger); font-size: var(--font-size-sm); margin-top: 0.5rem; display: none;"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-supplier">Save Supplier</button>
        </div>
      </form>
    </div>
  `;

  modal.classList.add('open');

  const close = () => modal.classList.remove('open');
  modal.querySelector('#modal-close').onclick = close;
  modal.querySelector('#modal-cancel').onclick = close;

  const form = document.getElementById('add-supplier-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('sup-form-error');
    errDiv.style.display = 'none';

    const name = document.getElementById('sup-name').value.trim();
    const contact = document.getElementById('sup-contact').value.trim();
    const email = document.getElementById('sup-email').value.trim();
    const address = document.getElementById('sup-address').value.trim();

    if (!name || !email) {
      errDiv.innerText = 'Supplier name and email address are required.';
      errDiv.style.display = 'block';
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      errDiv.innerText = 'Please provide a valid email address (e.g. user@domain.com).';
      errDiv.style.display = 'block';
      return;
    }

    try {
      const res = await API.post('/api/suppliers', { name, contact, email, address });
      UI.toast(res.message || 'Supplier created successfully.', 'success');
      close();
      handleRoute();
    } catch (err) {
      errDiv.innerText = err.message;
      errDiv.style.display = 'block';
    }
  };
};

// Modal: View Supplier Details & Orders
window.viewSupplierDetails = async function(supplierId) {
  const modal = document.getElementById('app-modal-wrapper');
  modal.innerHTML = `
    <div class="modal-card" style="max-width: 720px;">
      <div class="modal-header">
        <h3 class="modal-title">Supplier Profile & Purchase History</h3>
        <button type="button" class="btn-icon" id="modal-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body" id="supplier-profile-body">
        <div class="skeleton" style="height: 100px; margin-bottom: 1rem;"></div>
        <div class="skeleton" style="height: 180px;"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Close</button>
      </div>
    </div>
  `;
  modal.classList.add('open');

  const close = () => modal.classList.remove('open');
  modal.querySelector('#modal-close').onclick = close;
  modal.querySelector('#modal-cancel').onclick = close;

  try {
    const data = await API.get(`/api/suppliers/${supplierId}`);
    const sup = data.supplier;
    const orders = data.orders || [];

    const body = document.getElementById('supplier-profile-body');
    body.innerHTML = `
      <div style="background: var(--color-bg); padding: 1rem; border-radius: var(--radius); border: 1px solid var(--color-border); margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
          <div>
            <h3 style="font-size: var(--font-size-base); font-weight: 700; color: var(--color-text); margin-bottom: 0.25rem;">${sup.name}</h3>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">${sup.address || 'No address registered'}</div>
          </div>
          <div>${UI.renderBadge(sup.is_active ? 'ACTIVE' : 'INACTIVE')}</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; font-size: var(--font-size-sm);">
          <div><strong style="color: var(--color-text-muted);">Contact:</strong> ${sup.contact || 'N/A'}</div>
          <div><strong style="color: var(--color-text-muted);">Email:</strong> ${sup.email}</div>
        </div>
      </div>

      <h4 style="font-size: var(--font-size-sm); font-weight: 600; margin-bottom: 0.75rem;">Purchase Orders (${orders.length})</h4>
      ${orders.length === 0 ? `
        <div class="empty-state" style="padding: 1.5rem;">
          <div class="empty-state-desc">No purchase orders placed with this supplier yet.</div>
        </div>
      ` : `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Order Date</th>
                <th>Status</th>
                <th>Expected Date</th>
                <th>Items / Qty</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map(o => `
                <tr>
                  <td style="font-weight: 600;">#PO-${o.order_id}</td>
                  <td>${o.order_date}</td>
                  <td>${UI.renderBadge(o.status)}</td>
                  <td>${o.expected_date || 'N/A'}</td>
                  <td>${o.item_count} items (${o.total_quantity} units)</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;
  } catch (err) {
    document.getElementById('supplier-profile-body').innerHTML = `<div style="color: var(--color-danger);">Failed to load supplier details: ${err.message}</div>`;
  }
};

// Toggle Supplier Active Status
window.toggleSupplierStatus = function(supplierId, currentActive, supplierName) {
  const nextState = !currentActive;
  const actionText = nextState ? 'activate' : 'deactivate';

  UI.confirm({
    title: `${nextState ? 'Activate' : 'Deactivate'} Supplier`,
    message: nextState
      ? `Activate supplier "${supplierName}"? They will become eligible for new purchase orders.`
      : `Are you sure you want to deactivate "${supplierName}"? Inactive suppliers cannot be selected for new purchase orders.`,
    confirmText: nextState ? 'Activate Supplier' : 'Deactivate Supplier',
    confirmClass: nextState ? 'btn-primary' : 'btn-danger',
    onConfirm: async () => {
      try {
        const res = await API.patch(`/api/suppliers/${supplierId}/status`, { is_active: nextState });
        UI.toast(res.message, 'success');
        handleRoute();
      } catch (err) {
        UI.toast(err.message, 'danger');
      }
    }
  });
};

/* ==========================================================================
   INCREMENT 2: VIEW - PURCHASE ORDERS (Procurement Officer / Admin)
   ========================================================================== */
async function renderPurchaseOrders(container) {
  container.innerHTML = '<div class="skeleton" style="height: 120px; margin-bottom: 1.5rem;"></div><div class="skeleton" style="height: 360px;"></div>';

  try {
    const [ordersData, suppliersData] = await Promise.all([
      API.get('/api/orders'),
      API.get('/api/suppliers')
    ]);

    const orders = ordersData.orders || [];
    const suppliers = suppliersData.suppliers || [];

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <h2 style="font-size: var(--font-size-lg); font-weight: 700; margin-bottom: 0.25rem;">Purchase Orders & Procurement</h2>
          <p style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
            Create purchase orders, track vendor deliveries, monitor delayed shipments, and receive stock.
          </p>
        </div>
        <button type="button" class="btn btn-primary" onclick="openCreateOrderModal()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create Purchase Order
        </button>
      </div>

      <div class="card" id="po-table-card"></div>
    `;

    UI.createTable({
      container: document.getElementById('po-table-card'),
      data: orders,
      searchFields: ['order_id', 'supplier_name', 'notes', 'status'],
      columns: [
        {
          key: 'order_id',
          label: 'Order ID',
          sortable: true,
          render: (row) => `
            <div>
              <span style="font-weight: 700; color: var(--color-primary);">#PO-${row.order_id}</span>
              ${row.is_delayed ? '<span class="badge badge-low-stock" style="margin-left: 0.375rem;" title="Order past expected date and not received"><span class="badge-dot"></span>Delayed</span>' : ''}
            </div>
          `
        },
        {
          key: 'supplier_name',
          label: 'Supplier',
          sortable: true,
          render: (row) => `
            <div>
              <div style="font-weight: 600; color: var(--color-text);">${row.supplier_name}</div>
              <div style="font-size: var(--font-size-xs); color: var(--color-text-muted);">${row.supplier_contact || ''}</div>
            </div>
          `
        },
        {
          key: 'order_date',
          label: 'Order Date',
          sortable: true
        },
        {
          key: 'expected_date',
          label: 'Expected Delivery',
          sortable: true,
          render: (row) => `
            <div>
              <span style="${row.is_delayed ? 'color: var(--color-warning); font-weight: 600;' : ''}">${row.expected_date || 'N/A'}</span>
            </div>
          `
        },
        {
          key: 'item_count',
          label: 'Items & Qty',
          render: (row) => `<span style="font-size: var(--font-size-xs);">${row.item_count} items (${row.total_quantity} units)</span>`
        },
        {
          key: 'status',
          label: 'Order Status',
          sortable: true,
          render: (row) => UI.renderOrderStatusBadge(row)
        },
        {
          key: 'actions',
          label: 'Actions',
          render: (row) => {
            const today = new Date().toISOString().split('T')[0];
            const isFuture = (row.is_future_dispatch === true) || (row.status === 'DISPATCHED' && row.dispatch_date && row.dispatch_date > today);
            return `
            <div style="display: flex; gap: 0.375rem; flex-wrap: wrap;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="viewOrderDetails(${row.order_id})">
                Details
              </button>
              ${row.is_delayed && row.status === 'ORDERED' ? `
                <button type="button" class="btn btn-danger btn-sm" title="Cancel this delayed order and create a replacement order" onclick="cancelAndReorder(${row.order_id})">
                  Cancel & Reorder
                </button>
              ` : row.status === 'ORDERED' ? `
                <button type="button" class="btn btn-danger btn-sm" onclick="cancelOrder(${row.order_id})">
                  Cancel
                </button>
              ` : ''}
              ${row.is_delayed ? `
                <button type="button" class="btn btn-secondary btn-sm" title="Repeat this order" onclick="reorderItems(${row.order_id})">
                  Repeat Order
                </button>
              ` : ''}
              ${row.status === 'DISPATCHED' && isFuture ? `
                <span style="font-size: var(--font-size-xs); color: var(--color-info); font-weight: 500; align-self: center; padding: 0.2rem 0.4rem; background: var(--color-info-bg); border-radius: var(--radius-sm);">
                  Dispatch: ${row.dispatch_date}
                </span>
              ` : (row.status === 'ORDERED' || row.status === 'DISPATCHED') ? `
                <button type="button" class="btn btn-primary btn-sm" onclick="receiveOrder(${row.order_id})">
                  Receive Stock
                </button>
              ` : ''}
            </div>
          `;
          }
        }
      ],
      filters: [
        {
          id: 'status',
          label: 'Filter Status',
          options: [
            { value: 'ORDERED', label: 'Ordered (Pending)' },
            { value: 'DISPATCHED', label: 'Dispatched (In-Transit)' },
            { value: 'RECEIVED', label: 'Received (Stocked)' },
            { value: 'CANCELLED', label: 'Cancelled' }
          ],
          match: (row, val) => row.status === val
        },
        {
          id: 'supplier',
          label: 'Filter Supplier',
          options: suppliers.map(s => ({ value: String(s.supplier_id), label: s.name })),
          match: (row, val) => String(row.supplier_id) === val
        }
      ],
      emptyMessage: 'No purchase orders found.'
    });
  } catch (err) {
    container.innerHTML = `<div class="card" style="color: var(--color-danger);">Failed to load purchase orders: ${err.message}</div>`;
  }
}

// Modal: Create Purchase Order (with dynamic items builder & summary step)
window.openCreateOrderModal = async function(prefillData = null) {
  const modal = document.getElementById('app-modal-wrapper');
  modal.innerHTML = `
    <div class="modal-card" style="max-width: 680px;">
      <div class="modal-header">
        <h3 class="modal-title">${prefillData ? 'Create Repeat / Replacement Order' : 'Create Purchase Order'}</h3>
        <button type="button" class="btn-icon" id="modal-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body" id="po-form-body">
        <div class="skeleton" style="height: 80px; margin-bottom: 1rem;"></div>
        <div class="skeleton" style="height: 180px;"></div>
      </div>
    </div>
  `;
  modal.classList.add('open');

  const close = () => modal.classList.remove('open');
  modal.querySelector('#modal-close').onclick = close;

  try {
    const [suppliersRes, suppliesRes] = await Promise.all([
      API.get('/api/suppliers?active_only=true'),
      API.get('/api/supplies')
    ]);

    const activeSuppliers = suppliersRes.suppliers || [];
    const availableSupplies = (suppliesRes.supplies || []).filter(s => s.status !== 'DISPOSED');

    if (activeSuppliers.length === 0) {
      document.getElementById('po-form-body').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">No Active Suppliers</div>
          <div class="empty-state-desc">You must have at least one active supplier before creating a purchase order.</div>
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('app-modal-wrapper').classList.remove('open'); window.location.hash = '#manage-suppliers';">Go to Suppliers</button>
        </div>
      `;
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const defaultSupplierId = prefillData && prefillData.supplier_id ? String(prefillData.supplier_id) : '';
    const defaultExpectedDate = prefillData && prefillData.expected_date ? prefillData.expected_date : '';
    const defaultNotes = prefillData && prefillData.notes ? prefillData.notes : '';

    // Render Order Creation Form
    document.getElementById('po-form-body').innerHTML = `
      <form id="create-order-form">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Select Supplier <span class="required">*</span></label>
            <select id="po-supplier-select" class="form-select" required>
              <option value="">-- Choose Active Supplier --</option>
              ${activeSuppliers.map(s => `<option value="${s.supplier_id}" ${s.supplier_id == defaultSupplierId ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Expected Delivery Date <span class="required">*</span></label>
            <input type="date" id="po-expected-date" class="form-input" min="${todayStr}" value="${defaultExpectedDate}" required>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Procurement Notes / Instructions</label>
          <input type="text" id="po-notes" class="form-input" value="${defaultNotes}" placeholder="e.g. Expedited ward replenishment, Deliver to Main Pharmacy Loading Dock">
        </div>

        <div style="border-top: 1px solid var(--color-border); padding-top: 1rem; margin-top: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <label class="form-label" style="margin-bottom: 0;">Order Items <span class="required">*</span></label>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-add-item-row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Item
            </button>
          </div>

          <div id="order-items-container" style="display: flex; flex-direction: column; gap: 0.625rem;"></div>
          <div id="po-items-error" style="color: var(--color-danger); font-size: var(--font-size-sm); margin-top: 0.5rem; display: none;"></div>
        </div>

        <div class="modal-footer" style="margin-top: 1.5rem; padding: 1rem 0 0 0; background: none; border-top: 1px solid var(--color-border);">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('app-modal-wrapper').classList.remove('open')">Cancel</button>
          <button type="button" class="btn btn-primary" id="btn-review-order">Review Order Summary</button>
        </div>
      </form>
    `;

    const itemsContainer = document.getElementById('order-items-container');

    const addItemRow = (supplyId = '', quantity = 10) => {
      const rowId = `item-row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const rowDiv = document.createElement('div');
      rowDiv.className = 'order-item-row';
      rowDiv.id = rowId;
      rowDiv.style = 'display: grid; grid-template-columns: 1fr 120px 40px; gap: 0.5rem; align-items: center;';
      rowDiv.innerHTML = `
        <select class="form-select item-supply-select" required>
          <option value="">-- Select Medical Supply --</option>
          ${availableSupplies.map(item => `
            <option value="${item.supply_id}" ${item.supply_id == supplyId ? 'selected' : ''}>
              ${item.name} (${item.category} - Batch: ${item.batch_no} | Current: ${item.quantity} ${item.unit})
            </option>
          `).join('')}
        </select>
        <input type="number" class="form-input item-qty-input" min="1" step="1" value="${quantity}" placeholder="Qty" required>
        <button type="button" class="btn-icon" title="Remove item" onclick="document.getElementById('${rowId}').remove()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;
      itemsContainer.appendChild(rowDiv);
    };

    // Pre-populate items or add first blank row
    if (prefillData && Array.isArray(prefillData.items) && prefillData.items.length > 0) {
      prefillData.items.forEach(it => addItemRow(it.supply_id, it.quantity));
    } else {
      addItemRow();
    }

    document.getElementById('btn-add-item-row').onclick = () => addItemRow();

    // Review Summary Action
    document.getElementById('btn-review-order').onclick = () => {
      const errDiv = document.getElementById('po-items-error');
      errDiv.style.display = 'none';

      const supplierId = document.getElementById('po-supplier-select').value;
      const expectedDate = document.getElementById('po-expected-date').value;
      const notes = document.getElementById('po-notes').value.trim();

      if (!supplierId) {
        errDiv.innerText = 'Please select an active supplier.';
        errDiv.style.display = 'block';
        return;
      }

      if (!expectedDate) {
        errDiv.innerText = 'Please specify an expected delivery date.';
        errDiv.style.display = 'block';
        return;
      }

      if (expectedDate < todayStr) {
        errDiv.innerText = 'Expected delivery date cannot be in the past.';
        errDiv.style.display = 'block';
        return;
      }

      const rows = itemsContainer.querySelectorAll('.order-item-row');
      if (rows.length === 0) {
        errDiv.innerText = 'At least one medical supply item must be added.';
        errDiv.style.display = 'block';
        return;
      }

      const selectedItems = [];
      const seenSupplyIds = new Set();

      for (const r of rows) {
        const sSelect = r.querySelector('.item-supply-select');
        const qInput = r.querySelector('.item-qty-input');
        const sId = parseInt(sSelect.value, 10);
        const qty = parseInt(qInput.value, 10);

        if (!sId) {
          errDiv.innerText = 'Please choose a valid medical supply for all rows.';
          errDiv.style.display = 'block';
          return;
        }

        if (seenSupplyIds.has(sId)) {
          errDiv.innerText = 'Duplicate items detected. Please consolidate quantities into a single row.';
          errDiv.style.display = 'block';
          return;
        }
        seenSupplyIds.add(sId);

        if (isNaN(qty) || qty <= 0) {
          errDiv.innerText = 'All quantities must be positive whole numbers.';
          errDiv.style.display = 'block';
          return;
        }

        const matchSupply = availableSupplies.find(s => s.supply_id === sId);
        selectedItems.push({
          supply_id: sId,
          name: matchSupply ? matchSupply.name : `Supply #${sId}`,
          unit: matchSupply ? matchSupply.unit : 'Units',
          quantity: qty
        });
      }

      const chosenSupplier = activeSuppliers.find(s => s.supplier_id == supplierId);
      const totalUnits = selectedItems.reduce((acc, it) => acc + it.quantity, 0);

      // Render Order Summary Step
      document.getElementById('po-form-body').innerHTML = `
        <div style="background: var(--color-bg); padding: 1rem; border-radius: var(--radius); border: 1px solid var(--color-border); margin-bottom: 1.25rem;">
          <h4 style="font-size: var(--font-size-base); font-weight: 700; margin-bottom: 0.5rem; color: var(--color-primary);">Purchase Order Summary Preview</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; font-size: var(--font-size-sm);">
            <div><strong style="color: var(--color-text-muted);">Supplier:</strong> ${chosenSupplier ? chosenSupplier.name : 'Unknown'}</div>
            <div><strong style="color: var(--color-text-muted);">Expected Date:</strong> ${expectedDate}</div>
            <div><strong style="color: var(--color-text-muted);">Total Items:</strong> ${selectedItems.length} (${totalUnits} total units)</div>
            <div><strong style="color: var(--color-text-muted);">Initial Status:</strong> <span class="badge badge-pending"><span class="badge-dot"></span>ORDERED</span></div>
          </div>
          ${notes ? `<div style="font-size: var(--font-size-sm); margin-top: 0.5rem;"><strong style="color: var(--color-text-muted);">Notes:</strong> ${notes}</div>` : ''}
        </div>

        <div class="table-container" style="margin-bottom: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Medical Supply Item</th>
                <th>Packaging Unit</th>
                <th>Ordered Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${selectedItems.map(it => `
                <tr>
                  <td style="font-weight: 600;">${it.name}</td>
                  <td>${it.unit}</td>
                  <td style="font-weight: 700; color: var(--color-primary);">${it.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div id="submit-order-error" style="color: var(--color-danger); font-size: var(--font-size-sm); margin-bottom: 0.75rem; display: none;"></div>

        <div class="modal-footer" style="padding: 1rem 0 0 0; background: none; border-top: 1px solid var(--color-border);">
          <button type="button" class="btn btn-secondary" onclick="openCreateOrderModal({ supplier_id: '${supplierId}', expected_date: '${expectedDate}', notes: '${notes.replace(/'/g, "\\'")}', items: ${JSON.stringify(selectedItems).replace(/"/g, '&quot;')} })">Back to Edit</button>
          <button type="button" class="btn btn-primary" id="btn-confirm-submit-po">Confirm & Submit Purchase Order</button>
        </div>
      `;

      document.getElementById('btn-confirm-submit-po').onclick = async () => {
        const submitErr = document.getElementById('submit-order-error');
        submitErr.style.display = 'none';

        try {
          const payload = {
            supplier_id: parseInt(supplierId, 10),
            expected_date: expectedDate,
            notes: notes || null,
            items: selectedItems.map(it => ({ supply_id: it.supply_id, quantity: it.quantity }))
          };

          const res = await API.post('/api/orders', payload);
          UI.toast(res.message || 'Purchase order submitted successfully!', 'success');
          close();
          handleRoute();
        } catch (err) {
          submitErr.innerText = err.message;
          submitErr.style.display = 'block';
        }
      };
    };
  } catch (err) {
    document.getElementById('po-form-body').innerHTML = `<div style="color: var(--color-danger);">Failed to initialize order form: ${err.message}</div>`;
  }
};

// Modal: Order Details & Delivery Tracking (with Timeline)
window.viewOrderDetails = async function(orderId) {
  const modal = document.getElementById('app-modal-wrapper');
  modal.innerHTML = `
    <div class="modal-card" style="max-width: 760px;">
      <div class="modal-header">
        <h3 class="modal-title">Purchase Order #PO-${orderId} Details</h3>
        <button type="button" class="btn-icon" id="modal-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body" id="po-details-body">
        <div class="skeleton" style="height: 120px; margin-bottom: 1rem;"></div>
        <div class="skeleton" style="height: 200px;"></div>
      </div>
      <div class="modal-footer" id="po-details-footer">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Close</button>
      </div>
    </div>
  `;
  modal.classList.add('open');

  const close = () => modal.classList.remove('open');
  modal.querySelector('#modal-close').onclick = close;
  modal.querySelector('#modal-cancel').onclick = close;

  try {
    const data = await API.get(`/api/orders/${orderId}`);
    const order = data.order;
    const items = data.items || [];

    // Timeline step statuses
    const today = new Date().toISOString().split('T')[0];
    const isFutureDispatch = (order.is_future_dispatch === true) || (order.status === 'DISPATCHED' && order.dispatch_date && order.dispatch_date > today);
    const isOrdered = true;
    const isDispatched = (order.status === 'DISPATCHED' && !isFutureDispatch) || order.status === 'RECEIVED';
    const isReceived = order.status === 'RECEIVED';
    const isCancelled = order.status === 'CANCELLED';

    const body = document.getElementById('po-details-body');
    const footer = document.getElementById('po-details-footer');

    body.innerHTML = `
      ${order.is_delayed ? `
        <div style="background: var(--color-warning-bg); border: 1px solid var(--color-warning); border-radius: var(--radius); padding: 0.875rem 1rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <div>
              <div style="font-weight: 700; color: #78350F; font-size: var(--font-size-sm);">Delivery Delayed</div>
              <div style="font-size: var(--font-size-xs); color: #92400E;">This order passed its expected delivery date (${order.expected_date}) and has not yet arrived at the hospital store.</div>
            </div>
          </div>
          ${(currentUser.role === 'Procurement Officer' || currentUser.role === 'Hospital Administrator') ? `
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              ${order.status === 'ORDERED' ? `
                <button type="button" class="btn btn-danger btn-sm" onclick="cancelAndReorder(${order.order_id})">
                  Cancel & Repeat Order
                </button>
              ` : ''}
              <button type="button" class="btn btn-secondary btn-sm" onclick="reorderItems(${order.order_id})">
                Repeat / Reorder
              </button>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- Status Timeline -->
      <div class="timeline">
        <div class="timeline-step ${isCancelled ? 'cancelled' : isOrdered ? (isDispatched ? 'completed' : isFutureDispatch ? 'completed' : 'active') : ''}">
          <div class="timeline-icon">1</div>
          <div class="timeline-title">Ordered</div>
          <div class="timeline-date">${order.order_date}</div>
        </div>

        <div class="timeline-step ${isCancelled ? '' : isReceived ? 'completed' : isDispatched ? 'completed' : isFutureDispatch ? 'active' : ''}">
          <div class="timeline-icon">2</div>
          <div class="timeline-title">${isFutureDispatch ? 'Dispatch Scheduled' : 'Dispatched'}</div>
          <div class="timeline-date">${order.dispatch_date || (isCancelled ? '—' : 'Awaiting')}</div>
        </div>

        <div class="timeline-step ${isCancelled ? 'cancelled' : isReceived ? 'completed' : ''}">
          <div class="timeline-icon">3</div>
          <div class="timeline-title">${isCancelled ? 'Cancelled' : 'Received'}</div>
          <div class="timeline-date">${order.actual_date || (isCancelled ? 'Cancelled' : 'Awaiting')}</div>
        </div>
      </div>

      <!-- Order Metadata Summary -->
      <div style="background: var(--color-bg); padding: 1rem; border-radius: var(--radius); border: 1px solid var(--color-border); margin: 1.25rem 0;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; font-size: var(--font-size-sm);">
          <div><strong style="color: var(--color-text-muted);">Supplier:</strong> ${order.supplier_name}</div>
          <div><strong style="color: var(--color-text-muted);">Current Status:</strong> ${UI.renderOrderStatusBadge(order)}</div>
          <div><strong style="color: var(--color-text-muted);">Expected Date:</strong> ${order.expected_date || 'N/A'}</div>
          <div><strong style="color: var(--color-text-muted);">Actual Date:</strong> ${order.actual_date || 'Not yet received'}</div>
          <div><strong style="color: var(--color-text-muted);">Created By:</strong> ${order.created_by_name || 'Procurement Office'}</div>
          <div><strong style="color: var(--color-text-muted);">Supplier Contact:</strong> ${order.supplier_contact || order.supplier_email || 'N/A'}</div>
        </div>
        ${order.notes ? `
          <div style="font-size: var(--font-size-sm); margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--color-border);">
            <strong style="color: var(--color-text-muted);">Delivery Tracking / Notes:</strong> ${order.notes}
          </div>
        ` : ''}
      </div>

      <!-- Items List -->
      <h4 style="font-size: var(--font-size-sm); font-weight: 600; margin-bottom: 0.75rem;">Order Line Items (${items.length})</h4>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Medical Supply</th>
              <th>Category</th>
              <th>Batch No</th>
              <th>Unit</th>
              <th>Ordered Qty</th>
              <th>Store Stock</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => `
              <tr>
                <td style="font-weight: 600;">${it.name}</td>
                <td>${it.category}</td>
                <td><code>${it.batch_no}</code></td>
                <td>${it.unit}</td>
                <td style="font-weight: 700; color: var(--color-primary);">${it.quantity}</td>
                <td>${it.current_stock}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Dynamic Footer Action Buttons
    let actionsHtml = '<button type="button" class="btn btn-secondary" onclick="document.getElementById(\'app-modal-wrapper\').classList.remove(\'open\')">Close</button>';

    if (currentUser.role === 'Procurement Officer' || currentUser.role === 'Hospital Administrator') {
      if (order.status === 'ORDERED') {
        actionsHtml += `
          <button type="button" class="btn btn-danger" onclick="cancelOrder(${order.order_id})">Cancel Order</button>
        `;
      }
      if (order.status === 'DISPATCHED' && isFutureDispatch) {
        actionsHtml += `
          <span style="font-size: var(--font-size-sm); color: var(--color-info); align-self: center; margin-right: 0.5rem; font-weight: 500;">
            Awaiting dispatch on ${order.dispatch_date}
          </span>
        `;
      } else if (order.status === 'ORDERED' || order.status === 'DISPATCHED') {
        actionsHtml += `
          <button type="button" class="btn btn-primary" onclick="receiveOrder(${order.order_id})">Mark as Received & Stock Store</button>
        `;
      }
      actionsHtml += `
        <button type="button" class="btn btn-secondary" onclick="reorderItems(${order.order_id})">Repeat / Reorder</button>
      `;
    } else if (currentUser.role === 'Supplier / Vendor' && order.status === 'ORDERED') {
      actionsHtml += `
        <button type="button" class="btn btn-primary" onclick="openDispatchModal(${order.order_id}, '${order.expected_date || ''}')">Dispatch Shipment</button>
      `;
    }

    footer.innerHTML = actionsHtml;
  } catch (err) {
    document.getElementById('po-details-body').innerHTML = `<div style="color: var(--color-danger);">Failed to load order details: ${err.message}</div>`;
  }
};

// Reorder / Repeat items from an existing purchase order
window.reorderItems = async function(orderId) {
  try {
    const data = await API.get(`/api/orders/${orderId}`);
    const order = data.order;
    const items = data.items || [];

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 7);
    const expStr = nextDate.toISOString().split('T')[0];

    const prefill = {
      supplier_id: order.supplier_id,
      expected_date: expStr,
      notes: `Reorder of #PO-${orderId} (delayed delivery replacement)`,
      items: items.map(it => ({ supply_id: it.supply_id, quantity: it.quantity }))
    };

    UI.toast(`Pre-filling new order with items from #PO-${orderId}...`, 'info');
    openCreateOrderModal(prefill);
  } catch (err) {
    UI.toast(err.message, 'danger');
  }
};

// Cancel delayed order and immediately open replacement order
window.cancelAndReorder = function(orderId) {
  UI.confirm({
    title: 'Cancel Delayed Order & Reorder',
    message: `Cancel delayed purchase order #PO-${orderId} and immediately open a new replacement purchase order pre-filled with the same items?`,
    confirmText: 'Cancel & Reorder',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      try {
        const data = await API.get(`/api/orders/${orderId}`);
        const order = data.order;
        const items = data.items || [];

        const cancelRes = await API.patch(`/api/orders/${orderId}/cancel`);
        UI.toast(cancelRes.message, 'warning');

        const modal = document.getElementById('app-modal-wrapper');
        modal.classList.remove('open');

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 7);
        const expStr = nextDate.toISOString().split('T')[0];

        const prefill = {
          supplier_id: order.supplier_id,
          expected_date: expStr,
          notes: `Replacement order for cancelled delayed order #PO-${orderId}`,
          items: items.map(it => ({ supply_id: it.supply_id, quantity: it.quantity }))
        };

        setTimeout(() => {
          openCreateOrderModal(prefill);
        }, 150);
      } catch (err) {
        UI.toast(err.message, 'danger');
      }
    }
  });
};

// Cancel Order
window.cancelOrder = function(orderId) {
  UI.confirm({
    title: 'Cancel Purchase Order',
    message: `Are you sure you want to cancel purchase order #PO-${orderId}? Only orders in 'ORDERED' state can be cancelled. Once cancelled, it cannot be received.`,
    confirmText: 'Cancel Order',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      try {
        const res = await API.patch(`/api/orders/${orderId}/cancel`);
        UI.toast(res.message, 'success');
        document.getElementById('app-modal-wrapper').classList.remove('open');
        handleRoute();
      } catch (err) {
        UI.toast(err.message, 'danger');
      }
    }
  });
};

// Receive Order & Update Stock
window.receiveOrder = function(orderId) {
  UI.confirm({
    title: 'Receive Stock & Complete Order',
    message: `Confirm physical delivery of purchase order #PO-${orderId}? Marking this order as RECEIVED will record the arrival date as today and increment the quantity of each medical supply in the central medical store inventory in a database transaction. Proceed?`,
    confirmText: 'Confirm & Receive Stock',
    confirmClass: 'btn-primary',
    onConfirm: async () => {
      try {
        const res = await API.post(`/api/orders/${orderId}/receive`);
        UI.toast(res.message, 'success');
        document.getElementById('app-modal-wrapper').classList.remove('open');
        handleRoute();
      } catch (err) {
        UI.toast(err.message, 'danger');
      }
    }
  });
};

/* ==========================================================================
   INCREMENT 2: VIEW - SUPPLIER / VENDOR PORTAL
   ========================================================================== */
async function renderVendorOrders(container) {
  container.innerHTML = '<div class="skeleton" style="height: 120px; margin-bottom: 1.5rem;"></div><div class="skeleton" style="height: 360px;"></div>';

  try {
    const data = await API.get('/api/orders');
    const orders = data.orders || [];

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <h2 style="font-size: var(--font-size-lg); font-weight: 700; margin-bottom: 0.25rem;">Vendor Purchase Orders</h2>
          <p style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
            View purchase orders placed by the hospital procurement office and dispatch shipments.
          </p>
        </div>
      </div>

      <div class="card" id="vendor-po-table-card"></div>
    `;

    UI.createTable({
      container: document.getElementById('vendor-po-table-card'),
      data: orders,
      searchFields: ['order_id', 'notes', 'status'],
      columns: [
        {
          key: 'order_id',
          label: 'Order ID',
          sortable: true,
          render: (row) => `
            <div>
              <span style="font-weight: 700; color: var(--color-primary);">#PO-${row.order_id}</span>
              ${row.is_delayed ? '<span class="badge badge-low-stock" style="margin-left: 0.375rem;"><span class="badge-dot"></span>Delayed</span>' : ''}
            </div>
          `
        },
        {
          key: 'order_date',
          label: 'Order Date',
          sortable: true
        },
        {
          key: 'expected_date',
          label: 'Expected Delivery',
          sortable: true,
          render: (row) => `<span style="${row.is_delayed ? 'color: var(--color-warning); font-weight: 600;' : ''}">${row.expected_date || 'N/A'}</span>`
        },
        {
          key: 'dispatch_date',
          label: 'Dispatch Date',
          render: (row) => row.dispatch_date || 'Not dispatched'
        },
        {
          key: 'item_count',
          label: 'Items & Qty',
          render: (row) => `${row.item_count} items (${row.total_quantity} units)`
        },
        {
          key: 'status',
          label: 'Status',
          sortable: true,
          render: (row) => UI.renderOrderStatusBadge(row)
        },
        {
          key: 'actions',
          label: 'Actions',
          render: (row) => `
            <div style="display: flex; gap: 0.375rem; flex-wrap: wrap;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="viewOrderDetails(${row.order_id})">
                View Details
              </button>
              ${row.status === 'ORDERED' ? `
                <button type="button" class="btn btn-primary btn-sm" onclick="openDispatchModal(${row.order_id}, '${row.expected_date || ''}')">
                  Dispatch Shipment
                </button>
              ` : ''}
            </div>
          `
        }
      ],
      filters: [
        {
          id: 'status',
          label: 'Filter Status',
          options: [
            { value: 'ORDERED', label: 'Awaiting Dispatch Only' },
            { value: 'DISPATCHED', label: 'Dispatched Only' },
            { value: 'RECEIVED', label: 'Received / Delivered Only' }
          ],
          match: (row, val) => row.status === val
        }
      ],
      emptyMessage: 'No orders assigned to your supplier account.'
    });
  } catch (err) {
    container.innerHTML = `<div class="card" style="color: var(--color-danger);">Failed to load vendor orders: ${err.message}</div>`;
  }
}

// Vendor Deliveries Tracking View
async function renderVendorDeliveries(container) {
  container.innerHTML = '<div class="skeleton" style="height: 120px; margin-bottom: 1.5rem;"></div><div class="skeleton" style="height: 360px;"></div>';

  try {
    const data = await API.get('/api/orders');
    const orders = (data.orders || []).filter(o => o.status === 'DISPATCHED' || o.status === 'RECEIVED');

    container.innerHTML = `
      <div style="margin-bottom: 1.25rem;">
        <h2 style="font-size: var(--font-size-lg); font-weight: 700; margin-bottom: 0.25rem;">Delivery Tracking & Fulfillment</h2>
        <p style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
          Monitor shipments in transit and track delivery records for your facility.
        </p>
      </div>

      <div class="card" id="vendor-deliveries-card"></div>
    `;

    UI.createTable({
      container: document.getElementById('vendor-deliveries-card'),
      data: orders,
      searchFields: ['order_id', 'notes', 'status'],
      columns: [
        {
          key: 'order_id',
          label: 'Order ID',
          sortable: true,
          render: (row) => `
            <div>
              <span style="font-weight: 700; color: var(--color-primary);">#PO-${row.order_id}</span>
              ${row.is_delayed ? '<span class="badge badge-low-stock" style="margin-left: 0.375rem;"><span class="badge-dot"></span>Delayed</span>' : ''}
            </div>
          `
        },
        {
          key: 'dispatch_date',
          label: 'Dispatched On',
          sortable: true,
          render: (row) => row.dispatch_date || 'N/A'
        },
        {
          key: 'expected_date',
          label: 'Estimated Arrival',
          sortable: true
        },
        {
          key: 'actual_date',
          label: 'Received On',
          render: (row) => row.actual_date ? `<span style="color: var(--color-success); font-weight: 600;">${row.actual_date}</span>` : 'In transit'
        },
        {
          key: 'notes',
          label: 'Logistics Notes',
          render: (row) => row.notes || 'Standard shipping'
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => UI.renderOrderStatusBadge(row)
        },
        {
          key: 'actions',
          label: 'Actions',
          render: (row) => `
            <button type="button" class="btn btn-secondary btn-sm" onclick="viewOrderDetails(${row.order_id})">
              Tracking Details
            </button>
          `
        }
      ],
      emptyMessage: 'No active shipments found in delivery tracking.'
    });
  } catch (err) {
    container.innerHTML = `<div class="card" style="color: var(--color-danger);">Failed to load deliveries: ${err.message}</div>`;
  }
}

// Modal: Enter Delivery Information & Dispatch
window.openDispatchModal = function(orderId, currentExpectedDate) {
  const modal = document.getElementById('app-modal-wrapper');
  const todayStr = new Date().toISOString().split('T')[0];

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 500px;">
      <div class="modal-header">
        <h3 class="modal-title">Dispatch Order #PO-${orderId}</h3>
        <button type="button" class="btn-icon" id="modal-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <form id="dispatch-form">
        <div class="modal-body">
          <p style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: 1rem;">
            Update this purchase order to <strong>DISPATCHED</strong> and enter shipment tracking information for the hospital store.
          </p>

          <div class="form-group">
            <label class="form-label">Dispatch Date <span class="required">*</span></label>
            <input type="date" id="disp-date" class="form-input" value="${todayStr}" required>
          </div>

          <div class="form-group">
            <label class="form-label">Expected Arrival Date</label>
            <input type="date" id="disp-expected-date" class="form-input" value="${currentExpectedDate || ''}">
          </div>

          <div class="form-group">
            <label class="form-label">Logistics Tracking Note</label>
            <textarea id="disp-notes" class="form-textarea" rows="2" placeholder="e.g. Courier: MediFreight Express, Tracking #MF-77192, Est. 3 days transit."></textarea>
          </div>

          <div id="disp-error" style="color: var(--color-danger); font-size: var(--font-size-sm); margin-top: 0.5rem; display: none;"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-confirm-dispatch">Confirm Dispatch</button>
        </div>
      </form>
    </div>
  `;

  modal.classList.add('open');

  const close = () => modal.classList.remove('open');
  modal.querySelector('#modal-close').onclick = close;
  modal.querySelector('#modal-cancel').onclick = close;

  const form = document.getElementById('dispatch-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('disp-error');
    errDiv.style.display = 'none';

    const dispatchDate = document.getElementById('disp-date').value;
    const expectedArrival = document.getElementById('disp-expected-date').value;
    const notes = document.getElementById('disp-notes').value.trim();

    try {
      const res = await API.patch(`/api/orders/${orderId}/dispatch`, {
        dispatch_date: dispatchDate || todayStr,
        expected_date: expectedArrival || undefined,
        notes: notes || undefined
      });
      UI.toast(res.message || 'Order dispatched successfully!', 'success');
      close();
      handleRoute();
    } catch (err) {
      errDiv.innerText = err.message;
      errDiv.style.display = 'block';
    }
  };
};



/* ==========================================================================
   INCREMENT 3: ALERT BELL
   ========================================================================== */
async function updateAlertBell() {
  const bell = document.getElementById('alert-bell');
  const badge = document.getElementById('alert-badge');
  if (!bell || !badge) return;

  const role = currentUser.role;
  const hasAlerts = ['Hospital Administrator', 'Inventory Manager', 'Procurement Officer'].includes(role);
  if (!hasAlerts) {
    bell.style.display = 'none';
    return;
  }
  bell.style.display = 'flex';

  try {
    const data = await API.get('/api/alerts/count');
    const count = data.count || 0;
    if (count > 0) {
      badge.style.display = '';
      badge.textContent = count > 99 ? '99+' : count;
    } else {
      badge.style.display = 'none';
    }
  } catch (e) {
    badge.style.display = 'none';
  }
}

/* ==========================================================================
   VIEW: EXPIRY MONITORING (Inventory Manager)
   ========================================================================== */
async function renderExpiryMonitoring(container) {
  container.innerHTML = '<div class="skeleton" style="height:400px;"></div>';

  try {
    const data = await API.get('/api/supplies/expiry');
    const nearExpiry = data.near_expiry || [];
    const expired = data.expired || [];
    const nearExpiryDays = data.near_expiry_days || 30;

    let activeTab = 'near';

    function render() {
      const items = activeTab === 'near' ? nearExpiry : expired;
      const isNearTab = activeTab === 'near';

      container.innerHTML = `
        <div class="card" style="margin-bottom:1.25rem;">
          <p style="font-size:var(--font-size-sm); color:var(--color-text-muted); margin-bottom:0.75rem;">
            Expiry monitoring uses the system setting <strong>near_expiry_days = ${nearExpiryDays}</strong>.
            Supplies past their expiry date are automatically marked <span class="badge badge-expired"><span class="badge-dot"></span>Expired</span>.
          </p>
          <div class="tab-bar">
            <button class="tab-btn ${isNearTab ? 'active' : ''}" id="tab-near" type="button">
              Near Expiry (${nearExpiry.length})
            </button>
            <button class="tab-btn ${!isNearTab ? 'active' : ''}" id="tab-expired" type="button">
              Expired (${expired.length})
            </button>
          </div>

          <div id="expiry-table-mount"></div>
        </div>
      `;

      document.getElementById('tab-near').onclick = () => { activeTab = 'near'; render(); };
      document.getElementById('tab-expired').onclick = () => { activeTab = 'expired'; render(); };

      const mount = document.getElementById('expiry-table-mount');
      const daysCol = isNearTab
        ? { key: 'days_remaining', label: 'Days Remaining', sortable: true,
            render: r => `<span style="font-weight:700; color: ${r.days_remaining <= 7 ? 'var(--color-danger)' : 'var(--color-warning)'};">${r.days_remaining} day(s)</span>` }
        : { key: 'days_overdue', label: 'Days Overdue', sortable: true,
            render: r => `<span style="font-weight:700; color:var(--color-danger);">${r.days_overdue} day(s)</span>` };

      UI.createTable({
        container: mount,
        data: items,
        searchFields: ['name', 'batch_no', 'category'],
        emptyMessage: isNearTab
          ? 'No supplies approaching expiry within the threshold period.'
          : 'No expired supplies with remaining stock found.',
        columns: [
          { key: 'name', label: 'Supply Name', sortable: true, render: r => `<strong>${r.name}</strong>` },
          { key: 'batch_no', label: 'Batch No.', sortable: true },
          { key: 'category', label: 'Category', sortable: true },
          { key: 'quantity', label: 'Quantity', sortable: true, render: r => `${r.quantity} ${r.unit}` },
          { key: 'expiry_date', label: 'Expiry Date', sortable: true,
            render: r => `<span style="color:${isNearTab ? 'var(--color-warning)' : 'var(--color-danger)'}; font-weight:600;">${r.expiry_date}</span>` },
          daysCol,
          { key: 'status', label: 'Status', render: r => UI.renderBadge(r.status) },
          { key: 'actions', label: 'Actions', render: r => {
            if (r.quantity > 0) {
              return `<button class="btn btn-danger btn-sm" onclick="openDisposeModal(${r.supply_id}, '${r.name.replace(/'/g, "\\'")}', '${r.batch_no}', ${r.quantity}, '${r.unit}')">Dispose</button>`;
            }
            return '<span style="color:var(--color-text-muted); font-size:var(--font-size-xs);">No stock</span>';
          }}
        ]
      });
    }

    render();
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--color-danger);">Failed to load expiry data: ${err.message}</div>`;
  }
}

/* ==========================================================================
   VIEW: DISPOSAL MANAGEMENT (Inventory Manager)
   ========================================================================== */
async function renderDisposalManagement(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
      <p style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
        Record and track disposal of expired, damaged, or unusable medical supplies. Disposing reduces stock and updates supply status.
      </p>
      <button type="button" class="btn btn-primary" id="btn-new-disposal">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Record Disposal
      </button>
    </div>
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Disposal History</h3>
      </div>
      <div style="display:flex; gap:0.75rem; margin-bottom:1rem; flex-wrap:wrap;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" for="disp-filter-start">From Date</label>
          <input type="date" id="disp-filter-start" class="form-input" style="width:auto;">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" for="disp-filter-end">To Date</label>
          <input type="date" id="disp-filter-end" class="form-input" style="width:auto;">
        </div>
        <div style="display:flex; align-items:flex-end;">
          <button type="button" class="btn btn-secondary btn-sm" id="disp-filter-apply">Apply Filter</button>
        </div>
      </div>
      <div id="disposal-table-mount"></div>
    </div>
  `;

  document.getElementById('btn-new-disposal').onclick = () => showNewDisposalPicker();
  document.getElementById('disp-filter-apply').onclick = () => loadDisposalTable();
  loadDisposalTable();
}

async function loadDisposalTable() {
  const mount = document.getElementById('disposal-table-mount');
  if (!mount) return;
  mount.innerHTML = '<div class="skeleton" style="height:300px;"></div>';

  try {
    const startDate = document.getElementById('disp-filter-start')?.value || '';
    const endDate = document.getElementById('disp-filter-end')?.value || '';
    let url = '/api/disposals?';
    if (startDate) url += `start_date=${startDate}&`;
    if (endDate) url += `end_date=${endDate}&`;

    const data = await API.get(url);
    const disposals = data.disposals || [];

    UI.createTable({
      container: mount,
      data: disposals,
      searchFields: ['supply_name', 'batch_no', 'reason', 'recorded_by_name'],
      emptyMessage: 'No disposal records found for the selected period.',
      columns: [
        { key: 'disposal_id', label: 'ID', sortable: true },
        { key: 'supply_name', label: 'Supply', sortable: true,
          render: d => `<strong>${d.supply_name}</strong><br><span style="font-size:0.75rem; color:var(--color-text-muted);">Batch: ${d.batch_no}</span>` },
        { key: 'quantity', label: 'Qty Disposed', sortable: true, render: d => `${d.quantity} ${d.unit}` },
        { key: 'disposal_date', label: 'Date', sortable: true },
        { key: 'reason', label: 'Reason', render: d => `<span style="font-size:var(--font-size-sm);">${d.reason}</span>` },
        { key: 'recorded_by_name', label: 'Recorded By', sortable: true },
        { key: 'remaining_quantity', label: 'Remaining Stock', render: d => `${d.remaining_quantity} ${d.unit}` },
        { key: 'current_supply_status', label: 'Supply Status', render: d => UI.renderBadge(d.current_supply_status) }
      ]
    });
  } catch (err) {
    mount.innerHTML = `<div style="color:var(--color-danger);">Failed to load disposal records: ${err.message}</div>`;
  }
}

async function showNewDisposalPicker() {
  // Load supplies that can be disposed (EXPIRED or AVAILABLE with stock)
  try {
    const data = await API.get('/api/supplies?sort_by=name&sort_order=ASC');
    const eligible = (data.supplies || []).filter(s => s.quantity > 0 && s.status !== 'DISPOSED');

    if (eligible.length === 0) {
      return UI.toast('No supplies with available stock to dispose.', 'warning');
    }

    const modal = document.getElementById('app-modal-wrapper');
    modal.innerHTML = `
      <div class="modal-card" style="max-width:480px;">
        <div class="modal-header">
          <h3 class="modal-title">Select Supply to Dispose</h3>
          <button type="button" class="btn-icon" id="modal-close" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="disp-supply-select">Medical Supply</label>
            <select id="disp-supply-select" class="form-input">
              <option value="">-- Select a supply --</option>
              ${eligible.map(s => `<option value="${s.supply_id}" data-name="${s.name}" data-batch="${s.batch_no}" data-qty="${s.quantity}" data-unit="${s.unit}">${s.name} (Batch: ${s.batch_no}) — ${s.quantity} ${s.unit} — ${UI.renderBadge(s.status).replace(/<[^>]*>/g, '')}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
          <button type="button" class="btn btn-danger" id="btn-proceed-dispose">Proceed to Dispose</button>
        </div>
      </div>
    `;
    modal.classList.add('open');
    const close = () => modal.classList.remove('open');
    modal.querySelector('#modal-close').onclick = close;
    modal.querySelector('#modal-cancel').onclick = close;
    modal.querySelector('#btn-proceed-dispose').onclick = () => {
      const sel = document.getElementById('disp-supply-select');
      const opt = sel.options[sel.selectedIndex];
      if (!sel.value) return UI.toast('Please select a supply.', 'warning');
      close();
      openDisposeModal(
        parseInt(sel.value),
        opt.dataset.name,
        opt.dataset.batch,
        parseInt(opt.dataset.qty),
        opt.dataset.unit
      );
    };
  } catch (err) {
    UI.toast('Failed to load supplies: ' + err.message, 'danger');
  }
}

window.openDisposeModal = function openDisposeModal(supplyId, name, batchNo, maxQty, unit) {
  const modal = document.getElementById('app-modal-wrapper');
  modal.innerHTML = `
    <div class="modal-card" style="max-width:480px;">
      <div class="modal-header">
        <h3 class="modal-title">Dispose Medical Supply</h3>
        <button type="button" class="btn-icon" id="modal-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <form id="dispose-form">
        <div class="modal-body">
          <p style="font-size:var(--font-size-sm); color:var(--color-text-muted); margin-bottom:1rem;">
            <strong>${name}</strong> (Batch: ${batchNo})<br>
            Available stock: <strong>${maxQty} ${unit}</strong>
          </p>
          <div class="form-group">
            <label class="form-label" for="dispose-qty">Quantity to Dispose <span class="required">*</span></label>
            <input type="number" id="dispose-qty" class="form-input" min="1" max="${maxQty}" required placeholder="Max: ${maxQty}">
            <span class="form-hint">Cannot exceed ${maxQty} ${unit}</span>
          </div>
          <div class="form-group">
            <label class="form-label" for="dispose-date">Disposal Date</label>
            <input type="date" id="dispose-date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label class="form-label" for="dispose-reason">Reason for Disposal <span class="required">*</span></label>
            <textarea id="dispose-reason" class="form-textarea" rows="3" required placeholder="e.g. Expired — beyond safe usage date per hospital protocol."></textarea>
          </div>
          <div id="dispose-error" style="color:var(--color-danger); font-size:var(--font-size-sm); margin-top:0.5rem; display:none;"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-danger" id="btn-confirm-dispose">Confirm Disposal</button>
        </div>
      </form>
    </div>
  `;
  modal.classList.add('open');
  const close = () => modal.classList.remove('open');
  modal.querySelector('#modal-close').onclick = close;
  modal.querySelector('#modal-cancel').onclick = close;

  document.getElementById('dispose-form').onsubmit = async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('dispose-error');
    errDiv.style.display = 'none';

    const qty = parseInt(document.getElementById('dispose-qty').value, 10);
    const reason = document.getElementById('dispose-reason').value.trim();
    const date = document.getElementById('dispose-date').value;

    if (!qty || qty <= 0) { errDiv.textContent = 'Quantity must be a positive integer.'; errDiv.style.display = 'block'; return; }
    if (qty > maxQty) { errDiv.textContent = `Cannot exceed available stock of ${maxQty} ${unit}.`; errDiv.style.display = 'block'; return; }
    if (!reason) { errDiv.textContent = 'Reason is required.'; errDiv.style.display = 'block'; return; }

    UI.confirm({
      title: 'Confirm Medical Supply Disposal',
      message: `Are you sure you want to record the disposal of ${qty} ${unit} of "${name}"? This will permanently deduct the quantity from hospital inventory and update its status.`,
      confirmText: 'Confirm Disposal',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        try {
          const res = await API.post('/api/disposals', { supply_id: supplyId, quantity: qty, disposal_date: date, reason });
          UI.toast(res.message || 'Supply disposed successfully.', 'success');
          close();
          updateAlertBell();
          handleRoute(); // refresh current view
        } catch (err) {
          errDiv.textContent = err.message;
          errDiv.style.display = 'block';
        }
      }
    });
  };
}

/* ==========================================================================
   VIEW: ALERTS PAGE
   ========================================================================== */
async function renderAlerts(container) {
  container.innerHTML = '<div class="skeleton" style="height:400px;"></div>';

  try {
    const data = await API.get('/api/alerts');
    const alerts = data.alerts || [];

    if (alerts.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align:center; padding:3rem 1.5rem;">
          <div style="width:56px; height:56px; margin:0 auto 1.25rem; border-radius:50%; background:var(--color-success-bg); color:var(--color-success); display:flex; align-items:center; justify-content:center;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style="font-size:var(--font-size-xl); font-weight:700; margin-bottom:0.5rem;">All Clear</h2>
          <p style="color:var(--color-text-muted); font-size:var(--font-size-sm);">There are no active alerts for your role at this time.</p>
        </div>
      `;
      return;
    }

    // Group alerts by type
    const groups = {};
    const typeOrder = ['EXPIRED', 'DELAYED_DELIVERY', 'LOW_STOCK', 'NEAR_EXPIRY'];
    alerts.forEach(a => {
      if (!groups[a.type]) groups[a.type] = [];
      groups[a.type].push(a);
    });

    const typeLabels = { EXPIRED: 'Expired Supplies', NEAR_EXPIRY: 'Near Expiry', LOW_STOCK: 'Low Stock', DELAYED_DELIVERY: 'Delayed Deliveries' };
    const typeClasses = { EXPIRED: 'alert-expired', NEAR_EXPIRY: 'alert-near-expiry', LOW_STOCK: 'alert-low-stock', DELAYED_DELIVERY: 'alert-delayed' };
    const typeIconClasses = { EXPIRED: 'danger', NEAR_EXPIRY: 'warning', LOW_STOCK: 'warning', DELAYED_DELIVERY: 'warning' };
    const typeColors = { EXPIRED: 'var(--color-danger)', NEAR_EXPIRY: 'var(--color-warning)', LOW_STOCK: 'var(--color-warning)', DELAYED_DELIVERY: 'var(--color-warning)' };

    let html = `<p style="font-size:var(--font-size-sm); color:var(--color-text-muted); margin-bottom:1.25rem;">
      Showing <strong>${alerts.length}</strong> active alert(s) for your role. Alerts resolve automatically when conditions are cleared.
    </p>`;

    typeOrder.forEach(type => {
      const group = groups[type];
      if (!group || group.length === 0) return;

      html += `
        <div style="margin-bottom:1.5rem;">
          <h3 style="font-size:var(--font-size-base); font-weight:700; color:${typeColors[type]}; margin-bottom:0.75rem; display:flex; align-items:center; gap:0.5rem;">
            <span class="badge ${type === 'EXPIRED' ? 'badge-expired' : 'badge-low-stock'}"><span class="badge-dot"></span>${typeLabels[type]}</span>
            <span style="font-weight:400; font-size:var(--font-size-sm); color:var(--color-text-muted);">(${group.length})</span>
          </h3>
          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            ${group.map(a => {
              let linkHtml = '';
              if (a.supply_id) {
                linkHtml = `<a href="#expiry-monitoring" class="btn btn-secondary btn-sm">View Supply</a>`;
              } else if (a.order_id) {
                linkHtml = `<a href="#purchase-orders" class="btn btn-secondary btn-sm">View Order #${a.order_id}</a>`;
              }

              return `
                <div class="alert-card ${typeClasses[type]}">
                  <div class="alert-icon ${typeIconClasses[type]}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      ${type === 'EXPIRED' ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' :
                        type === 'DELAYED_DELIVERY' ? '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' :
                        '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'}
                    </svg>
                  </div>
                  <div class="alert-body">
                    <div class="alert-type-label" style="color:${typeColors[type]};">${typeLabels[type]}</div>
                    <div class="alert-message">${a.message}</div>
                    <div class="alert-meta">Generated: ${a.created_at}</div>
                    ${linkHtml ? `<div class="alert-actions">${linkHtml}</div>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--color-danger);">Failed to load alerts: ${err.message}</div>`;
  }
}

/* ==========================================================================
   VIEW: CROSS-ROLE ACTIVITY MONITOR (Hospital Administrator)
   ========================================================================== */
async function renderCrossRoleActivityMonitor(container) {
  let activeRoleTab = 'staff';

  function renderShell() {
    container.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem;">
        <p style="font-size:var(--font-size-sm); color:var(--color-text-muted); margin-bottom:1rem;">
          Live operational activity and audit history across all 4 supply chain roles. Click on each role tab to inspect records specific to that role.
        </p>
        <div class="tab-bar">
          <button class="tab-btn ${activeRoleTab === 'staff' ? 'active' : ''}" id="tab-act-staff" type="button">
            Hospital Department Staff
          </button>
          <button class="tab-btn ${activeRoleTab === 'inventory' ? 'active' : ''}" id="tab-act-inventory" type="button">
            Inventory Manager
          </button>
          <button class="tab-btn ${activeRoleTab === 'procurement' ? 'active' : ''}" id="tab-act-procurement" type="button">
            Procurement Officer
          </button>
          <button class="tab-btn ${activeRoleTab === 'supplier' ? 'active' : ''}" id="tab-act-supplier" type="button">
            Supplier / Vendor
          </button>
        </div>
        <div id="role-activity-content" style="margin-top:1.25rem;"></div>
      </div>
    `;

    document.getElementById('tab-act-staff').onclick = () => { activeRoleTab = 'staff'; renderShell(); };
    document.getElementById('tab-act-inventory').onclick = () => { activeRoleTab = 'inventory'; renderShell(); };
    document.getElementById('tab-act-procurement').onclick = () => { activeRoleTab = 'procurement'; renderShell(); };
    document.getElementById('tab-act-supplier').onclick = () => { activeRoleTab = 'supplier'; renderShell(); };

    loadRoleActivity(activeRoleTab);
  }

  renderShell();
}

async function loadRoleActivity(roleKey) {
  const mount = document.getElementById('role-activity-content');
  if (!mount) return;
  mount.innerHTML = '<div class="skeleton" style="height:320px;"></div>';

  try {
    const data = await API.get(`/api/activity/${roleKey}`);
    const activities = data.activities || [];

    if (roleKey === 'staff') {
      UI.createTable({
        container: mount,
        data: activities,
        searchFields: ['staff_name', 'department', 'supply_name', 'batch_no', 'status'],
        defaultSort: { key: 'request_date', direction: 'desc' },
        emptyMessage: 'No department staff requisition activity found.',
        columns: [
          { key: 'request_id', label: 'Req #', sortable: true, render: r => `<strong>#${r.request_id}</strong>` },
          { key: 'request_date', label: 'Date & Time', sortable: true },
          { key: 'staff_name', label: 'Department Staff', sortable: true,
            render: r => `<strong>${r.staff_name}</strong><br><span style="font-size:0.75rem; color:var(--color-text-muted);">${r.department}</span>` },
          { key: 'supply_name', label: 'Requested Supply', sortable: true,
            render: r => `<strong>${r.supply_name}</strong><br><span style="font-size:0.75rem; color:var(--color-text-muted);">Batch: ${r.batch_no}</span>` },
          { key: 'quantity', label: 'Quantity', sortable: true, render: r => `<strong>${r.quantity}</strong> ${r.unit}` },
          { key: 'status', label: 'Request Status', sortable: true, render: r => UI.renderBadge(r.status) },
          { key: 'decided_by_name', label: 'Inventory Reviewer', sortable: true,
            render: r => `<span>${r.decided_by_name}</span>${r.decided_at !== '-' ? `<br><span style="font-size:0.75rem; color:var(--color-text-muted);">${r.decided_at}</span>` : ''}` }
        ],
        filters: [
          {
            id: 'staff_status',
            label: 'Status',
            options: [
              { value: 'PENDING', label: 'Pending' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REJECTED', label: 'Rejected' }
            ],
            match: (row, val) => row.status === val
          }
        ]
      });
    } else if (roleKey === 'inventory') {
      UI.createTable({
        container: mount,
        data: activities,
        searchFields: ['manager_name', 'supply_name', 'batch_no', 'action', 'context', 'status'],
        defaultSort: { key: 'activity_date', direction: 'desc' },
        emptyMessage: 'No inventory manager activity found.',
        columns: [
          { key: 'activity_date', label: 'Date & Time', sortable: true },
          { key: 'manager_name', label: 'Inventory Manager', sortable: true, render: r => `<strong>${r.manager_name}</strong>` },
          { key: 'action', label: 'Action Executed', sortable: true,
            render: r => `<span class="badge ${r.record_type === 'DISPOSAL' ? 'badge-expired' : 'badge-low-stock'}">${r.action}</span>` },
          { key: 'supply_name', label: 'Medical Supply', sortable: true,
            render: r => `<strong>${r.supply_name}</strong><br><span style="font-size:0.75rem; color:var(--color-text-muted);">Batch: ${r.batch_no}</span>` },
          { key: 'quantity', label: 'Quantity', sortable: true, render: r => `<strong>${r.quantity}</strong>` },
          { key: 'context', label: 'Details / Reason', sortable: false, render: r => `<span style="font-size:0.8rem;">${r.context}</span>` },
          { key: 'status', label: 'Status', sortable: true, render: r => UI.renderBadge(r.status) }
        ],
        filters: [
          {
            id: 'inv_action',
            label: 'Action Type',
            options: [
              { value: 'DECISION', label: 'Requisition Decisions' },
              { value: 'DISPOSAL', label: 'Stock Disposals' }
            ],
            match: (row, val) => row.record_type === val
          }
        ]
      });
    } else if (roleKey === 'procurement') {
      UI.createTable({
        container: mount,
        data: activities,
        searchFields: ['officer_name', 'supplier_name', 'order_id', 'status', 'items_summary'],
        defaultSort: { key: 'order_date', direction: 'desc' },
        emptyMessage: 'No procurement officer activity found.',
        columns: [
          { key: 'order_id', label: 'Order #', sortable: true, render: r => `<strong>#PO-${r.order_id}</strong>` },
          { key: 'order_date', label: 'Order Date', sortable: true },
          { key: 'officer_name', label: 'Procurement Officer', sortable: true, render: r => `<strong>${r.officer_name}</strong>` },
          { key: 'supplier_name', label: 'Target Supplier', sortable: true, render: r => `<strong>${r.supplier_name}</strong>` },
          { key: 'items_summary', label: 'Line Items Summary', sortable: false, render: r => `<span style="font-size:0.8rem;">${r.items_summary}</span>` },
          { key: 'total_quantity', label: 'Total Units', sortable: true, render: r => `<strong>${r.total_quantity}</strong>` },
          { key: 'expected_date', label: 'Expected Date', sortable: true, render: r => r.expected_date || '-' },
          { key: 'status', label: 'PO Status', sortable: true, render: r => UI.renderBadge(r.status) }
        ],
        filters: [
          {
            id: 'po_status',
            label: 'Status',
            options: [
              { value: 'ORDERED', label: 'Ordered' },
              { value: 'DISPATCHED', label: 'Dispatched' },
              { value: 'RECEIVED', label: 'Received' },
              { value: 'CANCELLED', label: 'Cancelled' }
            ],
            match: (row, val) => row.status === val
          }
        ]
      });
    } else if (roleKey === 'supplier') {
      UI.createTable({
        container: mount,
        data: activities,
        searchFields: ['supplier_name', 'order_id', 'status', 'notes', 'items_summary'],
        defaultSort: { key: 'order_id', direction: 'desc' },
        emptyMessage: 'No supplier/vendor dispatch activity found.',
        columns: [
          { key: 'order_id', label: 'Order #', sortable: true, render: r => `<strong>#PO-${r.order_id}</strong>` },
          { key: 'supplier_name', label: 'Supplier / Vendor', sortable: true,
            render: r => `<strong>${r.supplier_name}</strong>${r.supplier_contact ? `<br><span style="font-size:0.75rem; color:var(--color-text-muted);">${r.supplier_contact}</span>` : ''}` },
          { key: 'items_summary', label: 'Items', sortable: false, render: r => `<span style="font-size:0.8rem;">${r.items_summary}</span>` },
          { key: 'order_date', label: 'Order Date', sortable: true },
          { key: 'expected_date', label: 'Expected Delivery', sortable: true, render: r => r.expected_date || '-' },
          { key: 'dispatch_date', label: 'Dispatch Date', sortable: true,
            render: r => r.dispatch_date ? `<strong style="color:var(--color-primary);">${r.dispatch_date}</strong>` : '<span style="color:var(--color-text-muted);">Pending</span>' },
          { key: 'display_status', label: 'Fulfillment Status', sortable: true, render: r => UI.renderBadge(r.display_status || r.status) },
          { key: 'notes', label: 'Tracking / Delivery Notes', sortable: false, render: r => `<span style="font-size:0.8rem;">${r.notes || '-'}</span>` }
        ],
        filters: [
          {
            id: 'sup_status',
            label: 'Status',
            options: [
              { value: 'ORDERED', label: 'Ordered / Pending Dispatch' },
              { value: 'SCHEDULED_DISPATCH', label: 'Scheduled Dispatch' },
              { value: 'DISPATCHED', label: 'Dispatched' },
              { value: 'RECEIVED', label: 'Delivered & Received' }
            ],
            match: (row, val) => (row.display_status || row.status) === val
          }
        ]
      });
    }
  } catch (err) {
    mount.innerHTML = `<div style="color:var(--color-danger); font-size:0.85rem;">Failed to load activity for this role: ${err.message}</div>`;
  }
}

/* ==========================================================================
   VIEW: REPORTS (Hospital Administrator)
   ========================================================================== */
async function renderReports(container) {
  let activeReport = 'inventory';

  function render() {
    container.innerHTML = `
      <div class="card" style="margin-bottom:1.25rem;">
        <div class="tab-bar">
          <button class="tab-btn ${activeReport === 'inventory' ? 'active' : ''}" id="tab-inv-report" type="button">Inventory Report</button>
          <button class="tab-btn ${activeReport === 'procurement' ? 'active' : ''}" id="tab-proc-report" type="button">Procurement Report</button>
        </div>
        <div id="report-content"></div>
      </div>
    `;

    document.getElementById('tab-inv-report').onclick = () => { activeReport = 'inventory'; render(); };
    document.getElementById('tab-proc-report').onclick = () => { activeReport = 'procurement'; render(); };

    if (activeReport === 'inventory') loadInventoryReport();
    else loadProcurementReport();
  }

  render();
}

async function loadInventoryReport() {
  const reportDiv = document.getElementById('report-content');
  if (!reportDiv) return;
  reportDiv.innerHTML = '<div class="skeleton" style="height:350px;"></div>';

  try {
    const catData = await API.get('/api/supplies/categories');
    const categories = catData.categories || [];

    reportDiv.innerHTML = `
      <div class="report-controls" style="display:flex; gap:0.75rem; margin:1rem 0; flex-wrap:wrap; align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" for="rpt-inv-cat">Category</label>
          <select id="rpt-inv-cat" class="form-input" style="width:auto;">
            <option value="ALL">All Categories</option>
            ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" for="rpt-inv-status">Status</label>
          <select id="rpt-inv-status" class="form-input" style="width:auto;">
            <option value="ALL">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="EXPIRED">Expired</option>
            <option value="DISPOSED">Disposed</option>
          </select>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="rpt-inv-load">Generate Report</button>
        <button type="button" class="btn btn-secondary btn-sm" id="rpt-inv-csv">Export CSV</button>
        <button type="button" class="btn btn-secondary btn-sm" id="rpt-inv-print">Print Report</button>
      </div>
      <div id="rpt-inv-summary"></div>
      <div id="rpt-inv-table"></div>
    `;

    document.getElementById('rpt-inv-load').onclick = fetchInventoryReport;
    document.getElementById('rpt-inv-csv').onclick = exportInventoryCSV;
    document.getElementById('rpt-inv-print').onclick = () => window.print();
    fetchInventoryReport();
  } catch (err) {
    reportDiv.innerHTML = `<div style="color:var(--color-danger);">Error: ${err.message}</div>`;
  }
}

let _lastInventoryReport = null;
async function fetchInventoryReport() {
  const summaryDiv = document.getElementById('rpt-inv-summary');
  const tableDiv = document.getElementById('rpt-inv-table');
  if (!summaryDiv || !tableDiv) return;

  const cat = document.getElementById('rpt-inv-cat')?.value || 'ALL';
  const status = document.getElementById('rpt-inv-status')?.value || 'ALL';

  tableDiv.innerHTML = '<div class="skeleton" style="height:250px;"></div>';

  try {
    const data = await API.get(`/api/reports/inventory?category=${cat}&status=${status}`);
    _lastInventoryReport = data;
    const s = data.summary;
    const supplies = data.supplies || [];

    summaryDiv.innerHTML = `
      <div class="print-header">
        <h2>Hospital Supply Chain Management System</h2>
        <p>Inventory Report — Generated ${new Date().toLocaleDateString('en-IN')}</p>
      </div>
      <div class="report-summary">
        <div class="report-kpi"><div class="report-kpi-label">Total Items</div><div class="report-kpi-value">${s.total_items}</div></div>
        <div class="report-kpi"><div class="report-kpi-label">Total Quantity</div><div class="report-kpi-value">${s.total_quantity}</div></div>
        <div class="report-kpi"><div class="report-kpi-label">Low Stock</div><div class="report-kpi-value" style="color:var(--color-warning);">${s.low_stock_count}</div></div>
        <div class="report-kpi"><div class="report-kpi-label">Near Expiry</div><div class="report-kpi-value" style="color:var(--color-warning);">${s.near_expiry_count}</div></div>
        <div class="report-kpi"><div class="report-kpi-label">Expired</div><div class="report-kpi-value" style="color:var(--color-danger);">${s.expired_count}</div></div>
      </div>
    `;

    UI.createTable({
      container: tableDiv,
      data: supplies,
      searchFields: ['name', 'batch_no', 'category', 'supplier_name'],
      emptyMessage: 'No supplies match the selected filters.',
      columns: [
        { key: 'name', label: 'Supply Name', sortable: true, render: r => `<strong>${r.name}</strong>` },
        { key: 'batch_no', label: 'Batch', sortable: true },
        { key: 'category', label: 'Category', sortable: true },
        { key: 'quantity', label: 'Quantity', sortable: true, render: r => `${r.quantity} ${r.unit}` },
        { key: 'min_stock_level', label: 'Min Stock', sortable: true },
        { key: 'expiry_date', label: 'Expiry Date', sortable: true,
          render: r => `<span style="color:${r.is_expired ? 'var(--color-danger)' : r.is_near_expiry ? 'var(--color-warning)' : 'inherit'}; font-weight:${r.is_expired || r.is_near_expiry ? '600' : '400'};">${r.expiry_date}</span>` },
        { key: 'status', label: 'Status', render: r => UI.renderBadge(r.status) },
        { key: 'supplier_name', label: 'Supplier', sortable: true, render: r => r.supplier_name || '—' }
      ]
    });
  } catch (err) {
    tableDiv.innerHTML = `<div style="color:var(--color-danger);">Failed to generate report: ${err.message}</div>`;
  }
}

function exportInventoryCSV() {
  if (!_lastInventoryReport || !_lastInventoryReport.supplies) return UI.toast('Generate the report first.', 'warning');
  const supplies = _lastInventoryReport.supplies;
  const headers = ['Name', 'Batch No', 'Category', 'Quantity', 'Unit', 'Min Stock Level', 'Expiry Date', 'Status', 'Supplier'];
  const rows = supplies.map(s => [s.name, s.batch_no, s.category, s.quantity, s.unit, s.min_stock_level, s.expiry_date, s.status, s.supplier_name || '']);
  downloadCSV('inventory_report.csv', headers, rows);
}

async function loadProcurementReport() {
  const reportDiv = document.getElementById('report-content');
  if (!reportDiv) return;
  reportDiv.innerHTML = '<div class="skeleton" style="height:350px;"></div>';

  try {
    const supData = await API.get('/api/suppliers');
    const suppliers = supData.suppliers || [];

    reportDiv.innerHTML = `
      <div class="report-controls" style="display:flex; gap:0.75rem; margin:1rem 0; flex-wrap:wrap; align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" for="rpt-proc-sup">Supplier</label>
          <select id="rpt-proc-sup" class="form-input" style="width:auto;">
            <option value="ALL">All Suppliers</option>
            ${suppliers.map(s => `<option value="${s.supplier_id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" for="rpt-proc-status">Status</label>
          <select id="rpt-proc-status" class="form-input" style="width:auto;">
            <option value="ALL">All Statuses</option>
            <option value="ORDERED">Ordered</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" for="rpt-proc-start">Start Date</label>
          <input type="date" id="rpt-proc-start" class="form-input" style="width:auto;">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" for="rpt-proc-end">End Date</label>
          <input type="date" id="rpt-proc-end" class="form-input" style="width:auto;">
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="rpt-proc-load">Generate Report</button>
        <button type="button" class="btn btn-secondary btn-sm" id="rpt-proc-csv">Export CSV</button>
        <button type="button" class="btn btn-secondary btn-sm" id="rpt-proc-print">Print Report</button>
      </div>
      <div id="rpt-proc-summary"></div>
      <div id="rpt-proc-table"></div>
    `;

    document.getElementById('rpt-proc-load').onclick = fetchProcurementReport;
    document.getElementById('rpt-proc-csv').onclick = exportProcurementCSV;
    document.getElementById('rpt-proc-print').onclick = () => window.print();
    fetchProcurementReport();
  } catch (err) {
    reportDiv.innerHTML = `<div style="color:var(--color-danger);">Error: ${err.message}</div>`;
  }
}

let _lastProcurementReport = null;
async function fetchProcurementReport() {
  const summaryDiv = document.getElementById('rpt-proc-summary');
  const tableDiv = document.getElementById('rpt-proc-table');
  if (!summaryDiv || !tableDiv) return;

  const supplier_id = document.getElementById('rpt-proc-sup')?.value || 'ALL';
  const status = document.getElementById('rpt-proc-status')?.value || 'ALL';
  const start_date = document.getElementById('rpt-proc-start')?.value || '';
  const end_date = document.getElementById('rpt-proc-end')?.value || '';

  tableDiv.innerHTML = '<div class="skeleton" style="height:250px;"></div>';

  try {
    let url = `/api/reports/procurement?supplier_id=${supplier_id}&status=${status}`;
    if (start_date) url += `&start_date=${start_date}`;
    if (end_date) url += `&end_date=${end_date}`;
    const data = await API.get(url);
    _lastProcurementReport = data;
    const s = data.summary;
    const orders = data.orders || [];

    summaryDiv.innerHTML = `
      <div class="print-header">
        <h2>Hospital Supply Chain Management System</h2>
        <p>Procurement Report — Generated ${new Date().toLocaleDateString('en-IN')}</p>
      </div>
      <div class="report-summary">
        <div class="report-kpi"><div class="report-kpi-label">Total Orders</div><div class="report-kpi-value">${s.total_orders}</div></div>
        <div class="report-kpi"><div class="report-kpi-label">Total Items Qty</div><div class="report-kpi-value">${s.total_items_quantity}</div></div>
        <div class="report-kpi"><div class="report-kpi-label" style="color:var(--color-info);">Ordered</div><div class="report-kpi-value">${s.ordered_count}</div></div>
        <div class="report-kpi"><div class="report-kpi-label">Dispatched</div><div class="report-kpi-value">${s.dispatched_count}</div></div>
        <div class="report-kpi"><div class="report-kpi-label" style="color:var(--color-success);">Received</div><div class="report-kpi-value">${s.received_count}</div></div>
        <div class="report-kpi"><div class="report-kpi-label" style="color:var(--color-warning);">Delayed</div><div class="report-kpi-value">${s.delayed_count}</div></div>
      </div>
    `;

    UI.createTable({
      container: tableDiv,
      data: orders,
      searchFields: ['supplier_name', 'notes', 'created_by_name'],
      emptyMessage: 'No orders match the selected filters.',
      columns: [
        { key: 'order_id', label: 'Order #', sortable: true, render: o => `<strong>#${o.order_id}</strong>` },
        { key: 'supplier_name', label: 'Supplier', sortable: true },
        { key: 'order_date', label: 'Order Date', sortable: true },
        { key: 'status', label: 'Status', render: o => {
          let badge = UI.renderBadge(o.status);
          if (o.is_delayed) badge += ' ' + UI.renderBadge('DELAYED', 'Delayed');
          return badge;
        }},
        { key: 'expected_date', label: 'Expected', sortable: true, render: o => o.expected_date || '—' },
        { key: 'actual_date', label: 'Received', render: o => o.actual_date || '—' },
        { key: 'item_count', label: 'Items', sortable: true },
        { key: 'total_quantity', label: 'Total Qty', sortable: true },
        { key: 'created_by_name', label: 'Created By', render: o => o.created_by_name || '—' }
      ]
    });
  } catch (err) {
    tableDiv.innerHTML = `<div style="color:var(--color-danger);">Failed to generate report: ${err.message}</div>`;
  }
}

function exportProcurementCSV() {
  if (!_lastProcurementReport || !_lastProcurementReport.orders) return UI.toast('Generate the report first.', 'warning');
  const orders = _lastProcurementReport.orders;
  const headers = ['Order ID', 'Supplier', 'Order Date', 'Status', 'Expected Date', 'Received Date', 'Items', 'Total Quantity', 'Delayed', 'Created By', 'Notes'];
  const rows = orders.map(o => [o.order_id, o.supplier_name, o.order_date, o.status, o.expected_date || '', o.actual_date || '', o.item_count, o.total_quantity, o.is_delayed ? 'Yes' : 'No', o.created_by_name || '', (o.notes || '').replace(/"/g, '""')]);
  downloadCSV('procurement_report.csv', headers, rows);
}

function downloadCSV(filename, headers, rows) {
  const escape = v => `"${String(v).replace(/"/g, '""')}"`;
  const csvContent = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  UI.toast(`${filename} exported successfully.`, 'success');
}
