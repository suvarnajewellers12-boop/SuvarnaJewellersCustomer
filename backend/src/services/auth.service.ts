import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/bcrypt";
import crypto from "crypto"; // Required for generating the ID

export async function signupUser(
  name: string,
  phone: string,
  password: string
) {
  // 1. Check if the Customer exists using findFirst (since phone might not be @unique)
  const existingUser = await prisma.customer.findFirst({
    where: { phone },
  });

  if (existingUser) {
    throw new Error("Account already exists");
  }

  // 2. Hash the password securely
  const hashedPassword = await hashPassword(password);

  // 3. Create the record with the MANUALLY provided ID and Username
  const user = await prisma.customer.create({
    data: {
      id: crypto.randomUUID(), // Fixes the "Property 'id' is missing" error
      name,
      phone,
      password: hashedPassword,
      username: name.toLowerCase().replace(/\s/g, "") + phone.slice(-4), 
      createdAt: new Date(), // Ensures the record has a timestamp
    },
    select: {
      id: true,
      name: true,
      phone: true,
    },
  });

  return user;
}

export async function loginUser(phone: string, passwordAttempt: string) {
  const user = await prisma.customer.findFirst({
    where: { phone },
    select: {
      id: true,
      name: true,
      phone: true,
      password: true,
      mpin: true,          // ← ADD
    },
  });

  if (!user) {
    throw new Error("No account found");
  }

  const passwordValid = await verifyPassword(passwordAttempt, user.password);

  if (!passwordValid) {
    throw new Error("Incorrect password");
  }

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    mpinExists: user.mpin !== null && user.mpin !== "",  // ← ADD
  };
}