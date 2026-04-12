
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const allowedOrigins = [
  "https://suvarnajewellers.in",
  "https://www.suvarnajewellers.in",
];

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") || "";
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}


export async function POST(req: Request) {
  const origin = req.headers.get("origin") || "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Credentials": "true",
  };

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      schemeId,
      userId,
    } = await req.json();

    // 1. Signature Verification
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 400, headers: corsHeaders });
    }

    // 2. Fetch Scheme Details
    const scheme = await prisma.scheme.findUnique({
      where: { id: schemeId },
    });

    if (!scheme) {
      return NextResponse.json({ message: "Scheme not found" }, { status: 404, headers: corsHeaders });
    }

    // 3. ATOMIC TRANSACTION
    const result = await prisma.$transaction(async (tx) => {
      
      const existing = await tx.customerScheme.findFirst({
        where: { customerId: userId, schemeId: schemeId },
      });

      let customerSchemeRecord;

      if (existing) {
        // --- CASE: INSTALLMENT PAYMENT ---
        // Check if this is the final payment
        const isFinalPayment = existing.installmentsLeft === 1;

        customerSchemeRecord = await tx.customerScheme.update({
          where: { id: existing.id },
          data: {
            installmentsPaid: { increment: 1 },
            totalPaid: { increment: scheme.monthlyAmount },
            remainingAmount: { decrement: scheme.monthlyAmount },
            installmentsLeft: { decrement: 1 },
            isCompleted: isFinalPayment ? true : false, // Mark completed if final payment
          },
        });

      } else {
        // --- CASE: FIRST ENROLLMENT ---
        // Handle immediate completion for 1-month schemes if applicable
        const isImmediateComplete = scheme.durationMonths === 1;

        customerSchemeRecord = await tx.customerScheme.create({
          data: {
            id: crypto.randomUUID(),
            customerId: userId,
            schemeId: schemeId,
            installmentsPaid: 1,
            totalPaid: scheme.monthlyAmount,
            remainingAmount: (scheme.monthlyAmount * scheme.durationMonths) - scheme.monthlyAmount,
            installmentsLeft: scheme.durationMonths - 1,
            isCompleted: isImmediateComplete,
            couponGenerated: true, 
          },
        });

        // Generate Unique Coupon Code
        const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
        const newCouponCode = `${scheme.name.toUpperCase().replace(/\s+/g, "")}-${randomSuffix}`;

        // Create the Coupon Record (Added ID fix)
        await tx.coupon.create({
          data: {
            id: crypto.randomUUID(), // Manually providing ID
            code: newCouponCode,
            couponValue: scheme.maturityAmount,
            isUsed: false,
            isActive: true, 
            customerId: userId,
            schemeId: schemeId,
            customerSchemeId: customerSchemeRecord.id,
          },
        });

        // Push code to Scheme Audit Array
        await tx.scheme.update({
          where: { id: schemeId },
          data: {
            issuedCouponCodes: { push: newCouponCode },
          },
        });
      }

      return customerSchemeRecord;
    });

    return NextResponse.json(
      { 
        message: result.isCompleted ? "Scheme Completed! Coupon is now fully valid." : "Payment Verified", 
        data: result 
      },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Verify Error:", error);
    return NextResponse.json({ message: "Server Error" }, { status: 500, headers: corsHeaders });
  }
}