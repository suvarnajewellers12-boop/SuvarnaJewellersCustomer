
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      console.log("No token found in cookies");
      return NextResponse.json({ schemes: [] }, { status: 401 });
    }

    const decoded: any = verifyToken(token);

    console.log("Decoded token:", decoded);

    const currentUserId = decoded?.userId || decoded?.id;

    if (!currentUserId) {
      console.log("Token decoded but no User ID found");
      return NextResponse.json({ schemes: [] }, { status: 401 });
    }

    console.log("Fetching schemes for user ID:", currentUserId);

    const myEnrollments = await prisma.customerScheme.findMany({
      where: {
        customerId: currentUserId.toString()
      },
      include: {
        Scheme: true
      },
      orderBy: {
        startDate: "desc"
      }
    });

    console.log("Fetched rows:", myEnrollments);

    return NextResponse.json({ schemes: myEnrollments }, { status: 200 });

  } catch (error) {
    console.error("Fetch Schemes Error:", error);
    return NextResponse.json({ schemes: [] }, { status: 500 });
  }
}

