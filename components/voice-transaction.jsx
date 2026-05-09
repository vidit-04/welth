"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Mic,
  Square,
  Loader2,
  Check,
  Pencil,
  Trash2,
  Sparkles,
  RotateCcw,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { defaultCategories } from "@/data/categories";
import { createTransaction } from "@/actions/transaction";
import { extractVoiceTransactions } from "@/actions/voice";

const STAGE = {
  IDLE: "idle",
  RECORDING: "recording",
  PROCESSING: "processing",
  REVIEW: "review",
  CREATING: "creating",
};

const MAX_SECONDS = 60;

function formatTime(s) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60)
    .toString()
    .padStart(2, "0")}`;
}

function getCategoryName(id) {
  return defaultCategories.find((c) => c.id === id)?.name ?? id;
}

function filteredCategories(type) {
  return defaultCategories.filter((c) => c.type === type);
}

export function VoiceTransaction({ accounts }) {
  const router = useRouter();

  const [stage, setStage] = useState(STAGE.IDLE);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const [processingMsg, setProcessingMsg] = useState("");
  const [transcript, setTranscript] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [accountId, setAccountId] = useState(
    () => accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? ""
  );

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const mimeTypeRef = useRef("audio/webm");
  const recordingStartRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Auto-stop when max duration hit
  useEffect(() => {
    if (stage === STAGE.RECORDING && recordingSecs >= MAX_SECONDS) {
      stopRecording();
    }
  }, [recordingSecs, stage]);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Your browser does not support audio recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const mimeType =
        [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
          "audio/ogg;codecs=opus",
          "audio/ogg",
        ].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

      mimeTypeRef.current = mimeType || "audio/webm";

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : {}
      );
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () =>
        handleAudioReady(chunksRef.current, mimeTypeRef.current);

      recorder.start(200);
      recordingStartRef.current = Date.now();
      setStage(STAGE.RECORDING);
      setRecordingSecs(0);

      timerRef.current = setInterval(() => {
        setRecordingSecs((s) => s + 1);
      }, 1000);
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error(
          "Microphone access denied. Please allow microphone access in your browser settings."
        );
      } else if (err.name === "NotFoundError") {
        toast.error("No microphone detected. Please connect a microphone and try again.");
      } else {
        toast.error("Could not start recording: " + err.message);
      }
    }
  }, []);

  const handleAudioReady = async (chunks, mimeType) => {
    const blob = new Blob(chunks, { type: mimeType });
    const durationMs = Date.now() - (recordingStartRef.current ?? Date.now());

    console.log("[voice-client] Audio blob — size:", blob.size, "bytes | duration:", durationMs, "ms");

    if (blob.size < 1000 || durationMs < 1500) {
      toast.error("Recording too short — please speak for at least 2 seconds.");
      setStage(STAGE.IDLE);
      return;
    }

    setStage(STAGE.PROCESSING);

    try {
      setProcessingMsg("Transcribing your speech...");

      const ext = mimeType.includes("mp4")
        ? "mp4"
        : mimeType.includes("ogg")
        ? "ogg"
        : "webm";

      const form = new FormData();
      form.append("audio", blob, `voice.${ext}`);

      console.log("[voice-client] Sending audio to /api/voice-transcribe — filename: voice." + ext);

      const res = await fetch("/api/voice-transcribe", {
        method: "POST",
        body: form,
      });

      const resBody = await res.json().catch(() => ({}));
      console.log("[voice-client] Transcribe response — status:", res.status, "| body:", resBody);

      if (!res.ok) {
        throw new Error(resBody.error || "Transcription failed.");
      }

      const text = resBody.transcript ?? "";
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

      if (!text?.trim() || wordCount < 2) {
        toast.error("Could not detect enough speech — please speak clearly for at least 2 seconds.");
        setStage(STAGE.IDLE);
        return;
      }

      setTranscript(text);

      setProcessingMsg("Extracting transactions with AI...");
      console.log("[voice-client] Calling extractVoiceTransactions with:", text);

      const extracted = await extractVoiceTransactions(text);

      console.log("[voice-client] extractVoiceTransactions returned:", extracted);

      if (!extracted || extracted.length === 0) {
        toast.error(
          "No transactions detected. Try saying something like: \"Paid 350 for groceries and 120 for Uber\"."
        );
        setStage(STAGE.IDLE);
        return;
      }

      setTransactions(extracted);
      setStage(STAGE.REVIEW);
    } catch (err) {
      console.error("[voice-client] Error:", err);
      toast.error(err.message || "Processing failed. Please try again.");
      setStage(STAGE.IDLE);
    } finally {
      setProcessingMsg("");
    }
  };

  const deleteTransaction = (idx) =>
    setTransactions((prev) => prev.filter((_, i) => i !== idx));

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setEditDraft({ ...transactions[idx] });
  };

  const commitEdit = () => {
    if (editDraft === null) return;
    if (!editDraft.amount || editDraft.amount <= 0) {
      toast.error("Amount must be greater than 0.");
      return;
    }
    setTransactions((prev) =>
      prev.map((t, i) => (i === editingIdx ? editDraft : t))
    );
    setEditingIdx(null);
    setEditDraft(null);
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setEditDraft(null);
  };

  const createAll = async () => {
    if (!accountId) {
      toast.error("Please select an account before creating transactions.");
      return;
    }
    if (transactions.length === 0) return;

    setStage(STAGE.CREATING);

    let successCount = 0;
    let failCount = 0;

    // Create in reverse so the table (sorted createdAt DESC) shows them
    // in the same order they were spoken (first spoken → top of list).
    for (const t of [...transactions].reverse()) {
      try {
        await createTransaction({
          type: t.type,
          amount: t.amount,
          description: t.description,
          date: new Date(t.date),
          accountId,
          category: t.category,
          isRecurring: false,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(
        `${successCount} transaction${successCount > 1 ? "s" : ""} created successfully!`
      );
      router.push(`/account/${accountId}`);
      return;
    }

    if (failCount > 0) {
      toast.error(
        `${failCount} transaction${failCount > 1 ? "s" : ""} failed to create. Please try again.`
      );
      setStage(STAGE.REVIEW);
    }
  };

  const reset = () => {
    setStage(STAGE.IDLE);
    setTranscript("");
    setTransactions([]);
    setEditingIdx(null);
    setEditDraft(null);
    setRecordingSecs(0);
    chunksRef.current = [];
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-6">
        <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
        <h2 className="text-sm font-semibold">Add with Voice AI</h2>
        {stage !== STAGE.IDLE && stage !== STAGE.RECORDING && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={reset}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="px-4 py-5 sm:px-6">
        {/* ── IDLE ─────────────────────────────────────────── */}
        {stage === STAGE.IDLE && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-center text-sm text-muted-foreground max-w-sm">
              Tap the mic and speak naturally.&nbsp;
              <span className="italic">
                &ldquo;Paid 350 for groceries and 120 for Uber&rdquo;
              </span>
            </p>

            <button
              type="button"
              onClick={startRecording}
              aria-label="Start recording"
              className="relative flex h-20 w-20 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-violet-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <Mic className="h-9 w-9" />
            </button>

            <p className="text-xs text-muted-foreground">Tap to start</p>
          </div>
        )}

        {/* ── RECORDING ────────────────────────────────────── */}
        {stage === STAGE.RECORDING && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex items-center justify-center">
              <span className="absolute h-28 w-28 rounded-full bg-red-400/20 animate-ping" />
              <span className="absolute h-24 w-24 rounded-full bg-red-400/25 animate-ping [animation-delay:200ms]" />
              <button
                type="button"
                onClick={stopRecording}
                aria-label="Stop recording"
                className="relative flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <Square className="h-7 w-7" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Listening&hellip;&ensp;
              <span className="tabular-nums">{formatTime(recordingSecs)}</span>
              <span className="text-xs text-muted-foreground font-normal">
                / {formatTime(MAX_SECONDS)}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">Tap to stop when done</p>
          </div>
        )}

        {/* ── PROCESSING ───────────────────────────────────── */}
        {stage === STAGE.PROCESSING && (
          <div className="flex flex-col items-center gap-4 py-4">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
            <p className="text-sm font-medium">{processingMsg || "Processing…"}</p>
            <p className="text-xs text-muted-foreground">This may take a few seconds</p>
          </div>
        )}

        {/* ── REVIEW ───────────────────────────────────────── */}
        {stage === STAGE.REVIEW && (
          <div className="space-y-4">
            {/* Transcript */}
            {transcript && (
              <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  You said
                </p>
                <p className="text-sm italic leading-relaxed">&ldquo;{transcript}&rdquo;</p>
              </div>
            )}

            {/* Account selector */}
            {accounts.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Account</label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} (₹{parseFloat(a.balance).toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <p className="text-sm font-medium">
              Detected&nbsp;
              <span className="text-violet-600">{transactions.length}</span>
              &nbsp;transaction{transactions.length !== 1 ? "s" : ""}
            </p>

            {/* Transaction cards */}
            <div className="space-y-2">
              {transactions.map((t, idx) =>
                editingIdx === idx ? (
                  /* ── Edit mode ── */
                  <div
                    key={idx}
                    className="rounded-lg border border-violet-200 bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/20 p-3 space-y-3"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Amount (₹)</label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={editDraft.amount}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              amount: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Type</label>
                        <Select
                          value={editDraft.type}
                          onValueChange={(v) =>
                            setEditDraft((d) => ({ ...d, type: v, category: "" }))
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EXPENSE">Expense</SelectItem>
                            <SelectItem value="INCOME">Income</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Category</label>
                      <Select
                        value={editDraft.category}
                        onValueChange={(v) =>
                          setEditDraft((d) => ({ ...d, category: v }))
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredCategories(editDraft.type).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Description</label>
                      <Input
                        value={editDraft.description}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, description: e.target.value }))
                        }
                        className="h-8 text-sm"
                        placeholder="Optional description"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Date</label>
                      <Input
                        type="date"
                        value={editDraft.date}
                        max={new Date().toISOString().split("T")[0]}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, date: e.target.value }))
                        }
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={commitEdit}
                        className="h-8"
                      >
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={cancelEdit}
                        className="h-8"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ── View mode ── */
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "text-base font-semibold tabular-nums",
                            t.type === "INCOME"
                              ? "text-green-600"
                              : "text-red-500"
                          )}
                        >
                          {t.type === "INCOME" ? "+" : "-"}₹
                          {t.amount % 1 === 0
                            ? t.amount.toLocaleString()
                            : t.amount.toFixed(2)}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {getCategoryName(t.category)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            t.type === "INCOME"
                              ? "border-green-400 text-green-600"
                              : "border-red-300 text-red-500"
                          )}
                        >
                          {t.type}
                        </Badge>
                      </div>

                      {t.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {t.description}
                        </p>
                      )}

                      <p className="text-xs text-muted-foreground">{t.date}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => startEdit(idx)}
                        aria-label="Edit transaction"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteTransaction(idx)}
                        aria-label="Delete transaction"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              )}
            </div>

            {transactions.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                All transactions removed.
              </p>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={reset}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Start Over
              </Button>

              {transactions.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                  onClick={createAll}
                  disabled={!accountId || editingIdx !== null}
                  title={editingIdx !== null ? "Save your edit first" : undefined}
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Create {transactions.length} Transaction
                  {transactions.length !== 1 ? "s" : ""}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── CREATING ─────────────────────────────────────── */}
        {stage === STAGE.CREATING && (
          <div className="flex flex-col items-center gap-4 py-4">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
            <p className="text-sm font-medium">Creating transactions…</p>
            <p className="text-xs text-muted-foreground">Please wait</p>
          </div>
        )}
      </div>
    </div>
  );
}
