export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") || "";

  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function GET(req: Request) {
  try {
    const origin = req.headers.get("origin") || "";

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      console.log("No token found in cookies");
      return NextResponse.json(
        { schemes: [] },
        {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }

    const decoded: any = verifyToken(token);
    console.log("Decoded token:", decoded);

    const currentUserId = decoded?.userId || decoded?.id;

    if (!currentUserId) {
      console.log("Token decoded but no User ID found");
      return NextResponse.json(
        { schemes: [] },
        {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }

    console.log("Fetching schemes for user ID:", currentUserId);

    const myEnrollments = await prisma.customerScheme.findMany({
      where: {
        customerId: currentUserId.toString(),
      },
      include: {
        Scheme: true,
      },
      orderBy: {
        startDate: "desc",
      },
    });

    console.log("Fetched rows:", myEnrollments);

    return NextResponse.json(
      { schemes: myEnrollments },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  } catch (error) {
    console.error("Fetch Schemes Error:", error);

    const origin = req.headers.get("origin") || "";

    return NextResponse.json(
      { schemes: [] },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  }
}