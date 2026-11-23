const express = require('express');
const Branch = require('../models/Branch');
const Meal = require('../models/Meal');
const Booking = require('../models/Booking');
const Order = require('../models/Order');
const asyncRoute = require('../utils/asyncRoute');
const AppError = require('../utils/AppError');
const { requireRole } = require('../middleware/auth');
const { setFlash } = require('../middleware/flash');
const {
  cancelCustomerBooking,
  createBooking,
  updateCustomerBooking
} = require('../services/bookingService');
const { createOrder } = require('../services/orderService');

const router = express.Router();
router.use('/customer', requireRole('customer'));

async function availableBranches() {
  return Branch.find({ operatingStatus: { $ne: 'disabled' } })
    .sort({ branchNo: 1 })
    .lean();
}

router.get(
  '/customer/bookings',
  asyncRoute(async (req, res) => {
    const [branches, bookings] = await Promise.all([
      availableBranches(),
      Booking.find({ customer: req.profile._id }).sort({
        bookingDate: -1,
        slotStart: -1
      })
    ]);
    res.render('customer/bookings', {
      title: 'Reservations',
      branches,
      bookings
    });
  })
);

router.post(
  '/customer/bookings',
  asyncRoute(async (req, res) => {
    await createBooking(req.profile._id, req.body);
    setFlash(req, 'success', 'Reservation created and awaiting confirmation.');
    res.redirect('/customer/bookings');
  })
);

router.get(
  '/customer/bookings/:id/edit',
  asyncRoute(async (req, res) => {
    const [branches, booking] = await Promise.all([
      availableBranches(),
      Booking.findOne({ _id: req.params.id, customer: req.profile._id })
    ]);
    if (!booking) {
      throw new AppError(404, 'Booking not found.');
    }
    res.render('customer/edit-booking', {
      title: 'Edit reservation',
      branches,
      booking
    });
  })
);

router.post(
  '/customer/bookings/:id/edit',
  asyncRoute(async (req, res) => {
    await updateCustomerBooking(req.profile._id, req.params.id, req.body);
    setFlash(req, 'success', 'Reservation updated.');
    res.redirect('/customer/bookings');
  })
);

router.post(
  '/customer/bookings/:id/cancel',
  asyncRoute(async (req, res) => {
    await cancelCustomerBooking(req.profile._id, req.params.id);
    setFlash(req, 'success', 'Reservation cancelled.');
    res.redirect('/customer/bookings');
  })
);

router.post(
  '/customer/branch',
  asyncRoute(async (req, res) => {
    const branchNo = Number(req.body.branchNo);
    const branch = await Branch.findOne({
      branchNo,
      operatingStatus: 'active'
    });
    if (!branch) {
      throw new AppError(400, 'Select an open branch.');
    }
    req.session.branchNo = branchNo;
    req.session.cart = {};
    res.redirect('/customer/menu');
  })
);

router.get(
  '/customer/menu',
  asyncRoute(async (req, res) => {
    const branches = await availableBranches();
    const openBranches = branches.filter(
      (branch) => branch.operatingStatus === 'active'
    );
    const selectedBranchIsOpen = openBranches.some(
      (branch) => branch.branchNo === req.session.branchNo
    );
    if (!selectedBranchIsOpen && openBranches.length) {
      req.session.branchNo = openBranches[0].branchNo;
    }
    const [meals, favoriteMeals] = await Promise.all([
      Meal.find({ isAvailable: true }).sort({ category: 1, name: 1 }).lean(),
      Meal.find({
        _id: { $in: req.profile.favoriteMealIds },
        isAvailable: true
      }).lean()
    ]);
    const availableById = new Map(meals.map((meal) => [meal._id.toString(), meal]));
    const cartEntries = Object.entries(req.session.cart || {})
      .filter(([mealId]) => availableById.has(mealId))
      .map(([mealId, quantity]) => ({
        meal: availableById.get(mealId),
        quantity,
        subtotal:
          Math.round(availableById.get(mealId).price * quantity * 100) / 100
      }));
    req.session.cart = Object.fromEntries(
      cartEntries.map((entry) => [entry.meal._id.toString(), entry.quantity])
    );
    const cartTotal =
      Math.round(
        cartEntries.reduce((sum, entry) => sum + entry.subtotal, 0) * 100
      ) / 100;

    const categories = [...new Set(meals.map((meal) => meal.category))];
    res.render('customer/menu', {
      title: 'Digital menu',
      branches,
      selectedBranchNo: req.session.branchNo,
      meals,
      favoriteMeals,
      favoriteIds: new Set(req.profile.favoriteMealIds.map(String)),
      categories,
      cartEntries,
      cartTotal
    });
  })
);

