import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Text,
} from "@react-email/components";

/* ─── Per-reminder-type config ─────────────────────────────────── */
const REMINDER_CONFIG = {
  "30-days": {
    label: "Due in 30 Days",
    daysText: "30 days",
    accent: "#6366f1",
    accentDark: "#3730a3",
    accentGlow: "rgba(99,102,241,0.35)",
    amountFrom: "#eef2ff",
    badgeBg: "#eef2ff",
    badgeColor: "#3730a3",
    badgeBorder: "#c7d2fe",
    bannerFrom: "#6366f1",
    bannerTo: "#818cf8",
    intro: "Your yearly payment is due next month — plenty of time to plan ahead.",
  },
  "15-days": {
    label: "Due in 15 Days",
    daysText: "15 days",
    accent: "#8b5cf6",
    accentDark: "#5b21b6",
    accentGlow: "rgba(139,92,246,0.35)",
    amountFrom: "#f5f3ff",
    badgeBg: "#f5f3ff",
    badgeColor: "#5b21b6",
    badgeBorder: "#ddd6fe",
    bannerFrom: "#8b5cf6",
    bannerTo: "#a78bfa",
    intro: "Your yearly payment is due in 15 days. A good time to check your balance.",
  },
  "7-days": {
    label: "Due in 7 Days",
    daysText: "7 days",
    accent: "#f59e0b",
    accentDark: "#b45309",
    accentGlow: "rgba(245,158,11,0.35)",
    amountFrom: "#fffbeb",
    badgeBg: "#fffbeb",
    badgeColor: "#92400e",
    badgeBorder: "#fde68a",
    bannerFrom: "#f59e0b",
    bannerTo: "#fbbf24",
    intro: "Your monthly payment is due next week. Time to make sure your account is ready.",
  },
  "3-days": {
    label: "Due in 3 Days",
    daysText: "3 days",
    accent: "#f97316",
    accentDark: "#c2410c",
    accentGlow: "rgba(249,115,22,0.35)",
    amountFrom: "#fff7ed",
    badgeBg: "#fff7ed",
    badgeColor: "#9a3412",
    badgeBorder: "#fed7aa",
    bannerFrom: "#f97316",
    bannerTo: "#fb923c",
    intro: "Your monthly payment is due in 3 days. Please ensure you have sufficient funds.",
  },
  "1-day": {
    label: "Due Tomorrow",
    daysText: "tomorrow",
    accent: "#ef4444",
    accentDark: "#991b1b",
    accentGlow: "rgba(239,68,68,0.35)",
    amountFrom: "#fef2f2",
    badgeBg: "#fef2f2",
    badgeColor: "#991b1b",
    badgeBorder: "#fca5a5",
    bannerFrom: "#ef4444",
    bannerTo: "#f87171",
    intro: "Final reminder — your payment is due tomorrow. Make sure your account is funded.",
  },
};

