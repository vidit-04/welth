"use server";

import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { defaultCategories } from "@/data/categories";
import { format, subDays } from "date-fns";

const VALID_CATEGORY_IDS = new Set(defaultCategories.map((c) => c.id));

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-3-flash",
];

function isValidDateString(str) {
  if (!str || typeof str !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str).getTime());
}

export async function extractVoiceTransactions(transcript) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (!transcript?.trim()) throw new Error("Transcript is empty.");

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const yesterdayStr = format(subDays(today, 1), "yyyy-MM-dd");

  const categoryDefs = defaultCategories
    .map((c) => `"${c.id}" = ${c.name} [${c.type}]`)
    .join(", ");

  const prompt = `Today is ${todayStr}. Yesterday was ${yesterdayStr}.

You are a financial transaction extractor. Your job is to extract ALL financial transactions from speech-to-text output which may contain transcription errors.

TEXT (may have speech recognition errors): "${transcript.trim()}"

IMPORTANT — HANDLE TRANSCRIPTION ERRORS:
- "Page" likely means "Paid"
- "Payed" means "Paid"
- Numbers may be slightly wrong (e.g. "forty five" for 45)
- Service/app names are usually correct: Rapido, Uber, Ola, Swiggy, Zomato, DMart, etc.
- If you see a number + a known service name, that is ALWAYS a payment transaction.

IMPLICIT PAYMENT PATTERNS (extract these even without "paid"):
- "[amount] to [service/person]" → EXPENSE
- "[service] [amount]" → EXPENSE
- "[amount] for [item/service]" → EXPENSE
- "[amount] [item]" → EXPENSE
- "received [amount]" or "[amount] received" → INCOME
- "salary [amount]" or "[amount] salary" → INCOME

KNOWN SERVICES → CATEGORY MAPPING:
- Rapido, Uber, Ola, auto, rickshaw, taxi, cab, bus, metro, petrol, fuel → "transportation"
- Swiggy, Zomato, restaurant, food, dinner, lunch, chai, coffee, tea → "food"
- DMart, BigBasket, groceries, vegetables, kirana → "groceries"
- Netflix, Hotstar, Amazon Prime, movie, game → "entertainment"
- PhonePe, Paytm transfers to people → depends on context (usually "other-expense")
- Medicine, doctor, hospital, pharmacy → "healthcare"
- Electricity, internet, phone bill, recharge → "utilities"
- Salary, wages, stipend → "salary"

AVAILABLE CATEGORY IDs (use EXACTLY one of these strings):
${categoryDefs}

FULL CATEGORY RULES:
- chai, coffee, tea, snack, biscuit, mithai → "food"
- uber, ola, rapido, auto, rickshaw, taxi, cab, bus, metro, local train, petrol, fuel, diesel → "transportation"
- groceries, sabzi, vegetables, fruits, dmart, bigbasket, reliance fresh, kirana → "groceries"
- swiggy, zomato, restaurant, dhaba, dinner, lunch, breakfast, biryani, pizza, burger, food delivery → "food"
- salary, stipend, wages, ctc, monthly income → "salary"
- netflix, amazon prime, hotstar, disney+, movie, cinema, game, gaming, ott, streaming → "entertainment"
- medicine, doctor, hospital, pharmacy, clinic, health checkup → "healthcare"
- school, college, tuition, coaching, course, books, stationery → "education"
- rent, house rent, flat rent, pg, hostel fees → "housing"
- electricity, water bill, gas, internet, broadband, wifi, phone bill, mobile recharge, dth → "utilities"
- flight, hotel, trip, vacation, tour, holiday → "travel"
- gym, salon, haircut, spa, beauty products → "personal"
- insurance, lic, term plan, health insurance premium → "insurance"
- gift, donation, charity, birthday present → "gifts"
- bank charges, fine, penalty, late fee, processing fee → "bills"
- freelance payment, project income, consulting fee → "freelance"
- mutual fund, stocks, sip, share market, investment → "investments"
- business revenue, business income → "business"
- house rent received, rental income → "rental"
- unclear expense → "other-expense"
- unclear income → "other-income"

DATE RULES:
- "today", or no date given → ${todayStr}
- "yesterday", "kal", "last night", "last evening" → ${yesterdayStr}
- any specific past date → parse to YYYY-MM-DD
- NEVER return a date after ${todayStr}. If the date would be in the future, use ${todayStr} instead.

TRANSACTION TYPE:
- EXPENSE: paid, spent, bought, page (transcription of "paid"), to [service], for [item], kharcha
- INCOME: received, got, salary, earned, mila, credited, refund

CRITICAL — READ BEFORE RESPONDING:
1. Extract ONLY transactions EXPLICITLY stated in the TEXT above.
2. Do NOT invent, assume, guess, or hallucinate any transaction.
3. Do NOT use anything from these instructions as a transaction template.
4. If the TEXT is empty, ambient noise, or contains no clear financial information → return [].
5. Every transaction MUST have a clear amount AND a clear subject in the TEXT.

OUTPUT FORMAT:
Return ONLY a raw JSON array. No markdown. No backticks. No explanation.
Start with [ and end with ].
Each object MUST use EXACTLY these five keys — no other key names allowed:
  "amount"      → positive number
  "type"        → "EXPENSE" or "INCOME"
  "category"    → exact category ID from the list above
  "description" → brief clean text describing the transaction (e.g. "Groceries", "Bike ride", "Food delivery")
  "date"        → YYYY-MM-DD
Empty result: []`;

  let lastError;
  for (const modelName of GEMINI_MODELS) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const rawText = result.response.text().trim();

      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();

      const start = cleaned.indexOf("[");
      const end = cleaned.lastIndexOf("]");
      if (start === -1 || end === -1) throw new Error("No JSON array in AI response.");

      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      if (!Array.isArray(parsed)) throw new Error("AI response is not an array.");

      const validated = [];
      for (const t of parsed) {
        if (!t || typeof t !== "object") continue;

        const amountNum = Number(t?.amount);
        if (isNaN(amountNum) || amountNum <= 0) continue;
        if (!["INCOME", "EXPENSE"].includes(t?.type)) continue;

        const category = VALID_CATEGORY_IDS.has(String(t.category))
          ? String(t.category)
          : t.type === "INCOME"
          ? "other-income"
          : "other-expense";

        let resolvedDate = isValidDateString(t.date) ? t.date : todayStr;
        if (resolvedDate > todayStr) resolvedDate = todayStr;

        validated.push({
          amount: Math.abs(amountNum),
          type: t.type,
          category,
          description: String(
            t.description ?? t.subject ?? t.item ?? t.name ?? t.title ?? ""
          ).trim(),
          date: resolvedDate,
        });
      }

      return validated;
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`AI extraction failed: ${lastError?.message ?? "Unknown error"}`);
}
