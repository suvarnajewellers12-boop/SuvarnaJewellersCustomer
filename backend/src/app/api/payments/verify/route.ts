export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import Razorpay from "razorpay";
import crypto from "crypto";

// ============================================================
// TEST RAZORPAY
// ============================================================

const RAZORPAY_KEY_ID =
  "rzp_test_TlLhkVrMSDh6az";

const RAZORPAY_KEY_SECRET =
  "e5VaoxSOW3ygy4kKHblZIir5";

const razorpay =
  new Razorpay({
    key_id:
      RAZORPAY_KEY_ID,

    key_secret:
      RAZORPAY_KEY_SECRET,
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

function corsHeaders(
  origin: string
) {
  return {
    "Access-Control-Allow-Origin":
      origin || "*",

    "Access-Control-Allow-Credentials":
      "true",

    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",

    "Access-Control-Allow-Methods":
      "POST, OPTIONS",
  };
}

export async function OPTIONS(
  req: Request
) {
  const origin =
    req.headers.get("origin") ||
    "";

  return new NextResponse(
    null,
    {
      status: 204,
      headers:
        corsHeaders(origin),
    }
  );
}

// ============================================================
// GET METAL RATE
// ============================================================

async function getLiveRate(
  rateType:
    | "CASH"
    | "GOLD_22K"
    | "GOLD_18K"
    | "SILVER"
) {
  if (
    rateType === "CASH"
  ) {
    return 0;
  }

  const response =
    await fetch(
      "https://suvarnagold-16e5.vercel.app/api/rates",
      {
        cache: "no-store",
      }
    );

  if (!response.ok) {
    throw new Error(
      "Unable to fetch live metal rate."
    );
  }

  const data =
    await response.json();

  let rawRate: any;

  switch (rateType) {
    case "GOLD_22K":
      rawRate =
        data.gold22;
      break;

    case "GOLD_18K":
      rawRate =
        data.gold18;
      break;

    case "SILVER":
      rawRate =
        data.silver;
      break;

    default:
      rawRate = null;
  }

  const rate =
    parseFloat(
      String(
        rawRate ?? ""
      ).replace(
        /[^0-9.]/g,
        ""
      )
    );

  if (
    !Number.isFinite(
      rate
    ) ||
    rate <= 0
  ) {
    throw new Error(
      `Invalid ${rateType} rate received.`
    );
  }

  return rate;
}

// ============================================================
// GENERATE MONTHLY DATE
// ============================================================

function addMonths(
  date: Date,
  months: number
) {
  const result =
    new Date(date);

  result.setMonth(
    result.getMonth() +
      months
  );

  return result;
}

// ============================================================
// VERIFY
// ============================================================

export async function POST(
  req: Request
) {
  const origin =
    req.headers.get("origin") ||
    "";

  try {
    const body =
      await req.json();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,

      schemeId,
      userId,

      amount,

      customerAddress,
      nomineeName,
      nomineeRelation,
      nomineePhone,
      nomineeAddress,
    } = body;

    // ==========================================================
    // AUTH
    // ==========================================================

    const authHeader =
      req.headers.get(
        "Authorization"
      );

    const token =
      authHeader?.startsWith(
        "Bearer "
      )
        ? authHeader.split(
            " "
          )[1]
        : null;

    if (!token) {
      return NextResponse.json(
        {
          message:
            "Unauthorized",
        },
        {
          status: 401,
          headers:
            corsHeaders(
              origin
            ),
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
          message:
            "Invalid token",
        },
        {
          status: 401,
          headers:
            corsHeaders(
              origin
            ),
        }
      );
    }

    if (
      userId &&
      String(userId) !==
        String(
          currentUserId
        )
    ) {
      return NextResponse.json(
        {
          message:
            "User mismatch",
        },
        {
          status: 403,
          headers:
            corsHeaders(
              origin
            ),
        }
      );
    }

    // ==========================================================
    // PAYMENT DETAILS
    // ==========================================================

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !schemeId
    ) {
      return NextResponse.json(
        {
          message:
            "Incomplete payment details.",
        },
        {
          status: 400,
          headers:
            corsHeaders(
              origin
            ),
        }
      );
    }

    // ==========================================================
    // DUPLICATE PAYMENT
    // ==========================================================

    const existingPayment =
      await prisma
        .paymentHistory
        .findUnique({
          where: {
            id:
              razorpay_payment_id,
          },

          select: {
            id: true,
          },
        });

    if (
      existingPayment
    ) {
      return NextResponse.json(
        {
          status:
            "Success",

          action:
            "PAYMENT_ALREADY_PROCESSED",
        },
        {
          status: 200,
          headers:
            corsHeaders(
              origin
            ),
        }
      );
    }

    // ==========================================================
    // VERIFY SIGNATURE
    // ==========================================================

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          RAZORPAY_KEY_SECRET
        )
        .update(
          `${razorpay_order_id}|${razorpay_payment_id}`
        )
        .digest("hex");

    if (
      expectedSignature !==
      razorpay_signature
    ) {
      return NextResponse.json(
        {
          message:
            "Invalid payment signature.",
        },
        {
          status: 400,
          headers:
            corsHeaders(
              origin
            ),
        }
      );
    }

    // ==========================================================
    // FETCH RAZORPAY DATA
    // ==========================================================

    const [
      razorpayOrder,
      razorpayPayment,
    ] =
      await Promise.all([
        razorpay.orders.fetch(
          razorpay_order_id
        ),

        razorpay.payments.fetch(
          razorpay_payment_id
        ),
      ]);

    if (
      razorpayPayment.order_id !==
      razorpay_order_id
    ) {
      return NextResponse.json(
        {
          message:
            "Payment/order mismatch.",
        },
        {
          status: 400,
          headers:
            corsHeaders(
              origin
            ),
        }
      );
    }

    if (
      razorpayPayment.status !==
      "captured"
    ) {
      return NextResponse.json(
        {
          message:
            "Payment is not captured.",
        },
        {
          status: 400,
          headers:
            corsHeaders(
              origin
            ),
        }
      );
    }

    const notes =
      razorpayOrder.notes ||
      {};

    // ==========================================================
    // FETCH SCHEME + ENROLLMENT
    // ==========================================================

    const [
      scheme,
      existingEnrollment,
    ] =
      await Promise.all([
        prisma.scheme
          .findUnique({
            where: {
              id: schemeId,
            },
          }),

        prisma.customerScheme
          .findFirst({
            where: {
              customerId:
                String(
                  currentUserId
                ),

              schemeId,
            },

            include: {
              installments: {
                orderBy: {
                  installmentNumber:
                    "asc",
                },
              },

              coupon: true,
            },
          }),
      ]);

    if (!scheme) {
      return NextResponse.json(
        {
          message:
            "Scheme not found.",
        },
        {
          status: 404,
          headers:
            corsHeaders(
              origin
            ),
        }
      );
    }

    if (
      existingEnrollment
        ?.isCompleted
    ) {
      return NextResponse.json(
        {
          message:
            "Scheme already completed.",
        },
        {
          status: 400,
          headers:
            corsHeaders(
              origin
            ),
        }
      );
    }

    // ==========================================================
    // INSTALLMENT AMOUNT
    // ==========================================================

    let installmentAmount: number;

    if (
      existingEnrollment
    ) {
      installmentAmount =
        Number(
          existingEnrollment
            .installmentAmount
        );
    } else {
      installmentAmount =
        Number(
          notes
            .installmentAmount ??
            amount
        );

      if (
        !ALLOWED_INSTALLMENT_AMOUNTS.includes(
          installmentAmount
        )
      ) {
        return NextResponse.json(
          {
            message:
              "Invalid installment amount.",
          },
          {
            status: 400,
            headers:
              corsHeaders(
                origin
              ),
          }
        );
      }
    }

    if (
      !Number.isFinite(
        installmentAmount
      ) ||
      installmentAmount <= 0
    ) {
      return NextResponse.json(
        {
          message:
            "Invalid installment amount.",
        },
        {
          status: 400,
          headers:
            corsHeaders(
              origin
            ),
        }
      );
    }

    // ==========================================================
    // EXISTING ENROLLMENT:
    // FIND NEXT INSTALLMENT
    // ==========================================================

    let nextInstallment:
      | any
      | null = null;

    if (
      existingEnrollment
    ) {
      // --------------------------------------------------------
      // Mark previous unpaid months as MISSED.
      // --------------------------------------------------------

      const now =
        new Date();

      const startOfCurrentMonth =
        new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        );

      const previousUnpaid =
        existingEnrollment
          .installments
          .filter(
            (item) =>
              item.status !==
                "PAID" &&
              new Date(
                item.dueDate
              ) <
                startOfCurrentMonth
          );

      if (
        previousUnpaid.length >
        0
      ) {
        await prisma
          .schemeInstallment
          .updateMany({
            where: {
              id: {
                in:
                  previousUnpaid.map(
                    (i) =>
                      i.id
                  ),
              },
            },

            data: {
              status:
                "MISSED",
            },
          });

        return NextResponse.json(
          {
            message:
              "Previous installment is pending. Please clear missed installments at the store before continuing.",

            code:
              "MISSED_INSTALLMENT_PENDING",

            missedInstallments:
              previousUnpaid.map(
                (i) => ({
                  id:
                    i.id,

                  installmentNumber:
                    i.installmentNumber,

                  dueDate:
                    i.dueDate,

                  amount:
                    i.amount,
                })
              ),
          },
          {
            status: 400,
            headers:
              corsHeaders(
                origin
              ),
          }
        );
      }

      // --------------------------------------------------------
      // Find earliest unpaid installment.
      // --------------------------------------------------------

      nextInstallment =
        existingEnrollment
          .installments
          .find(
            (item) =>
              item.status !==
              "PAID"
          );

      if (!nextInstallment) {
        return NextResponse.json(
          {
            message:
              "No installments left.",
          },
          {
            status: 400,
            headers:
              corsHeaders(
                origin
              ),
          }
        );
      }

      // --------------------------------------------------------
      // Do not allow future month payment online.
      // --------------------------------------------------------

      const due =
        new Date(
          nextInstallment
            .dueDate
        );

      const today =
        new Date();

      if (
        due.getFullYear() >
          today.getFullYear() ||
        (
          due.getFullYear() ===
            today.getFullYear() &&
          due.getMonth() >
            today.getMonth()
        )
      ) {
        return NextResponse.json(
          {
            message:
              "Next installment is not due yet.",

            code:
              "INSTALLMENT_NOT_DUE",
          },
          {
            status: 400,
            headers:
              corsHeaders(
                origin
              ),
          }
        );
      }
    }

    // ==========================================================
    // RATE + GRAMS
    // ==========================================================

    const rateType =
      scheme.rateType;

    const rateUsed =
      await getLiveRate(
        rateType
      );

    const gramsEarned =
      rateType === "CASH"
        ? 0
        : installmentAmount /
          rateUsed;

    // ==========================================================
    // RAZORPAY AMOUNT CHECK
    // ==========================================================

    const expectedPaise =
      Math.round(
        installmentAmount *
          100
      );

    if (
      Number(
        razorpayOrder.amount
      ) !== expectedPaise ||
      Number(
        razorpayPayment.amount
      ) !== expectedPaise
    ) {
      return NextResponse.json(
        {
          message:
            "Paid amount does not match installment amount.",
        },
        {
          status: 400,
          headers:
            corsHeaders(
              origin
            ),
        }
      );
    }

    // ==========================================================
    // DB TRANSACTION
    // ==========================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // ====================================================
          // EXISTING ENROLLMENT
          // ====================================================

          if (
            existingEnrollment &&
            nextInstallment
          ) {
            const isLast =
              nextInstallment
                .installmentNumber ===
              scheme
                .durationMonths;

            // -----------------------------------------------
            // Update installment row
            // -----------------------------------------------

            await tx
              .schemeInstallment
              .update({
                where: {
                  id:
                    nextInstallment.id,
                },

                data: {
                  status:
                    "PAID",

                  paidAt:
                    new Date(),

                  paymentMode:
                    "ONLINE",

                  rateType,

                  rateUsed:
                    rateType ===
                    "CASH"
                      ? null
                      : rateUsed,

                  gramsAdded:
                    rateType ===
                    "CASH"
                      ? null
                      : gramsEarned,

                  razorpayPaymentId:
                    razorpay_payment_id,
                },
              });

            const newRemaining =
              Math.max(
                0,
                Number(
                  existingEnrollment
                    .remainingAmount
                ) -
                  installmentAmount
              );

            const updated =
              await tx
                .customerScheme
                .update({
                  where: {
                    id:
                      existingEnrollment.id,
                  },

                  data: {
                    totalPaid: {
                      increment:
                        installmentAmount,
                    },

                    remainingAmount:
                      newRemaining,

                    installmentsPaid: {
                      increment: 1,
                    },

                    installmentsLeft: {
                      decrement: 1,
                    },

                    accumulatedGrams: {
                      increment:
                        gramsEarned,
                    },

                    isCompleted:
                      isLast,
                  },
                });

            // -----------------------------------------------
            // Payment history
            // -----------------------------------------------

            await tx
              .paymentHistory
              .create({
                data: {
                  id:
                    razorpay_payment_id,

                  customerSchemeId:
                    existingEnrollment.id,

                  amountPaid:
                    installmentAmount,

                  rateType,

                  rateUsed:
                    rateType ===
                    "CASH"
                      ? null
                      : rateUsed,

                  gramsAdded:
                    rateType ===
                    "CASH"
                      ? null
                      : gramsEarned,
                },
              });

            // -----------------------------------------------
            // Coupon
            // -----------------------------------------------

            if (
              existingEnrollment
                .coupon
            ) {
              await tx.coupon
                .update({
                  where: {
                    customerSchemeId:
                      existingEnrollment.id,
                  },

                  data: {
                    totalWeightGrams:
                      rateType ===
                      "CASH"
                        ? undefined
                        : {
                            increment:
                              gramsEarned,
                          },

                    isActive:
                      isLast,
                  },
                });
            }

            return {
              type:
                "INSTALLMENT_PROCESSED",

              data:
                updated,
            };
          }

          // ====================================================
          // FIRST ENROLLMENT
          // ====================================================

          const startDate =
            new Date();

          const duration =
            scheme
              .durationMonths;

          const remainingAmount =
            Math.max(
              0,
              (
                duration -
                1
              ) *
                installmentAmount
            );

          const newCS =
            await tx
              .customerScheme
              .create({
                data: {
                  id:
                    crypto.randomUUID(),

                  customerId:
                    String(
                      currentUserId
                    ),

                  schemeId,

                  installmentAmount,

                  totalPaid:
                    installmentAmount,

                  remainingAmount,

                  installmentsPaid:
                    1,

                  installmentsLeft:
                    Math.max(
                      0,
                      duration -
                        1
                    ),

                  accumulatedGrams:
                    gramsEarned,

                  isCompleted:
                    duration ===
                    1,

                  startDate,

                  customerAddress:
                    customerAddress ||
                    null,

                  nomineeName:
                    nomineeName ||
                    "",

                  nomineeRelation:
                    nomineeRelation ||
                    "",

                  nomineePhone:
                    nomineePhone ||
                    "",

                  nomineeAddress:
                    nomineeAddress ||
                    null,
                },
              });

          // ====================================================
          // CREATE ALL MONTHLY INSTALLMENT ROWS
          // ====================================================

          for (
            let i = 1;
            i <= duration;
            i++
          ) {
            const isFirst =
              i === 1;

            await tx
              .schemeInstallment
              .create({
                data: {
                  customerSchemeId:
                    newCS.id,

                  installmentNumber:
                    i,

                  dueDate:
                    addMonths(
                      startDate,
                      i - 1
                    ),

                  amount:
                    installmentAmount,

                  status:
                    isFirst
                      ? "PAID"
                      : "UPCOMING",

                  paidAt:
                    isFirst
                      ? new Date()
                      : null,

                  paymentMode:
                    isFirst
                      ? "ONLINE"
                      : null,

                  rateType,

                  rateUsed:
                    isFirst &&
                    rateType !==
                      "CASH"
                      ? rateUsed
                      : null,

                  gramsAdded:
                    isFirst &&
                    rateType !==
                      "CASH"
                      ? gramsEarned
                      : null,

                  razorpayPaymentId:
                    isFirst
                      ? razorpay_payment_id
                      : null,
                },
              });
          }

          // ====================================================
          // PAYMENT HISTORY
          // ====================================================

          await tx
            .paymentHistory
            .create({
              data: {
                id:
                  razorpay_payment_id,

                customerSchemeId:
                  newCS.id,

                amountPaid:
                  installmentAmount,

                rateType,

                rateUsed:
                  rateType ===
                  "CASH"
                    ? null
                    : rateUsed,

                gramsAdded:
                  rateType ===
                  "CASH"
                    ? null
                    : gramsEarned,
              },
            });

          // ====================================================
          // COUPON
          // ====================================================

          const suffix =
            crypto
              .randomBytes(3)
              .toString("hex")
              .toUpperCase();

          await tx.coupon
            .create({
              data: {
                id:
                  crypto.randomUUID(),

                code:
                  `SUV-${rateType}-${suffix}`,

                customerId:
                  String(
                    currentUserId
                  ),

                schemeId,

                customerSchemeId:
                  newCS.id,

                totalCashValue:
                  rateType ===
                  "CASH"
                    ? (
                        scheme
                          .durationMonths +
                        (
                          scheme
                            .maturityMonths ||
                          0
                        )
                      ) *
                      installmentAmount
                    : 0,

                totalWeightGrams:
                  rateType ===
                  "CASH"
                    ? 0
                    : gramsEarned,

                isActive:
                  duration ===
                  1,
              },
            });

          return {
            type:
              "NEW_ENROLLMENT_STARTED",

            data:
              newCS,
          };
        }
      );

    return NextResponse.json(
      {
        status:
          "Success",

        action:
          result.type,

        summary: {
          rateType,

          installmentAmount,

          rateUsed:
            rateType ===
            "CASH"
              ? null
              : rateUsed,

          gramsAdded:
            rateType ===
            "CASH"
              ? 0
              : Number(
                  gramsEarned.toFixed(
                    4
                  )
                ),

          installmentsPaid:
            result.data
              .installmentsPaid,

          installmentsLeft:
            result.data
              .installmentsLeft,

          accumulatedGrams:
            Number(
              result.data
                .accumulatedGrams
            ).toFixed(4),
        },

        enrollment:
          result.data,
      },
      {
        status: 200,
        headers:
          corsHeaders(
            origin
          ),
      }
    );
  } catch (
    error: any
  ) {
    console.error(
      "[VERIFY ERROR]",
      error
    );

    return NextResponse.json(
      {
        status:
          "Failed",

        message:
          error?.message ||
          "Internal Server Error",
      },
      {
        status: 500,
        headers:
          corsHeaders(
            origin
          ),
      }
    );
  }
}
