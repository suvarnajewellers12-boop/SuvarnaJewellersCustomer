export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

// ============================================================
// CORS
// ============================================================

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

// ============================================================
// INDIA DATE HELPERS
// ============================================================

function getIndiaDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  const getValue = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(getValue("year")),
    month: Number(getValue("month")),
    day: Number(getValue("day")),
  };
}

function isSameIndiaDay(first: Date, second: Date) {
  const a = getIndiaDateParts(first);
  const b = getIndiaDateParts(second);

  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day
  );
}

function isSameIndiaMonth(first: Date, second: Date) {
  const a = getIndiaDateParts(first);
  const b = getIndiaDateParts(second);

  return (
    a.year === b.year &&
    a.month === b.month
  );
}

function compareIndiaMonth(first: Date, second: Date) {
  const a = getIndiaDateParts(first);
  const b = getIndiaDateParts(second);

  if (a.year < b.year) return -1;
  if (a.year > b.year) return 1;

  if (a.month < b.month) return -1;
  if (a.month > b.month) return 1;

  return 0;
}

// ============================================================
// LAST DAY OF INSTALLMENT MONTH
//
// Example:
// 2026-11-anyday -> 2026-11-30 23:59:59 IST
// 2026-02-anyday -> 2026-02-28 23:59:59 IST
// ============================================================

function getLastDateOfIndiaMonth(date: Date) {
  const parts = getIndiaDateParts(date);

  const lastDay = new Date(
    Date.UTC(
      parts.year,
      parts.month,
      0
    )
  ).getUTCDate();

  const year = String(parts.year);
  const month = String(parts.month).padStart(2, "0");
  const day = String(lastDay).padStart(2, "0");

  return new Date(
    `${year}-${month}-${day}T23:59:59+05:30`
  );
}

// ============================================================
// PAYMENT WINDOW
//
// Entire installment month is payable.
// ============================================================

function isInstallmentPayableThisMonth(
  installmentDate: Date,
  now: Date
) {
  return isSameIndiaMonth(
    installmentDate,
    now
  );
}

// ============================================================
// RATE TYPE NORMALIZATION
// ============================================================

function normalizeRateType(
  rateType: string | null | undefined,
  isWeightBased: boolean
) {
  const raw = String(rateType ?? "")
    .trim()
    .toUpperCase();

  if (
    raw === "GOLD_22K" ||
    raw === "GOLD_18K" ||
    raw === "SILVER"
  ) {
    return raw;
  }

  if (isWeightBased) {
    return "GOLD_22K";
  }

  return "CASH";
}

// ============================================================
// GET /api/schemes/my
// ============================================================

