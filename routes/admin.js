const express = require('express');
const Booking = require('../models/Booking');
const Branch = require('../models/Branch');
const Meal = require('../models/Meal');
const Order = require('../models/Order');
const Shift = require('../models/Shift');
const Staff = require('../models/Staff');
const Supplier = require('../models/Supplier');
const SupplyBatch = require('../models/SupplyBatch');
const Account = require('../models/Account');
const asyncRoute = require('../utils/asyncRoute');
const AppError = require('../utils/AppError');
const { isPastDate, isValidTime, parseDateOnly } = require('../utils/dates');
const { requireRole } = require('../middleware/auth');
const { setFlash } = require('../middleware/flash');

const router = express.Router();
router.use('/admin', requireRole('admin'));

function code(prefix) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  return `${prefix}-${suffix.toUpperCase()}`;
}

function parseSlots(value) {
  const lines = String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    throw new AppError(400, 'Add at least one booking slot.');
  }

  return lines.map((line) => {
    const match = line.match(/^([0-2]\d:[0-5]\d)-([0-2]\d:[0-5]\d)\|(\d{1,3})$/);
    if (!match) {
      throw new AppError(
        400,
        'Use one slot per line in the format 09:00-11:00|20.'
      );
    }
    const [, startTime, endTime, capacityText] = match;
    const capacity = Number(capacityText);
    if (!isValidTime(startTime) || !isValidTime(endTime) || startTime >= endTime) {
      throw new AppError(400, 'Each slot must have a valid start and end time.');
    }
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) {
      throw new AppError(400, 'Capacity must be between 1 and 200.');
    }
    return { startTime, endTime, capacity };
  });
}

function readBranch(body) {
  const branchNo = Number(body.branchNo);
  const openTime = String(body.openTime || '');
  const closeTime = String(body.closeTime || '');
  if (!Number.isInteger(branchNo) || branchNo < 1) {
    throw new AppError(400, 'Branch number must be a positive integer.');
  }
  if (!isValidTime(openTime) || !isValidTime(closeTime) || openTime >= closeTime) {
    throw new AppError(400, 'Enter valid opening and closing times.');
  }
  const bookingSlots = parseSlots(body.slots);
  for (const slot of bookingSlots) {
    if (slot.startTime < openTime || slot.endTime > closeTime) {
      throw new AppError(400, 'Booking slots must fall within branch opening hours.');
    }
  }
  if (!['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(body.restDay)) {
    throw new AppError(400, 'Select a valid rest day.');
  }
  return {
    branchNo,
    name: String(body.name || '').trim(),
    address: String(body.address || '').trim(),
    openTime,
    closeTime,
    restDay: body.restDay,
    bookingSlots,
    isResting: body.isResting === 'on' || body.isResting === 'true',
    active: body.active === 'on' || body.active === 'true'
  };
}

router.get(
  '/admin/dashboard',
  asyncRoute(async (_req, res) => {
    const [
      branchCount,
      mealCount,
      staffCount,
      pendingBookingCount,
      activeOrderCount,
      recentOrders
    ] = await Promise.all([
      Branch.countDocuments({ active: true }),
      Meal.countDocuments({ isAvailable: true }),
      Staff.countDocuments({ active: true }),
      Booking.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: { $in: ['placed', 'preparing', 'ready'] } }),
      Order.find().sort({ createdAt: -1 }).limit(8).populate('customer')
    ]);
    res.render('admin/dashboard', {
      title: 'Administration',
      stats: {
        branchCount,
        mealCount,
        staffCount,
        pendingBookingCount,
        activeOrderCount
      },
      recentOrders
    });
  })
);

router.get(
  '/admin/branches',
  asyncRoute(async (_req, res) => {
    const branches = await Branch.find().sort({ branchNo: 1 });
    res.render('admin/branches', { title: 'Branches', branches });
  })
);

router.post(
  '/admin/branches',
  asyncRoute(async (req, res) => {
    await Branch.create(readBranch(req.body));
    setFlash(req, 'success', 'Branch created.');
    res.redirect('/admin/branches');
  })
);

