export interface Customer {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
}

export interface SendOtpResponse {
  message: string;
}

export interface VerifyOtpResponse {
  customer: Customer;
  isNewCustomer: boolean;
}

export interface CheckoutResponse {
  type: 'free' | 'paid';
  razorpay_order_id?: string;
  booking?: any;
}

export interface ConfirmBookingPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  guests: number;
  customer_name?: string;
}
