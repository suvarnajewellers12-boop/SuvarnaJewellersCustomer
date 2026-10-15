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
  const origin = req.headers.get("origin") || "";

  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

// ============================================================
// GET CURRENT USER ENROLLED SCHEMES
// ============================================================

export async function GET(req: Request) {
  const origin = req.headers.get("origin") || "";

  try {
    // ----------------------------------------------------------
    // 1. AUTH
    // ----------------------------------------------------------

    const authHeader =
      req.headers.get("Authorization");

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return NextResponse.json(
        {
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

    // ----------------------------------------------------------
    // 2. FETCH ENROLLMENTS
    // ----------------------------------------------------------

    const myEnrollments =
      await prisma.customerScheme.findMany({
        where: {
          customerId:
            String(currentUserId),
        },

        include: {
          // Your existing Prisma relation name
          Scheme: true,

          // Do NOT use paidAt until we confirm that field exists.
          PaymentHistory: true,

          coupon: true,
        },

        orderBy: {
          startDate: "desc",
        },
      });

    console.log(
      "[MY SCHEMES] Found:",
      myEnrollments.length
    );

    // ----------------------------------------------------------
    // 3. SORT PAYMENT HISTORY IN JAVASCRIPT IF POSSIBLE
    // ----------------------------------------------------------
    //
    // This prevents a wrong Prisma timestamp field such as
    // `paidAt` from breaking the whole endpoint.
    // ----------------------------------------------------------

    const schemes =
      myEnrollments.map(
        (enrollment: any) => {
          let histories =
            Array.isArray(
              enrollment.PaymentHistory
            )
              ? enrollment.PaymentHistory
              : [];

          // If PaymentHistory has createdAt, newest first.
          histories = histories.sort(
            (a: any, b: any) => {
              const aTime =
                a?.createdAt
                  ? new Date(
                      a.createdAt
                    ).getTime()
                  : 0;

              const bTime =
                b?.createdAt
                  ? new Date(
                      b.createdAt
                    ).getTime()
                  : 0;

              return bTime - aTime;
            }
          );

          return {
            ...enrollment,

            // Only send most recent payment to Flutter.
            PaymentHistory:
              histories.length > 0
                ? [histories[0]]
                : [],
          };
        }
      );

    // ----------------------------------------------------------
    // 4. RESPONSE
    // ----------------------------------------------------------

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
    // ==========================================================
    // IMPORTANT:
    // Do NOT silently return an empty scheme array.
    // ==========================================================

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
