export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import Razorpay from "razorpay";

import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

// ============================================================
// RAZORPAY TEST CONFIG
//
// IMPORTANT:
// Keep the secret only on the backend.
// Never put key_secret inside Flutter.
// ============================================================

const RAZORPAY_KEY_ID =
  "rzp_test_TlLhkVrMSDh6az";

const RAZORPAY_KEY_SECRET =
  "e5VaoxSOW3ygy4kKHblZIir5";

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

// ============================================================
// ALLOWED INSTALLMENT AMOUNTS
// ============================================================

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

// ============================================================
// CORS
// ============================================================

const allowedOrigins = [
  "https://suvarnajewellers.in",
  "https://www.suvarnajewellers.in",
];

function corsHeaders(origin: string) {
  const allowedOrigin =
    allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin":
      allowedOrigin,

    "Access-Control-Allow-Methods":
      "POST, OPTIONS",

    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",

    "Access-Control-Allow-Credentials":
      "true",
  };
}

// ============================================================
// OPTIONS
// ============================================================

export async function OPTIONS(
  req: Request
) {
  const origin =
    req.headers.get("origin") || "";

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

// ============================================================
// DATE HELPERS
// ============================================================

function startOfMonth(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

function getYearMonthValue(date: Date) {
  return (
    date.getFullYear() * 12 +
    date.getMonth()
  );
}

// ============================================================
// CREATE RAZORPAY ORDER
// ============================================================

export async function POST(
  req: Request
) {
  const origin =
    req.headers.get("origin") || "";

  try {
    // ==========================================================
    // 1. AUTHENTICATION
    // ==========================================================

    const authHeader =
      req.headers.get(
        "Authorization"
      );

    const token =
      authHeader?.startsWith(
        "Bearer "
      )
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
          headers:
            corsHeaders(origin),
        }
      );
    }

    const decoded: any =
      verifyToken(token);

    const currentUserId =
      decoded?.userId ||
      decoded?.id;

    if (!currentUserId) {
      return NextResponse.json(
        {
          status: "Failed",
          message:
            "Invalid token",
        },
        {
          status: 401,
          headers:
            corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 2. READ REQUEST
    // ==========================================================

    const body =
      await req.json();

    const {
      schemeId,
      amount,
      currency = "INR",
      userId,
    } = body;

    if (!schemeId) {
      return NextResponse.json(
        {
          status: "Failed",
          message:
            "schemeId is required",
        },
        {
          status: 400,
          headers:
            corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // PREVENT CUSTOMER ID MANIPULATION
    // ==========================================================

    if (
      userId &&
      String(userId) !==
        String(currentUserId)
    ) {
      return NextResponse.json(
        {
          status: "Failed",
          message:
            "User mismatch",
        },
        {
          status: 403,
          headers:
            corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 3. FETCH SCHEME + ENROLLMENT
    // ==========================================================

    const [
      scheme,
      existingEnrollment,
    ] = await Promise.all([
      prisma.scheme.findUnique({
        where: {
          id: schemeId,
        },
      }),

      prisma.customerScheme.findFirst({
        where: {
          customerId:
            String(currentUserId),

          schemeId,
        },

        include: {
          installments: {
            orderBy: {
              installmentNumber:
                "asc",
            },
          },
        },
      }),
    ]);

    // ==========================================================
    // SCHEME CHECK
    // ==========================================================

    if (!scheme) {
      return NextResponse.json(
        {
          status: "Failed",
          message:
            "Scheme not found",
        },
        {
          status: 404,
          headers:
            corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 4. EXISTING ENROLLMENT VALIDATION
    // ==========================================================

    if (
      existingEnrollment
        ?.isCompleted
    ) {
      return NextResponse.json(
        {
          status: "Failed",

          code:
            "SCHEME_COMPLETED",

          message:
            "Scheme already completed.",
        },
        {
          status: 400,
          headers:
            corsHeaders(origin),
        }
      );
    }

    if (
      existingEnrollment &&
      existingEnrollment
        .installmentsLeft <= 0
    ) {
      return NextResponse.json(
        {
          status: "Failed",

          code:
            "NO_INSTALLMENTS_LEFT",

          message:
            "No installments left to pay.",
        },
        {
          status: 400,
          headers:
            corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 5. MISSED INSTALLMENT CHECK
    //
    // IMPORTANT:
    //
    // This happens BEFORE Razorpay order creation.
    //
    // Example:
    //
    // Month 1 -> PAID
    // Month 2 -> PAID
    // Month 3 -> MISSED
    // Month 4 -> current month
    //
    // Customer CANNOT open Razorpay for Month 4.
    //
    // Admin/store must clear Month 3 first.
    // ==========================================================

    let nextInstallment:
      | (typeof existingEnrollment extends null
          ? never
          : any)
      | null = null;

    if (existingEnrollment) {
      const installments =
        existingEnrollment
          .installments;

      // --------------------------------------------------------
      // SAFETY CHECK
      //
      // New enrollments must have installment rows.
      //
      // If an old enrollment exists without them,
      // don't allow a payment because we cannot safely determine
      // which month the customer is paying.
      // --------------------------------------------------------

      if (
        !installments ||
        installments.length === 0
      ) {
        return NextResponse.json(
          {
            status: "Failed",

            code:
              "INSTALLMENT_DATA_MISSING",

            message:
              "Installment schedule is missing for this enrollment. Please contact the store.",
          },
          {
            status: 409,
            headers:
              corsHeaders(origin),
          }
        );
      }

      const now =
        new Date();

      const currentMonthStart =
        startOfMonth(now);

      // --------------------------------------------------------
      // FIND OLD UNPAID MONTHS
      //
      // An installment becomes MISSED only after its entire
      // calendar month has passed.
      //
      // Example:
      //
      // Due: 10 January
      //
      // Customer can still pay during January.
      //
      // Once February starts and January is unpaid,
      // January becomes MISSED.
      // --------------------------------------------------------

      const pastUnpaid =
        installments.filter(
          (item) => {
            if (
              item.status ===
              "PAID"
            ) {
              return false;
            }

            const dueDate =
              new Date(
                item.dueDate
              );

            return (
              dueDate <
              currentMonthStart
            );
          }
        );

      // --------------------------------------------------------
      // MARK OLD UNPAID MONTHS AS MISSED
      // --------------------------------------------------------

      const needMissedUpdate =
        pastUnpaid.filter(
          (item) =>
            item.status !==
            "MISSED"
        );

      if (
        needMissedUpdate.length >
        0
      ) {
        await prisma
          .schemeInstallment
          .updateMany({
            where: {
              id: {
                in:
                  needMissedUpdate.map(
                    (item) =>
                      item.id
                  ),
              },
            },

            data: {
              status:
                "MISSED",
            },
          });
      }

      // --------------------------------------------------------
      // CHECK ALREADY-MISSED OR NEWLY-MISSED INSTALLMENTS
      // --------------------------------------------------------

      const missedInstallments =
        installments.filter(
          (item) =>
            item.status ===
              "MISSED" ||
            pastUnpaid.some(
              (past) =>
                past.id ===
                item.id
            )
        );

      // ========================================================
      // BLOCK ONLINE PAYMENT IF ANY MISSED MONTH EXISTS
      // ========================================================

      if (
        missedInstallments.length >
        0
      ) {
        return NextResponse.json(
          {
            status: "Failed",

            code:
              "MISSED_INSTALLMENT_PENDING",

            message:
              missedInstallments.length ===
              1
                ? "You have a missed installment. Please clear it at the store before making the next online payment."
                : `You have ${missedInstallments.length} missed installments. Please clear them at the store before making the next online payment.`,

            missedCount:
              missedInstallments.length,

            missedInstallments:
              missedInstallments.map(
                (item) => ({
                  id:
                    item.id,

                  installmentNumber:
                    item.installmentNumber,

                  dueDate:
                    item.dueDate,

                  amount:
                    item.amount,

                  status:
                    "MISSED",
                })
              ),
          },
          {
            status: 400,
            headers:
              corsHeaders(origin),
          }
        );
      }

      // ========================================================
      // FIND NEXT UNPAID INSTALLMENT
      // ========================================================

      nextInstallment =
        installments.find(
          (item) =>
            item.status !==
            "PAID"
        ) ?? null;

      if (!nextInstallment) {
        return NextResponse.json(
          {
            status: "Failed",

            code:
              "NO_INSTALLMENTS_LEFT",

            message:
              "No installments left to pay.",
          },
          {
            status: 400,
            headers:
              corsHeaders(origin),
          }
        );
      }

      // ========================================================
      // DO NOT ALLOW FUTURE-MONTH PAYMENTS
      //
      // User said upcoming month prepayment is NOT required.
      // ========================================================

      const dueDate =
        new Date(
          nextInstallment
            .dueDate
        );

      const currentYearMonth =
        getYearMonthValue(
          now
        );

      const dueYearMonth =
        getYearMonthValue(
          dueDate
        );

      if (
        dueYearMonth >
        currentYearMonth
      ) {
        return NextResponse.json(
          {
            status: "Failed",

            code:
              "INSTALLMENT_NOT_DUE",

            message:
              "Your next installment is not due yet.",

            nextInstallment: {
              installmentNumber:
                nextInstallment
                  .installmentNumber,

              dueDate:
                nextInstallment
                  .dueDate,

              amount:
                nextInstallment
                  .amount,
            },
          },
          {
            status: 400,
            headers:
              corsHeaders(origin),
          }
        );
      }
    }

    // ==========================================================
    // 6. DETERMINE INSTALLMENT AMOUNT
    // ==========================================================

    let installmentAmount: number;

    // ==========================================================
    // EXISTING ENROLLMENT
    //
    // Never trust Flutter amount for existing enrollment.
    // ==========================================================

    if (existingEnrollment) {
      installmentAmount =
        Number(
          existingEnrollment
            .installmentAmount
        );

      if (
        !Number.isFinite(
          installmentAmount
        ) ||
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
            headers:
              corsHeaders(origin),
          }
        );
      }

      // --------------------------------------------------------
      // EXTRA SAFETY
      //
      // Installment row amount must also match the stored
      // enrollment installment amount.
      // --------------------------------------------------------

      if (
        nextInstallment &&
        Number(
          nextInstallment
            .amount
        ) !==
          installmentAmount
      ) {
        console.error(
          "[CREATE ORDER] Installment amount mismatch",
          {
            enrollmentId:
              existingEnrollment.id,

            storedEnrollmentAmount:
              installmentAmount,

            installmentRowAmount:
              nextInstallment.amount,

            installmentNumber:
              nextInstallment
                .installmentNumber,
          }
        );

        return NextResponse.json(
          {
            status: "Failed",

            code:
              "INSTALLMENT_AMOUNT_MISMATCH",

            message:
              "Installment amount mismatch. Please contact the store.",
          },
          {
            status: 409,
            headers:
              corsHeaders(origin),
          }
        );
      }
    }

    // ==========================================================
    // FIRST ENROLLMENT
    // ==========================================================

    else {
      installmentAmount =
        Number(amount);

      if (
        !Number.isFinite(
          installmentAmount
        ) ||
        installmentAmount <= 0
      ) {
        return NextResponse.json(
          {
            status: "Failed",

            message:
              "Please select an installment amount.",
          },
          {
            status: 400,
            headers:
              corsHeaders(origin),
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

            allowedAmounts:
              ALLOWED_INSTALLMENT_AMOUNTS,
          },
          {
            status: 400,
            headers:
              corsHeaders(origin),
          }
        );
      }
    }

    installmentAmount =
      Math.round(
        installmentAmount
      );

    // ==========================================================
    // 7. VALIDATE CURRENCY
    // ==========================================================

    const normalizedCurrency =
      String(currency)
        .trim()
        .toUpperCase();

    if (
      normalizedCurrency !==
      "INR"
    ) {
      return NextResponse.json(
        {
          status: "Failed",

          message:
            "Only INR payments are supported.",
        },
        {
          status: 400,
          headers:
            corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 8. RUPEES -> PAISE
    // ==========================================================

    const amountInPaise =
      Math.round(
        installmentAmount *
          100
      );

    // ==========================================================
    // 9. CREATE RAZORPAY ORDER
    // ==========================================================

    const order =
      await razorpay.orders.create({
        amount:
          amountInPaise,

        currency:
          normalizedCurrency,

        receipt:
          `scheme_${Date.now()}`,

        notes: {
          customerId:
            String(
              currentUserId
            ),

          schemeId:
            String(
              schemeId
            ),

          installmentAmount:
            String(
              installmentAmount
            ),

          // ----------------------------------------------------
          // Scheme metal/rate type
          // ----------------------------------------------------

          rateType:
            String(
              scheme.rateType
            ),

          paymentType:
            existingEnrollment
              ? "INSTALLMENT"
              : "NEW_ENROLLMENT",

          // ----------------------------------------------------
          // This allows verify to confirm exactly which month
          // this Razorpay order belongs to.
          // ----------------------------------------------------

          customerSchemeId:
            existingEnrollment
              ? String(
                  existingEnrollment.id
                )
              : "",

          installmentId:
            nextInstallment
              ? String(
                  nextInstallment.id
                )
              : "",

          installmentNumber:
            nextInstallment
              ? String(
                  nextInstallment
                    .installmentNumber
                )
              : "1",
        },
      });

    // ==========================================================
    // 10. SUCCESS RESPONSE
    // ==========================================================

    return NextResponse.json(
      {
        status: "Success",

        orderId:
          order.id,

        // Razorpay Flutter expects paisa.
        amount:
          order.amount,

        amountRupees:
          installmentAmount,

        currency:
          order.currency,

        paymentType:
          existingEnrollment
            ? "INSTALLMENT"
            : "NEW_ENROLLMENT",

        rateType:
          scheme.rateType,

        installment:
          existingEnrollment &&
          nextInstallment
            ? {
                id:
                  nextInstallment.id,

                installmentNumber:
                  nextInstallment
                    .installmentNumber,

                dueDate:
                  nextInstallment
                    .dueDate,

                amount:
                  nextInstallment
                    .amount,
              }
            : {
                installmentNumber:
                  1,

                amount:
                  installmentAmount,
              },
      },
      {
        status: 200,
        headers:
          corsHeaders(origin),
      }
    );
  } catch (error: any) {
    console.error(
      "[RAZORPAY CREATE ORDER ERROR]",
      error
    );

    return NextResponse.json(
      {
        status: "Failed",

        message:
          error?.message ||
          "Could not create order",
      },
      {
        status: 500,
        headers:
          corsHeaders(origin),
      }
    );
  }
}
