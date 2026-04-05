export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") || "";
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function GET(req: Request) {
  const origin = req.headers.get("origin") || "";
  try {
    const authHeader = req.headers.get("Authorization");
    
    // ✅ SAFETY CHECK: Prevent 500 crash if header is missing
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ schemes: [] }, { 
        status: 401, 
        headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" } 
      });
    }

    const token = authHeader.split(" ")[1]; 
    const decoded: any = verifyToken(token);
    const currentUserId = decoded?.userId || decoded?.id;

    if (!currentUserId) {
      return NextResponse.json({ schemes: [] }, { 
        status: 401, 
        headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" } 
      });
    }

    const myEnrollments = await prisma.customerScheme.findMany({
      where: { customerId: currentUserId.toString() },
      include: { Scheme: true },
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json({ schemes: myEnrollments }, {
      status: 200,
      headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" },
    });
  } catch (error) {
    return NextResponse.json({ schemes: [] }, { 
      status: 401, // Return 401 instead of 500 on token failure
      headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" } 
    });
  }
}