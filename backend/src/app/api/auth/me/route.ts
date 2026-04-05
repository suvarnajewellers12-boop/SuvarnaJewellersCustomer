export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";

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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function GET(req: Request) {
  const origin = req.headers.get("origin") || "";

  try {
    // --- RESTORED LOGIC: CHECK BOTH HEADER AND COOKIE ---
    const authHeader = req.headers.get("Authorization");
// We use '|| null' at the end to ensure it's never 'undefined'
let token: string | null = (authHeader && authHeader.startsWith("Bearer ")) 
  ? authHeader.split(" ")[1] 
  : null;

if (!token) {
  const cookieStore = await cookies();
  // We add '|| null' here to fix the red squiggle!
  token = cookieStore.get("token")?.value || null; 
}

    if (!token) {
      return NextResponse.json(
        { user: null },
        {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": allowedOrigins.includes(origin)
              ? origin
              : allowedOrigins[0],
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }

    const decoded: any = verifyToken(token);

    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { user: null },
        {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": allowedOrigins.includes(origin)
              ? origin
              : allowedOrigins[0],
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }

    const user = await prisma.customer.findUnique({
      where: { id: decoded.userId.toString() },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { user: null },
        {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": allowedOrigins.includes(origin)
              ? origin
              : allowedOrigins[0],
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }

    return NextResponse.json(
      { user },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigins.includes(origin)
            ? origin
            : allowedOrigins[0],
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  } catch (error) {
    console.error("Session Verification Error:", error);

    return NextResponse.json(
      { user: null },
      {
        status: 200,
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