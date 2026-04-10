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

    const user = await prisma.customer.findFirst({
      where: {
        phone,
      },
    });

    if (!user || user.mpin !== mpin) {
      return NextResponse.json(
        { message: "Incorrect MPIN" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "MPIN verified" },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        message: error.message || "MPIN verify failed",
      },
      { status: 500 }
    );
  }
}