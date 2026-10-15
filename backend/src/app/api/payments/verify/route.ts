export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import Razorpay from "razorpay";
import crypto from "crypto";

// ============================================================
// RAZORPAY TEST CREDENTIALS
// ============================================================

const RAZORPAY_KEY_ID = "rzp_test_TlLhkVrMSDh6az";
const RAZORPAY_KEY_SECRET = "e5VaoxSOW3ygy4kKHblZIir5";

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
  const allowedOrigin = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ============================================================
// OPTIONS
// ============================================================

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") || "";

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

// ============================================================
// VERIFY PAYMENT
// ============================================================

export async function POST(req: Request) {
  const origin = req.headers.get("origin") || "";

  try {
    // ==========================================================
    // 1. READ BODY
    // ==========================================================

    const body = await req.json();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,

      schemeId,
      userId,

      // Selected amount sent by Flutter.
      amount,

      // Enrollment details.
      customerAddress,
      nomineeName,
      nomineeRelation,
      nomineePhone,
      nomineeAddress,
    } = body;

    // ==========================================================
    // 2. AUTH
    // ==========================================================

    const authHeader = req.headers.get("Authorization");

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

    const decoded: any = verifyToken(token);

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

    // Prevent client from passing another customer's ID.
    if (
      userId &&
      String(userId) !== String(currentUserId)
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
    // 3. BASIC PAYMENT VALIDATION
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
    // 4. DUPLICATE PAYMENT CHECK
    // ==========================================================

    const existingPayment =
      await prisma.paymentHistory.findUnique({
        where: {
          id: razorpay_payment_id,
        },
      });

    if (existingPayment) {
      return NextResponse.json(
        {
          status: "Success",
          action: "PAYMENT_ALREADY_PROCESSED",
          message:
            "This Razorpay payment has already been processed.",
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

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        RAZORPAY_KEY_SECRET
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
            "Payment verification failed. Invalid Razorpay signature.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 6. FETCH REAL RAZORPAY ORDER + PAYMENT
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

    // ----------------------------------------------------------
    // PAYMENT MUST BELONG TO SAME ORDER
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // CURRENCY
    // ----------------------------------------------------------

    if (
      razorpayOrder.currency !== "INR" ||
      razorpayPayment.currency !== "INR"
    ) {
      return NextResponse.json(
        {
          message:
            "Invalid Razorpay currency.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // ----------------------------------------------------------
    // CAPTURE STATUS
    // ----------------------------------------------------------

    if (
      razorpayPayment.status !== "captured"
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
    // 7. CHECK RAZORPAY ORDER NOTES
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
    // 8. FETCH SCHEME + ENROLLMENT
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
          message: "Scheme not found.",
        },
        {
          status: 404,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 9. CHECK CURRENT ENROLLMENT
    // ==========================================================

    if (
      existingEnrollment?.isCompleted
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
      existingEnrollment.installmentsLeft <= 0
    ) {
      return NextResponse.json(
        {
          message:
            "No installments left to pay.",
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
      // LATER MONTHLY PAYMENT
      //
      // NEVER use Flutter amount here.
      //
      // Use amount saved when customer first enrolled.
      // ========================================================

      installmentAmount =
        Number(
          existingEnrollment.installmentAmount
        );
    } else {
      // ========================================================
      // FIRST ENROLLMENT
      //
      // create-order stores selected amount in Razorpay notes.
      // ========================================================

      installmentAmount =
        Number(
          notes.installmentAmount
        );

      // Fallback if old create-order does not have notes.
      if (
        !Number.isFinite(
          installmentAmount
        ) ||
        installmentAmount <= 0
      ) {
        installmentAmount =
          Number(amount);
      }

      // Only allow dropdown values.
      if (
        !ALLOWED_INSTALLMENT_AMOUNTS.includes(
          installmentAmount
        )
      ) {
        return NextResponse.json(
          {
            message:
              "Invalid installment amount.",
            allowedAmounts:
              ALLOWED_INSTALLMENT_AMOUNTS,
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
    // 11. CHECK AMOUNT SENT BY FLUTTER
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
              "Payment amount does not match the customer's installment amount.",
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
            "Razorpay order amount does not match the installment amount.",
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
            "Paid amount does not match the installment amount.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 13. WEIGHT BASED SCHEME - FETCH 22K RATE
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
          "Unable to fetch live gold rate."
        );
      }

      const rateData =
        await rateRes.json();

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
          "Invalid 22K gold rate received."
        );
      }

      // ========================================================
      // GOLD GRAMS
      //
      // selected installment / current 22K rate
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

            // --------------------------------------------------
            // UPDATE CUSTOMER SCHEME
            // --------------------------------------------------

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

                  remainingAmount:
                    newRemainingAmount,

                  accumulatedGrams: {
                    increment:
                      gramsEarned,
                  },

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
              !existingEnrollment.coupon
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
                    `SUV-${
                      scheme.isWeightBased
                        ? "W"
                        : "V"
                    }-${uniqueSuffix}`,

                  customerId:
                    currentUserId,

                  schemeId,

                  customerSchemeId:
                    existingEnrollment.id,

                  // --------------------------------------------
                  // NON-WEIGHTED
                  // --------------------------------------------

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

                  // --------------------------------------------
                  // WEIGHTED
                  // --------------------------------------------

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
                  // Only weighted schemes accumulate grams.
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
                // Razorpay payment IDs are unique,
                // so using it prevents same payment being added twice.
                id:
                  razorpay_payment_id,

                customerSchemeId:
                  existingEnrollment.id,

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
                "INSTALLMENT_PROCESSED",

              data:
                updated,
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

          // ----------------------------------------------------
          // CREATE CUSTOMER SCHEME
          // ----------------------------------------------------

          const newCS =
            await tx.customerScheme.create({
              data: {
                id:
                  crypto.randomUUID(),

                customerId:
                  currentUserId,

                schemeId,

                // ==============================================
                // CUSTOMER SELECTED AMOUNT
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
                // NOMINEE / ADDRESS DATA
                // ==============================================

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
                `SUV-${
                  scheme.isWeightBased
                    ? "W"
                    : "V"
                }-${uniqueSuffix}`,

              customerId:
                currentUserId,

              schemeId,

              customerSchemeId:
                newCS.id,

              // -----------------------------------------------
              // NON-WEIGHTED SCHEME
              //
              // Example:
              // ₹5,000 × (11 + 1)
              // -----------------------------------------------

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

              // -----------------------------------------------
              // WEIGHTED SCHEME
              // -----------------------------------------------

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
        },
        {
          timeout: 10000,
        }
      );

    // ==========================================================
    // 15. SUCCESS
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

          installmentsPaid:
            result.data.installmentsPaid,

          installmentsLeft:
            result.data.installmentsLeft,

          totalPaid:
            result.data.totalPaid,

          remainingAmount:
            result.data.remainingAmount,

          // ----------------------------------------------------
          // GOLD DATA
          // ----------------------------------------------------

          marketRate22K:
            scheme.isWeightBased
              ? liveRate22K
              : null,

          transactionGrams:
            scheme.isWeightBased
              ? Number(
                  gramsEarned.toFixed(4)
                )
              : 0,

          totalVaultBalance:
            scheme.isWeightBased
              ? Number(
                  Number(
                    result.data
                      .accumulatedGrams
                  ).toFixed(4)
                )
              : 0,

          isCompleted:
            result.data.isCompleted,
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
      "SCHEME PAYMENT VERIFY ERROR:",
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
