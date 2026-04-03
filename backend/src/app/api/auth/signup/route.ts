export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { signupUser } from "@/services/auth.service";
import { generateToken } from "@/lib/jwt";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { name, phone, password } = body;

    if (!name || !phone || !password) {
      return NextResponse.json(
        { message: "All fields are required" },
        { status: 400 }
      );
    }

    const user = await signupUser(name, phone, password);

    const token = generateToken({
      userId: user.id,
      phone: user.phone,
    });

    const response = NextResponse.json(
      {
        message: "Signup successful",
        user,
      },
      { status: 201 }
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
      {
        message: error.message || "Signup failed",
      },
      { status: 400 }
    );
  }
}