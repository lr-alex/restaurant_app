const mongoose = require('mongoose');
const { connectDatabase, disconnectDatabase } = require('../config/db');
const Account = require('../models/Account');
const Booking = require('../models/Booking');
const Branch = require('../models/Branch');
const Customer = require('../models/Customer');
const Meal = require('../models/Meal');
const Order = require('../models/Order');
const Shift = require('../models/Shift');
const Staff = require('../models/Staff');
const Supplier = require('../models/Supplier');
const SupplyBatch = require('../models/SupplyBatch');
const { addDaysString, todayString, weekdayName } = require('../utils/dates');

const models = [
  Account,
  Booking,
  Branch,
  Customer,
  Meal,
  Order,
  Shift,
  Staff,
  Supplier,
  SupplyBatch
];

async function clearProjectCollections() {
  await Promise.all(models.map((Model) => Model.deleteMany({})));
  for (const legacyCollection of [
    'booking_schedule',
    'order_items',
    'staffs',
    'supplybatches'
  ]) {
    const exists = await mongoose.connection
      .collection(legacyCollection)
      .estimatedDocumentCount()
      .catch(() => 0);
    if (exists) {
      await mongoose.connection.collection(legacyCollection).deleteMany({});
    }
  }
}

function nextOpenDate(startAt = 3, restDay) {
  let offset = startAt;
  for (let attempts = 0; attempts < 14; attempts += 1) {
    const candidate = addDaysString(todayString(), offset);
    if (weekdayName(candidate) !== restDay) {
      return candidate;
    }
    offset += 1;
  }
  throw new Error('Unable to find an open date.');
}

function orderItem(meal, quantity) {
  const unitPrice = Math.round(meal.price * 100) / 100;
  return {
    mealId: meal._id,
    mealName: meal.name,
    unitPrice,
    quantity,
    subtotal: Math.round(unitPrice * quantity * 100) / 100
  };
}

