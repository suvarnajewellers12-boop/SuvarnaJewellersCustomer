export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { loginUser } from "@/services/auth.service";
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
    const { phone, password } = body;

    if (!phone || !password) {
      return NextResponse.json(
        { message: "Phone and password are required" },
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

    // Find this section in your Login POST function
const user = await loginUser(phone, password);

// Ensure we use String(user.id) to be safe
const token = generateToken({
  userId: String(user.id), 
  phone: user.phone,
});

const response = NextResponse.json({
  message: "Login successful",
  token,
  user: {
    id: String(user.id),
    name: user.name,
    phone: user.phone,
  },
  mpinExists: user.mpinExists,    // ← ADD THIS
}, {
  status: 200,
  headers: {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Credentials": "true"
  }
});

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
      { message: error.message || "Login failed" },
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