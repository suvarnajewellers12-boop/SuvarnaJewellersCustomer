export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

import Razorpay from "razorpay";
import crypto from "crypto";

// ============================================================
// RAZORPAY
// ============================================================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// ============================================================
// ALLOWED FIRST-ENROLLMENT AMOUNTS
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

function corsHeaders(origin: string) {
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

export async function OPTIONS(req: Request) {
  const origin =
    req.headers.get("origin") || "";

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

// ============================================================
// VERIFY PAYMENT
// ============================================================

export async function POST(req: Request) {
  const origin =
    req.headers.get("origin") || "";

  try {
    // ==========================================================
    // 1. REQUEST BODY
    // ==========================================================

    const body = await req.json();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,

      schemeId,
      userId,

      // Flutter sends this.
      // Used only as an additional cross-check.
      amount,

      customerAddress,
      nomineeName,
      nomineeRelation,
      nomineePhone,
      nomineeAddress,
    } = body;

    // ==========================================================
    // 2. AUTHENTICATION
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
      decoded?.userId ||
      decoded?.id;

    if (!currentUserId) {
      return NextResponse.json(
        {
          message: "Invalid token",
        },
        {
          status: 401,
          headers: corsHeaders(origin),
        }
      );
    }

    // Prevent another customer ID from being passed manually.
    if (
      userId &&
      String(userId) !==
        String(currentUserId)
    ) {
      return NextResponse.json(
        {
          message: "User mismatch",
        },
        {
          status: 403,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 3. BASIC VALIDATION
    // ==========================================================

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return NextResponse.json(
        {
          message:
            "Incomplete Razorpay payment details.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    if (!schemeId) {
      return NextResponse.json(
        {
          message: "schemeId is required.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 4. PREVENT DUPLICATE PAYMENT PROCESSING
    //
    // We use razorpay_payment_id as PaymentHistory.id.
    //
    // If verify API is called twice, the second request cannot
    // add another installment.
    // ==========================================================

    const alreadyProcessed =
      await prisma.paymentHistory.findUnique({
        where: {
          id: razorpay_payment_id,
        },
      });

    if (alreadyProcessed) {
      return NextResponse.json(
        {
          status: "Success",

          action:
            "PAYMENT_ALREADY_PROCESSED",

          message:
            "Payment has already been processed.",
        },
        {
          status: 200,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 5. VERIFY RAZORPAY SIGNATURE
    // ==========================================================

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          process.env.RAZORPAY_KEY_SECRET!
        )
        .update(
          `${razorpay_order_id}|${razorpay_payment_id}`
        )
        .digest("hex");

    const expectedBuffer =
      Buffer.from(
        expectedSignature,
        "utf8"
      );

    const receivedBuffer =
      Buffer.from(
        razorpay_signature,
        "utf8"
      );

    const signatureValid =
      expectedBuffer.length ===
        receivedBuffer.length &&
      crypto.timingSafeEqual(
        expectedBuffer,
        receivedBuffer
      );

    if (!signatureValid) {
      return NextResponse.json(
        {
          message:
            "Payment verification failed.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 6. FETCH ACTUAL RAZORPAY ORDER + PAYMENT
    //
    // We don't trust only what Flutter sends us.
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

    // Payment must belong to the same Razorpay order.
    if (
      razorpayPayment.order_id !==
      razorpay_order_id
    ) {
      return NextResponse.json(
        {
          message:
            "Payment does not belong to this Razorpay order.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // We only accept INR.
    if (
      razorpayOrder.currency !==
        "INR" ||
      razorpayPayment.currency !==
        "INR"
    ) {
      return NextResponse.json(
        {
          message:
            "Invalid payment currency.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // Payment must actually be captured.
    if (
      razorpayPayment.status !==
      "captured"
    ) {
      return NextResponse.json(
        {
          message:
            `Payment is not captured. Current status: ${razorpayPayment.status}`,
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 7. VERIFY RAZORPAY ORDER NOTES
    // ==========================================================

    const notes =
      razorpayOrder.notes || {};

    if (
      notes.schemeId &&
      String(notes.schemeId) !==
        String(schemeId)
    ) {
      return NextResponse.json(
        {
          message:
            "Scheme mismatch in Razorpay order.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    if (
      notes.customerId &&
      String(notes.customerId) !==
        String(currentUserId)
    ) {
      return NextResponse.json(
        {
          message:
            "Customer mismatch in Razorpay order.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 8. FETCH SCHEME + EXISTING ENROLLMENT
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
            currentUserId,

          schemeId,
        },

        include: {
          coupon: true,
        },
      }),
    ]);

    if (!scheme) {
      return NextResponse.json(
        {
          message:
            "Scheme not found",
        },
        {
          status: 404,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 9. CHECK ENROLLMENT STATUS
    // ==========================================================

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
          headers: corsHeaders(origin),
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
          message:
            "No installments left.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 10. DETERMINE INSTALLMENT AMOUNT
    // ==========================================================

    let installmentAmount: number;

    if (existingEnrollment) {
      // ========================================================
      // EXISTING CUSTOMER
      //
      // ALWAYS use saved value.
      // Flutter cannot change it.
      // ========================================================

      installmentAmount =
        Number(
          existingEnrollment
            .installmentAmount
        );
    } else {
      // ========================================================
      // FIRST ENROLLMENT
      //
      // The create-order API stored the selected amount in
      // Razorpay notes.
      //
      // We prefer that server-created value rather than trusting
      // Flutter again.
      // ========================================================

      installmentAmount =
        Number(
          notes.installmentAmount
        );

      if (
        !Number.isFinite(
          installmentAmount
        ) ||
        installmentAmount <= 0
      ) {
        // Fallback only for compatibility.
        installmentAmount =
          Number(amount);
      }

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
      Math.round(
        installmentAmount
      );

    // ==========================================================
    // 11. VERIFY FLUTTER AMOUNT ALSO MATCHES
    //
    // This is just an additional check.
    //
    // The server still uses installmentAmount calculated above.
    // ==========================================================

    if (
      amount !== undefined &&
      amount !== null
    ) {
      const flutterAmount =
        Number(amount);

      if (
        Number.isFinite(
          flutterAmount
        ) &&
        flutterAmount !==
          installmentAmount
      ) {
        return NextResponse.json(
          {
            message:
              "Payment amount does not match the enrollment installment amount.",
          },
          {
            status: 400,
            headers: corsHeaders(origin),
          }
        );
      }
    }

    // ==========================================================
    // 12. VERIFY ACTUAL RAZORPAY AMOUNT
    // ==========================================================

    const expectedAmountInPaise =
      installmentAmount * 100;

    if (
      Number(
        razorpayOrder.amount
      ) !==
      expectedAmountInPaise
    ) {
      return NextResponse.json(
        {
          message:
            "Razorpay order amount does not match installment amount.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    if (
      Number(
        razorpayPayment.amount
      ) !==
      expectedAmountInPaise
    ) {
      return NextResponse.json(
        {
          message:
            "Paid Razorpay amount does not match installment amount.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 13. 22K GOLD RATE
    // ==========================================================

    let liveRate22K = 0;

    let gramsEarned = 0;

    if (scheme.isWeightBased) {
      const rateRes =
        await fetch(
          "https://suvarnagold-16e5.vercel.app/api/rates",
          {
            cache: "no-store",
          }
        );

      if (!rateRes.ok) {
        throw new Error(
          "Could not fetch live gold rate."
        );
      }

      const rateData =
        await rateRes.json();

      // ========================================================
      // IMPORTANT:
      // USE 22K, NOT 24K
      // ========================================================

      if (!rateData?.gold22) {
        throw new Error(
          "22K gold rate is unavailable."
        );
      }

      liveRate22K =
        parseFloat(
          String(
            rateData.gold22
          ).replace(
            /[^0-9.]/g,
            ""
          )
        );

      if (
        !Number.isFinite(
          liveRate22K
        ) ||
        liveRate22K <= 0
      ) {
        throw new Error(
          "Invalid 22K gold rate."
        );
      }

      // ========================================================
      // CUSTOMER SELECTED AMOUNT / LIVE 22K RATE
      //
      // Example:
      //
      // ₹25,000 / ₹14,000
      //
      // = 1.7857 grams
      // ========================================================

      gramsEarned =
        installmentAmount /
        liveRate22K;
    }

    // ==========================================================
    // 14. DATABASE TRANSACTION
    // ==========================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          // ----------------------------------------------------
          // Prevent processing same payment twice.
          // ----------------------------------------------------

          const duplicatePayment =
            await tx.paymentHistory.findUnique({
              where: {
                id:
                  razorpay_payment_id,
              },
            });

          if (duplicatePayment) {
            return {
              type:
                "PAYMENT_ALREADY_PROCESSED",

              data:
                existingEnrollment!,
            };
          }

          // ====================================================
          // EXISTING ENROLLMENT
          // ====================================================

          if (
            existingEnrollment
          ) {
            const isLastPayment =
              existingEnrollment
                .installmentsLeft === 1;

            const newRemainingAmount =
              Math.max(
                0,

                Number(
                  existingEnrollment
                    .remainingAmount
                ) -
                  installmentAmount
              );

            const updated =
              await tx.customerScheme.update({
                where: {
                  id:
                    existingEnrollment.id,
                },

                data: {
                  totalPaid: {
                    increment:
                      installmentAmount,
                  },

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

                  remainingAmount:
                    newRemainingAmount,

                  isCompleted:
                    isLastPayment,
                },

                include: {
                  coupon: true,
                },
              });

            // ==================================================
            // COUPON
            // ==================================================

            if (
              !existingEnrollment
                .coupon
            ) {
              const uniqueSuffix =
                crypto
                  .randomBytes(3)
                  .toString("hex")
                  .toUpperCase();

              await tx.coupon.create({
                data: {
                  id:
                    crypto.randomUUID(),

                  code:
                    `SUV-${scheme.isWeightBased ? "W" : "V"}-${uniqueSuffix}`,

                  customerId:
                    currentUserId,

                  schemeId,

                  customerSchemeId:
                    existingEnrollment.id,

                  totalCashValue:
                    !scheme.isWeightBased
                      ? (
                            scheme.durationMonths +
                            (
                              scheme.maturityMonths ||
                              0
                            )
                          ) *
                          installmentAmount
                      : 0,

                  totalWeightGrams:
                    scheme.isWeightBased
                      ? gramsEarned
                      : 0,

                  isActive:
                    isLastPayment,
                },
              });
            } else {
              await tx.coupon.update({
                where: {
                  customerSchemeId:
                    existingEnrollment.id,
                },

                data: {
                  totalWeightGrams:
                    scheme.isWeightBased
                      ? {
                          increment:
                            gramsEarned,
                        }
                      : undefined,

                  isActive:
                    isLastPayment,
                },
              });
            }

            // ==================================================
            // PAYMENT HISTORY
            // ==================================================

            await tx.paymentHistory.create({
              data: {
                // Razorpay payment ID makes the payment unique.
                id:
                  razorpay_payment_id,

                customerSchemeId:
                  existingEnrollment.id,

                amountPaid:
                  installmentAmount,

                // SEE NOTE BELOW ABOUT FIELD NAME.
                liveRate22K:
                  scheme.isWeightBased
                    ? liveRate22K
                    : null,

                gramsAdded:
                  scheme.isWeightBased
                    ? gramsEarned
                    : null,
              },
            });

            return {
              type:
                "INSTALLMENT_PROCESSED",

              data: updated,
            };
          }

          // ====================================================
          // NEW ENROLLMENT
          // ====================================================

          const installmentsLeft =
            Math.max(
              0,
              scheme.durationMonths -
                1
            );

          const isCompleted =
            installmentsLeft === 0;

          const remainingAmount =
            installmentsLeft *
            installmentAmount;

          const newCS =
            await tx.customerScheme.create({
              data: {
                id:
                  crypto.randomUUID(),

                customerId:
                  currentUserId,

                schemeId,

                // ==============================================
                // NEW FIELD
                //
                // Customer selected this value.
                // It stays fixed for all future installments.
                // ==============================================

                installmentAmount,

                totalPaid:
                  installmentAmount,

                remainingAmount,

                installmentsPaid:
                  1,

                installmentsLeft,

                accumulatedGrams:
                  gramsEarned,

                isCompleted,

                // ==============================================
                // ENROLLMENT DETAILS
                // Set only during first enrollment.
                // ==============================================

                customerAddress:
                  customerAddress ||
                  null,

                nomineeName:
                  nomineeName || "",

                nomineeRelation:
                  nomineeRelation ||
                  "",

                nomineePhone:
                  nomineePhone || "",

                nomineeAddress:
                  nomineeAddress ||
                  null,
              },
            });

          // ====================================================
          // CREATE COUPON
          // ====================================================

          const uniqueSuffix =
            crypto
              .randomBytes(3)
              .toString("hex")
              .toUpperCase();

          await tx.coupon.create({
            data: {
              id:
                crypto.randomUUID(),

              code:
                `SUV-${scheme.isWeightBased ? "W" : "V"}-${uniqueSuffix}`,

              customerId:
                currentUserId,

              schemeId,

              customerSchemeId:
                newCS.id,

              // ================================================
              // CASH SCHEME
              //
              // Uses customer's selected installment.
              //
              // Example:
              //
              // ₹25,000 × (11 + 1)
              // ================================================

              totalCashValue:
                !scheme.isWeightBased
                  ? (
                        scheme.durationMonths +
                        (
                          scheme.maturityMonths ||
                          0
                        )
                      ) *
                      installmentAmount
                  : 0,

              totalWeightGrams:
                scheme.isWeightBased
                  ? gramsEarned
                  : 0,

              isActive:
                isCompleted,
            },
          });

          // ====================================================
          // FIRST PAYMENT HISTORY
          // ====================================================

          await tx.paymentHistory.create({
            data: {
              id:
                razorpay_payment_id,

              customerSchemeId:
                newCS.id,

              amountPaid:
                installmentAmount,

              liveRate22K:
                scheme.isWeightBased
                  ? liveRate22K
                  : null,

              gramsAdded:
                scheme.isWeightBased
                  ? gramsEarned
                  : null,
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

    // ==========================================================
    // 15. SUCCESS RESPONSE
    // ==========================================================

    return NextResponse.json(
      {
        status: "Success",

        action:
          result.type,

        summary: {
          installmentAmount,

          transactionAmount:
            installmentAmount,

          installmentsLeft:
            result.data
              .installmentsLeft,

          marketRate22K:
            scheme.isWeightBased
              ? liveRate22K
              : null,

          transactionGrams:
            scheme.isWeightBased
              ? gramsEarned.toFixed(
                  4
                )
              : "0.0000",

          totalVaultBalance:
            Number(
              result.data
                .accumulatedGrams
            ).toFixed(4),

          totalPaid:
            result.data
              .totalPaid,

          remainingAmount:
            result.data
              .remainingAmount,
        },

        enrollment:
          result.data,
      },
      {
        status: 200,
        headers: corsHeaders(origin),
      }
    );
  } catch (error: any) {
    console.error(
      "VERIFY ERROR:",
      error
    );

    return NextResponse.json(
      {
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
