import nodemailer from "nodemailer";

export async function sendContactMail(
  name: string,
  email: string,
  message: string
) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // Use SSL
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Make sure this has NO spaces!
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