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

function getIndiaTodayStartUtc() {
  const parts = getIndiaDateParts();

  const year = String(parts.year);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");

  return new Date(
    `${year}-${month}-${day}T00:00:00+05:30`
  );
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

function isInstallmentDue(dueDate: Date, now: Date) {
  const dueParts = getIndiaDateParts(dueDate);
  const nowParts = getIndiaDateParts(now);

  const dueKey = Date.UTC(
    dueParts.year,
    dueParts.month - 1,
    dueParts.day
  );

  const nowKey = Date.UTC(
    nowParts.year,
    nowParts.month - 1,
    nowParts.day
  );

  return dueKey <= nowKey;
}

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

export async function GET(req: Request) {
  const origin = req.headers.get("origin") || "";

  try {
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
    const todayStart = getIndiaTodayStartUtc();

    await prisma.schemeInstallment.updateMany({
      where: {
        customerScheme: {
          customerId,
        },
        status: "UPCOMING",
        dueDate: {
          lt: todayStart,
        },
      },
      data: {
        status: "MISSED",
      },
    });

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

    const schemes = myEnrollments.map(
      (enrollment) => {
        const installments =
          enrollment.installments ?? [];

        const missedInstallments =
          installments.filter(
            (item) =>
              item.status === "MISSED"
          );

        const nextInstallment =
          installments.find(
            (item) =>
              item.status !== "PAID"
          ) ?? null;

        const latestPayment =
          enrollment.payments.length > 0
            ? enrollment.payments[0]
            : null;

        const currentMonthInstallment =
          installments.find(
            (item) =>
              isSameIndiaMonth(
                new Date(item.dueDate),
                now
              )
          ) ?? null;

        const isPaidThisMonth =
          currentMonthInstallment?.status ===
          "PAID";

        const scheduleMissing =
          installments.length === 0 &&
          !enrollment.isCompleted;

        const isNextInstallmentDue =
          nextInstallment != null
            ? isInstallmentDue(
                new Date(
                  nextInstallment.dueDate
                ),
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
          nextInstallment.status ===
            "UPCOMING" &&
          isNextInstallmentDue &&
          !isPaidThisMonth;

        const normalizedRateType =
          normalizeRateType(
            enrollment.scheme.rateType,
            enrollment.scheme.isWeightBased
          );

        const normalizedScheme = {
          ...enrollment.scheme,
          rateType: normalizedRateType,
          isWeightBased:
            normalizedRateType !== "CASH",
        };

        return {
          id: enrollment.id,
          customerId: enrollment.customerId,
          schemeId: enrollment.schemeId,
          installmentAmount:
            enrollment.installmentAmount,
          totalPaid: enrollment.totalPaid,
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

          Scheme: normalizedScheme,
          scheme: normalizedScheme,

          PaymentHistory:
            latestPayment
              ? [latestPayment]
              : [],

          paymentHistory:
            latestPayment
              ? [latestPayment]
              : [],

          Installments: installments,
          installments,

          hasMissedInstallments,
          missedInstallmentCount:
            missedInstallments.length,
          missedInstallments,
          nextInstallment,
          canPayOnline,
          isPaidThisMonth,
          isNextInstallmentDue,
          scheduleMissing,

          lastPaymentDate:
            latestPayment?.paidAt ?? null,

          nextDueDate:
            nextInstallment?.dueDate ??
            null,

          isDueToday:
            nextInstallment != null
              ? isSameIndiaDay(
                  new Date(
                    nextInstallment.dueDate
                  ),
                  now
                )
              : false,
        };
      }
    );

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