router.post(
  '/customer/favorites/:id/toggle',
  asyncRoute(async (req, res) => {
    const meal = await Meal.findOne({ _id: req.params.id, isAvailable: true });
    if (!meal) {
      throw new AppError(404, 'Meal not found.');
    }
    const index = req.profile.favoriteMealIds.findIndex(
      (mealId) => mealId.toString() === req.params.id
    );
    if (index >= 0) {
      req.profile.favoriteMealIds.splice(index, 1);
      setFlash(req, 'success', `${meal.name} removed from favorites.`);
    } else {
      req.profile.favoriteMealIds.push(meal._id);
      setFlash(req, 'success', `${meal.name} added to favorites.`);
    }
    await req.profile.save();
    res.redirect(req.body.returnTo === 'profile' ? '/customer/profile' : '/customer/menu');
  })
);

router.post(
  '/customer/cart/add/:id',
  asyncRoute(async (req, res) => {
    const meal = await Meal.findOne({ _id: req.params.id, isAvailable: true });
    if (!meal) {
      throw new AppError(404, 'Meal not found.');
    }
    req.session.cart = req.session.cart || {};
    req.session.cart[req.params.id] = Math.min(
      Number(req.session.cart[req.params.id] || 0) + 1,
      20
    );
    res.redirect('/customer/menu');
  })
);

router.post(
  '/customer/cart/update/:id',
  asyncRoute(async (req, res) => {
    const quantity = Number(req.body.quantity);
    req.session.cart = req.session.cart || {};
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new AppError(400, 'Quantity must be between 1 and 20.');
    }
    req.session.cart[req.params.id] = quantity;
    res.redirect('/customer/menu');
  })
);

router.post('/customer/cart/remove/:id', (req, res) => {
  if (req.session.cart) {
    delete req.session.cart[req.params.id];
  }
  res.redirect('/customer/menu');
});

router.get(
  '/customer/orders',
  asyncRoute(async (req, res) => {
    const orders = await Order.find({ customer: req.profile._id }).sort({
      createdAt: -1
    });
    res.render('customer/orders', { title: 'My orders', orders });
  })
);

router.post(
  '/customer/orders',
  asyncRoute(async (req, res) => {
    const items = Object.entries(req.session.cart || {}).map(
      ([mealId, quantity]) => ({ mealId, quantity })
    );
    if (!req.session.branchNo) {
      throw new AppError(400, 'Select a branch before placing an order.');
    }
    const order = await createOrder(req.profile._id, {
      branchNo: req.session.branchNo,
      items
    });
    req.session.cart = {};
    setFlash(
      req,
      'success',
      `Order ${order._id.toString().slice(-8).toUpperCase()} was sent to the kitchen.`
    );
    res.redirect('/customer/orders');
  })
);

router.get(
  '/customer/profile',
  asyncRoute(async (req, res) => {
    await req.profile.populate('favoriteMealIds');
    res.render('customer/profile', {
      title: 'My profile',
      favorites: req.profile.favoriteMealIds
    });
  })
);

router.post(
  '/customer/profile',
  asyncRoute(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    if (name.length < 2 || name.length > 80) {
      throw new AppError(400, 'Name must be between 2 and 80 characters.');
    }
    if (phone.length < 5 || phone.length > 30) {
      throw new AppError(400, 'Enter a valid phone number.');
    }
    const current = await req.profile.constructor.findById(req.profile._id);
    current.name = name;
    current.phone = phone;
    await current.save();
    setFlash(req, 'success', 'Profile updated.');
    res.redirect('/customer/profile');
  })
);

module.exports = router;
