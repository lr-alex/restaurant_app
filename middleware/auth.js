const Account = require('../models/Account');
const Customer = require('../models/Customer');
const Staff = require('../models/Staff');
const asyncRoute = require('../utils/asyncRoute');

const loadCurrentUser = asyncRoute(async (req, res, next) => {
  res.locals.currentUser = null;
  res.locals.currentProfile = null;
  res.locals.homePath = '/login';
  req.user = null;

  if (!req.session.accountId) {
    return next();
  }

  const account = await Account.findById(req.session.accountId);
  if (!account || !account.active) {
    delete req.session.accountId;
    return next();
  }

  const profile =
    account.role === 'customer'
      ? await Customer.findOne({ _id: account.profileId, active: true })
      : await Staff.findOne({ _id: account.profileId, active: true });

  if (!profile) {
    delete req.session.accountId;
    return next();
  }

  req.user = {
    id: account._id.toString(),
    username: account.username,
    role: account.role,
    profileId: account.profileId.toString()
  };
  req.profile = profile;
  res.locals.currentUser = req.user;
  res.locals.currentProfile = profile;
  res.locals.homePath =
    account.role === 'customer'
      ? '/customer/bookings'
      : account.role === 'staff'
        ? '/staff/dashboard'
        : '/admin/dashboard';
  next();
});

function requireAuth(req, res, next) {
  if (req.user) {
    return next();
  }
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return res.redirect('/login');
}

function requireRole(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return requireAuth(req, res, next);
    }
    if (!roles.includes(req.user.role)) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      return res.status(403).render('error', {
        title: 'Access denied',
        status: 403,
        message: 'Your account does not have permission to view this page.'
      });
    }
    return next();
  };
}

module.exports = { loadCurrentUser, requireAuth, requireRole };
