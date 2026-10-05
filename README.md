# PHEONIX SMM - Social Media Marketing Platform

A production-ready SaaS platform for social media marketing services with real UPI payment integration via Razorpay.

## Features

- User authentication with JWT
- Wallet-based order system
- Real UPI payments via Razorpay
- Admin order management dashboard
- MongoDB for data persistence
- Secure payment verification
- Order tracking

## Setup

### Prerequisites

- Node.js 14+
- MongoDB Atlas account
- Razorpay business account
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repo-url>
cd pheonix-smm
```

2. Install dependencies
```bash
npm install
```

3. Create `.env` file
```bash
cp .env.example .env
```

4. Fill in your environment variables
```
MONGO_URI=your_mongodb_connection_string
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
JWT_SECRET=your_jwt_secret_key
```

5. Start the server
```bash
npm start
```

The app will run on `http://localhost:3000`

## Default Admin Account

- Email: orphictushar@gmail.com
- Password: admin123
- Phone: +91 98333 08800

> ⚠️ Change these credentials immediately in production!

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires token)

### Payments
- `POST /api/payment/create-order` - Create Razorpay order (requires token)
- `POST /api/payment/verify` - Verify payment signature (requires token)

### Admin (requires admin role)
- `GET /api/admin/orders` - List all orders
- `GET /api/admin/summary` - Get order statistics
- `PATCH /api/admin/orders/:id/status` - Update order status

## Production Deployment

### Environment Variables (Required for Production)

- Set `NODE_ENV=production`
- Use live Razorpay keys (not test keys)
- Use a strong JWT_SECRET
- Use HTTPS only
- Set secure MONGO_URI to production database

### Recommended Deployment Platforms

- Backend: Render, Railway, or Heroku
- Database: MongoDB Atlas
- Frontend: Vercel or Netlify

## Security Notes

⚠️ **Critical Security Rules:**

1. Never expose `RAZORPAY_KEY_SECRET` in browser code
2. Never trust wallet balance from browser - always verify on server
3. Payment signature verification must happen on backend
4. Use HTTPS in production
5. Set secure JWT_SECRET (min 32 characters)
6. Rotate admin credentials regularly
7. Use environment variables for all secrets

## Architecture

```
Frontend (HTML/JS)
        ↓
    Razorpay Checkout
        ↓
    Backend (Express + Node.js)
        ↓
    Payment Verification
        ↓
    MongoDB (User & Order data)
```

## Support

Email: orphictushar@gmail.com
Phone: +91 98333 08800

## License

MIT
