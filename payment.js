const API_BASE = 'http://localhost:3000/api';

async function createPaymentOrder(amount, type = 'wallet', service = 'Wallet Top-up', link = '') {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Please login to proceed with payment');
    }

    const response = await fetch(`${API_BASE}/payment/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        amount,
        type,
        service,
        link
      })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to create payment order');
    }

    return data;
  } catch (error) {
    console.error('Create order error:', error);
    throw error;
  }
}

async function verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature, amount, type = 'wallet', service = 'Wallet Top-up', link = '') {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required for payment verification');
    }

    const response = await fetch(`${API_BASE}/payment/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        type,
        amount,
        service,
        link
      })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Payment verification failed');
    }

    return data;
  } catch (error) {
    console.error('Verify payment error:', error);
    throw error;
  }
}

function openRazorpayCheckout({ amount, service, type = 'wallet', metadata = {} }) {
  return new Promise(async (resolve, reject) => {
    try {
      const orderData = await createPaymentOrder(amount, type, service, metadata.link || '');
      const user = getUser();

      const options = {
        key: orderData.key,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'PHEONIX SMM',
        description: service,
        order_id: orderData.order.id,
        prefill: {
          email: user?.email || 'customer@example.com',
          contact: '+91 98333 08800'
        },
        handler: async function (response) {
          try {
            const verified = await verifyPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature,
              amount,
              type,
              service,
              metadata.link || ''
            );

            // Update local user state after successful payment
            if (currentUser) {
              currentUser.wallet = verified.walletBalance || currentUser.wallet;
            }

            resolve({ success: true, data: verified });
          } catch (error) {
            reject(error);
          }
        },
        theme: {
          color: '#ff5500'
        },
        modal: {
          ondismiss: function () {
            reject(new Error('Payment cancelled by user'));
          }
        }
      };

      const rzp = new Razorpay(options);
      rzp.open();
    } catch (error) {
      reject(error);
    }
  });
}
