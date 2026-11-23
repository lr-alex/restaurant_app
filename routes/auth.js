const express = require('express');
const Account = require('../models/Account');
const env = require('../config/env');
const asyncRoute = require('../utils/asyncRoute');
const { requireAuth } = require('../middleware/auth');
const { setFlash } = require('../middleware/flash');

const router = express.Router();

const demoAccounts = {
  customer: {
    username: 'customer1',
    password: 'Customer@123',
    role: 'customer'
  },
  customer2: {
    username: 'customer2',
    password: 'Customer2@123',
    role: 'customer'
  },
  staff: { username: 'staff1', password: 'Staff@123', role: 'staff' },
  staff2: { username: 'staff2', password: 'Staff2@123', role: 'staff' },
  admin: { username: 'admin1', password: 'Admin@123', role: 'admin' }
};

function homeForRole(role) {
  if (role === 'customer') {
    return '/customer/bookings';
  }
  if (role === 'staff') {
    return '/staff/dashboard';
  }
  return '/admin/dashboard';
}

async function findAuthenticatedAccount(username, password) {
  const account = await Account.findOne({
    username,
    active: true
  }).select('+password');
  return account && account.password === password ? account : null;
}

function startSession(req, account) {
  req.session.accountId = account._id.toString();
  req.session.cart = {};
  delete req.session.branchNo;
}

router.get('/login', (req, res) => {
  if (req.user) {
    return res.redirect(res.locals.homePath);
  }
  return res.render('login', {
    title: 'Sign in',
    demoLoginAvailable: env.nodeEnv !== 'production'
  });
});

router.post(
  '/login',
  asyncRoute(async (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const account = await findAuthenticatedAccount(username, password);

    if (!account) {
      setFlash(req, 'danger', 'Incorrect username or password.');
      return res.redirect('/login');
    }

    startSession(req, account);
    return res.redirect(homeForRole(account.role));
  })
);

router.post(
  '/login/demo/:role',
  asyncRoute(async (req, res) => {
    if (env.nodeEnv === 'production') {
      return res.status(404).render('error', {
        title: 'Page not found',
        status: 404,
        message: 'The page you requested does not exist.'
      });
    }

    const demoAccount = demoAccounts[req.params.role];
    if (!demoAccount) {
      return res.status(404).render('error', {
        title: 'Page not found',
        status: 404,
        message: 'Unknown demo account.'
      });
    }

    const account = await findAuthenticatedAccount(
      demoAccount.username,
      demoAccount.password
    );
    if (!account || account.role !== demoAccount.role) {
      setFlash(
        req,
        'danger',
        'This demo account is unavailable. Run npm run reset and try again.'
      );
      return res.redirect('/login');
    }

    startSession(req, account);
    return res.redirect(homeForRole(account.role));
  })
);

router.post('/logout', requireAuth, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }
    res.clearCookie('saffron.sid');
    return res.redirect('/login');
  });
});

router.get('/account/password', requireAuth, (req, res) => {
  res.render('password', { title: 'Change password' });
});

router.post(
  '/account/password',
  requireAuth,
  asyncRoute(async (req, res) => {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    if (newPassword.length < 6) {
      setFlash(req, 'danger', 'The new password must contain at least 6 characters.');
      return res.redirect('/account/password');
    }
    if (newPassword !== confirmPassword) {
      setFlash(req, 'danger', 'The new passwords do not match.');
      return res.redirect('/account/password');
    }

    const account = await Account.findById(req.user.id).select('+password');
    if (!account || account.password !== currentPassword) {
      setFlash(req, 'danger', 'The current password is incorrect.');
      return res.redirect('/account/password');
    }

    account.password = newPassword;
    await account.save();
    setFlash(req, 'success', 'Password updated.');
    return res.redirect('/account/password');
  })
);

module.exports = router;
