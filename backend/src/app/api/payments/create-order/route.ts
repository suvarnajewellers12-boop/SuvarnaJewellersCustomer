export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import Razorpay from "razorpay";

import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

const razorpay = new Razorpay({
  key_id: "rzp_test_TlLhkVrMSDh6az",
  key_secret: "e5VaoxSOW3ygy4kKHblZIir5",
});

const ALLOWED_INSTALLMENT_AMOUNTS = [
  1000,
  2000,
  5000,
  7000,
  10000,
  15000,
  20000,
  25000,
  30000,
  40000,
  50000,
  75000,
  100000,
  125000,
  150000,
  175000,
  200000,
];

const allowedOrigins = [
  "https://suvarnajewellers.in",
  "https://www.suvarnajewellers.in",
];

function corsHeaders(origin: string) {
  const allowedOrigin = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") || "";

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

function monthKey(date: Date) {
  return date.getFullYear() * 12 + date.getMonth();
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin") || "";

  try {
    // ==========================================================
    // 1. AUTH
    // ==========================================================

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      return NextResponse.json(
        {
          status: "Failed",
          message: "Unauthorized",
        },
        {
          status: 401,
          headers: corsHeaders(origin),
        }
      );
    }

    const decoded: any = verifyToken(token);
    const currentUserId = decoded?.userId || decoded?.id;

    if (!currentUserId) {
      return NextResponse.json(
        {
          status: "Failed",
          message: "Invalid token",
        },
        {
          status: 401,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 2. BODY
    // ==========================================================

    const body = await req.json();

    const {
      schemeId,
      amount,
      currency = "INR",
      userId,
      customerAddress,
      nomineeName,
      nomineeRelation,
      nomineePhone,
      nomineeAddress,
    } = body;

    if (!schemeId) {
      return NextResponse.json(
        {
          status: "Failed",
          message: "schemeId is required",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    if (
      userId &&
      String(userId) !== String(currentUserId)
    ) {
      return NextResponse.json(
        {
          status: "Failed",
          message: "User mismatch",
        },
        {
          status: 403,
          headers: corsHeaders(origin),
        }
      );
    }

    // customerAddress and nomineeAddress are optional.
    // Required nominee fields are validated before Razorpay opens
    // for a brand-new enrollment.
    const nomineeNameValue =
      String(nomineeName ?? "").trim();
    const nomineeRelationValue =
      String(nomineeRelation ?? "").trim();
    const nomineePhoneValue =
      String(nomineePhone ?? "").trim();

    // ==========================================================
    // 3. SCHEME + ENROLLMENT
    // ==========================================================

    const [scheme, existingEnrollment] =
      await Promise.all([
        prisma.scheme.findUnique({
          where: {
            id: schemeId,
          },
        }),
        prisma.customerScheme.findFirst({
          where: {
            customerId: String(currentUserId),
            schemeId,
          },
          include: {
            installments: {
              orderBy: {
                installmentNumber: "asc",
              },
            },
          },
        }),
      ]);

    if (!scheme) {
      return NextResponse.json(
        {
          status: "Failed",
          message: "Scheme not found",
        },
        {
          status: 404,
          headers: corsHeaders(origin),
        }
      );
    }

    if (
      !existingEnrollment &&
      (
        !nomineeNameValue ||
        !nomineeRelationValue ||
        !nomineePhoneValue
      )
    ) {
      return NextResponse.json(
        {
          status: "Failed",
          code: "ENROLLMENT_DETAILS_REQUIRED",
          message:
            "Nominee name, relation and phone are required before starting enrollment.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    if (existingEnrollment?.isCompleted) {
      return NextResponse.json(
        {
          status: "Failed",
          code: "SCHEME_COMPLETED",
          message: "Scheme already completed.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    if (
      existingEnrollment &&
      existingEnrollment.installmentsLeft <= 0
    ) {
      return NextResponse.json(
        {
          status: "Failed",
          code: "NO_INSTALLMENTS_LEFT",
          message: "No installments left to pay.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 4. MISSED-MONTH / NEXT-MONTH GATE
    // ==========================================================

    let nextInstallment: any = null;

    if (existingEnrollment) {
      const installments = existingEnrollment.installments;

      if (installments.length === 0) {
        return NextResponse.json(
          {
            status: "Failed",
            code: "INSTALLMENT_DATA_MISSING",
            message:
              "Installment schedule is missing for this enrollment. Please contact the store.",
          },
          {
            status: 409,
            headers: corsHeaders(origin),
          }
        );
      }

      const now = new Date();
      const currentMonthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

      const newlyMissed = installments.filter(
        (item) =>
          item.status === "UPCOMING" &&
          new Date(item.dueDate) < currentMonthStart
      );

      if (newlyMissed.length > 0) {
        await prisma.schemeInstallment.updateMany({
          where: {
            id: {
              in: newlyMissed.map((item) => item.id),
            },
          },
          data: {
            status: "MISSED",
          },
        });
      }

      const missedInstallments = installments.filter(
        (item) =>
          item.status === "MISSED" ||
          newlyMissed.some((missed) => missed.id === item.id)
      );

      if (missedInstallments.length > 0) {
        return NextResponse.json(
          {
            status: "Failed",
            code: "MISSED_INSTALLMENT_PENDING",
            message:
              missedInstallments.length === 1
                ? "You have a missed installment. Please clear it at the store before making the next online payment."
                : `You have ${missedInstallments.length} missed installments. Please clear them at the store before making the next online payment.`,
            missedCount: missedInstallments.length,
            missedInstallments: missedInstallments.map((item) => ({
              id: item.id,
              installmentNumber: item.installmentNumber,
              dueDate: item.dueDate,
              amount: item.amount,
              status: "MISSED",
            })),
          },
          {
            status: 400,
            headers: corsHeaders(origin),
          }
        );
      }

      nextInstallment =
        installments.find((item) => item.status !== "PAID") ??
        null;

      if (!nextInstallment) {
        return NextResponse.json(
          {
            status: "Failed",
            code: "NO_INSTALLMENTS_LEFT",
            message: "No installments left to pay.",
          },
          {
            status: 400,
            headers: corsHeaders(origin),
          }
        );
      }

      if (
        monthKey(new Date(nextInstallment.dueDate)) >
        monthKey(now)
      ) {
        return NextResponse.json(
          {
            status: "Failed",
            code: "INSTALLMENT_NOT_DUE",
            message: "Your next installment is not due yet.",
            nextInstallment: {
              installmentNumber:
                nextInstallment.installmentNumber,
              dueDate: nextInstallment.dueDate,
              amount: nextInstallment.amount,
            },
          },
          {
            status: 400,
            headers: corsHeaders(origin),
          }
        );
      }
    }

    // ==========================================================
    // 5. AMOUNT
    // ==========================================================

    let installmentAmount: number;

    if (existingEnrollment) {
      installmentAmount = Number(
        existingEnrollment.installmentAmount
      );

      if (
        !Number.isFinite(installmentAmount) ||
        installmentAmount <= 0
      ) {
        return NextResponse.json(
          {
            status: "Failed",
            message:
              "Invalid installment amount stored for this enrollment.",
          },
          {
            status: 400,
            headers: corsHeaders(origin),
          }
        );
      }

      if (
        nextInstallment &&
        Number(nextInstallment.amount) !== installmentAmount
      ) {
        return NextResponse.json(
          {
            status: "Failed",
            code: "INSTALLMENT_AMOUNT_MISMATCH",
            message:
              "Installment amount mismatch. Please contact the store.",
          },
          {
            status: 409,
            headers: corsHeaders(origin),
          }
        );
      }
    } else {
      installmentAmount = Number(amount);

      if (
        !Number.isFinite(installmentAmount) ||
        installmentAmount <= 0
      ) {
        return NextResponse.json(
          {
            status: "Failed",
            message: "Please select an installment amount.",
          },
          {
            status: 400,
            headers: corsHeaders(origin),
          }
        );
      }

      if (
        !ALLOWED_INSTALLMENT_AMOUNTS.includes(
          installmentAmount
        )
      ) {
        return NextResponse.json(
          {
            status: "Failed",
            message:
              "Selected installment amount is not allowed.",
            allowedAmounts: ALLOWED_INSTALLMENT_AMOUNTS,
          },
          {
            status: 400,
            headers: corsHeaders(origin),
          }
        );
      }
    }

    installmentAmount = Math.round(installmentAmount);

    const normalizedCurrency =
      String(currency).trim().toUpperCase();

    if (normalizedCurrency !== "INR") {
      return NextResponse.json(
        {
          status: "Failed",
          message: "Only INR payments are supported.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    const amountInPaise = installmentAmount * 100;

    // ==========================================================
    // 6. RAZORPAY ORDER
    // ==========================================================

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: normalizedCurrency,
      receipt: `scheme_${Date.now()}`,
      notes: {
        customerId: String(currentUserId),
        schemeId: String(schemeId),
        installmentAmount: String(installmentAmount),
        rateType: String(scheme.rateType),
        paymentType: existingEnrollment
          ? "INSTALLMENT"
          : "NEW_ENROLLMENT",
        customerSchemeId: existingEnrollment
          ? String(existingEnrollment.id)
          : "",
        installmentId: nextInstallment
          ? String(nextInstallment.id)
          : "",
        installmentNumber: nextInstallment
          ? String(nextInstallment.installmentNumber)
          : "1",
      },
    });

    return NextResponse.json(
      {
        status: "Success",
        orderId: order.id,
        amount: order.amount,
        amountRupees: installmentAmount,
        currency: order.currency,
        paymentType: existingEnrollment
          ? "INSTALLMENT"
          : "NEW_ENROLLMENT",
        rateType: scheme.rateType,
        installment:
          existingEnrollment && nextInstallment
            ? {
                id: nextInstallment.id,
                installmentNumber:
                  nextInstallment.installmentNumber,
                dueDate: nextInstallment.dueDate,
                amount: nextInstallment.amount,
              }
            : {
                installmentNumber: 1,
                amount: installmentAmount,
              },
      },
      {
        status: 200,
        headers: corsHeaders(origin),
      }
    );
  } catch (error: any) {
    console.error("[RAZORPAY CREATE ORDER ERROR]", error);

    return NextResponse.json(
      {
        status: "Failed",
        message:
          error?.message || "Could not create order",
      },
      {
        status: 500,
        headers: corsHeaders(origin),
      }
    );
  }
}
