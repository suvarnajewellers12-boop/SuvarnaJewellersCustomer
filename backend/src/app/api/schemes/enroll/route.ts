export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") || "";

  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin") || "";

    const body = await req.json();
    const { schemeId, monthlyAmount, durationMonths } = body;

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { message: "Unauthorized" },
        {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }

    const decoded: any = verifyToken(token);
    const currentUserId = decoded?.userId || decoded?.id;

    if (!currentUserId) {
      return NextResponse.json(
        { message: "Invalid token" },
        {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }

    const existing = await prisma.customerScheme.findFirst({
      where: {
        customerId: String(currentUserId),
        schemeId: schemeId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { message: "You already enrolled in this scheme" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }

    const enrollment = await prisma.customerScheme.create({
      data: {
        id: crypto.randomUUID(),
        customerId: String(currentUserId),
        schemeId: schemeId,
        startDate: new Date(),
        installmentsPaid: 1,
        totalPaid: monthlyAmount,
        remainingAmount: (monthlyAmount * durationMonths) - monthlyAmount,
        installmentsLeft: durationMonths - 1,
        isCompleted: false,
      },
      include: {
        Scheme: true,
      },
    });

    return NextResponse.json(
      enrollment,
      {
        status: 201,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  } catch (error: any) {
    console.error("Enrollment Error:", error);

    const origin = req.headers.get("origin") || "";

    return NextResponse.json(
      { message: "Failed to enroll" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  }
}