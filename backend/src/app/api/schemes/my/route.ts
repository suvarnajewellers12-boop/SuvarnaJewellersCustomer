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

// ============================================================
// OPTIONS
// ============================================================

export async function OPTIONS(req: Request) {
  const origin =
    req.headers.get("origin") || "";

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

// ============================================================
// GET CURRENT CUSTOMER SCHEMES
// ============================================================

export async function GET(req: Request) {
  const origin =
    req.headers.get("origin") || "";

  try {
    // ==========================================================
    // 1. AUTH
    // ==========================================================

    const authHeader =
      req.headers.get("Authorization");

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

    const token =
      authHeader.split(" ")[1];

    const decoded: any =
      verifyToken(token);

    const currentUserId =
      decoded?.userId ||
      decoded?.id;

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

    console.log(
      "[MY SCHEMES] Customer:",
      currentUserId
    );

    // ==========================================================
    // 2. FETCH ENROLLMENTS
    //
    // IMPORTANT:
    //
    // Prisma relations are:
    //
    // scheme
    // payments
    // customer
    //
    // NOT:
    //
    // Scheme
    // PaymentHistory
    // ==========================================================

    const myEnrollments =
      await prisma.customerScheme.findMany({
        where: {
          customerId:
            String(currentUserId),
        },

        include: {
          scheme: true,

          payments: true,
        },

        orderBy: {
          startDate: "desc",
        },
      });

    console.log(
      "[MY SCHEMES] Found:",
      myEnrollments.length
    );

    // ==========================================================
    // 3. FORMAT RESPONSE FOR FLUTTER
    //
    // Your Flutter code was previously expecting:
    //
    // e["Scheme"]
    // e["PaymentHistory"]
    //
    // Instead of changing several Flutter places,
    // map Prisma's relation names to those response names.
    // ==========================================================

    const schemes =
      myEnrollments.map(
        (enrollment: any) => {
          const payments =
            Array.isArray(
              enrollment.payments
            )
              ? enrollment.payments
              : [];

          // ----------------------------------------------------
          // FIND MOST RECENT PAYMENT
          //
          // If createdAt exists, newest comes first.
          // Otherwise preserve returned order.
          // ----------------------------------------------------

          const sortedPayments =
            [...payments].sort(
              (a: any, b: any) => {
                const aTime =
                  a?.createdAt
                    ? new Date(
                        a.createdAt
                      ).getTime()
                    : a?.paidAt
                    ? new Date(
                        a.paidAt
                      ).getTime()
                    : 0;

                const bTime =
                  b?.createdAt
                    ? new Date(
                        b.createdAt
                      ).getTime()
                    : b?.paidAt
                    ? new Date(
                        b.paidAt
                      ).getTime()
                    : 0;

                return bTime - aTime;
              }
            );

          // Remove original relation fields so response is clean.
          const {
            scheme,
            payments: _payments,
            ...enrollmentData
          } = enrollment;

          return {
            ...enrollmentData,

            // Keep the response compatible with
            // your current Flutter service.
            Scheme: scheme,

            PaymentHistory:
              sortedPayments.length > 0
                ? [sortedPayments[0]]
                : [],
          };
        }
      );

    // ==========================================================
    // 4. RESPONSE
    // ==========================================================

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
