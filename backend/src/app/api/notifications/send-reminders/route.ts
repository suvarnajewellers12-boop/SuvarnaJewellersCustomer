export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as admin from "firebase-admin";

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const NOTIFY_DAYS = [10, 7, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7];

function getMessage(schemeName: string, diff: number): { title: string; body: string } | null {
  if (diff === 10) return { title: "Scheme Reminder 🔔", body: `${schemeName}: 10 days to your next installment due` };
  if (diff === 7)  return { title: "Scheme Reminder 🔔", body: `${schemeName}: 7 days to your next installment due` };
  if (diff === 5)  return { title: "Scheme Reminder 🔔", body: `${schemeName}: 5 days to your next installment due` };
  if (diff === 4)  return { title: "Scheme Reminder 🔔", body: `${schemeName}: 4 days to your next installment due` };
  if (diff === 3)  return { title: "Scheme Reminder 🔔", body: `${schemeName}: 3 days to your next installment due` };
  if (diff === 2)  return { title: "Scheme Reminder 🔔", body: `${schemeName}: 2 days to your next installment due` };
  if (diff === 1)  return { title: "Payment Due Tomorrow ⚠️", body: `${schemeName}: 1 day to your next installment due` };
  if (diff === 0)  return { title: "Pay Today! ⚠️", body: `${schemeName}: Today is the last day to pay your installment` };
  if (diff < 0)   return { title: "Due Crossed ❌", body: `${schemeName}: Due date crossed. Please visit the store` };
  return null;
}

export async function GET(req: Request) {
  // Security check
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const customers = await prisma.customer.findMany({
      where: { fcmToken: { not: null } },
      select: {
        id: true,
        name: true,
        fcmToken: true,
        CustomerScheme: {
          where: { isCompleted: false },
          select: {
            installmentsPaid: true,
            startDate: true,
            Scheme: {
              select: { name: true },
            },
          },
        },
      },
    });

    let totalSent = 0;
    let totalSkipped = 0;

    for (const customer of customers) {
      if (!customer.fcmToken) continue;

      for (const enrollment of customer.CustomerScheme) {
        const startDate = new Date(enrollment.startDate);
        const nextDueDate = new Date(
          startDate.getFullYear(),
          startDate.getMonth() + enrollment.installmentsPaid,
          startDate.getDate(),
        );
        nextDueDate.setHours(0, 0, 0, 0);

        const diffMs = nextDueDate.getTime() - today.getTime();
        const diff = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (!NOTIFY_DAYS.includes(diff)) {
          totalSkipped++;
          continue;
        }

        const message = getMessage(enrollment.Scheme.name, diff);
        if (!message) {
          totalSkipped++;
          continue;
        }

        try {
          await admin.messaging().send({
            token: customer.fcmToken,
            notification: {
              title: message.title,
              body: message.body,
            },
            android: {
              priority: "high",
              notification: {
                channelId: "suvarna_reminders",
                sound: "default",
              },
            },
          });
          totalSent++;
        } catch (fcmError: any) {
          console.error(`FCM send failed for ${customer.id}:`, fcmError.message);
          // If token is invalid, clear it from DB
          if (fcmError.code === "messaging/registration-token-not-registered") {
            await prisma.customer.update({
              where: { id: customer.id },
              data: { fcmToken: null },
            });
          }
        }
      }
    }

    return NextResponse.json({
      message: "Reminders processed",
      totalSent,
      totalSkipped,
      processedAt: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("Send reminders error:", error);
    return NextResponse.json(
      { message: error.message || "Failed" },
      { status: 500 }
    );
  }
}