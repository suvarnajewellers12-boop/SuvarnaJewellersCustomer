import { NextResponse } from "next/server";
import Razorpay from "razorpay";

// Initialize Razorpay with your keys from the .env file
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: Request) {
  try {
    // 1. Get the amount from the frontend (e.g., 1000)
    const { amount, currency = "INR" } = await req.json();

    // 2. Razorpay expects amounts in PAISE (1 Rupee = 100 Paise)
    // So we multiply the amount by 100
    const options = {
      amount: amount * 100, 
      currency,
      receipt: `receipt_${Date.now()}`, // A unique ID for your records
    };

    // 3. Ask Razorpay to create the order
    const order = await razorpay.orders.create(options);

    // 4. Send the order details back to the frontend
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error: any) {
    console.error("Razorpay Order Error:", error);
    return NextResponse.json({ message: "Could not create order" }, { status: 500 });
  }
}