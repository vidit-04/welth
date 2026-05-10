import { resend } from "@/lib/resend";
import { render } from "@react-email/render";
import RecurringReminderTemplate from "@/emails/recurring-reminder-template";

const SUBJECT_SUFFIX = {
  "7-days":  "is due in 7 days",
  "3-days":  "is due in 3 days",
  "1-day":   "is due tomorrow",
  "30-days": "is due in 30 days",
  "15-days": "is due in 15 days",
};

/**
 * Sends a recurring transaction reminder email via Resend.
 * Plain module function — called from Inngest (already server-side) and the test endpoint.
 */
export async function sendReminderEmail({ to, userName, transaction, reminderType, dueDate }) {
  const suffix = SUBJECT_SUFFIX[reminderType] ?? "is coming up";
  const subject = `[Welth Reminder] ${transaction.description} ${suffix}`;

  try {
    const html = await render(
      RecurringReminderTemplate({ userName, transaction, reminderType, dueDate })
    );

    const { data, error } = await resend.emails.send({
      from: "Welth <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    if (error) {
      console.error("[send-reminder-email] Resend error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("[send-reminder-email] Failed to send:", err);
    return { success: false, error: err.message };
  }
}
