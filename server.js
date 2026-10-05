const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const mongoose = require('mongoose');
const isMongoEnabled = !!process.env.MONGO_URI;

if (isMongoEnabled) {
  mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.error('MongoDB connection error:', err.message));
}

const users = [{ id: 'demo-user', wallet: 0 }];
const orders = [];

function getUser(userId) {
  let user = users.find((entry) => entry.id === userId);
  if (!user) {
    user = { id: userId, wallet: 0 };
    users.push(user);
  }
  return user;
}

function formatOrderRecord(payload) {
  return {
    id: payload.id,
    userId: payload.userId,
    type: payload.type,
    service: payload.service,
    amount: Number(payload.amount),
    link: payload.link || '',
    status: payload.status || 'pending',
    paymentId: payload.paymentId || '',
    orderId: payload.orderId || '',
    createdAt: payload.createdAt || new Date().toISOString()
  };
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_1234567890abcd',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_test_secret_key'
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'PHEONIX SMM API is running' });
});

app.get('/api/orders', (req, res) => {
  const { userId } = req.query;
  const filtered = userId
    ? orders.filter((order) => order.userId === userId)
    : orders;
  res.json({ success: true, orders: filtered.reverse() });
});

app.post('/api/payment/create-order', async (req, res) => {
  try {
    const { amount, userId = 'demo-user', type = 'wallet', service = 'Wallet Top-up', link = '' } = req.body;
    const numericAmount = Number(amount || 0);

    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than zero.' });
    }

    const receiptId = `rcpt_${Date.now()}`;
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(numericAmount * 100),
      currency: 'INR',
      receipt: receiptId,
      notes: {
        userId,
        type,
        service,
        link
      }
    });

    const localOrder = formatOrderRecord({
      id: `PHX-${Math.floor(100000 + Math.random() * 900000)}`,
      userId,
      type,
      service,
      amount: numericAmount,
      link,
      status: 'pending',
      orderId: razorpayOrder.id,
      createdAt: new Date().toISOString()
    });

    orders.push(localOrder);

    return res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_1234567890abcd',
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt
      },
      localOrder
    });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create Razorpay order',
      error: error.message
    });
  }
});

app.post('/api/payment/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      type,
      userId = 'demo-user',
      amount,
      service = 'Wallet Top-up',
      link = ''
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment verification details.' });
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'your_test_secret_key')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const isValid = generatedSignature === razorpay_signature;

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Payment signature validation failed.' });
    }

    const user = getUser(userId);
    const numericAmount = Number(amount || 0);

    let matchedOrder = orders.find((order) => order.orderId === razorpay_order_id);
    if (!matchedOrder) {
      matchedOrder = formatOrderRecord({
        id: `PHX-${Math.floor(100000 + Math.random() * 900000)}`,
        userId,
        type,
        service,
        amount: numericAmount,
        link,
        status: 'paid',
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        createdAt: new Date().toISOString()
      });
      orders.push(matchedOrder);
    }

    matchedOrder.paymentId = razorpay_payment_id;
    matchedOrder.status = 'paid';
    matchedOrder.type = type;
    matchedOrder.amount = numericAmount;
    matchedOrder.service = service;
    matchedOrder.link = link;

    if (type === 'wallet') {
      user.wallet = Number(user.wallet || 0) + numericAmount;
    }

    return res.json({
      success: true,
      message: 'Payment verified successfully.',
      walletBalance: Number(user.wallet || 0),
      order: matchedOrder
    });
  } catch (error) {
    console.error('Verify order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Payment verification failed.',
      error: error.message
    });
  }
});

app.get('/api/admin/orders', (req, res) => {
  res.json({ success: true, orders: orders.slice().reverse() });
});

app.patch('/api/admin/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const target = orders.find((order) => order.id === id || order.orderId === id);

  if (!target) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }

  target.status = status;
  return res.json({ success: true, order: target });
});

app.get('/api/admin/summary', (req, res) => {
  const summary = {
    totalOrders: orders.length,
    paidOrders: orders.filter((order) => order.status === 'paid' || order.status === 'processing' || order.status === 'completed').length,
    totalRevenue: orders.reduce((sum, order) => sum + Number(order.amount || 0), 0)
  };

  res.json({ success: true, summary });
});

app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/admin.html');
});

app.get('*', (req, res) => {
  if (req.path.endsWith('.html')) {
    return res.sendFile(__dirname + '/index.html');
  }
  return res.sendFile(__dirname + '/index.html');
});

app.listen(PORT, () => {
  console.log(`PHEONIX SMM server running on http://localhost:${PORT}`);
  console.log('Set your Razorpay keys in .env before live payments.');
});

module.exports = { app, orders, users };
