export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
      "Access-Control-Allow-Methods": "PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function PATCH(req: Request) {
  const origin = req.headers.get("origin") || "";
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ message: "Invalid Token" }, { status: 401 });

    const { customerSchemeId } = await req.json();

    // Find the current scheme
    const scheme = await prisma.customerScheme.findUnique({
      where: { id: customerSchemeId },
    });

    if (!scheme) return NextResponse.json({ message: "Scheme not found" }, { status: 404 });

    // UPDATE: Increment installmentsPaid by 1
    const updatedScheme = await prisma.customerScheme.update({
      where: { id: customerSchemeId },
      data: {
        installmentsPaid: { increment: 1 },
        // You can also update a lastPaymentDate here if you have that field
      },
    });

    return NextResponse.json({ 
      message: `Payment for Month ${updatedScheme.installmentsPaid} successful`,
      updatedScheme 
    }, {
      status: 200,
      headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" },
    });

  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}