const express = require('express');
const Account = require('../models/Account');
const Booking = require('../models/Booking');
const Branch = require('../models/Branch');
const Customer = require('../models/Customer');
const Meal = require('../models/Meal');
const Order = require('../models/Order');
const Staff = require('../models/Staff');
const asyncRoute = require('../utils/asyncRoute');
const AppError = require('../utils/AppError');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  cancelCustomerBooking,
  createBooking,
  updateBookingStatus,
  updateCustomerBooking
} = require('../services/bookingService');
const { createOrder, updateOrderStatus } = require('../services/orderService');

const router = express.Router();

function publicSession(account, profile) {
  return {
    username: account.username,
    role: account.role,
    profile: {
      id: profile._id,
      name: profile.name,
      branchNo: profile.branchNo || null
    }
  };
}

router.post(
  '/session',
  asyncRoute(async (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const account = await Account.findOne({ username, active: true }).select(
      '+password'
    );
    if (!account || account.password !== password) {
      throw new AppError(401, 'Incorrect username or password.');
    }
    const profile =
      account.role === 'customer'
        ? await Customer.findById(account.profileId)
        : await Staff.findById(account.profileId);
    if (!profile || !profile.active) {
      throw new AppError(403, 'The account profile is inactive.');
    }
    req.session.accountId = account._id.toString();
    req.session.cart = {};
    res.status(201).json({ data: publicSession(account, profile) });
  })
);

router.use(requireAuth);

router.get('/session', (req, res) => {
  res.json({
    data: {
      username: req.user.username,
      role: req.user.role,
      profile: {
        id: req.profile._id,
        name: req.profile.name,
        branchNo: req.profile.branchNo || null
      }
    }
  });
});

router.delete('/session', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }
    res.clearCookie('saffron.sid');
    return res.status(204).end();
  });
});

router.get(
  '/branches',
  asyncRoute(async (_req, res) => {
    const branches = await Branch.find({ active: true })
      .sort({ branchNo: 1 })
      .lean();
    res.json({ data: branches });
  })
);

router.get(
  '/meals',
  asyncRoute(async (req, res) => {
    const filter = req.user.role === 'admin' ? {} : { isAvailable: true };
    const meals = await Meal.find(filter).sort({ category: 1, name: 1 }).lean();
    res.json({ data: meals });
  })
);

router.get(
  '/meals/:id',
  asyncRoute(async (req, res) => {
    const meal = await Meal.findById(req.params.id);
    if (!meal || (req.user.role !== 'admin' && !meal.isAvailable)) {
      throw new AppError(404, 'Meal not found.');
    }
    res.json({ data: meal });
  })
);

router.post(
  '/meals',
  requireRole('admin'),
  asyncRoute(async (req, res) => {
    const meal = await Meal.create({
      mealCode: String(req.body.mealCode || `MEAL-${Date.now()}`),
      name: req.body.name,
      category: req.body.category,
      description: req.body.description || '',
      price: Number(req.body.price),
      isAvailable: req.body.isAvailable !== false
    });
    res.status(201).json({ data: meal });
  })
);

router.patch(
  '/meals/:id',
  requireRole('admin'),
  asyncRoute(async (req, res) => {
    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      throw new AppError(404, 'Meal not found.');
    }
    const allowed = [
      'name',
      'category',
      'description',
      'price',
      'isAvailable',
      'mealCode'
    ];
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        meal[field] = field === 'price' ? Number(req.body[field]) : req.body[field];
      }
    }
    await meal.save();
    res.json({ data: meal });
  })
);

router.delete(
  '/meals/:id',
  requireRole('admin'),
  asyncRoute(async (req, res) => {
    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      throw new AppError(404, 'Meal not found.');
    }
    if (await Order.exists({ 'items.mealId': meal._id })) {
      throw new AppError(
        409,
        'This meal appears in order history. Set isAvailable to false instead.'
      );
    }
    await meal.deleteOne();
    res.status(204).end();
  })
);

function bookingFilterForUser(user, profile) {
  if (user.role === 'customer') {
    return { customer: profile._id };
  }
  if (user.role === 'staff') {
    return { branchNo: profile.branchNo };
  }
  return {};
}

