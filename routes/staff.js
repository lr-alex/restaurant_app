const express = require('express');
const Booking = require('../models/Booking');
const Meal = require('../models/Meal');
const Order = require('../models/Order');
const Shift = require('../models/Shift');
const asyncRoute = require('../utils/asyncRoute');
const AppError = require('../utils/AppError');
const { todayString } = require('../utils/dates');
const { requireRole } = require('../middleware/auth');
const { setFlash } = require('../middleware/flash');
const { updateBookingStatus } = require('../services/bookingService');
const { updateOrderStatus } = require('../services/orderService');

const router = express.Router();
router.use('/staff', requireRole('staff'));

router.get(
  '/staff/dashboard',
  asyncRoute(async (req, res) => {
    const [orders, bookings] = await Promise.all([
      Order.find({
        branchNo: req.profile.branchNo,
        status: { $in: ['placed', 'preparing', 'ready'] }
      })
        .sort({ createdAt: 1 })
        .populate('customer'),
      Booking.find({
        branchNo: req.profile.branchNo,
        status: { $in: ['pending', 'confirmed'] }
      })
        .sort({ bookingDate: 1, slotStart: 1 })
        .populate('customer')
        .limit(8)
    ]);
    res.render('staff/dashboard', {
      title: 'Kitchen dashboard',
      orders,
      bookings
    });
  })
);

router.post(
  '/staff/orders/:id/status',
  asyncRoute(async (req, res) => {
    const order = await Order.findOne({
      _id: req.params.id,
      branchNo: req.profile.branchNo
    });
    if (!order) {
      throw new AppError(404, 'Order not found for your branch.');
    }
    await updateOrderStatus(order, String(req.body.status || ''));
    setFlash(req, 'success', 'Order status updated.');
    res.redirect('/staff/dashboard');
  })
);

router.get(
  '/staff/bookings',
  asyncRoute(async (req, res) => {
    const bookings = await Booking.find({ branchNo: req.profile.branchNo })
      .sort({ bookingDate: 1, slotStart: 1 })
      .populate('customer');
    res.render('staff/bookings', {
      title: 'Branch reservations',
      bookings
    });
  })
);

router.post(
  '/staff/bookings/:id/status',
  asyncRoute(async (req, res) => {
    const booking = await Booking.findOne({
      _id: req.params.id,
      branchNo: req.profile.branchNo
    });
    if (!booking) {
      throw new AppError(404, 'Booking not found for your branch.');
    }
    await updateBookingStatus(booking, String(req.body.status || ''), 'staff');
    setFlash(req, 'success', 'Booking status updated.');
    res.redirect('/staff/bookings');
  })
);

router.get(
  '/staff/menu',
  asyncRoute(async (_req, res) => {
    const meals = await Meal.find().sort({ category: 1, name: 1 });
    res.render('staff/menu', { title: 'Menu reference', meals });
  })
);

router.get(
  '/staff/schedule',
  asyncRoute(async (req, res) => {
    const shifts = await Shift.find({
      staff: req.profile._id,
      shiftDate: { $gte: todayString() }
    }).sort({ shiftDate: 1, startTime: 1 });
    res.render('staff/schedule', {
      title: 'My schedule',
      shifts
    });
  })
);

module.exports = router;
