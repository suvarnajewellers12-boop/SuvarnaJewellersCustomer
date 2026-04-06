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
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, schemeId, userId } = await req.json();

    // 1. Security Check: HMAC SHA256 Signature Verification
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 400 });
    }

    // 2. Database Action: Check if Enrollment exists
    const existingEnrollment = await prisma.customerScheme.findFirst({
      where: { 
        customerId: userId, 
        schemeId: schemeId 
      }
    });

    if (existingEnrollment) {
      // IF ENROLLED: Update existing record (Monthly Installment)
      await prisma.customerScheme.update({
        where: { id: existingEnrollment.id },
        data: {
          installmentsPaid: { increment: 1 },
          installmentsLeft: { decrement: 1 },
          totalPaid: { increment: 1000 }, // Change to dynamic amount if needed
        },
      });
    } else {
      // IF NOT ENROLLED: Create NEW record (First Enrollment)
      await prisma.customerScheme.create({
        data: {
          id: crypto.randomUUID(),
          customerId: userId,
          schemeId: schemeId,
          startDate: new Date(),
          installmentsPaid: 1,
          totalPaid: 1000,
          remainingAmount: 10000, // Replace with your scheme logic
          installmentsLeft: 10,   // Replace with your scheme logic
          isCompleted: false,
        }
      });
    }

    return NextResponse.json({ message: "Success!" }, { 
      status: 200,
      headers: { 
        "Access-Control-Allow-Origin": origin, 
        "Access-Control-Allow-Credentials": "true" 
      }
    });

  } catch (error) {
    console.error("Critical Verify Error:", error);
    return NextResponse.json({ message: "Server Error" }, { status: 500 });
  }
}