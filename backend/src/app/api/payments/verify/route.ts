export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import Razorpay from "razorpay";
import crypto from "crypto";

const RAZORPAY_KEY_ID =
  "rzp_test_TlLhkVrMSDh6az";

const RAZORPAY_KEY_SECRET =
  "e5VaoxSOW3ygy4kKHblZIir5";

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
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

type SchemeRateTypeValue =
  | "CASH"
  | "GOLD_22K"
  | "GOLD_18K"
  | "SILVER";

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",
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

function normalizeRateType(value: unknown): SchemeRateTypeValue {
  const rateType = String(value || "CASH").toUpperCase();

  if (
    rateType === "GOLD_22K" ||
    rateType === "GOLD_18K" ||
    rateType === "SILVER"
  ) {
    return rateType;
  }

  return "CASH";
}

async function getLiveRate(
  rateType: SchemeRateTypeValue
) {
  if (rateType === "CASH") {
    return 0;
  }

  const response = await fetch(
    "https://suvarnagold-16e5.vercel.app/api/rates",
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      "Unable to fetch the current metal rate."
    );
  }

  const data = await response.json();

  const rawRate =
    rateType === "GOLD_22K"
      ? data.gold22
      : rateType === "GOLD_18K"
      ? data.gold18
      : data.silver;

  const rate = parseFloat(
    String(rawRate ?? "").replace(/[^0-9.]/g, "")
  );

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(
      `Invalid ${rateType} rate received.`
    );
  }

  return rate;
}

// Creates the same calendar-day schedule where possible.
// Example: Jan 31 -> Feb 28/29 -> Mar 31.
function addMonthsSafe(
  source: Date,
  monthsToAdd: number
) {
  const sourceDay = source.getDate();

  const target = new Date(
    source.getFullYear(),
    source.getMonth() + monthsToAdd,
    1,
    source.getHours(),
    source.getMinutes(),
    source.getSeconds(),
    source.getMilliseconds()
  );

  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0
  ).getDate();

  target.setDate(
    Math.min(sourceDay, lastDay)
  );

  return target;
}

