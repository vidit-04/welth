import { NextResponse } from "next/server";
import Groq, { toFile } from "groq-sdk";
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

    // Strip codec params ("audio/webm;codecs=opus" → "audio/webm") — Groq's
    // format detector rejects the codec string. Convert to Buffer + toFile()
    // because the raw Web API File from Next.js FormData is not reliably
    // serialized by the Groq SDK in serverless environments.
    const cleanType = (audioFile.type ?? "audio/webm").split(";")[0].trim();
    const fileName = audioFile.name ?? `voice.${cleanType.split("/")[1] ?? "webm"}`;
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const groqFile = await toFile(buffer, fileName, { type: cleanType });

    const groq = new Groq({ apiKey: groqKey });

    const transcription = await groq.audio.transcriptions.create({
      file: groqFile,
      model: "whisper-large-v3-turbo",
      response_format: "json",
      prompt:
        "Paid, spent, received, salary, rupees, expense, income. " +
        "Apps: Uber, Ola, Rapido, Swiggy, Zomato, DMart, BigBasket, PhonePe, Paytm. " +
        "Example: Paid 45 to Rapido. Spent 200 on Swiggy. Received 5000 salary.",
    });

    return NextResponse.json({ transcript: transcription.text ?? "" });
  } catch (error) {
    console.error("[voice-transcribe]", error);
    return NextResponse.json(
      { error: error.message || "Transcription failed." },
      { status: 500 }
    );
  }
}
