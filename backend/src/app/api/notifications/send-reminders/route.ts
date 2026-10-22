export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as admin from "firebase-admin";

// ============================================================
// FIREBASE ADMIN
// ============================================================

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:
        process.env.FIREBASE_PROJECT_ID,

      clientEmail:
        process.env.FIREBASE_CLIENT_EMAIL,

      privateKey:
        process.env.FIREBASE_PRIVATE_KEY
          ?.replace(/\\n/g, "\n"),
    }),
  });
}

// ============================================================
// REMINDER DAYS
// ============================================================

const NOTIFY_DAYS = [
  10,
  7,
  5,
  4,
  3,
  2,
  1,
  0,
];

// ============================================================
// DATE HELPERS
// ============================================================

function startOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function differenceInDays(
  target: Date,
  today: Date
) {
  const targetDay =
    startOfDay(target).getTime();

  const todayDay =
    startOfDay(today).getTime();

  return Math.round(
    (targetDay - todayDay) /
      (1000 * 60 * 60 * 24)
  );
}

// ============================================================
// MESSAGE
// ============================================================

function getReminderMessage(
  schemeName: string,
  diff: number
) {
  if (diff === 10) {
    return {
      title:
        "Scheme Reminder 🔔",
      body:
        `${schemeName}: 10 days until your installment is due.`,
    };
  }

  if (diff === 7) {
    return {
      title:
        "Scheme Reminder 🔔",
      body:
        `${schemeName}: 7 days until your installment is due.`,
    };
  }

  if (diff === 5) {
    return {
      title:
        "Scheme Reminder 🔔",
      body:
        `${schemeName}: 5 days until your installment is due.`,
    };
  }

  if (diff === 4) {
    return {
      title:
        "Scheme Reminder 🔔",
      body:
        `${schemeName}: 4 days until your installment is due.`,
    };
  }

  if (diff === 3) {
    return {
      title:
        "Scheme Reminder 🔔",
      body:
        `${schemeName}: 3 days until your installment is due.`,
    };
  }

  if (diff === 2) {
    return {
      title:
        "Scheme Reminder 🔔",
      body:
        `${schemeName}: 2 days until your installment is due.`,
    };
  }

  if (diff === 1) {
    return {
      title:
        "Payment Due Tomorrow ⚠️",
      body:
        `${schemeName}: your installment is due tomorrow.`,
    };
  }

  if (diff === 0) {
    return {
      title:
        "Payment Due Today ⚠️",
      body:
        `${schemeName}: your installment is due today.`,
    };
  }

  return null;
}

// ============================================================
// SEND FCM
// ============================================================

async function sendFcm(
  token: string,
  title: string,
  body: string
) {
  return admin.messaging().send({
    token,

    notification: {
      title,
      body,
    },

    data: {
      type:
        "SCHEME_PAYMENT_REMINDER",
    },

    android: {
      priority: "high",

      notification: {
        channelId:
          "suvarna_reminders",

        sound:
          "default",
      },
    },

    apns: {
      payload: {
        aps: {
          sound:
            "default",
        },
      },
    },
  });
}

// ============================================================
// GET
// ============================================================

export async function GET(
  req: Request
) {
  // ==========================================================
  // CRON AUTH
  // ==========================================================

  const cronSecret =
    req.headers.get(
      "x-cron-secret"
    );

  if (
    !process.env.CRON_SECRET ||
    cronSecret !==
      process.env.CRON_SECRET
  ) {
    return NextResponse.json(
      {
        message:
          "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const now =
      new Date();

    const currentMonthStart =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

    // ========================================================
    // 1. PROMOTE OLD UPCOMING ROWS TO MISSED
    // ========================================================

    await prisma
      .schemeInstallment
      .updateMany({
        where: {
          status:
            "UPCOMING",

          dueDate: {
            lt:
              currentMonthStart,
          },
        },

        data: {
          status:
            "MISSED",
        },
      });

    // ========================================================
    // 2. FETCH ACTIVE ENROLLMENTS
    // ========================================================

    const enrollments =
      await prisma
        .customerScheme
        .findMany({
          where: {
            isCompleted:
              false,

            customer: {
              fcmToken: {
                not: null,
              },
            },
          },

          include: {
            customer: {
              select: {
                id: true,
                fcmToken: true,
              },
            },

            scheme: {
              select: {
                id: true,
                name: true,
                rateType: true,
              },
            },

            installments: {
              orderBy: {
                installmentNumber:
                  "asc",
              },
            },
          },
        });

    let totalSent = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    // ========================================================
    // 3. PROCESS EACH ENROLLMENT
    // ========================================================

    for (
      const enrollment
      of enrollments
    ) {
      const token =
        enrollment.customer
          .fcmToken;

      if (!token) {
        totalSkipped++;
        continue;
      }

      const installments =
        enrollment.installments ??
        [];

      // ------------------------------------------------------
      // MISSED INSTALLMENT
      // ------------------------------------------------------

      const missed =
        installments.filter(
          (item) =>
            item.status ===
            "MISSED"
        );

      if (
        missed.length > 0
      ) {
        try {
          await sendFcm(
            token,
            "Missed Installment ⚠️",
            `${enrollment.scheme.name}: ${missed.length} missed installment${missed.length === 1 ? "" : "s"}. Please visit the store to clear ${missed.length === 1 ? "it" : "them"}.`
          );

          totalSent++;
        } catch (
          error: any
        ) {
          totalFailed++;

          console.error(
            `[FCM FAILED] Customer ${enrollment.customer.id}`,
            error
          );

          if (
            error?.code ===
            "messaging/registration-token-not-registered"
          ) {
            await prisma
              .customer
              .update({
                where: {
                  id:
                    enrollment
                      .customer
                      .id,
                },

                data: {
                  fcmToken:
                    null,
                },
              });
          }
        }

        // Don't send normal due reminder while older payment is missed.
        continue;
      }

      // ------------------------------------------------------
      // NEXT UNPAID INSTALLMENT
      // ------------------------------------------------------

      const nextInstallment =
        installments.find(
          (item) =>
            item.status !==
            "PAID"
        );

      if (
        !nextInstallment
      ) {
        totalSkipped++;
        continue;
      }

      const diff =
        differenceInDays(
          new Date(
            nextInstallment.dueDate
          ),
          now
        );

      if (
        !NOTIFY_DAYS.includes(
          diff
        )
      ) {
        totalSkipped++;
        continue;
      }

      const message =
        getReminderMessage(
          enrollment.scheme.name,
          diff
        );

      if (!message) {
        totalSkipped++;
        continue;
      }

      try {
        await sendFcm(
          token,
          message.title,
          message.body
        );

        totalSent++;
      } catch (
        error: any
      ) {
        totalFailed++;

        console.error(
          `[FCM FAILED] Customer ${enrollment.customer.id}`,
          error
        );

        if (
          error?.code ===
          "messaging/registration-token-not-registered"
        ) {
          await prisma
            .customer
            .update({
              where: {
                id:
                  enrollment
                    .customer
                    .id,
              },

              data: {
                fcmToken:
                  null,
              },
            });
        }
      }
    }

    return NextResponse.json({
      success: true,

      message:
        "Reminders processed",

      activeEnrollments:
        enrollments.length,

      totalSent,

      totalSkipped,

      totalFailed,

      processedAt:
        new Date()
          .toISOString(),
    });
  } catch (
    error: any
  ) {
    console.error(
      "[SEND REMINDERS ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Failed to process reminders",
      },
      {
        status: 500,
      }
    );
  }
}
