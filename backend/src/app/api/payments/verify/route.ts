export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import crypto from "crypto";

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
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      schemeId,
      userId,
    } = body;

    // 1. Verify auth token
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

    // 2. Verify Razorpay signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { message: "Payment verification failed" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // 3. Fetch scheme and existing enrollment
    const [scheme, existingEnrollment] = await Promise.all([
      prisma.scheme.findUnique({ where: { id: schemeId } }),
      prisma.customerScheme.findFirst({
        where: { customerId: currentUserId, schemeId },
        include: { coupon: true },
      }),
    ]);

    if (!scheme) {
      return NextResponse.json(
        { message: "Scheme not found" },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    if (existingEnrollment?.isCompleted) {
      return NextResponse.json(
        { message: "Scheme already completed." },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    if (existingEnrollment && existingEnrollment.installmentsLeft <= 0) {
      return NextResponse.json(
        { message: "No installments left." },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // 4. Gold rate logic
    let liveRate = 0;
    let gramsEarned = 0;
    if (scheme.isWeightBased) {
      const rateRes = await fetch(
        "https://suvarnagold-16e5.vercel.app/api/rates",
        { cache: "no-store" }
      );
      const rateData = await rateRes.json();
      liveRate = parseFloat(rateData.gold24.replace(/[^0-9.]/g, ""));
      gramsEarned = scheme.monthlyAmount / liveRate;
    }

    // 5. Transaction
    const result = await prisma.$transaction(async (tx) => {
      if (existingEnrollment) {
        const isLastPayment = existingEnrollment.installmentsLeft === 1;

        const updated = await tx.customerScheme.update({
          where: { id: existingEnrollment.id },
          data: {
            totalPaid: { increment: scheme.monthlyAmount },
            installmentsPaid: { increment: 1 },
            installmentsLeft: { decrement: 1 },
            accumulatedGrams: { increment: gramsEarned },
            remainingAmount: { decrement: scheme.monthlyAmount },
            isCompleted: isLastPayment,
          },
          include: { coupon: true },
        });

        if (!existingEnrollment.coupon) {
          const uniqueSuffix = crypto
            .randomBytes(3)
            .toString("hex")
            .toUpperCase();
          await tx.coupon.create({
            data: {
              id: crypto.randomUUID(),
              code: `SUV-${scheme.isWeightBased ? "W" : "V"}-${uniqueSuffix}`,
              customerId: currentUserId,
              schemeId,
              customerSchemeId: existingEnrollment.id,
              totalCashValue: !scheme.isWeightBased
                ? (scheme.durationMonths + (scheme.maturityMonths || 0)) *
                  scheme.monthlyAmount
                : 0,
              totalWeightGrams: gramsEarned,
              isActive: isLastPayment,
            },
          });
        } else {
          await tx.coupon.update({
            where: { customerSchemeId: existingEnrollment.id },
            data: {
              totalWeightGrams: { increment: gramsEarned },
              isActive: isLastPayment,
            },
          });
        }

        return { type: "INSTALLMENT_PROCESSED", data: updated };
      }

      // New enrollment
      const newCS = await tx.customerScheme.create({
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
      await tx.coupon.create({
        data: {
          id: crypto.randomUUID(),
          code: `SUV-${scheme.isWeightBased ? "W" : "V"}-${uniqueSuffix}`,
          customerId: currentUserId,
          schemeId,
          customerSchemeId: newCS.id,
          totalCashValue: !scheme.isWeightBased
            ? (scheme.durationMonths + (scheme.maturityMonths || 0)) *
              scheme.monthlyAmount
            : 0,
          totalWeightGrams: gramsEarned,
          isActive: false,
        },
      });

      return { type: "NEW_ENROLLMENT_STARTED", data: newCS };
    });

    // 6. Payment history
    await prisma.paymentHistory.create({
      data: {
        id: crypto.randomUUID(),
        customerSchemeId: result.data.id,
        amountPaid: scheme.monthlyAmount,
        liveRate24K: scheme.isWeightBased ? liveRate : null,
        gramsAdded: scheme.isWeightBased ? gramsEarned : null,
      },
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
      { status: 200, headers: corsHeaders(origin) }
    );
  } catch (error: any) {
    console.error("Verify Error:", error);
    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}