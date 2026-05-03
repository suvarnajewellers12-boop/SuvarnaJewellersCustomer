export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Cheapest possible query — just wakes up the DB connection
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ warmed: true });
  } catch {
    return NextResponse.json({ warmed: false });
  }
}