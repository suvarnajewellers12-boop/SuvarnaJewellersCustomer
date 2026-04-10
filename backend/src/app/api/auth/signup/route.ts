import { prisma } from "@/lib/prisma";
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { signupUser } from "@/services/auth.service";
import { generateToken } from "@/lib/jwt";

const allowedOrigins = [
  "https://suvarnajewellers.in",
  "https://www.suvarnajewellers.in",
];

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") || "";

  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigins.includes(origin)
        ? origin
        : allowedOrigins[0],
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin") || "";

  try {
    const body = await req.json();
    const { name, phone, password } = body;

    if (!name || !phone || !password) {
      return NextResponse.json(
        { message: "All fields are required" },
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
    const verifiedOtp = await prisma.otpVerification.findFirst({
  where: {
    phoneNumber: phone,
    purpose: "signup",
    isUsed: true,
  },
  orderBy: {
    createdAt: "desc",
  },
});

if (!verifiedOtp) {
  return NextResponse.json(
    { message: "OTP verification required" },
    { status: 400 }
  );
}
    const user = await signupUser(name, phone, password);
await prisma.otpVerification.deleteMany({
  where: {
  phoneNumber: phone,
  purpose: "signup",
  isUsed: true,
  expiresAt: {
    gt: new Date(),
  },
  },
});
    const token = generateToken({
      userId: user.id,
      phone: user.phone,
    });

const response = NextResponse.json(
  {
    message: "Signup successful",
    token,
    user,
  },
  {
    status: 201,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigins.includes(origin)
        ? origin
        : allowedOrigins[0],
      "Access-Control-Allow-Credentials": "true",
    },
  }
);


    response.cookies.set("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        message: error.message || "Signup failed",
      },
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
}