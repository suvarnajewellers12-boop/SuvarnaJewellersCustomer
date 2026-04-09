
import { NextResponse } from "next/server";

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

    const response = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: process.env.MSG91_AUTH_KEY!,
      },
      body: JSON.stringify({
        mobile: `91${phone}`,
        template_id: process.env.MSG91_TEMPLATE_ID,
        otp_length: 6,
        otp_expiry: 5,
      }),
    });

    const data = await response.json();

    console.log("MSG91 Response:", data);

    return NextResponse.json(data, {
      status: response.status,
      headers: getCorsHeaders(origin),
    });
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