/* ─── Helpers ───────────────────────────────────────────────────── */
function formatDueDate(date) {
  return new Date(date).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatAmount(n) {
  return parseFloat(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ─── Template ─────────────────────────────────────────────────── */
export default function RecurringReminderTemplate({
  userName = "",
  transaction = {},
  reminderType = "7-days",
  dueDate = new Date(),
}) {
  const {
    description = "Payment",
    amount = 0,
    type = "EXPENSE",
    recurringInterval = "MONTHLY",
  } = transaction;

  const cfg = REMINDER_CONFIG[reminderType] ?? REMINDER_CONFIG["7-days"];
  const isExpense      = type === "EXPENSE";
  const amountColor    = isExpense ? "#dc2626" : "#16a34a";
  const amountSign     = isExpense ? "−" : "+";
  const intervalLabel  = recurringInterval === "YEARLY" ? "Yearly" : "Monthly";
  const intervalBadge  = recurringInterval === "YEARLY" ? "1× / year" : "12× / year";
  const formattedDate  = formatDueDate(dueDate);
  const formattedAmt   = formatAmount(amount);
  const preview        = `${cfg.label}: ${description} — ₹${formattedAmt} due ${formattedDate}`;

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>

      {/* ── Outer body — soft gradient background ── */}
      <Body style={s.body}>
        <Container style={s.shell}>

          {/* ══ HEADER ═══════════════════════════════════════════ */}
          {/* Accent bar */}
          <div style={{
            height: "5px",
            background: `linear-gradient(90deg, ${cfg.bannerFrom} 0%, ${cfg.bannerTo} 100%)`,
            borderRadius: "20px 20px 0 0",
          }} />

          {/* White header area — table-based for email-safe inline centering */}
          <div style={s.header}>
            <table role="presentation" align="center" style={{ margin: "0 auto", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  {/* 3-D W badge */}
                  <td style={{ verticalAlign: "middle", paddingRight: "12px" }}>
                    <div style={{
                      ...s.logoBadge,
                      boxShadow: `0 4px 0 ${cfg.accentDark}, 0 8px 20px ${cfg.accentGlow}, 0 2px 5px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.25)`,
                    }}>W</div>
                  </td>
                  {/* Brand text */}
                  <td style={{ verticalAlign: "middle", textAlign: "left" }}>
                    <div style={s.logoName}>Welth</div>
                    <div style={s.logoSub}>Finance Manager</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Urgency pill — centered */}
          <div style={s.pillRow}>
            <span style={{
              ...s.pill,
              background: `linear-gradient(90deg, ${cfg.bannerFrom} 0%, ${cfg.bannerTo} 100%)`,
            }}>
              {cfg.label}
            </span>
          </div>

          {/* ══ BODY ═════════════════════════════════════════════ */}
          <div style={s.body2}>

            <Text style={s.greeting}>Hello {userName},</Text>
            <Text style={s.intro}>{cfg.intro}</Text>

            {/* ── Amount hero ── */}
            <div style={{
              ...s.amountBox,
              background: `linear-gradient(145deg, ${cfg.amountFrom} 0%, #ffffff 100%)`,
              borderColor: cfg.badgeBorder,
              boxShadow: `0 2px 12px ${cfg.accentGlow}, 0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)`,
            }}>
              <Text style={s.amountLabel}>AMOUNT DUE</Text>
              <Text style={{ ...s.amountValue, color: amountColor }}>
                {amountSign}₹{formattedAmt}
              </Text>
            </div>

            {/* ── Detail card — stacked rows ── */}
            <div style={{
              ...s.detailCard,
              borderTop: `3px solid ${cfg.accent}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)",
            }}>

              <div style={s.row}>
                <Text style={s.rowLabel}>DESCRIPTION</Text>
                <Text style={s.rowValue}>{description}</Text>
              </div>

              <div style={s.rowDivider} />

              <div style={s.row}>
                <Text style={s.rowLabel}>DUE DATE</Text>
                <Text style={s.rowValue}>{formattedDate}</Text>
              </div>

              <div style={s.rowDivider} />

              <div style={s.row}>
                <Text style={s.rowLabel}>FREQUENCY</Text>
                <Text style={s.rowValue}>
                  {intervalLabel}&nbsp;
                  <span style={{
                    ...s.freqPill,
                    backgroundColor: cfg.badgeBg,
                    color: cfg.badgeColor,
                    border: `1px solid ${cfg.badgeBorder}`,
                  }}>
                    {intervalBadge}
                  </span>
                </Text>
              </div>

            </div>

            {/* ── Tip ── */}
            <div style={{
              ...s.tip,
              borderLeftColor: cfg.accent,
              backgroundColor: cfg.badgeBg,
            }}>
              <Text style={s.tipText}>
                💡&nbsp; You have <strong>{cfg.daysText}</strong> to ensure
                sufficient funds are available for this {intervalLabel.toLowerCase()} payment.
              </Text>
            </div>

          </div>

          {/* ══ FOOTER ═══════════════════════════════════════════ */}
          <div style={s.footer}>
            <div style={s.footerLine} />
            <Text style={s.footerInfo}>
              You received this because email reminders are enabled for this
              recurring transaction. You can turn them off from transaction settings.
            </Text>
            <Text style={s.footerBrand}>
              <span style={{ color: cfg.accent, fontWeight: "700" }}>Welth</span>
              {" · "}Your Personal Finance Manager
            </Text>
          </div>

        </Container>
      </Body>
    </Html>
  );
}

/* ─── Styles ────────────────────────────────────────────────────── */
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const s = {
  /* Outer body */
  body: {
    backgroundColor: "#edf0f7",
    backgroundImage: "linear-gradient(160deg, #e8edf7 0%, #eef2f8 50%, #e5eaf5 100%)",
    fontFamily: FONT,
    margin: 0,
    padding: "44px 16px",
  },

  /* White card that floats on background */
  shell: {
    maxWidth: "560px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow:
      "0 2px 4px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.07), 0 24px 48px rgba(0,0,0,0.07)",
  },

  /* ── Header ── */
  header: {
    backgroundColor: "#ffffff",
    padding: "28px 32px 20px",
    textAlign: "center",
    borderBottom: "1px solid #f1f5f9",
  },
  logoBadge: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    background: "linear-gradient(145deg, #818cf8 0%, #6366f1 50%, #4f46e5 100%)",
    textAlign: "center",
    lineHeight: "42px",
    fontSize: "20px",
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: "-0.5px",
  },
  logoName: {
    color: "#0f172a",
    fontSize: "19px",
    fontWeight: "800",
    letterSpacing: "-0.3px",
    margin: "0 0 2px",
    lineHeight: 1.2,
  },
  logoSub: {
    color: "#94a3b8",
    fontSize: "11px",
    fontWeight: "500",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    margin: 0,
    lineHeight: 1,
  },

  /* Urgency pill row */
  pillRow: {
    textAlign: "center",
    padding: "18px 32px 0",
    backgroundColor: "#ffffff",
  },
  pill: {
    display: "inline-block",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "1px",
    textTransform: "uppercase",
    padding: "6px 20px",
    borderRadius: "999px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  },

  /* ── Body ── */
  body2: {
    padding: "24px 28px 28px",
    backgroundColor: "#ffffff",
  },
  greeting: {
    color: "#0f172a",
    fontSize: "21px",
    fontWeight: "700",
    margin: "0 0 6px",
    letterSpacing: "-0.3px",
  },
  intro: {
    color: "#64748b",
    fontSize: "15px",
    lineHeight: "1.65",
    margin: "0 0 22px",
  },

  /* Amount hero */
  amountBox: {
    borderRadius: "14px",
    border: "1px solid",
    padding: "22px 24px",
    textAlign: "center",
    marginBottom: "20px",
  },
  amountLabel: {
    color: "#94a3b8",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "1.8px",
    textTransform: "uppercase",
    margin: "0 0 8px",
  },
  amountValue: {
    fontSize: "40px",
    fontWeight: "800",
    letterSpacing: "-1.5px",
    lineHeight: 1,
    margin: 0,
  },

  /* Detail card */
  detailCard: {
    borderRadius: "14px",
    overflow: "hidden",
    marginBottom: "20px",
    border: "1px solid #e8edf2",
  },
  row: {
    padding: "15px 20px",
    backgroundColor: "#ffffff",
  },
  rowLabel: {
    color: "#94a3b8",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    margin: "0 0 5px",
  },
  rowValue: {
    color: "#0f172a",
    fontSize: "15px",
    fontWeight: "600",
    margin: 0,
    lineHeight: 1.45,
  },
  rowDivider: {
    height: "1px",
    backgroundColor: "#f1f5f9",
  },
  freqPill: {
    display: "inline-block",
    fontSize: "11px",
    fontWeight: "600",
    padding: "2px 9px",
    borderRadius: "999px",
    verticalAlign: "middle",
    marginLeft: "6px",
  },

  /* Tip */
  tip: {
    borderLeft: "3px solid",
    borderRadius: "0 10px 10px 0",
    padding: "13px 17px",
  },
  tipText: {
    color: "#374151",
    fontSize: "13px",
    lineHeight: "1.6",
    margin: 0,
  },

  /* ── Footer ── */
  footer: {
    backgroundColor: "#f8fafc",
    padding: "20px 32px 24px",
    textAlign: "center",
  },
  footerLine: {
    height: "1px",
    backgroundColor: "#e2e8f0",
    marginBottom: "18px",
  },
  footerInfo: {
    color: "#94a3b8",
    fontSize: "11px",
    lineHeight: "1.7",
    margin: "0 0 10px",
  },
  footerBrand: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "500",
    margin: 0,
  },
};
