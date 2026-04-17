export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { verifyToken } from "@/lib/jwt";

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") || "";
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin") || "";

  try {
    const body = await req.json();
    const { schemeId } = body;

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: corsHeaders(origin) });
    }

    const decoded: any = verifyToken(token);
    const currentUserId = decoded?.userId || decoded?.id;

    if (!currentUserId) {
      return NextResponse.json({ message: "Invalid token" }, { status: 401, headers: corsHeaders(origin) });
    }

    // 1. Fetch Scheme & Existing Enrollment
    const [scheme, existingEnrollment] = await Promise.all([
      prisma.scheme.findUnique({
        where: { id: schemeId },
      }),
      prisma.customerScheme.findFirst({
        where: { customerId: currentUserId, schemeId },
        include: { coupon: true } // Ensure lowercase matches your schema
      }),
    ]);

    if (!scheme) {
      return NextResponse.json({ message: "Scheme not found" }, { status: 404, headers: corsHeaders(origin) });
    }

    // 2. Lifecycle Checks
    if (existingEnrollment) {
      if (existingEnrollment.isCompleted) {
        return NextResponse.json({ message: "Lifecycle Conflict: Scheme already completed." }, { status: 400, headers: corsHeaders(origin) });
      }
      if (existingEnrollment.installmentsLeft <= 0) {
        return NextResponse.json({ message: "No installments remaining." }, { status: 400, headers: corsHeaders(origin) });
      }
    }

    // 3. Category-B Logic: Fetch Live Rate and Calculate Grams
    let liveRate = 0;
    let gramsEarned = 0;

    if (scheme.isWeightBased) {
      try {
        const rateRes = await fetch("https://suvarnagold-16e5.vercel.app/api/rates", { cache: 'no-store' });
        const rateData = await rateRes.json();
        
        // Strip symbols like ₹ or , and parse
        const rateString = rateData.gold24.replace(/[^0-9.]/g, "");
        liveRate = parseFloat(rateString);

        if (isNaN(liveRate) || liveRate <= 0) {
          throw new Error("Invalid gold rate received from API");
        }
        
        // Logic: Installment Amount / Current 24K Rate
        gramsEarned = scheme.monthlyAmount / liveRate;
      } catch (err) {
        console.error("Gold Rate Error:", err);
        return NextResponse.json({ message: "Gold Rate Service Unavailable" }, { status: 500, headers: corsHeaders(origin) });
      }
    }

    // 4. Atomic Database Transaction
    const result = await prisma.$transaction(async (tx) => {
      
      // CASE A: PROCESS SUBSEQUENT INSTALLMENT
      if (existingEnrollment) {
        const isLastPayment = existingEnrollment.installmentsLeft === 1;

        const updatedEnrollment = await tx.customerScheme.update({
          where: { id: existingEnrollment.id },
          data: {
            totalPaid: { increment: scheme.monthlyAmount },
            installmentsPaid: { increment: 1 },
            installmentsLeft: { decrement: 1 },
            accumulatedGrams: { increment: gramsEarned },
            remainingAmount: { decrement: scheme.monthlyAmount },
            isCompleted: isLastPayment,
          },
          include: { coupon: true }
        });

        // Update Coupon Logic
        await tx.coupon.update({
          where: { customerSchemeId: existingEnrollment.id },
          data: {
            totalWeightGrams: { increment: gramsEarned },
            isActive: isLastPayment,
          },
        });

        // Audit Log
        await tx.paymentHistory.create({
          data: {
            id: crypto.randomUUID(),
            customerSchemeId: existingEnrollment.id,
            amountPaid: scheme.monthlyAmount,
            liveRate24K: liveRate || null,
            gramsAdded: gramsEarned || null,
          },
        });

        return { type: "INSTALLMENT_PROCESSED", data: updatedEnrollment };
      }

      // CASE B: NEW ENROLLMENT (STARTING FIRST MONTH)
      const customerScheme = await tx.customerScheme.create({
        data: {
          id: crypto.randomUUID(),
          customerId: currentUserId,
          schemeId,
          totalPaid: scheme.monthlyAmount,
          remainingAmount: (scheme.durationMonths - 1) * scheme.monthlyAmount,
          installmentsPaid: 1,
          installmentsLeft: scheme.durationMonths - 1,
          accumulatedGrams: gramsEarned,
          isCompleted: false,
        },
      });

      // Generate Coupon Code (SUV-W- or SUV-V-)
      const uniqueSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
      const generatedCode = `SUV-${scheme.isWeightBased ? 'W' : 'V'}-${uniqueSuffix}`;

      const coupon = await tx.coupon.create({
        data: {
          id: crypto.randomUUID(),
          code: generatedCode,
          customerId: currentUserId,
          schemeId,
          customerSchemeId: customerScheme.id,
          // Cat-A: Full Bonus Value Calculation
          totalCashValue: !scheme.isWeightBased 
            ? (scheme.durationMonths + (scheme.maturityMonths || 0)) * scheme.monthlyAmount 
            : 0,
          totalWeightGrams: gramsEarned,
          isActive: false,
        },
      });

      await tx.paymentHistory.create({
        data: {
          id: crypto.randomUUID(),
          customerSchemeId: customerScheme.id,
          amountPaid: scheme.monthlyAmount,
          liveRate24K: liveRate || null,
          gramsAdded: gramsEarned || null,
        },
      });

      return { type: "NEW_ENROLLMENT_STARTED", data: { ...customerScheme, coupon } };
    });

    // 5. Success Response
    return NextResponse.json(
      {
        status: "Success",
        action: result.type,
        summary: {
          transactionGrams: gramsEarned.toFixed(4),
          marketRateUsed: liveRate,
          totalVaultBalance: result.data.accumulatedGrams.toFixed(4),
          installmentsLeft: result.data.installmentsLeft,
        },
        enrollment: result.data,
      },
      { status: 200, headers: corsHeaders(origin) }
    );

  } catch (error: any) {
    console.error("Final Processing Error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500, headers: corsHeaders(origin) });
  }
}