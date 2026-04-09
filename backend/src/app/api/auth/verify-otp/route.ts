import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { phone, otp } = await req.json();

    const response = await fetch(
      `https://control.msg91.com/api/v5/otp/verify?mobile=91${phone}&otp=${otp}`,
      {
        method: "GET",
        headers: {
          authkey: process.env.MSG91_AUTH_KEY!,
        },
      }
    );

    const data = await response.json();

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { message: "OTP verify failed" },
      { status: 500 }
    );
  }
}