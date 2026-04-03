
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { schemeId, monthlyAmount, durationMonths } = body;

    // Read token directly from cookie
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Decode logged-in user
    const decoded: any = verifyToken(token);
    const currentUserId = decoded?.userId || decoded?.id;

    if (!currentUserId) {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    // Prevent duplicate enrollment of same scheme by same user
    const existing = await prisma.customerScheme.findFirst({
      where: {
        customerId: String(currentUserId),
        schemeId: schemeId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { message: "You already enrolled in this scheme" },
        { status: 400 }
      );
    }

    const enrollment = await prisma.customerScheme.create({
      data: {
        id: crypto.randomUUID(),
        customerId: String(currentUserId),
        schemeId: schemeId,
        startDate: new Date(),
        installmentsPaid: 1,
        totalPaid: monthlyAmount,
        remainingAmount: (monthlyAmount * durationMonths) - monthlyAmount,
        installmentsLeft: durationMonths - 1,
        isCompleted: false,
      },
      include: {
        Scheme: true,
      },
    });

    return NextResponse.json(enrollment, { status: 201 });
  } catch (error: any) {
    console.error("Enrollment Error:", error);
    return NextResponse.json({ message: "Failed to enroll" }, { status: 500 });
  }
}
