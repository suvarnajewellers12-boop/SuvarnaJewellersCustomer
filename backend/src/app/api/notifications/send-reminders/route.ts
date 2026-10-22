export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import {
  getMessaging,
} from "firebase-admin/messaging";

// ============================================================
// FIREBASE ADMIN
// ============================================================

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID;

  const clientEmail =
    process.env.FIREBASE_CLIENT_EMAIL;

  const privateKey =
    process.env.FIREBASE_PRIVATE_KEY
      ?.replace(/\\n/g, "\n");

  if (
    !projectId ||
    !clientEmail ||
    !privateKey
  ) {
    throw new Error(
      "Firebase Admin environment variables are missing."
    );
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

// ============================================================
// IST DATE HELPERS
// ============================================================

type IndiaDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayKey: string;
};

function getIndiaDateParts(
  date = new Date()
): IndiaDateParts {
  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Asia/Kolkata",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hourCycle:
          "h23",
      }
    );

  const parts =
    formatter.formatToParts(
      date
    );

  const get =
    (type: string) =>
      Number(
        parts.find(
          (part) =>
            part.type ===
            type
        )?.value ?? 0
      );

  const year =
    get("year");

  const month =
    get("month");

  const day =
    get("day");

  const hour =
    get("hour");

  const minute =
    get("minute");

  const dayKey =
    `${year}-${String(
      month
    ).padStart(
      2,
      "0"
    )}-${String(
      day
    ).padStart(
      2,
      "0"
    )}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    dayKey,
  };
}

// ============================================================
// GET CALENDAR DATE KEY IN INDIA
// ============================================================

function getIndiaDayKey(
  date: Date
) {
  return getIndiaDateParts(
    date
  ).dayKey;
}

// ============================================================
// DIFFERENCE BETWEEN INDIA CALENDAR DAYS
// ============================================================

function calendarDayDifference(
  target: Date,
  today: Date
) {
  const targetParts =
    getIndiaDateParts(
      target
    );

  const todayParts =
    getIndiaDateParts(
      today
    );

  const targetUtc =
    Date.UTC(
      targetParts.year,
      targetParts.month - 1,
      targetParts.day
    );

  const todayUtc =
    Date.UTC(
      todayParts.year,
      todayParts.month - 1,
      todayParts.day
    );

  return Math.round(
    (
      targetUtc -
      todayUtc
    ) /
      86400000
  );
}

// ============================================================
// TODAY START IN INDIA, REPRESENTED AS UTC INSTANT
// ============================================================

function indiaTodayStartUtc(
  now = new Date()
) {
  const parts =
    getIndiaDateParts(
      now
    );

  return new Date(
    `${parts.dayKey}T00:00:00+05:30`
  );
}

// ============================================================
// NOTIFICATION SLOT
// ============================================================

type NotificationSlot =
  | "MORNING"
  | "AFTERNOON"
  | "EVENING"
  | null;

function getCurrentSlot():
  NotificationSlot {
  const {
    hour,
  } =
    getIndiaDateParts();

  // Vercel cron runs around:
  //
  // 09:00 IST
  // 14:00 IST
  // 19:00 IST

  if (hour >= 8 &&
      hour <= 10) {
    return "MORNING";
  }

  if (
    hour >= 13 &&
    hour <= 15
  ) {
    return "AFTERNOON";
  }

  if (
    hour >= 18 &&
    hour <= 20
  ) {
    return "EVENING";
  }

  return null;
}

// ============================================================
// MESSAGE BUILDER
// ============================================================

function buildUpcomingMessage(
  schemeName: string,
  daysLeft: number,
  slot: NotificationSlot
) {
  // ==========================================================
  // DUE TODAY
  // ==========================================================

  if (daysLeft === 0) {
    if (
      slot === "MORNING"
    ) {
      return {
        type:
          "DUE_TODAY_MORNING" as const,

        title:
          "Payment Due Today ⚠️",

        body:
          `${schemeName}: Your installment is due today. Please complete your payment.`,
      };
    }

    if (
      slot ===
      "AFTERNOON"
    ) {
      return {
        type:
          "DUE_TODAY_AFTERNOON" as const,

        title:
          "Payment Reminder ⚠️",

        body:
          `${schemeName}: Your installment is still due today. Complete your payment before the day ends.`,
      };
    }

    if (
      slot === "EVENING"
    ) {
      return {
        type:
          "DUE_TODAY_FINAL" as const,

        title:
          "Last Day to Pay ⚠️",

        body:
          `${schemeName}: Today is the last day to pay this installment.`,
      };
    }

    return null;
  }

  // ==========================================================
  // UPCOMING REMINDERS ONLY IN MORNING
  // ==========================================================

  if (
    slot !== "MORNING"
  ) {
    return null;
  }

  // ==========================================================
  // TOMORROW
  // ==========================================================

  if (daysLeft === 1) {
    return {
      type:
        "DUE_TOMORROW" as const,

      title:
        "Payment Due Tomorrow 🔔",

      body:
        `${schemeName}: Your installment is due tomorrow.`,
    };
  }

  // ==========================================================
  // 2 - 10 DAYS
  // ==========================================================

  if (
    daysLeft >= 2 &&
    daysLeft <= 10
  ) {
    return {
      type:
        "DAILY_REMINDER" as const,

      title:
        "Scheme Payment Reminder 🔔",

      body:
        `${schemeName}: ${daysLeft} days remaining until your installment is due.`,
    };
  }

  return null;
}

// ============================================================
// SEND FCM WITH DEDUPLICATION
// ============================================================

async function sendNotificationOnce({
  customerId,
  customerSchemeId,
  installmentId,
  token,
  type,
  dayKey,
  title,
  body,
}: {
  customerId: string;
  customerSchemeId: string;
  installmentId: string;
  token: string;
  type:
    | "DAILY_REMINDER"
    | "DUE_TOMORROW"
    | "DUE_TODAY_MORNING"
    | "DUE_TODAY_AFTERNOON"
    | "DUE_TODAY_FINAL"
    | "MISSED_PAYMENT";
  dayKey: string;
  title: string;
  body: string;
}) {
  // ==========================================================
  // CREATE RESERVATION FIRST
  //
  // Unique constraint prevents two cron executions from
  // sending the same notification simultaneously.
  // ==========================================================

  let logId:
    string | null =
    null;

  try {
    const log =
      await prisma
        .schemeNotificationLog
        .create({
          data: {
            customerId,
            customerSchemeId,
            installmentId,
            type,
            dayKey,
            title,
            body,
          },
        });

    logId =
      log.id;
  } catch (
    error: any
  ) {
    // Prisma unique constraint.
    if (
      error?.code ===
      "P2002"
    ) {
      return {
        sent: false,
        duplicate: true,
      };
    }

    throw error;
  }

  try {
    // ========================================================
    // SEND FCM
    // ========================================================

    await getMessaging()
      .send({
        token,

        notification: {
          title,
          body,
        },

        data: {
          type,
          customerSchemeId,
          installmentId,
        },

        android: {
          priority:
            "high",

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

    return {
      sent: true,
      duplicate: false,
    };
  } catch (
    error: any
  ) {
    // ========================================================
    // DELETE RESERVATION WHEN DELIVERY REQUEST FAILED
    //
    // This allows the next cron execution to retry.
    // ========================================================

    if (logId) {
      await prisma
        .schemeNotificationLog
        .delete({
          where: {
            id:
              logId,
          },
        })
        .catch(
          () => {}
        );
    }

    throw error;
  }
}

// ============================================================
// CLEAR INVALID FCM TOKEN
// ============================================================

async function handleFcmError(
  customerId: string,
  error: any
) {
  const code =
    error?.code ??
    "";

  console.error(
    `[FCM ERROR] ${customerId}`,
    code,
    error?.message
  );

  if (
    code ===
      "messaging/registration-token-not-registered" ||
    code ===
      "messaging/invalid-registration-token"
  ) {
    await prisma.customer
      .update({
        where: {
          id:
            customerId,
        },

        data: {
          fcmToken:
            null,
        },
      });
  }
}

// ============================================================
// GET
// ============================================================

export async function GET(
  req: Request
) {
  // ==========================================================
  // VERCEL CRON SECURITY
  // ==========================================================

  const authHeader =
    req.headers.get(
      "authorization"
    );

  const expected =
    process.env.CRON_SECRET;

  if (
    !expected ||
    authHeader !==
      `Bearer ${expected}`
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  try {
    initializeFirebaseAdmin();

    const now =
      new Date();

    const india =
      getIndiaDateParts(
        now
      );

    const todayKey =
      india.dayKey;

    const slot =
      getCurrentSlot();

    // ========================================================
    // 1. PROMOTE OVERDUE INSTALLMENTS TO MISSED
    //
    // dueDate yesterday or earlier => MISSED
    // ========================================================

    const todayStartUtc =
      indiaTodayStartUtc(
        now
      );

    const missedUpdate =
      await prisma
        .schemeInstallment
        .updateMany({
          where: {
            status:
              "UPCOMING",

            dueDate: {
              lt:
                todayStartUtc,
            },
          },

          data: {
            status:
              "MISSED",
          },
        });

    // ========================================================
    // 2. GET ACTIVE CUSTOMER ENROLLMENTS
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
    let totalDuplicates = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    // ========================================================
    // 3. PROCESS ENROLLMENTS
    // ========================================================

    for (
      const enrollment
      of enrollments
    ) {
      const token =
        enrollment
          .customer
          .fcmToken;

      if (!token) {
        totalSkipped++;
        continue;
      }

      const installments =
        enrollment.installments;

      // ======================================================
      // A. MISSED INSTALLMENT HAS PRIORITY
      // ======================================================

      const missedInstallments =
        installments
          .filter(
            (item) =>
              item.status ===
              "MISSED"
          )
          .sort(
            (a, b) =>
              a.installmentNumber -
              b.installmentNumber
          );

      if (
        missedInstallments
          .length > 0
      ) {
        // Missed reminder only once per day,
        // during morning cron execution.
        if (
          slot !== "MORNING"
        ) {
          totalSkipped++;
          continue;
        }

        const oldestMissed =
          missedInstallments[0];

        const title =
          "Missed Installment ⚠️";

        const body =
          missedInstallments.length ===
          1
            ? `${enrollment.scheme.name}: You have a missed installment. Please visit the store to clear it before making further online payments.`
            : `${enrollment.scheme.name}: You have ${missedInstallments.length} missed installments. Please visit the store to clear them before making further online payments.`;

        try {
          const result =
            await sendNotificationOnce({
              customerId:
                enrollment.customer.id,

              customerSchemeId:
                enrollment.id,

              installmentId:
                oldestMissed.id,

              token,

              type:
                "MISSED_PAYMENT",

              dayKey:
                todayKey,

              title,

              body,
            });

          if (
            result.sent
          ) {
            totalSent++;
          } else if (
            result.duplicate
          ) {
            totalDuplicates++;
          }
        } catch (
          error: any
        ) {
          totalFailed++;

          await handleFcmError(
            enrollment.customer.id,
            error
          );
        }

        // Do not send upcoming reminder while a missed payment exists.
        continue;
      }

      // ======================================================
      // B. NEXT UNPAID INSTALLMENT
      // ======================================================

      const nextInstallment =
        installments.find(
          (item) =>
            item.status ===
            "UPCOMING"
        );

      if (
        !nextInstallment
      ) {
        totalSkipped++;
        continue;
      }

      const daysLeft =
        calendarDayDifference(
          new Date(
            nextInstallment.dueDate
          ),
          now
        );

      // Only:
      //
      // 10 -> 0
      //
      // Missed is handled above.
      if (
        daysLeft < 0 ||
        daysLeft > 10
      ) {
        totalSkipped++;
        continue;
      }

      const notification =
        buildUpcomingMessage(
          enrollment.scheme.name,
          daysLeft,
          slot
        );

      if (
        !notification
      ) {
        totalSkipped++;
        continue;
      }

      try {
        const result =
          await sendNotificationOnce({
            customerId:
              enrollment.customer.id,

            customerSchemeId:
              enrollment.id,

            installmentId:
              nextInstallment.id,

            token,

            type:
              notification.type,

            dayKey:
              todayKey,

            title:
              notification.title,

            body:
              notification.body,
          });

        if (
          result.sent
        ) {
          totalSent++;
        } else if (
          result.duplicate
        ) {
          totalDuplicates++;
        }
      } catch (
        error: any
      ) {
        totalFailed++;

        await handleFcmError(
          enrollment.customer.id,
          error
        );
      }
    }

    return NextResponse.json({
      success: true,

      slot,

      indiaTime: {
        dayKey:
          todayKey,

        hour:
          india.hour,

        minute:
          india.minute,
      },

      promotedToMissed:
        missedUpdate.count,

      enrollmentsChecked:
        enrollments.length,

      totalSent,

      totalDuplicates,

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
          "Failed to process scheme reminders.",
      },
      {
        status: 500,
      }
    );
  }
}