router.post(
  '/admin/branches/:id',
  asyncRoute(async (req, res) => {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      throw new AppError(404, 'Branch not found.');
    }
    const data = readBranch(req.body);
    const duplicate = await Branch.exists({
      branchNo: data.branchNo,
      _id: { $ne: branch._id }
    });
    if (duplicate) {
      throw new AppError(409, 'That branch number is already in use.');
    }
    if (data.branchNo !== branch.branchNo) {
      const references = await Promise.all([
        Booking.exists({ branchNo: branch.branchNo }),
        Order.exists({ branchNo: branch.branchNo }),
        Staff.exists({ branchNo: branch.branchNo }),
        Shift.exists({ branchNo: branch.branchNo }),
        SupplyBatch.exists({ branchNo: branch.branchNo })
      ]);
      if (references.some(Boolean)) {
        throw new AppError(
          409,
          'The branch number cannot change while related records exist.'
        );
      }
    }
    Object.assign(branch, data);
    await branch.save();
    setFlash(req, 'success', 'Branch updated.');
    res.redirect('/admin/branches');
  })
);

router.post(
  '/admin/branches/:id/delete',
  asyncRoute(async (req, res) => {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      throw new AppError(404, 'Branch not found.');
    }
    const references = await Promise.all([
      Booking.exists({ branchNo: branch.branchNo }),
      Order.exists({ branchNo: branch.branchNo }),
      Staff.exists({ branchNo: branch.branchNo }),
      Shift.exists({ branchNo: branch.branchNo }),
      SupplyBatch.exists({ branchNo: branch.branchNo })
    ]);
    if (references.some(Boolean)) {
      throw new AppError(
        409,
        'This branch has related records and cannot be deleted. Disable it instead.'
      );
    }
    await branch.deleteOne();
    setFlash(req, 'success', 'Branch deleted.');
    res.redirect('/admin/branches');
  })
);

router.get(
  '/admin/meals',
  asyncRoute(async (_req, res) => {
    const meals = await Meal.find().sort({ category: 1, name: 1 });
    res.render('admin/meals', { title: 'Meal catalog', meals });
  })
);

router.post(
  '/admin/meals',
  asyncRoute(async (req, res) => {
    const price = Number(req.body.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new AppError(400, 'Enter a valid meal price.');
    }
    await Meal.create({
      mealCode: code('MEAL'),
      name: String(req.body.name || '').trim(),
      category: String(req.body.category || '').trim(),
      description: String(req.body.description || '').trim(),
      price: Math.round(price * 100) / 100,
      isAvailable: req.body.isAvailable === 'on'
    });
    setFlash(req, 'success', 'Meal created.');
    res.redirect('/admin/meals');
  })
);

router.post(
  '/admin/meals/:id',
  asyncRoute(async (req, res) => {
    const price = Number(req.body.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new AppError(400, 'Enter a valid meal price.');
    }
    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      throw new AppError(404, 'Meal not found.');
    }
    meal.name = String(req.body.name || '').trim();
    meal.category = String(req.body.category || '').trim();
    meal.description = String(req.body.description || '').trim();
    meal.price = Math.round(price * 100) / 100;
    meal.isAvailable = req.body.isAvailable === 'on';
    await meal.save();
    setFlash(req, 'success', 'Meal updated.');
    res.redirect('/admin/meals');
  })
);

router.post(
  '/admin/meals/:id/delete',
  asyncRoute(async (req, res) => {
    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      throw new AppError(404, 'Meal not found.');
    }
    const referenced = await Order.exists({ 'items.mealId': meal._id });
    if (referenced) {
      meal.isAvailable = false;
      await meal.save();
      setFlash(req, 'warning', 'Meal appears in order history, so it was disabled.');
    } else {
      await meal.deleteOne();
      setFlash(req, 'success', 'Meal deleted.');
    }
    res.redirect('/admin/meals');
  })
);