async function resetDemoData() {
  await connectDatabase();
  await clearProjectCollections();
  await Promise.all(models.map((Model) => Model.syncIndexes()));
  console.log('Cleared project collections.');

  const branches = await Branch.create([
    {
      branchNo: 1,
      name: 'Downtown Room',
      address: '123 Main Street, Downtown',
      openTime: '09:00',
      closeTime: '22:00',
      restDay: 'Monday',
      bookingSlots: [
        { startTime: '09:00', endTime: '11:00', capacity: 20 },
        { startTime: '11:00', endTime: '13:00', capacity: 24 },
        { startTime: '13:00', endTime: '15:00', capacity: 18 },
        { startTime: '15:00', endTime: '17:00', capacity: 18 },
        { startTime: '17:00', endTime: '19:00', capacity: 26 },
        { startTime: '19:00', endTime: '21:00', capacity: 28 }
      ]
    },
    {
      branchNo: 2,
      name: 'Waterfront Kitchen',
      address: '456 Ocean Drive, Waterfront',
      openTime: '10:00',
      closeTime: '23:00',
      restDay: 'Tuesday',
      isResting: true,
      bookingSlots: [
        { startTime: '10:00', endTime: '12:00', capacity: 20 },
        { startTime: '12:00', endTime: '14:00', capacity: 24 },
        { startTime: '14:00', endTime: '16:00', capacity: 16 },
        { startTime: '16:00', endTime: '18:00', capacity: 18 },
        { startTime: '18:00', endTime: '20:00', capacity: 30 },
        { startTime: '20:00', endTime: '22:00', capacity: 26 }
      ]
    },
    {
      branchNo: 3,
      name: 'Uptown Table',
      address: '789 Pine Road, Uptown',
      openTime: '08:00',
      closeTime: '21:00',
      restDay: 'Wednesday',
      bookingSlots: [
        { startTime: '08:00', endTime: '10:00', capacity: 12 },
        { startTime: '10:00', endTime: '12:00', capacity: 16 },
        { startTime: '12:00', endTime: '14:00', capacity: 20 },
        { startTime: '14:00', endTime: '16:00', capacity: 16 },
        { startTime: '16:00', endTime: '18:00', capacity: 18 },
        { startTime: '18:00', endTime: '20:00', capacity: 22 }
      ]
    },
    {
      branchNo: 4,
      name: 'Westside Terrace',
      address: '321 Maple Avenue, Westside',
      openTime: '11:00',
      closeTime: '22:00',
      restDay: 'Thursday',
      bookingSlots: [
        { startTime: '11:00', endTime: '13:00', capacity: 16 },
        { startTime: '13:00', endTime: '15:00', capacity: 16 },
        { startTime: '15:00', endTime: '17:00', capacity: 14 },
        { startTime: '17:00', endTime: '19:00', capacity: 22 },
        { startTime: '19:00', endTime: '21:00', capacity: 24 }
      ]
    }
  ]);

  const meals = await Meal.create([
    {
      mealCode: 'MEAL-001',
      name: 'Spaghetti Carbonara',
      category: 'Pasta',
      description: 'Classic Italian pasta with pancetta, egg, and pecorino cheese.',
      price: 15.99,
      isAvailable: true
    },
    {
      mealCode: 'MEAL-002',
      name: 'Margherita Pizza',
      category: 'Pizza',
      description: 'Fresh tomatoes, mozzarella cheese, and basil.',
      price: 12.5,
      isAvailable: true
    },
    {
      mealCode: 'MEAL-003',
      name: 'Caesar Salad',
      category: 'Salad',
      description: 'Crisp romaine lettuce with parmesan and Caesar dressing.',
      price: 9.99,
      isAvailable: true
    },
    {
      mealCode: 'MEAL-004',
      name: 'Tiramisu',
      category: 'Dessert',
      description: 'Traditional coffee-soaked sponge with mascarpone cream.',
      price: 7.5,
      isAvailable: true
    },
    {
      mealCode: 'MEAL-005',
      name: 'Wild Mushroom Risotto',
      category: 'Main',
      description: 'Carnaroli rice, roasted mushrooms, thyme, and parmesan.',
      price: 18.75,
      isAvailable: true
    },
    {
      mealCode: 'MEAL-006',
      name: 'Pesto Tagliatelle',
      category: 'Pasta',
      description: 'Fresh ribbons tossed with basil pesto and toasted pine nuts.',
      price: 16.5,
      isAvailable: true
    },
    {
      mealCode: 'MEAL-007',
      name: 'Burrata & Tomatoes',
      category: 'Starter',
      description: 'Creamy burrata, marinated tomatoes, olive oil, and sea salt.',
      price: 11.25,
      isAvailable: true
    },
    {
      mealCode: 'MEAL-008',
      name: 'Sparkling Blood Orange',
      category: 'Drinks',
      description: 'House blood-orange soda with rosemary and citrus.',
      price: 4.5,
      isAvailable: true
    }
  ]);

  const customers = await Customer.create([
    {
      customerCode: 'CUS-1001',
      name: 'Bob Johnson',
      phone: '+1-555-0192',
      dateOfBirth: '1990-05-20',
      isMember: true,
      vipId: 'VIP-001',
      favoriteMealIds: [meals[0]._id, meals[3]._id]
    },
    {
      customerCode: 'CUS-1002',
      name: 'Sarah Connor',
      phone: '+1-555-0198',
      dateOfBirth: '1988-02-14',
      isMember: true,
      vipId: 'VIP-002',
      favoriteMealIds: [meals[1]._id]
    }
  ]);

  const staff = await Staff.create([
    {
      staffCode: 'STF-101',
      branchNo: 1,
      name: 'Gordon Ramsay',
      roleTitle: 'chef',
      address: '45 Hill Road',
      dateOfBirth: '1966-11-08',
      salary: 8500,
      workingPeriod: 'day'
    },
    {
      staffCode: 'STF-102',
      branchNo: 1,
      name: 'Alice Smith',
      roleTitle: 'manager',
      address: '789 Park Avenue',
      dateOfBirth: '1995-04-12',
      salary: 4200,
      workingPeriod: 'night'
    },
    {
      staffCode: 'STF-103',
      branchNo: 2,
      name: 'Marco Pierre',
      roleTitle: 'chef',
      address: '12 Ocean View',
      dateOfBirth: '1970-12-11',
      salary: 8000,
      workingPeriod: 'day'
    },
    {
      staffCode: 'STF-104',
      branchNo: 3,
      name: 'Sarah Jenkins',
      roleTitle: 'waiter',
      address: '88 Pine Lane',
      dateOfBirth: '1998-09-25',
      salary: 2800,
      workingPeriod: 'night'
    },
    {
      staffCode: 'STF-900',
      branchNo: 1,
      name: 'Morgan Lee',
      roleTitle: 'administrator',
      address: '18 Market Square',
      dateOfBirth: '1985-06-22',
      salary: 0,
      workingPeriod: 'flexible'
    }
  ]);

  await Account.create([
    {
      username: 'customer1',
      password: 'Customer@123',
      role: 'customer',
      profileId: customers[0]._id
    },
    {
      username: 'customer2',
      password: 'Customer2@123',
      role: 'customer',
      profileId: customers[1]._id
    },
    {
      username: 'staff1',
      password: 'Staff@123',
      role: 'staff',
      profileId: staff[1]._id
    },
    {
      username: 'staff2',
      password: 'Staff2@123',
      role: 'staff',
      profileId: staff[2]._id
    },
    {
      username: 'admin1',
      password: 'Admin@123',
      role: 'admin',
      profileId: staff[4]._id
    }
  ]);

  const branchOne = branches[0];
  const branchTwo = branches[1];
  const firstBookingDate = nextOpenDate(3, branchOne.restDay);
  const secondBookingDate = nextOpenDate(5, branchOne.restDay);
  await Booking.create([
    {
      customer: customers[0]._id,
      branchNo: branchOne.branchNo,
      bookingDate: firstBookingDate,
      slotStart: '19:00',
      slotEnd: '21:00',
      partySize: 4,
      status: 'confirmed',
      notes: 'Window table if available.'
    },
    {
      customer: customers[1]._id,
      branchNo: branchOne.branchNo,
      bookingDate: secondBookingDate,
      slotStart: '17:00',
      slotEnd: '19:00',
      partySize: 2,
      status: 'pending'
    }
  ]);

  const carbonara = orderItem(meals[0], 2);
  const pizza = orderItem(meals[1], 1);
  await Order.create([
    {
      customer: customers[0]._id,
      branchNo: 1,
      items: [carbonara, pizza],
      totalAmount:
        Math.round((carbonara.subtotal + pizza.subtotal) * 100) / 100,
      status: 'preparing'
    },
    {
      customer: customers[1]._id,
      branchNo: 1,
      items: [orderItem(meals[4], 1), orderItem(meals[7], 2)],
      totalAmount: 27.75,
      status: 'placed'
    }
  ]);

  await Shift.create([
    {
      staff: staff[0]._id,
      branchNo: 1,
      shiftDate: nextOpenDate(1, branchOne.restDay),
      startTime: '09:00',
      endTime: '17:00'
    },
    {
      staff: staff[1]._id,
      branchNo: 1,
      shiftDate: nextOpenDate(1, branchOne.restDay),
      startTime: '15:00',
      endTime: '22:00'
    },
    {
      staff: staff[2]._id,
      branchNo: 2,
      shiftDate: nextOpenDate(2, branchTwo.restDay),
      startTime: '10:00',
      endTime: '18:00'
    }
  ]);

  const suppliers = await Supplier.create([
    {
      supplierCode: 'SUP-001',
      name: 'Organic Valley Farms',
      contactInfo: 'contact@organicvalley.example',
      description: 'Fresh vegetables, herbs, and dairy products.'
    },
    {
      supplierCode: 'SUP-002',
      name: 'Ocean Catch Seafood',
      contactInfo: 'sales@oceancatch.example',
      description: 'Daily fresh fish and seafood.'
    },
    {
      supplierCode: 'SUP-003',
      name: 'Global Spices Ltd.',
      contactInfo: 'support@globalspices.example',
      description: 'International herbs and seasonings.'
    },
    {
      supplierCode: 'SUP-004',
      name: 'Daily Bakery Supplies',
      contactInfo: 'orders@dailybakery.example',
      description: 'Bread flour, dough, and baking ingredients.'
    }
  ]);

  await SupplyBatch.create([
    {
      batchCode: 'BATCH-301',
      supplier: suppliers[0]._id,
      branchNo: 1,
      itemName: 'Fresh Tomatoes',
      receivedDate: addDaysString(todayString(), -3)
    },
    {
      batchCode: 'BATCH-302',
      supplier: suppliers[1]._id,
      branchNo: 2,
      itemName: 'Atlantic Salmon',
      receivedDate: addDaysString(todayString(), -2)
    },
    {
      batchCode: 'BATCH-303',
      supplier: suppliers[2]._id,
      branchNo: 1,
      itemName: 'Black Pepper',
      receivedDate: addDaysString(todayString(), -5)
    },
    {
      batchCode: 'BATCH-304',
      supplier: suppliers[3]._id,
      branchNo: 3,
      itemName: 'Burger Buns',
      receivedDate: addDaysString(todayString(), -1)
    }
  ]);

  console.log('Demo reset complete.');
  console.log('Accounts: customer1, customer2, staff1, staff2, admin1');
  console.log('Database restored to the pre-CRUD demo baseline.');
}

resetDemoData()
  .catch((error) => {
    console.error('Demo reset failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
