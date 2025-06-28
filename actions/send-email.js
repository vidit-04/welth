"use server";

import nodemailer from "nodemailer";

export async function sendEmail({ to, subject, react }) {
  // Create transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  try {
    // Convert React component to HTML
    const { render } = await import("@react-email/render");
    const html = await render(react);

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to,
      subject,
      html,
    };

    const data = await transporter.sendMail(mailOptions);
    return { success: true, data };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { success: false, error: error.message };
  }
}
