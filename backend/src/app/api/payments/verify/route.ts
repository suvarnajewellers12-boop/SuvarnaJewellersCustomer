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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, schemeId, userId } = await req.json();

    // 1. Signature Verification
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 400, headers: corsHeaders });
    }

    // 2. SMART LOGIC: Find existing enrollment
  
const existing = await prisma.customerScheme.findFirst({
  where: {
    customerId: userId,
    schemeId: schemeId,
  },
});

const scheme = await prisma.scheme.findUnique({
  where: { id: schemeId },
});

if (!scheme) {
  return NextResponse.json(
    { message: "Scheme not found" },
    { status: 404, headers: corsHeaders }
  );
}

if (existing) {
  await prisma.customerScheme.update({
    where: { id: existing.id },
    data: {
      installmentsPaid: { increment: 1 },
      totalPaid: { increment: scheme.monthlyAmount },
      remainingAmount: { decrement: scheme.monthlyAmount },
      installmentsLeft: { decrement: 1 },
    },
  });
} else {
  await prisma.customerScheme.create({
    data: {
      id: crypto.randomUUID(),
      customerId: userId,
      schemeId: schemeId,
      installmentsPaid: 1,
      totalPaid: scheme.monthlyAmount,
      remainingAmount:
        scheme.monthlyAmount * scheme.durationMonths - scheme.monthlyAmount,
      installmentsLeft: scheme.durationMonths - 1,
      isCompleted: false,
    },
  });
}


    if (existing) {
      // If already enrolled, just INCREMENT (Fixes the double-show issue!)
      await prisma.customerScheme.update({
        where: { id: existing.id },
        data: {
          installmentsPaid: { increment: 1 },
          totalPaid: { increment: 1000 },
          installmentsLeft: { decrement: 1 },
        },
      });
    } else {
      // Only CREATE if it's truly the first time
      await prisma.customerScheme.create({
        data: {
          id: crypto.randomUUID(),
          customerId: userId,
          schemeId: schemeId,
          installmentsPaid: 1,
          totalPaid: 1000,
          remainingAmount: 10000,
          installmentsLeft: 10,
          isCompleted: false,
        }
      });
    }

    return NextResponse.json({ message: "Success" }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("Verify Error:", error);
    return NextResponse.json({ message: "Server Error" }, { status: 500, headers: corsHeaders });
  }
}