import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

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
      where: {
        phone,
      },
      data: {
        mpin,
      },
    });

    return NextResponse.json(
      { message: "MPIN saved successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        message: error.message || "MPIN save failed",
      },
      { status: 500 }
    );
  }
}