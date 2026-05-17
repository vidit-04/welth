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

    // verbose_json gives language detection + no_speech_prob per segment.
    // No prompt — vocabulary hints get hallucinated back verbatim on silence.
    const transcription = await groq.audio.transcriptions.create({
      file: groqFile,
      model: "whisper-large-v3-turbo",
      response_format: "verbose_json",
    });

    const segments = transcription.segments ?? [];
    const detectedLang = transcription.language ?? "en";
    const avgNoSpeech =
      segments.length > 0
        ? segments.reduce((sum, s) => sum + (s.no_speech_prob ?? 0), 0) /
          segments.length
        : 0;

    console.log(
      `[transcribe] lang=${detectedLang} segments=${segments.length} ` +
        `avgNoSpeech=${avgNoSpeech.toFixed(3)} transcript="${transcription.text?.trim()}"`
    );

    // Block 1: unexpected language → very likely hallucination.
    // Fan/AC noise causes Whisper to hallucinate in random languages
    // (Russian, Icelandic, etc.) with no_speech_prob=0 (wrongly confident).
    // Groq verbose_json returns full names ("english") not ISO codes ("en"),
    // so include both forms.
    const ALLOWED_LANGS = new Set([
      "en", "english",
      "hi", "hindi",
      "mr", "marathi",
      "gu", "gujarati",
      "ta", "tamil",
      "te", "telugu",
      "kn", "kannada",
      "bn", "bengali",
      "pa", "punjabi",
      "ur", "urdu",
    ]);
    if (!ALLOWED_LANGS.has(detectedLang)) {
      console.log(`[transcribe] BLOCKED — unexpected language "${detectedLang}"`);
      return NextResponse.json({ transcript: "" });
    }

    // Block 2: Whisper itself says no speech detected.
    if (avgNoSpeech > 0.8) {
      console.log(`[transcribe] BLOCKED — avgNoSpeech=${avgNoSpeech.toFixed(3)}`);
      return NextResponse.json({ transcript: "" });
    }

    return NextResponse.json({ transcript: transcription.text ?? "" });
  } catch (error) {
    console.error("[voice-transcribe]", error);
    return NextResponse.json(
      { error: error.message || "Transcription failed." },
      { status: 500 }
    );
  }
}
