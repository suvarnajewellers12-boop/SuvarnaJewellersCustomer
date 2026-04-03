export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // 1. Get the token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // 2. Verify the JWT token
    const decoded: any = verifyToken(token);
    
    // Check if decoded token exists and has the userId we stored during login
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // 3. FIXED: Changed 'prisma.user' to 'prisma.customer' to match your shared DB
    const user = await prisma.customer.findUnique({
      where: { id: decoded.userId },
      select: { 
        id: true, 
        name: true, 
        phone: true 
        // Notice we don't select 'password' here for security!
      } 
    });

    if (!user) {
      // If user was deleted from DB but still has a cookie
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // 4. Return the real customer data to the AuthContext
    return NextResponse.json({ user }, { status: 200 });
    
  } catch (error) {
    console.error("Session Verification Error:", error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}