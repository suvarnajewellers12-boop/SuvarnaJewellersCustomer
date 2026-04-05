import nodemailer from "nodemailer";

export async function sendContactMail(
  name: string,
  email: string,
  message: string
) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: "suvarnajewellers12@gmail.com",
    subject: "New Contact Message from Suvarna Jewellers Website",
    html: `
      <h3>New Customer Inquiry</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong> ${message}</p>
    `,
  });
}