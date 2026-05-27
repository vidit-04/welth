/**
 * Generates all occurrences of a recurring transaction within [rangeStart, rangeEnd].
 * Starts from transaction.nextRecurringDate and advances by interval.
 */
export function generateRecurringOccurrences(transaction, rangeStart, rangeEnd) {
  const { nextRecurringDate, recurringInterval } = transaction;
  if (!nextRecurringDate || !recurringInterval) return [];

  let current = toUTCMidnight(new Date(nextRecurringDate));
  if (current > rangeEnd) return [];

  const occurrences = [];
  let iterations = 0;

  while (current <= rangeEnd && iterations < 400) {
    iterations++;
    if (current >= rangeStart) {
      occurrences.push(new Date(current));
    }
    current = advanceDate(current, recurringInterval);
  }

  return occurrences;
}

function toUTCMidnight(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function advanceDate(date, interval) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();

  switch (interval) {
    case "DAILY":
      return new Date(Date.UTC(y, m, d + 1));
    case "WEEKLY":
      return new Date(Date.UTC(y, m, d + 7));
    case "MONTHLY": {
      const nextM = m + 1;
      const nextY = y + Math.floor(nextM / 12);
      const normM = nextM % 12;
      const maxDay = new Date(Date.UTC(nextY, normM + 1, 0)).getUTCDate();
      return new Date(Date.UTC(nextY, normM, Math.min(d, maxDay)));
    }
    case "YEARLY": {
      const nextY = y + 1;
      const maxDay = new Date(Date.UTC(nextY, m + 1, 0)).getUTCDate();
      return new Date(Date.UTC(nextY, m, Math.min(d, maxDay)));
    }
    default:
      return new Date(Date.UTC(y, m, d + 1));
  }
}
