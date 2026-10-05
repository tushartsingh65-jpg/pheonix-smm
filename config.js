// Configuration for PHEONIX SMM
// Replace with your actual API keys and endpoints

const CONFIG = {
  // Razorpay Configuration (Indian Payment Gateway)
  razorpay: {
    key_id: 'rzp_test_1234567890abcd', // Replace with your Razorpay Key ID
    key_secret: 'your_key_secret_here', // Server-side only - never expose this
    webhook_secret: 'your_webhook_secret'
  },

  // API Endpoints
  api: {
    baseUrl: 'http://localhost:3000/api', // Change to your backend URL
    endpoints: {
      wallet: '/wallet',
      orders: '/orders',
      payment: '/payment',
      admin: '/admin'
    }
  },

  // Backend Configuration (for Node.js/Express server)
  backend: {
    port: 3000,
    mongoUri: 'mongodb://localhost:27017/pheonix-smm', // MongoDB connection
    jwtSecret: 'your_jwt_secret_key_change_this',
    nodeEnv: 'development'
  }
};

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} else {
  window.CONFIG = CONFIG;
}
