
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

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
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json(
        { message: "Phone required" },
        {
          status: 400,
          headers: getCorsHeaders(origin),
        }
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.otpVerification.deleteMany({
      where: {
        phoneNumber: phone,
        purpose: "signup",
      },
    });

    await prisma.otpVerification.create({
      data: {
        id: crypto.randomUUID(),
        phoneNumber: phone,
        otpCode: otp,
        purpose: "signup",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const response = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: process.env.MSG91_AUTH_KEY!,
      },
      body: JSON.stringify({
        template_id: process.env.MSG91_TEMPLATE_ID,
        short_url: "0",
        recipients: [
          {
            mobiles: `91${phone}`,
            OTP: otp,
          },
        ],
      }),
    });

    const data = await response.json();

    console.log("Generated OTP:", otp);
    console.log("MSG91 FLOW Response:", data);

    return NextResponse.json(
      {
        message: "OTP sent successfully",
      },
      {
        status: 200,
        headers: getCorsHeaders(origin),
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        message: error.message || "OTP send failed",
      },
      {
        status: 500,
        headers: getCorsHeaders(origin),
      }
    );
  }
}
