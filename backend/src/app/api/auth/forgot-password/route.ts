export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/bcrypt";

const allowedOrigins = [
  "https://suvarnajewellers.in",
  "https://www.suvarnajewellers.in",
];

function getCorsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0],
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") || "";
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin") || "";

  try {
    const { phone, otp, newPassword } = await req.json();

    if (!phone || !otp || !newPassword) {
      return NextResponse.json(
        { message: "Phone, OTP and new password are required" },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { message: "Password must be at least 6 characters" },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // 1. Verify the OTP is valid and was verified
    const record = await prisma.otpVerification.findFirst({
      where: {
        phoneNumber: phone,
        otpCode: otp,
        purpose: "forgot_password",
        isUsed: true,   // must already be verified
      },
    });

    if (!record) {
      return NextResponse.json(
        { message: "OTP not verified. Please verify OTP first." },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // 2. Check OTP wasn't verified too long ago (10 min window)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (!record.verifiedAt || record.verifiedAt < tenMinutesAgo) {
      return NextResponse.json(
        { message: "Session expired. Please start again." },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // 3. Hash new password
    const hashed = await hashPassword(newPassword);

    // 4. Update customer password
    const updated = await prisma.customer.updateMany({
      where: { phone },
      data: { password: hashed },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { message: "Account not found" },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    // 5. Clean up OTP record
    await prisma.otpVerification.deleteMany({
      where: {
        phoneNumber: phone,
        purpose: "forgot_password",
      },
    });

    return NextResponse.json(
      { message: "Password reset successful" },
      { status: 200, headers: getCorsHeaders(origin) }
    );

  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Password reset failed" },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}