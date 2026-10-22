export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") || "";

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

function sameMonth(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth()
  );
}

function isDueByCurrentMonth(dueDate: Date, now: Date) {
  const dueKey = dueDate.getFullYear() * 12 + dueDate.getMonth();
  const nowKey = now.getFullYear() * 12 + now.getMonth();
  return dueKey <= nowKey;
}

export async function GET(req: Request) {
  const origin = req.headers.get("origin") || "";

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          schemes: [],
          message: "Unauthorized",
        },
        {
          status: 401,
          headers: corsHeaders(origin),
        }
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);
    const currentUserId = decoded?.userId || decoded?.id;

    if (!currentUserId) {
      return NextResponse.json(
        {
          success: false,
          schemes: [],
          message: "Invalid token",
        },
        {
          status: 401,
          headers: corsHeaders(origin),
        }
      );
    }

    const customerId = String(currentUserId);
    const now = new Date();
    const currentMonthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    // ==========================================================
    // 1. PROMOTE PAST UNPAID MONTHS TO MISSED
    //
    // Example:
    // October installment remains unpaid when November begins
    // -> October becomes MISSED.
    // ==========================================================

    await prisma.schemeInstallment.updateMany({
      where: {
        customerScheme: {
          customerId,
        },
        status: "UPCOMING",
        dueDate: {
          lt: currentMonthStart,
        },
      },
      data: {
        status: "MISSED",
      },
    });

    // ==========================================================
    // 2. FETCH ENROLLMENTS
    // ==========================================================

    const myEnrollments = await prisma.customerScheme.findMany({
      where: {
        customerId,
      },
      include: {
        scheme: true,
        payments: {
          orderBy: {
            paidAt: "desc",
          },
          take: 1,
        },
        installments: {
          orderBy: {
            installmentNumber: "asc",
          },
        },
      },
      orderBy: {
        startDate: "desc",
      },
    });

    const schemes = myEnrollments.map((enrollment) => {
      const installments = enrollment.installments ?? [];
      const missedInstallments = installments.filter(
        (item) => item.status === "MISSED"
      );

      const nextInstallment =
        installments.find((item) => item.status !== "PAID") ?? null;

     const latestPayment =
  enrollment.payments.length > 0
    ? enrollment.payments[0]
    : null;

// ==========================================================
// CHECK THE ACTUAL CURRENT-MONTH INSTALLMENT
// ==========================================================

const currentMonthInstallment =
  installments.find(
    (item) =>
      sameMonth(
        new Date(
          item.dueDate
        ),
        now
      )
  ) ?? null;

const isPaidThisMonth =
  currentMonthInstallment
    ?.status === "PAID";
      const scheduleMissing =
        installments.length === 0 &&
        !enrollment.isCompleted;

      const isNextInstallmentDue =
        nextInstallment != null
          ? isDueByCurrentMonth(
              new Date(nextInstallment.dueDate),
              now
            )
          : false;

      const hasMissedInstallments =
        missedInstallments.length > 0;

      const canPayOnline =
        !enrollment.isCompleted &&
        !scheduleMissing &&
        !hasMissedInstallments &&
        nextInstallment != null &&
        isNextInstallmentDue &&
        !isPaidThisMonth;

      return {
        id: enrollment.id,
        customerId: enrollment.customerId,
        schemeId: enrollment.schemeId,
        installmentAmount: enrollment.installmentAmount,
        totalPaid: enrollment.totalPaid,
        remainingAmount: enrollment.remainingAmount,
        installmentsPaid: enrollment.installmentsPaid,
        installmentsLeft: enrollment.installmentsLeft,
        isCompleted: enrollment.isCompleted,
        startDate: enrollment.startDate,
        accumulatedGrams: enrollment.accumulatedGrams,
        customerAddress: enrollment.customerAddress,
        nomineeAddress: enrollment.nomineeAddress,
        nomineeName: enrollment.nomineeName,
        nomineePhone: enrollment.nomineePhone,
        nomineeRelation: enrollment.nomineeRelation,

        // Flutter compatibility
        Scheme: enrollment.scheme,
        PaymentHistory: latestPayment ? [latestPayment] : [],

        // New installment state
        Installments: installments,
        hasMissedInstallments,
        missedInstallmentCount: missedInstallments.length,
        missedInstallments,
        nextInstallment,
        canPayOnline,
        isPaidThisMonth,
        isNextInstallmentDue,
        scheduleMissing,
        lastPaymentDate: latestPayment?.paidAt ?? null,
        nextDueDate: nextInstallment?.dueDate ?? null,
      };
    });

    return NextResponse.json(
      {
        success: true,
        count: schemes.length,
        schemes,
      },
      {
        status: 200,
        headers: corsHeaders(origin),
      }
    );
  } catch (error: any) {
    console.error("[MY SCHEMES API ERROR]", error);

    return NextResponse.json(
      {
        success: false,
        schemes: [],
        message:
          error?.message ||
          "Failed to fetch enrolled schemes",
      },
      {
        status: 500,
        headers: corsHeaders(origin),
      }
    );
  }
}