router.get(
  '/admin/staff',
  asyncRoute(async (_req, res) => {
    const [staff, branches, accounts] = await Promise.all([
      Staff.find().sort({ branchNo: 1, name: 1 }),
      Branch.find({ active: true }).sort({ branchNo: 1 }),
      Account.find({ role: { $in: ['staff', 'admin'] } })
    ]);
    const accountByProfile = new Map(
      accounts.map((account) => [account.profileId.toString(), account])
    );
    res.render('admin/staff', {
      title: 'Staff directory',
      staff,
      branches,
      accountByProfile
    });
  })
);

router.post(
  '/admin/staff',
  asyncRoute(async (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const branchNo = Number(req.body.branchNo);
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      throw new AppError(400, 'Username must be 3-40 lowercase letters, numbers, dots, dashes or underscores.');
    }
    if (password.length < 6) {
      throw new AppError(400, 'Password must contain at least 6 characters.');
    }
    if (!(await Branch.exists({ branchNo, active: true }))) {
      throw new AppError(400, 'Select an active branch.');
    }
    if (await Account.exists({ username })) {
      throw new AppError(409, 'That username is already in use.');
    }
    const salary = Number(req.body.salary || 0);
    const member = await Staff.create({
      staffCode: code('STF'),
      branchNo,
      name: String(req.body.name || '').trim(),
      roleTitle: req.body.roleTitle,
      address: String(req.body.address || '').trim(),
      dateOfBirth: String(req.body.dateOfBirth || '').trim(),
      salary: Number.isFinite(salary) ? Math.max(salary, 0) : 0,
      workingPeriod: req.body.workingPeriod,
      active: true
    });
    try {
      await Account.create({
        username,
        password,
        role: 'staff',
        profileId: member._id,
        active: true
      });
    } catch (error) {
      await member.deleteOne();
      throw error;
    }
    setFlash(req, 'success', 'Staff member and login created.');
    res.redirect('/admin/staff');
  })
);

router.post(
  '/admin/staff/:id',
  asyncRoute(async (req, res) => {
    const member = await Staff.findById(req.params.id);
    if (!member) {
      throw new AppError(404, 'Staff member not found.');
    }
    const branchNo = Number(req.body.branchNo);
    if (!(await Branch.exists({ branchNo, active: true }))) {
      throw new AppError(400, 'Select an active branch.');
    }
    const salary = Number(req.body.salary || 0);
    member.branchNo = branchNo;
    member.name = String(req.body.name || '').trim();
    member.roleTitle = req.body.roleTitle;
    member.address = String(req.body.address || '').trim();
    member.dateOfBirth = String(req.body.dateOfBirth || '').trim();
    member.salary = Number.isFinite(salary) ? Math.max(salary, 0) : 0;
    member.workingPeriod = req.body.workingPeriod;
    member.active = req.body.active === 'on';
    await member.save();
    await Account.updateOne({ profileId: member._id }, { active: member.active });
    setFlash(req, 'success', 'Staff profile updated.');
    res.redirect('/admin/staff');
  })
);

router.get(
  '/admin/shifts',
  asyncRoute(async (_req, res) => {
    const [shifts, staff, branches] = await Promise.all([
      Shift.find().sort({ shiftDate: 1, startTime: 1 }).populate('staff'),
      Staff.find({ active: true }).sort({ name: 1 }),
      Branch.find({ active: true }).sort({ branchNo: 1 })
    ]);
    res.render('admin/shifts', {
      title: 'Staff scheduling',
      shifts,
      staff,
      branches
    });
  })
);

router.post(
  '/admin/shifts',
  asyncRoute(async (req, res) => {
    const member = await Staff.findOne({
      _id: req.body.staffId,
      active: true
    });
    if (!member) {
      throw new AppError(400, 'Select an active staff member.');
    }
    const shiftDate = String(req.body.shiftDate || '');
    const startTime = String(req.body.startTime || '');
    const endTime = String(req.body.endTime || '');
    if (!parseDateOnly(shiftDate) || isPastDate(shiftDate)) {
      throw new AppError(400, 'Shift date must be today or later.');
    }
    if (!isValidTime(startTime) || !isValidTime(endTime) || startTime >= endTime) {
      throw new AppError(400, 'Enter a valid shift period.');
    }
    await Shift.create({
      staff: member._id,
      branchNo: member.branchNo,
      shiftDate,
      startTime,
      endTime
    });
    setFlash(req, 'success', 'Shift created.');
    res.redirect('/admin/shifts');
  })
);

