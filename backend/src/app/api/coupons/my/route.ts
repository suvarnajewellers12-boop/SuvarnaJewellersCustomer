export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

const allowedOrigins = [
  "https://suvarnajewellers.in",
  "https://www.suvarnajewellers.in",
];

function getCorsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin)
      ? origin : allowedOrigins[0],
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") || "";
  return new NextResponse(null, { status: 200, headers: getCorsHeaders(origin) });
}

export async function GET(req: Request) {
  const origin = req.headers.get("origin") || "";

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401, headers: getCorsHeaders(origin) }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const payload = verifyToken(token);

    if (!payload?.userId) {
      return NextResponse.json(
        { message: "Invalid token" },
        { status: 401, headers: getCorsHeaders(origin) }
      );
    }

    const coupons = await prisma.coupon.findMany({
      where: {
        customerId: payload.userId,
        isActive: true, // only completed schemes
      },
      include: {
        Scheme: {
          select: {
            name: true,
            monthlyAmount: true,
            durationMonths: true,
            isWeightBased: true,
          },
        },
        CustomerScheme: {
          select: {
            totalPaid: true,
            accumulatedGrams: true,
            installmentsPaid: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(
      { coupons },
      { status: 200, headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Failed to fetch coupons" },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}