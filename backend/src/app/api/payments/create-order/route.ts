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

// ============================================================
// AMOUNTS AVAILABLE IN FLUTTER DROPDOWN
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

// ============================================================
// CREATE RAZORPAY ORDER
// ============================================================

export async function POST(req: Request) {
  const origin = req.headers.get("origin") || "";

  try {
    // ==========================================================
    // 1. AUTHENTICATION
    // ==========================================================

    const authHeader = req.headers.get("Authorization");

    const token = authHeader?.startsWith("Bearer ")
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

    // ==========================================================
    // 2. READ REQUEST BODY
    // ==========================================================

    const body = await req.json();

    const {
      schemeId,

      // This is chosen from the dropdown during FIRST enrollment.
      amount,

      currency = "INR",

      // Flutter currently sends this.
      userId,
    } = body;

    if (!schemeId) {
      return NextResponse.json(
        {
          message: "schemeId is required",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // Prevent customer ID manipulation.
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
    // 3. GET SCHEME + CURRENT ENROLLMENT
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
            customerId: currentUserId,
            schemeId,
          },
        }),
      ]);

    if (!scheme) {
      return NextResponse.json(
        {
          message: "Scheme not found",
        },
        {
          status: 404,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 4. CHECK CURRENT ENROLLMENT STATUS
    // ==========================================================

    if (existingEnrollment?.isCompleted) {
      return NextResponse.json(
        {
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
          message: "No installments left to pay.",
        },
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );
    }

    // ==========================================================
    // 5. DETERMINE AMOUNT TO CHARGE
    // ==========================================================

    let installmentAmount: number;

    if (existingEnrollment) {
      // ========================================================
      // EXISTING ENROLLMENT
      //
      // Do NOT trust an amount from Flutter.
      //
      // Example:
      // Customer originally selected ₹25,000.
      //
      // Month 2, 3, 4... must ALWAYS be ₹25,000.
      // ========================================================

      installmentAmount = Number(
        existingEnrollment.installmentAmount
      );

      if (
        !Number.isFinite(installmentAmount) ||
        installmentAmount <= 0
      ) {
        return NextResponse.json(
          {
            message:
              "Invalid installment amount stored for this enrollment.",
          },
          {
            status: 400,
            headers: corsHeaders(origin),
          }
        );
      }
    } else {
      // ========================================================
      // FIRST ENROLLMENT
      //
      // Here we accept the dropdown amount.
      // ========================================================

      installmentAmount = Number(amount);

      if (
        !Number.isFinite(installmentAmount) ||
        installmentAmount <= 0
      ) {
        return NextResponse.json(
          {
            message: "Please select an installment amount.",
          },
          {
            status: 400,
            headers: corsHeaders(origin),
          }
        );
      }

      // Server-side validation.
      if (
        !ALLOWED_INSTALLMENT_AMOUNTS.includes(
          installmentAmount
        )
      ) {
        return NextResponse.json(
          {
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

    installmentAmount =
      Math.round(installmentAmount);

    // ==========================================================
    // 6. CONVERT RUPEES -> PAISE
    // ==========================================================

    const amountInPaise =
      installmentAmount * 100;

    // ==========================================================
    // 7. CREATE RAZORPAY ORDER
    // ==========================================================

    const order =
      await razorpay.orders.create({
        amount: amountInPaise,

        currency:
          String(currency).toUpperCase(),

        receipt:
          `scheme_${Date.now()}`,

        // These values are useful during verify.
        notes: {
          customerId:
            String(currentUserId),

          schemeId:
            String(schemeId),

          installmentAmount:
            String(installmentAmount),

          paymentType:
            existingEnrollment
              ? "INSTALLMENT"
              : "NEW_ENROLLMENT",
        },
      });

    // ==========================================================
    // 8. RESPONSE
    //
    // This matches your Flutter PaymentService:
    //
    // orderData["orderId"]
    // orderData["amount"]
    // ==========================================================

    return NextResponse.json(
      {
        status: "Success",

        orderId:
          order.id,

        // Razorpay expects PAISA here.
        amount:
          order.amount,

        // Useful only for debugging/display.
        amountRupees:
          installmentAmount,

        currency:
          order.currency,

        paymentType:
          existingEnrollment
            ? "INSTALLMENT"
            : "NEW_ENROLLMENT",
      },
      {
        status: 200,
        headers: corsHeaders(origin),
      }
    );
  } catch (error: any) {
    console.error(
      "RAZORPAY ORDER ERROR:",
      error
    );

    return NextResponse.json(
      {
        message:
          error?.message ||
          "Could not create order",
      },
      {
        status: 500,
        headers: corsHeaders(origin),
      }
    );
  }
}
