import { prisma } from "@/lib/prisma";

export async function checkPaymentEligibility(customerSchemeId: string) {
  const scheme = await prisma.customerScheme.findUnique({
    where: { id: customerSchemeId },
  });

  if (!scheme) throw new Error("Scheme not found");

  const today = new Date();
  const enrollmentDate = new Date(scheme.startDate);

  // LOGIC: Next payment is due exactly (installmentsPaid) months after start date
  // Example: If 1 installment paid on April 5, next is due May 5.
  const nextDueDate = new Date(enrollmentDate);
  nextDueDate.setMonth(nextDueDate.getMonth() + scheme.installmentsPaid);

  // Set time to midnight for a fair comparison
  today.setHours(0, 0, 0, 0);
  nextDueDate.setHours(0, 0, 0, 0);

  return {
    isEligible: today >= nextDueDate,
    nextDueDate: nextDueDate,
    daysRemaining: Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  };
}