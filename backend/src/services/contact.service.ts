import { Resend } from "resend";

// Initialize Resend with your new API Key from Vercel
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendContactMail(
  name: string,
  email: string,
  message: string
) {
  try {
    // Using the Resend SDK to send the email
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev", // Required for Free/Sandbox accounts
      to: "suvarnajewellers12@gmail.com", // Your verified Resend email
      subject: "New Customer Inquiry: Suvarna Jewellers",
      html: `
        <div style="font-family: 'Playfair Display', serif; padding: 20px; border: 1px solid #D4AF37; border-radius: 10px;">
          <h2 style="color: #D4AF37; border-bottom: 1px solid #D4AF37; padding-bottom: 10px;">New Website Inquiry</h2>
          <p><strong>Customer Name:</strong> ${name}</p>
          <p><strong>Customer Email:</strong> ${email}</p>
          <div style="background-color: #fcfcfc; padding: 15px; border-radius: 5px; margin-top: 10px;">
            <p><strong>Message:</strong></p>
            <p style="font-style: italic;">"${message}"</p>
          </div>
          <p style="font-size: 12px; color: #888; margin-top: 20px;">Sent via Suvarna Jewellers Contact Form</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend API Error:", error);
      throw new Error(error.message);
    }

    return data;
  } catch (err: any) {
    console.error("Contact Service Error:", err);
    throw new Error(err.message || "Failed to send email via Resend");
  }
}