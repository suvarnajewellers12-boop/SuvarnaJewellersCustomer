export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { loginUser } from "@/services/auth.service";
import { generateToken } from "@/lib/jwt";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, password } = body;

    if (!phone || !password) {
      return NextResponse.json(
        { message: "Phone and password are required" },
        { status: 400 }
      );
    }

    const user = await loginUser(phone, password);

    // Create the token
    const token = generateToken({
      userId: user.id,
      phone: user.phone,
    });

    const response = NextResponse.json(
      {
        message: "Login successful",
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
        },
      },
      { status: 200 }
    );

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Login failed" },
      { status: 400 }
    );
  }
}