export async function GET(req: Request) {
  const origin = req.headers.get("origin") || "";

  try {
    // ========================================================
    // AUTH
    // ========================================================

    const authHeader = req.headers.get("Authorization");

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
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

    const currentUserId =
      decoded?.userId || decoded?.id;

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

    // ========================================================
    // STEP 1:
    // MARK ONLY PREVIOUS CALENDAR MONTHS AS MISSED
    //
    // Current month must NEVER be marked missed before the
    // calendar month ends.
    // ========================================================

    const upcomingInstallments =
      await prisma.schemeInstallment.findMany({
        where: {
          customerScheme: {
            customerId,
          },

          status: "UPCOMING",
        },

        select: {
          id: true,
          dueDate: true,
        },
      });

    const missedIds =
      upcomingInstallments
        .filter((installment) => {
          return (
            compareIndiaMonth(
              new Date(installment.dueDate),
              now
            ) < 0
          );
        })
        .map((installment) => installment.id);

    if (missedIds.length > 0) {
      await prisma.schemeInstallment.updateMany({
        where: {
          id: {
            in: missedIds,
          },

          status: "UPCOMING",
        },

        data: {
          status: "MISSED",
        },
      });
    }

    // ========================================================
    // STEP 2:
    // FETCH ENROLLMENTS
    // ========================================================

    const myEnrollments =
      await prisma.customerScheme.findMany({
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

    // ========================================================
    // STEP 3:
    // BUILD RESPONSE
    // ========================================================

    const schemes = myEnrollments.map(
      (enrollment) => {
        // ----------------------------------------------------
        // Normalize every due date to the last day of month.
        //
        // This affects the API response and all calculations
        // inside this endpoint.
        // ----------------------------------------------------

        const installments =
          (enrollment.installments ?? []).map(
            (item) => ({
              ...item,

              dueDate:
                getLastDateOfIndiaMonth(
                  new Date(item.dueDate)
                ),
            })
          );

        // ====================================================
        // MISSED INSTALLMENTS
        // ====================================================

        const missedInstallments =
          installments.filter(
            (item) =>
              item.status === "MISSED"
          );

        const hasMissedInstallments =
          missedInstallments.length > 0;

        // ====================================================
        // CURRENT MONTH INSTALLMENT
        // ====================================================

        const currentMonthInstallment =
          installments.find(
            (item) =>
              isSameIndiaMonth(
                new Date(item.dueDate),
                now
              )
          ) ?? null;

        // ====================================================
        // PAID THIS MONTH?
        // ====================================================

        const isPaidThisMonth =
          currentMonthInstallment?.status ===
          "PAID";

        // ====================================================
        // NEXT NON-PAID INSTALLMENT
        // ====================================================

        const nextInstallment =
          installments.find(
            (item) =>
              item.status !== "PAID"
          ) ?? null;

        // ====================================================
        // LATEST PAYMENT
        // ====================================================

        const latestPayment =
          enrollment.payments.length > 0
            ? enrollment.payments[0]
            : null;

        // ====================================================
        // SCHEDULE MISSING
        // ====================================================

        const scheduleMissing =
          installments.length === 0 &&
          !enrollment.isCompleted;

        // ====================================================
        // CURRENT MONTH PAYMENT WINDOW
        // ====================================================

        const isNextInstallmentDue =
          currentMonthInstallment != null &&
          currentMonthInstallment.status ===
            "UPCOMING" &&
          isInstallmentPayableThisMonth(
            new Date(
              currentMonthInstallment.dueDate
            ),
            now
          );

        // ====================================================
        // ONLINE PAYMENT
        // ====================================================

        const canPayOnline =
          !enrollment.isCompleted &&
          !scheduleMissing &&
          !hasMissedInstallments &&
          currentMonthInstallment != null &&
          currentMonthInstallment.status ===
            "UPCOMING" &&
          isNextInstallmentDue &&
          !isPaidThisMonth;

        // ====================================================
        // NORMALIZE SCHEME
        // ====================================================

        const normalizedRateType =
          normalizeRateType(
            enrollment.scheme.rateType,
            enrollment.scheme.isWeightBased
          );

        const normalizedScheme = {
          ...enrollment.scheme,

          rateType:
            normalizedRateType,

          isWeightBased:
            normalizedRateType !==
            "CASH",
        };

        // ====================================================
        // EFFECTIVE NEXT INSTALLMENT
        //
        // Prefer current month if it is still unpaid.
        // ====================================================

        const effectiveNextInstallment =
          currentMonthInstallment?.status ===
            "UPCOMING"
            ? currentMonthInstallment
            : nextInstallment;

        // ====================================================
        // NEXT DUE DATE
        //
        // Always returns last day of installment month.
        // ====================================================

        const nextDueDate =
          effectiveNextInstallment?.dueDate ??
          null;

        return {
          id:
            enrollment.id,

          customerId:
            enrollment.customerId,

          schemeId:
            enrollment.schemeId,

          installmentAmount:
            enrollment.installmentAmount,

          totalPaid:
            enrollment.totalPaid,

          remainingAmount:
            enrollment.remainingAmount,

          installmentsPaid:
            enrollment.installmentsPaid,

          installmentsLeft:
            enrollment.installmentsLeft,

          isCompleted:
            enrollment.isCompleted,

          startDate:
            enrollment.startDate,

          accumulatedGrams:
            enrollment.accumulatedGrams,

          customerAddress:
            enrollment.customerAddress,

          nomineeAddress:
            enrollment.nomineeAddress,

          nomineeName:
            enrollment.nomineeName,

          nomineePhone:
            enrollment.nomineePhone,

          nomineeRelation:
            enrollment.nomineeRelation,

          // ================================================
          // SCHEME
          // ================================================

          Scheme:
            normalizedScheme,

          scheme:
            normalizedScheme,

          // ================================================
          // PAYMENT HISTORY
          // ================================================

          PaymentHistory:
            latestPayment
              ? [latestPayment]
              : [],

          paymentHistory:
            latestPayment
              ? [latestPayment]
              : [],

          // ================================================
          // INSTALLMENTS
          // ================================================

          Installments:
            installments,

          installments,

          // ================================================
          // MISSED
          // ================================================

          hasMissedInstallments,

          missedInstallmentCount:
            missedInstallments.length,

          missedInstallments,

          // ================================================
          // CURRENT MONTH
          // ================================================

          currentMonthInstallment,

          // ================================================
          // NEXT INSTALLMENT
          // ================================================

          nextInstallment:
            effectiveNextInstallment,

          nextInstallmentNumber:
            effectiveNextInstallment
              ?.installmentNumber ??
            null,

          // ================================================
          // PAYMENT FLAGS
          // ================================================

          canPayOnline,

          isPaidThisMonth,

          isNextInstallmentDue,

          isPaymentWindowOpen:
            canPayOnline,

          scheduleMissing,

          // ================================================
          // PAYMENT DATES
          // ================================================

          lastPaymentDate:
            latestPayment?.paidAt ??
            null,

          nextDueDate,

          // ================================================
          // DUE TODAY
          // ================================================

          isDueToday:
            effectiveNextInstallment != null
              ? isSameIndiaDay(
                  new Date(
                    effectiveNextInstallment.dueDate
                  ),
                  now
                )
              : false,
        };
      }
    );

    // ========================================================
    // RESPONSE
    // ========================================================

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
    console.error(
      "[MY SCHEMES API ERROR]",
      error
    );

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
