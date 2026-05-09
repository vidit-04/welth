"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";
import aj from "@/lib/arcjet";
import { request } from "@arcjet/next";
import { recalculateBalancesFromDate } from "@/lib/balance";

const serializeAmount = (obj) => {
  const out = { ...obj };
  if (out.amount != null) out.amount = out.amount?.toNumber?.() ?? out.amount;
  if (out.balanceAfter != null) out.balanceAfter = out.balanceAfter?.toNumber?.() ?? out.balanceAfter;
  return out;
};

const GEMINI_RECEIPT_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash",
  "gemini-2.5-flash",
];

const RECEIPT_CATEGORIES = new Set([
  "housing",
  "transportation",
  "groceries",
  "utilities",
  "entertainment",
  "food",
  "shopping",
  "healthcare",
  "education",
  "personal",
  "travel",
  "insurance",
  "gifts",
  "bills",
  "other-expense",
]);

function extractJsonFromText(text) {
  const cleanedText = text.replace(/```(?:json)?\n?/gi, "").trim();
  const start = cleanedText.indexOf("{");
  const end = cleanedText.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in AI response.");
  }

  return cleanedText.slice(start, end + 1);
}

function normalizeReceiptData(parsed) {
  const amount = Number(parsed?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Receipt amount could not be extracted accurately.");
  }

  const rawCategory =
    typeof parsed?.category === "string"
      ? parsed.category.toLowerCase().trim()
      : "other-expense";
  const category = RECEIPT_CATEGORIES.has(rawCategory)
    ? rawCategory
    : "other-expense";

  const parsedDate =
    parsed?.date && !Number.isNaN(new Date(parsed.date).getTime())
      ? new Date(parsed.date)
      : new Date();

  return {
    amount,
    date: parsedDate,
    description:
      typeof parsed?.description === "string" ? parsed.description.trim() : "",
    category,
    merchantName:
      typeof parsed?.merchantName === "string" ? parsed.merchantName.trim() : "",
  };
}

// Create Transaction
export async function createTransaction(data) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Get request data for ArcJet
    const req = await request();

    // Check rate limit
    const decision = await aj.protect(req, {
      userId,
      requested: 1, // Specify how many tokens to consume
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        const { remaining, reset } = decision.reason;
        console.error({
          code: "RATE_LIMIT_EXCEEDED",
          details: {
            remaining,
            resetInSeconds: reset,
          },
        });

        throw new Error("Too many requests. Please try again later.");
      }

      throw new Error("Request blocked");
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Reject future-dated transactions
    const txDate = new Date(data.date);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (txDate > endOfToday) {
      throw new Error("Transaction date cannot be in the future.");
    }

    const account = await db.account.findUnique({
      where: {
        id: data.accountId,
        userId: user.id,
      },
    });

    if (!account) {
      throw new Error("Account not found");
    }

    // Create transaction then recalculate balance from source of truth
    const transaction = await db.$transaction(async (tx) => {
      const newTransaction = await tx.transaction.create({
        data: {
          ...data,
          userId: user.id,
          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(data.date, data.recurringInterval)
              : null,
        },
      });

      await recalculateBalancesFromDate(data.accountId, data.date, tx);

      return newTransaction;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${transaction.accountId}`);

    return { success: true, data: serializeAmount(transaction) };
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function getTransaction(id) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const transaction = await db.transaction.findUnique({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!transaction) throw new Error("Transaction not found");

  return serializeAmount(transaction);
}

export async function updateTransaction(id, data) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    // Get original transaction to calculate balance change
    const originalTransaction = await db.transaction.findUnique({
      where: {
        id,
        userId: user.id,
      },
      include: {
        account: true,
      },
    });

    if (!originalTransaction) throw new Error("Transaction not found");

    // Update transaction then recalculate balance(s) from source of truth
    const transaction = await db.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id, userId: user.id },
        data: {
          ...data,
          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(data.date, data.recurringInterval)
              : null,
        },
      });

      // Use the earlier of the two dates so the window covers both old and new position
      const fromDate = new Date(
        Math.min(new Date(originalTransaction.date).getTime(), new Date(data.date).getTime())
      );
      await recalculateBalancesFromDate(data.accountId, fromDate, tx);
      if (data.accountId !== originalTransaction.accountId) {
        await recalculateBalancesFromDate(originalTransaction.accountId, new Date(originalTransaction.date), tx);
      }

      return updated;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${data.accountId}`);

    return { success: true, data: serializeAmount(transaction) };
  } catch (error) {
    throw new Error(error.message);
  }
}

// Get User Transactions
export async function getUserTransactions(query = {}) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const transactions = await db.transaction.findMany({
      where: {
        userId: user.id,
        ...query,
      },
      include: {
        account: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    return { success: true, data: transactions.map(serializeAmount) };
  } catch (error) {
    throw new Error(error.message);
  }
}

// Scan Receipt
export async function scanReceipt(file) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured. Please add it to your .env file and restart the dev server.");
    }

    // Validate file
    if (!file) {
      throw new Error("No file provided");
    }

    // Validate file type
    if (!file.type || !file.type.startsWith("image/")) {
      throw new Error("Please upload a valid image file (JPEG, PNG, etc.)");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Convert File to ArrayBuffer
    let arrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error("File is empty or corrupted");
      }
    } catch (error) {
      console.error("Error reading file:", error);
      throw new Error("Failed to read the image file. Please try again with a different image.");
    }

    // Convert ArrayBuffer to Base64
    const base64String = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `
      Analyze this receipt or invoice image and extract the following information in JSON format:
      - Total amount (just the number, from TOTAL field if it's an invoice)
      - Date (in ISO format YYYY-MM-DD, from invoice date or receipt date)
      - Description or items purchased (brief summary of items)
      - Merchant/store name (company name from FROM field or merchant name)
      - Suggested category (one of: housing,transportation,groceries,utilities,entertainment,food,shopping,healthcare,education,personal,travel,insurance,gifts,bills,other-expense)
      
      Only respond with valid JSON in this exact format:
      {
        "amount": number,
        "date": "ISO date string (YYYY-MM-DD)",
        "description": "string",
        "merchantName": "string",
        "category": "string"
      }

      For the invoice shown:
      - Extract the TOTAL amount (e.g., 154.06)
      - Extract the invoice date
      - Use merchant/store name from FROM section
      - Describe items from the line items
      - Choose appropriate category based on items

      If it's not a receipt or invoice, return an empty object {}
    `;

    // Try different models until one works
    let result;
    let lastError;

    for (const modelName of GEMINI_RECEIPT_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
          },
        });
        
        result = await model.generateContent([
          {
            inlineData: {
              data: base64String,
              mimeType: file.type || "image/jpeg",
            },
          },
          prompt,
        ]);
        
        break; // Success! Exit the loop
      } catch (error) {
        lastError = error;
        // Continue to next model
      }
    }

    // If all models failed, throw a helpful error
    if (!result) {
      const errorMsg = lastError?.message || "Unknown error";
      throw new Error(
        `All Gemini models failed. Last error: ${errorMsg}. ` +
        `Tried: ${GEMINI_RECEIPT_MODELS.join(", ")}. ` +
        `Please check your API key has access to vision models at https://aistudio.google.com/apikey`
      );
    }

    const response = await result.response;
    const text = response.text();
    const extractedJsonText = extractJsonFromText(text);

    // Handle empty response or invalid receipt
    if (!extractedJsonText || extractedJsonText === "{}") {
      throw new Error("Unable to extract receipt information. Please ensure the image contains a valid receipt.");
    }

    try {
      const data = JSON.parse(extractedJsonText);
      return normalizeReceiptData(data);
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);
      console.error("Response text:", extractedJsonText);
      throw new Error(`Invalid response format from Gemini AI. ${parseError.message}`);
    }
  } catch (error) {
    // Provide more specific error messages
    if (error.message.includes("API key") || error.message.includes("401")) {
      throw new Error("Gemini API key is invalid or missing. Please check your GEMINI_API_KEY in .env file.");
    }
    
    if (error.message.includes("404") || error.message.includes("not found") || error.message.includes("models/")) {
      throw new Error(
        "Model not found. The Gemini model may not be available in your region or API version. " +
        "Please check your API key has access to vision models."
      );
    }
    
    if (error.message.includes("quota") || error.message.includes("limit") || error.message.includes("429")) {
      throw new Error("Gemini API quota exceeded. Please check your API usage limits.");
    }
    
    if (error.message.includes("permission") || error.message.includes("403")) {
      throw new Error("Permission denied. Please check your Gemini API key permissions.");
    }
    
    throw new Error(error.message || "Failed to scan receipt. Please try again.");
  }
}

// Helper function to calculate next recurring date
function calculateNextRecurringDate(startDate, interval) {
  const date = new Date(startDate);

  switch (interval) {
    case "DAILY":
      date.setDate(date.getDate() + 1);
      break;
    case "WEEKLY":
      date.setDate(date.getDate() + 7);
      break;
    case "MONTHLY":
      date.setMonth(date.getMonth() + 1);
      break;
    case "YEARLY":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date;
}
