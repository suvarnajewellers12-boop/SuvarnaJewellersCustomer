import { NextResponse } from "next/server";

const allowedOrigins = [
  "https://suvarnajewellers.in",
  "https://www.suvarnajewellers.in",
];

export async function POST(req: Request) {
  const origin = req.headers.get("origin") || "";

  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json(
        { message: "Phone required" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": allowedOrigins.includes(origin)
              ? origin
              : allowedOrigins[0],
            "Access-Control-Allow-Credentials": "true",
          },
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
      }),
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigins.includes(origin)
          ? origin
          : allowedOrigins[0],
        "Access-Control-Allow-Credentials": "true",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "OTP send failed" },
      { status: 500 }
    );
  }
}