// Reusable UI Components Engine for HSCMS

const UI = {
  // Toast notifications
  toast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Inline SVG icon based on type
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
    } else if (type === 'danger') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    } else {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    toast.innerHTML = `
      <div style="flex-shrink:0;">${iconSvg}</div>
      <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 200ms ease';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  },

  // Confirm dialog
  confirm({ title = 'Confirm Action', message, confirmText = 'Confirm', confirmClass = 'btn-danger', onConfirm }) {
    let modal = document.getElementById('confirm-modal-wrapper');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'confirm-modal-wrapper';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card" style="max-width: 420px;">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button type="button" class="btn-icon" id="confirm-modal-close" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <p style="font-size: var(--font-size-sm); color: var(--color-text);">${message}</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="confirm-modal-cancel">Cancel</button>
          <button type="button" class="btn ${confirmClass}" id="confirm-modal-action">${confirmText}</button>
        </div>
      </div>
    `;

    modal.classList.add('open');

    const close = () => {
      modal.classList.remove('open');
    };

    modal.querySelector('#confirm-modal-close').onclick = close;
    modal.querySelector('#confirm-modal-cancel').onclick = close;
    modal.querySelector('#confirm-modal-action').onclick = async () => {
      close();
      if (typeof onConfirm === 'function') {
        await onConfirm();
      }
    };
  },

  // Render Status Badge with explicit Text + Color Dot
  renderBadge(status, labelOverride = null) {
    const s = (status || '').toUpperCase();
    let cssClass = 'badge-info';
    let label = labelOverride || status;

    if (s === 'OK' || s === 'AVAILABLE' || s === 'ACTIVE' || s === 'APPROVED' || s === 'RECEIVED') {
      cssClass = 'badge-ok';
      if (!labelOverride) label = s === 'OK' ? 'OK' : s === 'ACTIVE' ? 'Active' : s === 'APPROVED' ? 'Approved' : s === 'RECEIVED' ? 'Received' : 'Available';
    } else if (s === 'LOW_STOCK' || s === 'LOW STOCK' || s === 'NEAR_EXPIRY' || s === 'DELAYED') {
      cssClass = 'badge-low-stock';
      if (!labelOverride) label = s.includes('EXPIRY') ? 'Near Expiry' : s === 'DELAYED' ? 'Delayed' : 'Low Stock';
    } else if (s === 'EXPIRED' || s === 'INACTIVE' || s === 'REJECTED' || s === 'CANCELLED') {
      cssClass = 'badge-expired';
      if (!labelOverride) label = s === 'EXPIRED' ? 'Expired' : s === 'INACTIVE' ? 'Deactivated' : s === 'REJECTED' ? 'Rejected' : 'Cancelled';
    } else if (s === 'DISPATCHED') {
      cssClass = 'badge-warning';
      if (!labelOverride) label = 'Dispatched';
    } else if (s === 'SCHEDULED_DISPATCH' || s === 'SCHEDULED FOR DISPATCH' || s === 'DISPATCH_SCHEDULED') {
      cssClass = 'badge-info';
      if (!labelOverride) label = 'Scheduled for Dispatch';
    } else if (s === 'PENDING' || s === 'ORDERED') {
      cssClass = 'badge-pending';
      if (!labelOverride) label = s === 'PENDING' ? 'Pending' : 'Ordered';
    } else if (s === 'DISPOSED') {
      cssClass = 'badge-disposed';
      if (!labelOverride) label = 'Disposed';
    }

    return `<span class="badge ${cssClass}"><span class="badge-dot"></span>${label}</span>`;
  },

  // Render Order Status Badge considering dispatch_date
  renderOrderStatusBadge(order) {
    if (!order) return '';
    const today = new Date().toISOString().split('T')[0];
    const isFuture = (order.is_future_dispatch === true) || (order.status === 'DISPATCHED' && order.dispatch_date && order.dispatch_date > today);
    if (isFuture) {
      return this.renderBadge('SCHEDULED_DISPATCH', 'Scheduled for Dispatch');
    }
    return this.renderBadge(order.status);
  },

  // Generic Reusable Data Table Component
  createTable({
    container,
    columns, // [{ key, label, sortable, render: (row) => ... }]
    data = [],
    searchFields = [],
    defaultSort = { key: null, direction: 'asc' },
    filters = [], // [{ id, label, options: [{ value, label }], match: (row, value) => boolean }]
    pageSize = 10,
    emptyMessage = 'No records found.'
  }) {
    let currentData = [...data];
    let sortState = { ...defaultSort };
    let currentPage = 1;
    let searchQuery = '';
    const activeFilters = {};

    function getFilteredData() {
      let filtered = [...currentData];

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(row => {
          return searchFields.some(field => {
            const val = row[field];
            return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
          });
        });
      }

      // Dropdown filters
      Object.keys(activeFilters).forEach(filterId => {
        const val = activeFilters[filterId];
        if (val && val !== 'ALL') {
          const filterDef = filters.find(f => f.id === filterId);
          if (filterDef && typeof filterDef.match === 'function') {
            filtered = filtered.filter(row => filterDef.match(row, val));
          }
        }
      });

      // Sort
      if (sortState.key) {
        filtered.sort((a, b) => {
          let valA = a[sortState.key];
          let valB = b[sortState.key];

          if (valA === undefined || valA === null) valA = '';
          if (valB === undefined || valB === null) valB = '';

          if (typeof valA === 'number' && typeof valB === 'number') {
            return sortState.direction === 'asc' ? valA - valB : valB - valA;
          }

          valA = String(valA).toLowerCase();
          valB = String(valB).toLowerCase();
          if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }

      return filtered;
    }

    const instanceId = container.id || ('tbl_' + Math.random().toString(36).substring(2, 9));

    // Render outer table container and toolbar once so search input never loses focus
    container.innerHTML = `
      <div class="table-container">
        <div class="table-toolbar">
          <div class="table-toolbar-left">
            ${searchFields.length > 0 ? `
              <div class="table-search-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" class="table-search-input" placeholder="Search..." value="${searchQuery}" id="tbl-search-${instanceId}">
              </div>
            ` : ''}

            ${filters.map(f => `
              <select class="table-filter-select" id="tbl-filter-${instanceId}-${f.id}">
                <option value="ALL">${f.label}: All</option>
                ${f.options.map(opt => `
                  <option value="${opt.value}" ${activeFilters[f.id] === opt.value ? 'selected' : ''}>${opt.label}</option>
                `).join('')}
              </select>
            `).join('')}
          </div>
          <div style="font-size: var(--font-size-xs); color: var(--color-text-muted);">
            Total: <strong id="tbl-total-${instanceId}">0</strong> records
          </div>
        </div>

        <div id="tbl-content-${instanceId}"></div>
      </div>
    `;

    const contentArea = container.querySelector(`#tbl-content-${instanceId}`);
    const totalCountEl = container.querySelector(`#tbl-total-${instanceId}`);
    const searchInput = container.querySelector(`#tbl-search-${instanceId}`);

    if (searchInput) {
      searchInput.oninput = (e) => {
        searchQuery = e.target.value;
        currentPage = 1;
        renderContent();
      };
    }

    filters.forEach(f => {
      const sel = container.querySelector(`#tbl-filter-${instanceId}-${f.id}`);
      if (sel) {
        sel.onchange = (e) => {
          activeFilters[f.id] = e.target.value;
          currentPage = 1;
          renderContent();
        };
      }
    });

    function renderContent() {
      const filtered = getFilteredData();
      const totalRows = filtered.length;
      const totalPages = Math.ceil(totalRows / pageSize) || 1;
      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      if (totalCountEl) {
        totalCountEl.innerText = totalRows;
      }

      const startIndex = (currentPage - 1) * pageSize;
      const pageData = filtered.slice(startIndex, startIndex + pageSize);

      let contentHtml = `
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                ${columns.map(col => `
                  <th class="${col.sortable ? 'sortable' : ''}" data-key="${col.key || ''}">
                    ${col.label}
                    ${col.sortable ? (sortState.key === col.key ? (sortState.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕') : ''}
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${pageData.length === 0 ? `
                <tr>
                  <td colspan="${columns.length}" style="text-align: center; padding: 2.5rem 1rem; color: var(--color-text-muted);">
                    <div class="empty-state">
                      <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
                      <p class="empty-state-title">${emptyMessage}</p>
                    </div>
                  </td>
                </tr>
              ` : pageData.map(row => `
                <tr>
                  ${columns.map(col => `
                    <td>${col.render ? col.render(row) : (row[col.key] !== undefined ? row[col.key] : '')}</td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${totalRows > pageSize ? `
          <div class="table-pagination">
            <div>
              Showing <strong>${startIndex + 1}</strong> to <strong>${Math.min(startIndex + pageSize, totalRows)}</strong> of <strong>${totalRows}</strong> entries
            </div>
            <div class="pagination-controls">
              <button type="button" class="pagination-btn" id="tbl-prev-${instanceId}" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
              <span style="padding: 0.375rem 0.625rem; font-weight:600;">Page ${currentPage} of ${totalPages}</span>
              <button type="button" class="pagination-btn" id="tbl-next-${instanceId}" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
            </div>
          </div>
        ` : ''}
      `;

      contentArea.innerHTML = contentHtml;

      contentArea.querySelectorAll('th.sortable').forEach(th => {
        th.onclick = () => {
          const key = th.getAttribute('data-key');
          if (sortState.key === key) {
            sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
          } else {
            sortState.key = key;
            sortState.direction = 'asc';
          }
          renderContent();
        };
      });

      const prevBtn = contentArea.querySelector(`#tbl-prev-${instanceId}`);
      if (prevBtn) {
        prevBtn.onclick = () => {
          if (currentPage > 1) {
            currentPage--;
            renderContent();
          }
        };
      }

      const nextBtn = contentArea.querySelector(`#tbl-next-${instanceId}`);
      if (nextBtn) {
        nextBtn.onclick = () => {
          if (currentPage < totalPages) {
            currentPage++;
            renderContent();
          }
        };
      }
    }

    renderContent();

    return {
      updateData(newData) {
        currentData = [...newData];
        renderContent();
      }
    };
  }
};
