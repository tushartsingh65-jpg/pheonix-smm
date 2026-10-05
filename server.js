const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Order = require('./models/Order');
const authRoutes = require('./routes/auth');
const { requireAuth, requireAdmin } = require('./middleware/auth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch((error) => console.error('MongoDB connect failed:', error.message));
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_1234567890abcd',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_test_secret_key'
});

const memoryUsers = [
  {
    id: 'demo-admin',
    name: 'Admin',
    email: 'admin@pheonixsmm.com',
    passwordHash: bcrypt.hashSync('admin123', 10),
    wallet: 0,
    role: 'admin'
  }
];

const memoryOrders = [];

async function ensureAdminUser() {
  if (mongoose.connection.readyState === 1) {
    const adminExists = await User.findOne({ email: 'admin@pheonixsmm.com' });
    if (!adminExists) {
      const hash = bcrypt.hashSync('admin123', 10);
      await User.create({
        name: 'Admin',
        email: 'admin@pheonixsmm.com',
        passwordHash: hash,
        role: 'admin',
        wallet: 0
      });
      console.log('Created default admin user: admin@pheonixsmm.com / admin123');
    }
  }
}

function ensureAdminFallback() {
  if (!memoryUsers.some((u) => u.email === 'admin@pheonixsmm.com')) {
    memoryUsers.push({
      id: 'demo-admin',
      name: 'Admin',
      email: 'admin@pheonixsmm.com',
      passwordHash: bcrypt.hashSync('admin123', 10),
      wallet: 0,
      role: 'admin'
    });
  }
}

app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', message: 'PHEONIX SMM API is running' });
});

app.post('/api/payment/create-order', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, type = 'wallet', service = 'Wallet Top-up', link = '' } = req.body || {};
    const numericAmount = Number(amount || 0);

    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than zero.' });
    }

    const receiptId = `PHX-${Date.now()}`;
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(numericAmount * 100),
      currency: 'INR',
      receipt: receiptId,
      notes: { userId, type, service, link }
    });

    const orderCode = `PHX-${Math.floor(100000 + Math.random() * 900000)}`;

    if (mongoose.connection.readyState === 1) {
      const order = await Order.create({
        userId,
        orderId: orderCode,
        paymentId: '',
        service,
        amount: numericAmount,
        link,
        status: 'pending',
        type,
        quantity: 0
      });

      return res.json({
        success: true,
        key: process.env.RAZORPAY_KEY_ID || 'rzp_test_1234567890abcd',
        order: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          receipt: razorpayOrder.receipt
        },
        localOrder: order
      });
    }

    const localOrder = {
      id: orderCode,
      userId,
      orderId: razorpayOrder.id,
      paymentId: '',
      service,
      amount: numericAmount,
      link,
      status: 'pending',
      type,
      quantity: 0,
      createdAt: new Date().toISOString()
    };

    memoryOrders.push(localOrder);

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
    return res.status(500).json({ success: false, message: error.message || 'Failed to create payment order.' });
  }
});

app.post('/api/payment/verify', requireAuth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, type = 'wallet', service = 'Wallet Top-up', link = '' } = req.body || {};
    const userId = req.user.id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing Razorpay verification values.' });
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'your_test_secret_key')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment signature verification failed.' });
    }

    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

      const orderCode = `PHX-${Math.floor(100000 + Math.random() * 900000)}`;
      const order = await Order.create({
        userId,
        orderId: orderCode,
        paymentId: razorpay_payment_id,
        service,
        amount: Number(amount || 0),
        link,
        status: 'paid',
        type,
        quantity: 0
      });

      if (type === 'wallet') {
        user.wallet = Number(user.wallet || 0) + Number(amount || 0);
        await user.save();
      }

      return res.json({
        success: true,
        message: 'Payment verified successfully.',
        walletBalance: user.wallet,
        order
      });
    }

    const user = memoryUsers.find((u) => u.id === userId) || memoryUsers[0];
    if (type === 'wallet') {
      user.wallet = Number(user.wallet || 0) + Number(amount || 0);
    }

    const order = {
      id: `PHX-${Math.floor(100000 + Math.random() * 900000)}`,
      userId,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      service,
      amount: Number(amount || 0),
      link,
      status: 'paid',
      type,
      quantity: 0,
      createdAt: new Date().toISOString()
    };

    memoryOrders.push(order);

    return res.json({
      success: true,
      message: 'Payment verified successfully.',
      walletBalance: user.wallet,
      order
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Verification failed.' });
  }
});

app.get('/api/admin/orders', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const orders = await Order.find().sort({ createdAt: -1 }).lean();
      return res.json({ success: true, orders });
    }

    return res.json({ success: true, orders: memoryOrders.slice().reverse() });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Unable to fetch orders.' });
  }
});

app.get('/api/admin/summary', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const orders = await Order.find();
      const totalRevenue = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
      return res.json({
        success: true,
        summary: {
          totalOrders: orders.length,
          paidOrders: orders.filter((o) => ['paid', 'processing', 'completed'].includes(o.status)).length,
          totalRevenue
        }
      });
    }

    const totalRevenue = memoryOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
    return res.json({
      success: true,
      summary: {
        totalOrders: memoryOrders.length,
        paidOrders: memoryOrders.filter((o) => ['paid', 'processing', 'completed'].includes(o.status)).length,
        totalRevenue
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Unable to load summary.' });
  }
});

app.patch('/api/admin/orders/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (mongoose.connection.readyState === 1) {
      const order = await Order.findOne({ orderId: id }).orFail();
      order.status = status;
      await order.save();
      return res.json({ success: true, order });
    }

    const order = memoryOrders.find((entry) => entry.id === id || entry.orderId === id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    order.status = status;
    return res.json({ success: true, order });
  } catch (error) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/admin.html');
});

app.get('*', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

async function bootstrap() {
  ensureAdminFallback();
  if (mongoose.connection.readyState === 1) {
    await ensureAdminUser();
  }
}

bootstrap();

app.listen(PORT, () => {
  console.log(`PHEONIX SMM server running on http://localhost:${PORT}`);
  console.log('Use admin@pheonixsmm.com / admin123 to access the admin dashboard.');
});

module.exports = { app, memoryUsers, memoryOrders };