router.post(
  '/admin/shifts/:id/delete',
  asyncRoute(async (req, res) => {
    const result = await Shift.findByIdAndDelete(req.params.id);
    if (!result) {
      throw new AppError(404, 'Shift not found.');
    }
    setFlash(req, 'success', 'Shift removed.');
    res.redirect('/admin/shifts');
  })
);

router.get(
  '/admin/suppliers',
  asyncRoute(async (_req, res) => {
    const suppliers = await Supplier.find().sort({ name: 1 });
    res.render('admin/suppliers', { title: 'Suppliers', suppliers });
  })
);

router.post(
  '/admin/suppliers',
  asyncRoute(async (req, res) => {
    await Supplier.create({
      supplierCode: code('SUP'),
      name: String(req.body.name || '').trim(),
      contactInfo: String(req.body.contactInfo || '').trim(),
      description: String(req.body.description || '').trim(),
      active: true
    });
    setFlash(req, 'success', 'Supplier created.');
    res.redirect('/admin/suppliers');
  })
);

router.post(
  '/admin/suppliers/:id',
  asyncRoute(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      throw new AppError(404, 'Supplier not found.');
    }
    supplier.name = String(req.body.name || '').trim();
    supplier.contactInfo = String(req.body.contactInfo || '').trim();
    supplier.description = String(req.body.description || '').trim();
    supplier.active = req.body.active === 'on';
    await supplier.save();
    setFlash(req, 'success', 'Supplier updated.');
    res.redirect('/admin/suppliers');
  })
);

router.post(
  '/admin/suppliers/:id/delete',
  asyncRoute(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      throw new AppError(404, 'Supplier not found.');
    }
    if (await SupplyBatch.exists({ supplier: supplier._id })) {
      supplier.active = false;
      await supplier.save();
      setFlash(req, 'warning', 'Supplier has supply history and was disabled.');
    } else {
      await supplier.deleteOne();
      setFlash(req, 'success', 'Supplier deleted.');
    }
    res.redirect('/admin/suppliers');
  })
);

router.get(
  '/admin/batches',
  asyncRoute(async (_req, res) => {
    const [batches, suppliers, branches] = await Promise.all([
      SupplyBatch.find().sort({ receivedDate: -1 }).populate('supplier'),
      Supplier.find({ active: true }).sort({ name: 1 }),
      Branch.find({ active: true }).sort({ branchNo: 1 })
    ]);
    res.render('admin/batches', {
      title: 'Supply batches',
      batches,
      suppliers,
      branches
    });
  })
);

router.post(
  '/admin/batches',
  asyncRoute(async (req, res) => {
    const supplier = await Supplier.findOne({
      _id: req.body.supplierId,
      active: true
    });
    if (!supplier) {
      throw new AppError(400, 'Select an active supplier.');
    }
    const branchNo = Number(req.body.branchNo);
    if (!(await Branch.exists({ branchNo, active: true }))) {
      throw new AppError(400, 'Select an active branch.');
    }
    const receivedDate = String(req.body.receivedDate || '');
    if (!parseDateOnly(receivedDate)) {
      throw new AppError(400, 'Enter a valid received date.');
    }
    await SupplyBatch.create({
      batchCode: code('BATCH'),
      supplier: supplier._id,
      branchNo,
      itemName: String(req.body.itemName || '').trim(),
      receivedDate
    });
    setFlash(req, 'success', 'Supply batch created.');
    res.redirect('/admin/batches');
  })
);

router.post(
  '/admin/batches/:id/delete',
  asyncRoute(async (req, res) => {
    const batch = await SupplyBatch.findByIdAndDelete(req.params.id);
    if (!batch) {
      throw new AppError(404, 'Supply batch not found.');
    }
    setFlash(req, 'success', 'Supply batch deleted.');
    res.redirect('/admin/batches');
  })
);

module.exports = router;
