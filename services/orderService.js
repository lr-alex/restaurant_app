const Meal = require('../models/Meal');
const Order = require('../models/Order');
const Branch = require('../models/Branch');
const AppError = require('../utils/AppError');

const ORDER_STATUSES = ['placed', 'preparing', 'ready', 'completed', 'cancelled'];

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'Add at least one meal to the order.');
  }

  const quantities = new Map();
  for (const item of items) {
    const mealId = String(item.mealId || '');
    const quantity = Number(item.quantity);
    if (!/^[a-f\d]{24}$/i.test(mealId)) {
      throw new AppError(400, 'The order contains an invalid meal.');
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new AppError(400, 'Meal quantities must be between 1 and 20.');
    }
    quantities.set(mealId, Math.min((quantities.get(mealId) || 0) + quantity, 20));
  }
  return quantities;
}

async function createOrder(customerId, input) {
  const branchNo = Number(input.branchNo);
  const branch = await Branch.findOne({ branchNo, active: true });
  if (!branch) {
    throw new AppError(400, 'Select an available branch before ordering.');
  }

  const quantities = normalizeItems(input.items);
  const meals = await Meal.find({
    _id: { $in: [...quantities.keys()] },
    isAvailable: true
  });
  if (meals.length !== quantities.size) {
    throw new AppError(409, 'One or more selected meals are no longer available.');
  }

  const orderItems = meals.map((meal) => {
    const quantity = quantities.get(meal._id.toString());
    const unitPrice = Math.round(meal.price * 100) / 100;
    return {
      mealId: meal._id,
      mealName: meal.name,
      unitPrice,
      quantity,
      subtotal: Math.round(unitPrice * quantity * 100) / 100
    };
  });
  const totalAmount =
    Math.round(orderItems.reduce((sum, item) => sum + item.subtotal, 0) * 100) /
    100;

  return Order.create({
    customer: customerId,
    branchNo,
    items: orderItems,
    totalAmount,
    status: 'placed'
  });
}

async function updateOrderStatus(order, status) {
  if (!ORDER_STATUSES.includes(status)) {
    throw new AppError(400, 'Invalid order status.');
  }
  if (order.status === 'completed' && status !== 'completed') {
    throw new AppError(409, 'Completed orders cannot be reopened.');
  }
  if (order.status === 'cancelled' && status !== 'cancelled') {
    throw new AppError(409, 'Cancelled orders cannot be reopened.');
  }
  order.status = status;
  await order.save();
  return order;
}

module.exports = { ORDER_STATUSES, createOrder, updateOrderStatus };