async function findScopedBooking(req) {
  const filter = {
    ...bookingFilterForUser(req.user, req.profile),
    _id: req.params.id
  };
  const booking = await Booking.findOne(filter).populate(
    'customer',
    'customerCode name phone'
  );
  if (!booking) {
    throw new AppError(404, 'Booking not found.');
  }
  return booking;
}

router.get(
  '/bookings',
  asyncRoute(async (req, res) => {
    const filter = bookingFilterForUser(req.user, req.profile);
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.branchNo) {
      const branchNo = Number(req.query.branchNo);
      if (req.user.role === 'staff' && branchNo !== req.profile.branchNo) {
        throw new AppError(403, 'Staff can only view their own branch.');
      }
      filter.branchNo = branchNo;
    }
    const bookings = await Booking.find(filter)
      .sort({ bookingDate: -1, slotStart: -1 })
      .populate('customer', 'customerCode name phone');
    res.json({ data: bookings });
  })
);

router.post(
  '/bookings',
  requireRole('customer'),
  asyncRoute(async (req, res) => {
    const booking = await createBooking(req.profile._id, req.body);
    res.status(201).json({ data: booking });
  })
);

router.get(
  '/bookings/:id',
  asyncRoute(async (req, res) => {
    res.json({ data: await findScopedBooking(req) });
  })
);

router.patch(
  '/bookings/:id',
  asyncRoute(async (req, res) => {
    const current = await findScopedBooking(req);
    let booking;
    if (req.user.role === 'customer') {
      if (req.body.status === 'cancelled') {
        booking = await cancelCustomerBooking(req.profile._id, current._id);
      } else if (!req.body.status) {
        booking = await updateCustomerBooking(
          req.profile._id,
          current._id,
          req.body
        );
      } else {
        throw new AppError(403, 'Customers may only cancel a booking.');
      }
    } else {
      if (!req.body.status) {
        throw new AppError(400, 'Only booking status can be changed by staff.');
      }
      booking = await updateBookingStatus(current, req.body.status, req.user.role);
    }
    res.json({ data: booking });
  })
);

router.delete('/bookings/:id', (_req, res) => {
  res.status(405).json({
    error: 'Bookings cannot be deleted. Set status to cancelled instead.'
  });
});

function orderFilterForUser(user, profile) {
  if (user.role === 'customer') {
    return { customer: profile._id };
  }
  if (user.role === 'staff') {
    return { branchNo: profile.branchNo };
  }
  return {};
}

async function findScopedOrder(req) {
  const order = await Order.findOne({
    ...orderFilterForUser(req.user, req.profile),
    _id: req.params.id
  }).populate('customer', 'customerCode name phone');
  if (!order) {
    throw new AppError(404, 'Order not found.');
  }
  return order;
}

router.get(
  '/orders',
  asyncRoute(async (req, res) => {
    const filter = orderFilterForUser(req.user, req.profile);
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.branchNo) {
      const branchNo = Number(req.query.branchNo);
      if (req.user.role === 'staff' && branchNo !== req.profile.branchNo) {
        throw new AppError(403, 'Staff can only view their own branch.');
      }
      filter.branchNo = branchNo;
    }
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .populate('customer', 'customerCode name phone');
    res.json({ data: orders });
  })
);

router.post(
  '/orders',
  requireRole('customer'),
  asyncRoute(async (req, res) => {
    const order = await createOrder(req.profile._id, req.body);
    res.status(201).json({ data: order });
  })
);

router.get(
  '/orders/:id',
  asyncRoute(async (req, res) => {
    res.json({ data: await findScopedOrder(req) });
  })
);

router.patch(
  '/orders/:id',
  requireRole('staff', 'admin'),
  asyncRoute(async (req, res) => {
    const order = await findScopedOrder(req);
    const updated = await updateOrderStatus(order, req.body.status);
    res.json({ data: updated });
  })
);

router.delete('/orders/:id', (_req, res) => {
  res.status(405).json({
    error: 'Orders cannot be deleted. Set status to cancelled instead.'
  });
});

module.exports = router;
