export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { verifyToken } from "@/lib/jwt";

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") || "";
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": origin,
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
    const { schemeId } = body;

    // 1. Token Verification
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { 
        status: 401, 
        headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" } 
      });
    }

    const decoded: any = verifyToken(token);
    const currentUserId = decoded?.userId || decoded?.id;

    if (!currentUserId) {
      return NextResponse.json({ message: "Invalid token" }, { 
        status: 401, 
        headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" } 
      });
    }

    // 2. Fetch Scheme Template
    const scheme = await prisma.scheme.findUnique({
      where: { id: schemeId },
    });

    if (!scheme) {
      return NextResponse.json({ message: "Scheme not found" }, { 
        status: 404, 
        headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" } 
      });
    }

    // 3. ATOMIC TRANSACTION: Enrollment + Coupon Generation
    const enrollmentResult = await prisma.$transaction(async (tx) => {
      
      // A. Create the Customer enrollment tracking
      const customerScheme = await tx.customerScheme.create({
        data: {
          customerId: currentUserId,
          schemeId: schemeId,
          totalPaid: 0,
          remainingAmount: scheme.durationMonths * scheme.monthlyAmount,
          installmentsPaid: 0,
          installmentsLeft: scheme.durationMonths,
          isCompleted: false,
          couponGenerated: true,
        },
      });

      // B. Generate a unique Coupon Code
      // Format: SCHEME_NAME-RANDOM_HEX (e.g., GOLD-A1B2C3)
      const uniqueSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
      const generatedCode = `${scheme.name.toUpperCase().replace(/\s+/g, "")}-${uniqueSuffix}`;

      // C. Create the Coupon record
      const coupon = await tx.coupon.create({
        data: {
          code: generatedCode,
          couponValue: scheme.maturityAmount,
          isUsed: false,
          isActive: true, // Activated because a user now owns it
          customerId: currentUserId,
          schemeId: schemeId,
          customerSchemeId: customerScheme.id,
        },
      });

      // D. Update the parent Scheme's audit array
      await tx.scheme.update({
        where: { id: schemeId },
        data: {
          issuedCouponCodes: {
            push: generatedCode,
          },
        },
      });

      return { customerScheme, coupon };
    });

    // 4. Final Success Response
    return NextResponse.json(
      {
        message: "Enrollment successful",
        enrollmentId: enrollmentResult.customerScheme.id,
        couponCode: enrollmentResult.coupon.code,
        maturityAmount: enrollmentResult.coupon.couponValue,
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );

  } catch (error: any) {
    console.error("Enrollment error:", error);
    return NextResponse.json(
      { message: "Failed to enroll. Please try again later." },
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
