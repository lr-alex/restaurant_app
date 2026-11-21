const path = require('node:path');
const express = require('express');
const session = require('express-session');
const env = require('./config/env');
const { loadCurrentUser } = require('./middleware/auth');
const { flashMiddleware } = require('./middleware/flash');
const { formatDate, formatDateTime, todayString } = require('./utils/dates');
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customer');
const staffRoutes = require('./routes/staff');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '100kb' }));
app.use(
  session({
    name: 'saffron.sid',
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.nodeEnv === 'production',
      maxAge: 8 * 60 * 60 * 1000
    }
  })
);
app.use(flashMiddleware);
app.use(loadCurrentUser);

app.use(
  '/vendor/bootstrap',
  express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist'))
);
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.today = todayString();
  res.locals.formatDate = formatDate;
  res.locals.formatDateTime = formatDateTime;
  res.locals.formatMoney = (value) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(Number(value || 0));
  res.locals.statusLabel = (value) =>
    String(value || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  next();
});

app.get('/', (req, res) => {
  if (!req.user) {
    return res.redirect('/login');
  }
  return res.redirect(res.locals.homePath);
});

app.use(authRoutes);
app.use(customerRoutes);
app.use(staffRoutes);
app.use(adminRoutes);
app.use('/api', apiRoutes);

app.use((req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found.' });
  }
  return res.status(404).render('error', {
    title: 'Page not found',
    status: 404,
    message: 'The page you requested does not exist.'
  });
});

app.use((error, req, res, _next) => {
  let status = error.status || 500;
  let message = error.message || 'Something went wrong.';

  if (error.name === 'ValidationError') {
    status = 400;
    message = Object.values(error.errors)
      .map((item) => item.message)
      .join(' ');
  } else if (error.name === 'CastError') {
    status = 400;
    message = 'The supplied identifier is invalid.';
  } else if (error.code === 11000) {
    status = 409;
    message = 'A record with that unique value already exists.';
  }

  if (status >= 500) {
    console.error(error);
  }
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(status).json({
      error: message,
      details: error.details || undefined
    });
  }
  return res.status(status).render('error', {
    title: status === 500 ? 'Server error' : 'Request error',
    status,
    message
  });
});

module.exports = app;