function monthKey(date: Date) {
  return date.getFullYear() * 12 + date.getMonth();
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
      amount,
      customerAddress,
      nomineeName,
      nomineeRelation,
      nomineePhone,
      nomineeAddress,
    } = body;

    // ==========================================================
    // 1. AUTH
    // ==========================================================

    const authHeader =
      req.headers.get("Authorization");

    const token =
      authHeader?.startsWith("Bearer ")
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

    const decoded: any =
      verifyToken(token);

    const currentUserId =
      decoded?.userId || decoded?.id;

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

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !schemeId
    ) {
      return NextResponse.json(
        {
          status: "Failed",
          message:
            "Incomplete payment verification details.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 2. IDEMPOTENCY
    // ==========================================================

    const alreadyProcessed =
      await prisma.paymentHistory.findUnique({
        where: {
          id: razorpay_payment_id,
        },
        select: {
          id: true,
          customerSchemeId: true,
        },
      });

    if (alreadyProcessed) {
      return NextResponse.json(
        {
          status: "Success",
          action: "PAYMENT_ALREADY_PROCESSED",
          message:
            "This payment was already processed.",
        },
        {
          status: 200,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 3. SIGNATURE
    // ==========================================================

    const expectedSignature = crypto
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
          status: "Failed",
          message:
            "Invalid payment signature.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 4. RAZORPAY ORDER + PAYMENT
    // ==========================================================

    const [
      razorpayOrder,
      razorpayPayment,
    ] = await Promise.all([
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
          status: "Failed",
          message:
            "Payment and order do not match.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    if (
      razorpayPayment.status !==
      "captured"
    ) {
      return NextResponse.json(
        {
          status: "Failed",
          message:
            "Payment has not been captured.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    if (
      String(razorpayOrder.currency).toUpperCase() !==
        "INR" ||
      String(razorpayPayment.currency).toUpperCase() !==
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
          headers: corsHeaders(origin),
        }
      );
    }

    const notes: any =
      razorpayOrder.notes || {};

    if (
      String(notes.customerId || "") !==
        String(currentUserId) ||
      String(notes.schemeId || "") !==
        String(schemeId)
    ) {
      return NextResponse.json(
        {
          status: "Failed",
          message:
            "Razorpay order metadata does not match this customer or scheme.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 5. SCHEME + CURRENT ENROLLMENT
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
              installmentNumber: "asc",
            },
          },
          coupon: true,
        },
      }),
    ]);

    if (!scheme) {
      return NextResponse.json(
        {
          status: "Failed",
          message: "Scheme not found.",
        },
        {
          status: 404,
          headers: corsHeaders(origin),
        }
      );
    }

    const rateType =
      normalizeRateType(scheme.rateType);

    if (
      notes.rateType &&
      String(notes.rateType) !== rateType
    ) {
      return NextResponse.json(
        {
          status: "Failed",
          message:
            "Scheme rate type changed after the payment order was created.",
        },
        {
          status: 409,
          headers: corsHeaders(origin),
        }
      );
    }

    if (
      !Number.isInteger(scheme.durationMonths) ||
      scheme.durationMonths <= 0
    ) {
      return NextResponse.json(
        {
          status: "Failed",
          message:
            "Scheme duration is invalid.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 6. AMOUNT
    // ==========================================================

    let installmentAmount: number;

    if (existingEnrollment) {
      installmentAmount = Number(
        existingEnrollment.installmentAmount
      );

      if (
        notes.paymentType !== "INSTALLMENT" ||
        String(notes.customerSchemeId || "") !==
          String(existingEnrollment.id)
      ) {
        return NextResponse.json(
          {
            status: "Failed",
            message:
              "This payment order does not belong to the current installment.",
          },
          {
            status: 409,
            headers: corsHeaders(origin),
          }
        );
      }
    } else {
      installmentAmount = Number(
        notes.installmentAmount ?? amount
      );

      if (
        notes.paymentType &&
        notes.paymentType !==
          "NEW_ENROLLMENT"
      ) {
        return NextResponse.json(
          {
            status: "Failed",
            message:
              "Invalid enrollment payment type.",
          },
          {
            status: 409,
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
              "Invalid installment amount.",
          },
          {
            status: 400,
            headers: corsHeaders(origin),
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
          status: "Failed",
          message:
            "Invalid installment amount.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    installmentAmount =
      Math.round(installmentAmount);

    if (
      Number(notes.installmentAmount) !==
      installmentAmount
    ) {
      return NextResponse.json(
        {
          status: "Failed",
          message:
            "Razorpay order installment amount does not match the enrollment.",
        },
        {
          status: 409,
          headers: corsHeaders(origin),
        }
      );
    }

    const expectedPaise =
      installmentAmount * 100;

    if (
      Number(razorpayOrder.amount) !==
        expectedPaise ||
      Number(razorpayPayment.amount) !==
        expectedPaise
    ) {
      return NextResponse.json(
        {
          status: "Failed",
          message:
            "Paid amount does not match the installment amount.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 7. EXISTING ENROLLMENT MONTH VALIDATION
    // ==========================================================

    let selectedInstallment: any = null;

    if (existingEnrollment) {
      if (
        existingEnrollment.isCompleted ||
        existingEnrollment.installmentsLeft <= 0
      ) {
        return NextResponse.json(
          {
            status: "Failed",
            code: "SCHEME_COMPLETED",
            message:
              "Scheme is already completed.",
          },
          {
            status: 400,
            headers: corsHeaders(origin),
          }
        );
      }

      if (
        existingEnrollment.installments.length ===
        0
      ) {
        return NextResponse.json(
          {
            status: "Failed",
            code: "INSTALLMENT_DATA_MISSING",
            message:
              "Installment schedule is missing for this enrollment.",
          },
          {
            status: 409,
            headers: corsHeaders(origin),
          }
        );
      }

      const now = new Date();
      const currentMonthStart =
        new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        );

      const previousUnpaid =
        existingEnrollment.installments.filter(
          (item) =>
            item.status !== "PAID" &&
            new Date(item.dueDate) <
              currentMonthStart
        );

      if (previousUnpaid.length > 0) {
        await prisma.schemeInstallment.updateMany({
          where: {
            id: {
              in: previousUnpaid.map(
                (item) => item.id
              ),
            },
          },
          data: {
            status: "MISSED",
          },
        });

        return NextResponse.json(
          {
            status: "Failed",
            code:
              "MISSED_INSTALLMENT_PENDING",
            message:
              "A previous installment is missed. Please clear it at the store before continuing.",
          },
          {
            status: 409,
            headers: corsHeaders(origin),
          }
        );
      }

      const existingMissed =
        existingEnrollment.installments.filter(
          (item) =>
            item.status === "MISSED"
        );

      if (existingMissed.length > 0) {
        return NextResponse.json(
          {
            status: "Failed",
            code:
              "MISSED_INSTALLMENT_PENDING",
            message:
              "A previous installment is missed. Please clear it at the store before continuing.",
          },
          {
            status: 409,
            headers: corsHeaders(origin),
          }
        );
      }

      const earliestUnpaid =
        existingEnrollment.installments.find(
          (item) =>
            item.status !== "PAID"
        );

      if (!earliestUnpaid) {
        return NextResponse.json(
          {
            status: "Failed",
            code:
              "NO_INSTALLMENTS_LEFT",
            message:
              "No installments are left to pay.",
          },
          {
            status: 400,
            headers: corsHeaders(origin),
          }
        );
      }

      if (
        String(notes.installmentId || "") !==
          String(earliestUnpaid.id) ||
        Number(
          notes.installmentNumber
        ) !==
          earliestUnpaid.installmentNumber
      ) {
        return NextResponse.json(
          {
            status: "Failed",
            message:
              "This payment order belongs to a different installment. Please refresh and try again.",
          },
          {
            status: 409,
            headers: corsHeaders(origin),
          }
        );
      }

      if (
        monthKey(
          new Date(earliestUnpaid.dueDate)
        ) > monthKey(now)
      ) {
        return NextResponse.json(
          {
            status: "Failed",
            code:
              "INSTALLMENT_NOT_DUE",
            message:
              "Next installment is not due yet.",
          },
          {
            status: 400,
            headers: corsHeaders(origin),
          }
        );
      }

      selectedInstallment =
        earliestUnpaid;
    }

    // ==========================================================
    // 8. RATE + LOCKED GRAMS
    // ==========================================================

    const rateUsed =
      await getLiveRate(rateType);

    const gramsEarned =
      rateType === "CASH"
        ? 0
        : installmentAmount / rateUsed;

    if (
      rateType !== "CASH" &&
      (!Number.isFinite(gramsEarned) ||
        gramsEarned <= 0)
    ) {
      throw new Error(
        "Unable to calculate locked grams."
      );
    }

    // ==========================================================
    // 9. TRANSACTION
    // ==========================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          const duplicateInsideTx =
            await tx.paymentHistory.findUnique({
              where: {
                id: razorpay_payment_id,
              },
              select: {
                id: true,
              },
            });

          if (duplicateInsideTx) {
            return {
              type:
                "PAYMENT_ALREADY_PROCESSED",
              data: null,
            };
          }

          // ====================================================
          // EXISTING ENROLLMENT
          // ====================================================

          if (
            existingEnrollment &&
            selectedInstallment
          ) {
            const latestEnrollment =
              await tx.customerScheme.findUnique({
                where: {
                  id: existingEnrollment.id,
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
              });

            if (!latestEnrollment) {
              throw new Error(
                "Enrollment no longer exists."
              );
            }

            const latestTarget =
              latestEnrollment.installments.find(
                (item) =>
                  item.id ===
                  selectedInstallment.id
              );

            if (
              !latestTarget ||
              latestTarget.status !==
                "UPCOMING"
            ) {
              throw new Error(
                "This installment has already been processed or changed."
              );
            }

            const previousUnpaid =
              latestEnrollment.installments.filter(
                (item) =>
                  item.installmentNumber <
                    latestTarget.installmentNumber &&
                  item.status !== "PAID"
              );

            if (
              previousUnpaid.length > 0
            ) {
              throw new Error(
                "A previous installment is still unpaid."
              );
            }

            await tx.schemeInstallment.update({
              where: {
                id: latestTarget.id,
              },
              data: {
                status: "PAID",
                paidAt: new Date(),
                paymentMode: "ONLINE",
                rateType,
                rateUsed:
                  rateType === "CASH"
                    ? null
                    : rateUsed,
                gramsAdded:
                  rateType === "CASH"
                    ? null
                    : gramsEarned,
                razorpayPaymentId:
                  razorpay_payment_id,
              },
            });

            const newPaidCount =
              latestEnrollment.installmentsPaid + 1;

            const newLeftCount =
              Math.max(
                0,
                latestEnrollment.installmentsLeft -
                  1
              );

            const completed =
              newLeftCount === 0 ||
              newPaidCount >=
                scheme.durationMonths;

            const newRemaining =
              newLeftCount *
              installmentAmount;

            const updatedEnrollment =
              await tx.customerScheme.update({
                where: {
                  id: latestEnrollment.id,
                },
                data: {
                  totalPaid: {
                    increment:
                      installmentAmount,
                  },
                  remainingAmount:
                    newRemaining,
                  installmentsPaid:
                    newPaidCount,
                  installmentsLeft:
                    newLeftCount,
                  accumulatedGrams: {
                    increment:
                      gramsEarned,
                  },
                  isCompleted:
                    completed,
                },
              });

            await tx.paymentHistory.create({
              data: {
                id:
                  razorpay_payment_id,
                customerSchemeId:
                  latestEnrollment.id,
                amountPaid:
                  installmentAmount,
                liveRate22K:
                  rateType ===
                  "GOLD_22K"
                    ? rateUsed
                    : null,
                rateType,
                rateUsed:
                  rateType === "CASH"
                    ? null
                    : rateUsed,
                gramsAdded:
                  rateType === "CASH"
                    ? null
                    : gramsEarned,
                paymentMode: "ONLINE",
                reference:
                  razorpay_order_id,
              },
            });

            if (latestEnrollment.coupon) {
              await tx.coupon.update({
                where: {
                  customerSchemeId:
                    latestEnrollment.id,
                },
                data: {
                  ...(rateType !== "CASH"
                    ? {
                        totalWeightGrams: {
                          increment:
                            gramsEarned,
                        },
                      }
                    : {}),
                  isActive:
                    completed,
                },
              });
            }

            return {
              type:
                "INSTALLMENT_PROCESSED",
              data:
                updatedEnrollment,
            };
          }

          // ====================================================
          // FIRST ENROLLMENT
          // ====================================================

          const enrollmentExistsNow =
            await tx.customerScheme.findFirst({
              where: {
                customerId:
                  String(currentUserId),
                schemeId,
              },
              select: {
                id: true,
              },
            });

          if (enrollmentExistsNow) {
            throw new Error(
              "An enrollment for this scheme already exists."
            );
          }

          const startDate =
            new Date();

          const duration =
            scheme.durationMonths;

          const installmentsLeft =
            Math.max(0, duration - 1);

          const newCS =
            await tx.customerScheme.create({
              data: {
                id:
                  crypto.randomUUID(),
                customerId:
                  String(currentUserId),
                schemeId,
                installmentAmount,
                totalPaid:
                  installmentAmount,
                remainingAmount:
                  installmentsLeft *
                  installmentAmount,
                installmentsPaid: 1,
                installmentsLeft,
                accumulatedGrams:
                  gramsEarned,
                isCompleted:
                  installmentsLeft === 0,
                startDate,
                customerAddress:
                  customerAddress || null,
                nomineeName:
                  nomineeName || "",
                nomineeRelation:
                  nomineeRelation || "",
                nomineePhone:
                  nomineePhone || "",
                nomineeAddress:
                  nomineeAddress || null,
              },
            });

          const installmentRows =
            Array.from(
              {
                length: duration,
              },
              (_, index) => {
                const installmentNumber =
                  index + 1;
                const isFirst =
                  installmentNumber === 1;

                return {
                  customerSchemeId:
                    newCS.id,
                  installmentNumber,
                  dueDate:
                    addMonthsSafe(
                      startDate,
                      index
                    ),
                  amount:
                    installmentAmount,
                  status: isFirst
                    ? ("PAID" as const)
                    : ("UPCOMING" as const),
                  paidAt: isFirst
                    ? new Date()
                    : null,
                  paymentMode: isFirst
                    ? ("ONLINE" as const)
                    : null,
                  rateType,
                  rateUsed:
                    isFirst &&
                    rateType !== "CASH"
                      ? rateUsed
                      : null,
                  gramsAdded:
                    isFirst &&
                    rateType !== "CASH"
                      ? gramsEarned
                      : null,
                  razorpayPaymentId:
                    isFirst
                      ? razorpay_payment_id
                      : null,
                };
              }
            );

          await tx.schemeInstallment.createMany({
            data:
              installmentRows,
          });

          await tx.paymentHistory.create({
            data: {
              id:
                razorpay_payment_id,
              customerSchemeId:
                newCS.id,
              amountPaid:
                installmentAmount,
              liveRate22K:
                rateType ===
                "GOLD_22K"
                  ? rateUsed
                  : null,
              rateType,
              rateUsed:
                rateType === "CASH"
                  ? null
                  : rateUsed,
              gramsAdded:
                rateType === "CASH"
                  ? null
                  : gramsEarned,
              paymentMode: "ONLINE",
              reference:
                razorpay_order_id,
            },
          });

          const suffix = crypto
            .randomBytes(3)
            .toString("hex")
            .toUpperCase();

          await tx.coupon.create({
            data: {
              id:
                crypto.randomUUID(),
              code:
                `SUV-${rateType}-${suffix}`,
              customerId:
                String(currentUserId),
              schemeId,
              customerSchemeId:
                newCS.id,
              totalCashValue:
                rateType === "CASH"
                  ? (
                      scheme.durationMonths +
                      (scheme.maturityMonths ||
                        0)
                    ) *
                    installmentAmount
                  : 0,
              totalWeightGrams:
                rateType === "CASH"
                  ? 0
                  : gramsEarned,
              isActive:
                installmentsLeft === 0,
              type:
                rateType === "CASH"
                  ? "CASH"
                  : "WEIGHT",
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

    if (
      result.type ===
      "PAYMENT_ALREADY_PROCESSED"
    ) {
      return NextResponse.json(
        {
          status: "Success",
          action:
            "PAYMENT_ALREADY_PROCESSED",
        },
        {
          status: 200,
          headers: corsHeaders(origin),
        }
      );
    }

    const enrollment = result.data!;

    return NextResponse.json(
      {
        status: "Success",
        action: result.type,
        summary: {
          rateType,
          installmentAmount,
          rateUsed:
            rateType === "CASH"
              ? null
              : rateUsed,
          gramsAdded:
            rateType === "CASH"
              ? 0
              : Number(
                  gramsEarned.toFixed(4)
                ),
          installmentsPaid:
            enrollment.installmentsPaid,
          installmentsLeft:
            enrollment.installmentsLeft,
          accumulatedGrams:
            Number(
              enrollment.accumulatedGrams
            ).toFixed(4),
        },
        enrollment,
      },
      {
        status: 200,
        headers: corsHeaders(origin),
      }
    );
  } catch (error: any) {
    console.error(
      "[VERIFY ERROR]",
      error
    );

    return NextResponse.json(
      {
        status: "Failed",
        message:
          error?.message ||
          "Internal Server Error",
      },
      {
        status: 500,
        headers: corsHeaders(origin),
      }
    );
  }
}
