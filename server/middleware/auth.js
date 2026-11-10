// Authentication and Role Authorization Middleware

function authenticate(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  
  if (req.originalUrl.startsWith('/api') || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  
  return res.redirect('/login.html');
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      if (req.originalUrl.startsWith('/api') || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Authentication required. Please log in.' });
      }
      return res.redirect('/login.html');
    }

    const userRole = req.session.user.role;
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    if (req.originalUrl.startsWith('/api') || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({ 
        error: `Access denied. Role '${userRole}' is not authorized to access this resource.` 
      });
    }

    return res.status(403).redirect('/#access-denied');
  };
}

module.exports = {
  authenticate,
  requireRole
};
