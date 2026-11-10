// Business rules for stock and expiry calculations

function isExpired(expiryDate) {
  if (!expiryDate) return false;
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return exp < today;
}

function isNearExpiry(expiryDate, nearExpiryDays = 30) {
  if (!expiryDate) return false;
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (exp < today) return false; // already expired
  
  const threshold = new Date(today);
  threshold.setDate(threshold.getDate() + Number(nearExpiryDays));
  return exp <= threshold;
}

function isLowStock(quantity, minStockLevel, status) {
  if (status === 'EXPIRED' || status === 'DISPOSED') return false;
  return Number(quantity) <= Number(minStockLevel);
}

function computeStockStatus(item, nearExpiryDays = 30) {
  if (item.status === 'DISPOSED') {
    return 'DISPOSED';
  }
  if (isExpired(item.expiry_date) || item.status === 'EXPIRED') {
    return 'EXPIRED';
  }
  if (isLowStock(item.quantity, item.min_stock_level, item.status)) {
    return 'LOW_STOCK';
  }
  return 'OK';
}

module.exports = {
  isExpired,
  isNearExpiry,
  isLowStock,
  computeStockStatus
};
