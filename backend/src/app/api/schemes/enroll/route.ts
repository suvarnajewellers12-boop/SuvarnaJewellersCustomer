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
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    const decoded: any = verifyToken(token);
    const currentUserId = decoded?.userId || decoded?.id;

    if (!currentUserId) {
      return NextResponse.json(
        { message: "Invalid token" },
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    const [scheme, existingEnrollment] = await Promise.all([
      prisma.scheme.findUnique({
        where: { id: schemeId },
      }),
      prisma.customerScheme.findFirst({
        where: {
          customerId: currentUserId,
          schemeId,
        },
        include: {
          coupon: true,
        },
      }),
    ]);

    if (!scheme) {
      return NextResponse.json(
        { message: "Scheme not found" },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    if (existingEnrollment) {
      if (existingEnrollment.isCompleted) {
        return NextResponse.json(
          { message: "Lifecycle Conflict: You already completed this scheme." },
          { status: 400, headers: corsHeaders(origin) }
        );
      }

      if (existingEnrollment.installmentsLeft <= 0) {
        return NextResponse.json(
          { message: "All installments already paid." },
          { status: 400, headers: corsHeaders(origin) }
        );
      }
    }

    let liveRate = 0;
    let gramsEarned = 0;

    if (scheme.isWeightBased) {
      const rateRes = await fetch("https://suvarnagold-16e5.vercel.app/api/rates");
      const rateData = await rateRes.json();

      liveRate = parseFloat(rateData.gold24.replace(/[^\d.]/g, ""));
      gramsEarned = scheme.monthlyAmount / liveRate;
    }

    const result = await prisma.$transaction(async (tx) => {
      if (existingEnrollment) {
        const isLastPayment = existingEnrollment.installmentsLeft === 1;

        const updatedEnrollment = await tx.customerScheme.update({
          where: {
            id: existingEnrollment.id,
          },
          data: {
            totalPaid: {
              increment: scheme.monthlyAmount,
            },
            installmentsPaid: {
              increment: 1,
            },
            installmentsLeft: {
              decrement: 1,
            },
            accumulatedGrams: {
              increment: gramsEarned,
            },
            remainingAmount: {
              decrement: scheme.monthlyAmount,
            },
            isCompleted: isLastPayment,
          },
        });

        await tx.coupon.update({
          where: {
            customerSchemeId: existingEnrollment.id,
          },
          data: {
            totalWeightGrams: {
              increment: gramsEarned,
            },
            isActive: isLastPayment,
          },
        });

        await tx.paymentHistory.create({
          data: {
            id: crypto.randomUUID(),
            customerSchemeId: existingEnrollment.id,
            amountPaid: scheme.monthlyAmount,
            liveRate24K: scheme.isWeightBased ? liveRate : null,
            gramsAdded: scheme.isWeightBased ? gramsEarned : null,
          },
        });

        return {
          type: "INSTALLMENT_PROCESSED",
          data: updatedEnrollment,
        };
      }

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

      const uniqueSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
      const generatedCode = `${scheme.name.toUpperCase().replace(/\s+/g, "")}-${uniqueSuffix}`;

      const coupon = await tx.coupon.create({
        data: {
          id: crypto.randomUUID(),
          code: generatedCode,
          customerId: currentUserId,
          schemeId,
          customerSchemeId: customerScheme.id,
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
          liveRate24K: scheme.isWeightBased ? liveRate : null,
          gramsAdded: scheme.isWeightBased ? gramsEarned : null,
        },
      });

      return {
        type: "NEW_ENROLLMENT_STARTED",
        data: customerScheme,
        coupon,
      };
    });

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
      {
        status: 200,
        headers: corsHeaders(origin),
      }
    );
  } catch (error: any) {
    console.error("Enrollment error:", error);

    return NextResponse.json(
      {
        message: error.message || "Failed to process enrollment",
      },
      {
        status: 500,
        headers: corsHeaders(origin),
      }
    );
  }
}