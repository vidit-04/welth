import { sendEmail } from "@/actions/send-email";
import RecurringReminderTemplate from "@/emails/recurring-reminder-template";

const SUBJECT_SUFFIX = {
  "7-days":  "is due in 7 days",
  "3-days":  "is due in 3 days",
  "1-day":   "is due tomorrow",
  "30-days": "is due in 30 days",
  "15-days": "is due in 15 days",
};

export async function sendReminderEmail({ to, userName, transaction, reminderType, dueDate }) {
  const suffix = SUBJECT_SUFFIX[reminderType] ?? "is coming up";
  const subject = `[Welth Reminder] ${transaction.description} ${suffix}`;

  return sendEmail({
    to,
    subject,
    react: RecurringReminderTemplate({ userName, transaction, reminderType, dueDate }),
  });
}
