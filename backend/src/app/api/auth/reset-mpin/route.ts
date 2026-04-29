import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { phone, mpin } = await req.json();

    if (!phone || !mpin) {
      return NextResponse.json(
        { message: "Phone and MPIN required" },
        { status: 400 }
      );
    }

    await prisma.customer.updateMany({
      where: { phone },
      data: { mpin },
    });

    return NextResponse.json({
      success: true,
      message: "MPIN updated successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Failed" },
      { status: 500 }
    );
  }
}