import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { auth } from "@clerk/nextjs/server";

export async function POST(request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const groqKey = process.env.GROQ_API_KEY?.trim();
    if (!groqKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || typeof audioFile === "string") {
      return NextResponse.json(
        { error: "No audio file provided." },
        { status: 400 }
      );
    }

    console.log("\n========== [transcribe] START ==========");
    console.log("[transcribe] File name:", audioFile.name);
    console.log("[transcribe] File type:", audioFile.type);
    console.log("[transcribe] File size:", audioFile.size, "bytes");

    const groq = new Groq({ apiKey: groqKey });

    // Prompt anchors Whisper to Indian financial vocabulary so it doesn't
    // mishear "Paid" as "Page", "Fifty" as "Fifteen", etc.
    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3-turbo",
      response_format: "json",
      prompt:
        "Paid, spent, received, salary, rupees, expense, income. " +
        "Apps: Uber, Ola, Rapido, Swiggy, Zomato, DMart, BigBasket, PhonePe, Paytm. " +
        "Example: Paid 45 to Rapido. Spent 200 on Swiggy. Received 5000 salary.",
    });

    const transcript = transcription.text ?? "";
    console.log("[transcribe] Transcript:", transcript);
    console.log("========== [transcribe] END ==========\n");

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error("[voice-transcribe]", error);
    return NextResponse.json(
      { error: error.message || "Transcription failed." },
      { status: 500 }
    );
  }
}
