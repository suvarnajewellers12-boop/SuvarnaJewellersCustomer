
import { NextResponse } from "next/server";
import { otpStore } from "../send-otp/route";

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
    const { phone, otp } = await req.json();

    if (!phone || !otp) {
      return NextResponse.json(
        { message: "Phone and OTP required" },
        {
          status: 400,
          headers: getCorsHeaders(origin),
        }
      );
    }

    const savedOtp = otpStore.get(phone);

    if (savedOtp !== otp) {
      return NextResponse.json(
        { type: "error", message: "Invalid OTP" },
        {
          status: 400,
          headers: getCorsHeaders(origin),
        }
      );
    }

    otpStore.delete(phone);

    return NextResponse.json(
      {
        type: "success",
      },
      {
        status: 200,
        headers: getCorsHeaders(origin),
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        message: error.message || "OTP verify failed",
      },
      {
        status: 500,
        headers: getCorsHeaders(origin),
      }
    );
  }
}
