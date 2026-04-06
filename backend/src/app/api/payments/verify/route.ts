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
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      schemeId,
      userId 
    } = await req.json();

    // 1. Security Check
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      // 2. Database Update
      // We use updateMany because customerId + schemeId identifies the enrollment
      const result = await prisma.customerScheme.updateMany({
        where: {
          customerId: userId,
          schemeId: schemeId,
        },
        data: {
          installmentsPaid: { increment: 1 },
          // We also need to decrease installmentsLeft and increase totalPaid
          installmentsLeft: { decrement: 1 },
          totalPaid: { increment: 1000 } // Or use dynamic amount
        },
      });

      if (result.count === 0) {
        console.error("No enrollment found for User:", userId, "Scheme:", schemeId);
        return NextResponse.json({ message: "Enrollment record not found" }, { status: 404 });
      }

      return NextResponse.json({ message: "Payment verified and saved!" }, { 
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
        }
      });
    } else {
      return NextResponse.json({ message: "Invalid signature!" }, { status: 400 });
    }
  } catch (error) {
    console.error("Verification Error:", error);
    return NextResponse.json({ message: "Server Error" }, { status: 500 });
  }
}