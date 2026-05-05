"use client";

import { useRef, useState, useEffect } from "react";
import {
  QrCode,
  Upload,
  Camera,
  Copy,
  Check,
  Smartphone,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsQR from "jsqr";
import { QRCodeSVG } from "qrcode.react";

function parseUpiUrl(url) {
  if (!url.startsWith("upi://pay")) return null;
  const queryStart = url.indexOf("?");
  const query = queryStart !== -1 ? url.slice(queryStart + 1) : "";
  const params = new URLSearchParams(query);
  return {
    upiUrl: url,
    pa: params.get("pa") || "",
    pn: decodeURIComponent(params.get("pn") || ""),
    am: params.get("am") || "",
    tn: params.get("tn") || "",
  };
}

export function UpiScanner({ onUpiScanned, upiData, onReset }) {
  const [isScanning, setIsScanning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const scanCanvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    setIsMobile(
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || window.innerWidth < 768
    );
    return () => stopCamera();
  }, []);

  // Attach stream to video element after it renders (when isScanning flips to true)
  useEffect(() => {
    if (!isScanning || !streamRef.current || !videoRef.current) return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;

    let animId;
    function tick() {
      const canvas = scanCanvasRef.current;
      if (!canvas || !streamRef.current) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext("2d");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          stopCamera();
          processQrData(code.data);
          return;
        }
      }
      animId = requestAnimationFrame(tick);
    }

    video
      .play()
      .then(tick)
      .catch(() => {
        toast.error("Could not start camera stream");
        stopCamera();
      });

    return () => cancelAnimationFrame(animId);
  }, [isScanning]); // eslint-disable-line react-hooks/exhaustive-deps

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }

  function processQrData(rawData) {
    const parsed = parseUpiUrl(rawData);
    if (!parsed) {
      toast.error("Not a valid UPI QR code");
      return;
    }
    onUpiScanned(parsed);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: isMobile ? "environment" : "user" },
      });
      streamRef.current = stream;
      setIsScanning(true);
    } catch {
      toast.error("Camera access denied — please allow camera permission.");
    }
  }

  async function handleImageUpload(file) {
    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (!code) {
        toast.error("No QR code found in image");
        return;
      }
      processQrData(code.data);
    } catch {
      toast.error("Failed to read QR from image");
    }
  }

  function copyLink() {
    if (!upiData?.upiUrl) return;
    navigator.clipboard.writeText(upiData.upiUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("UPI link copied");
  }

  // ── Post-scan UI ──────────────────────────────────────────────────────────
  if (upiData) {
    const merchantLabel = upiData.pn || upiData.pa || "Unknown Merchant";

    // Merchant info card — same for mobile and desktop.
    // Desktop also shows a QR so the user can scan on phone.
    return (
      <div className="rounded-xl border border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-800 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center shrink-0">
              <QrCode className="h-4 w-4 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Paying to</p>
              <p className="font-semibold leading-tight truncate">{merchantLabel}</p>
              {upiData.pa && (
                <p className="text-xs text-muted-foreground truncate">{upiData.pa}</p>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={onReset}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Desktop only: QR to scan on phone + copy link */}
        {!isMobile && (
          <div className="flex flex-col items-center gap-3 pt-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Smartphone className="h-4 w-4" />
              Scan with your phone to pay
            </p>
            <div className="bg-white p-3 rounded-xl shadow-sm inline-block">
              <QRCodeSVG value={upiData.upiUrl} size={160} />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={copyLink}
            >
              {copied
                ? <><Check className="h-3 w-3 mr-1.5" />Copied!</>
                : <><Copy className="h-3 w-3 mr-1.5" />Copy UPI Link</>}
            </Button>
            <p className="text-xs text-muted-foreground">
              Fill the form and click <strong>Create Transaction</strong> below
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Camera scanning UI ────────────────────────────────────────────────────
  if (isScanning) {
    return (
      <div className="space-y-2">
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-52 h-52 border-2 border-white/80 rounded-2xl" />
          </div>
          <canvas ref={scanCanvasRef} className="hidden" />
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={stopCamera}
        >
          Cancel Scan
        </Button>
      </div>
    );
  }

  // ── Initial UI ────────────────────────────────────────────────────────────
  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageUpload(file);
          e.target.value = "";
        }}
      />

      {isMobile ? (
        <Button
          type="button"
          variant="outline"
          className="w-full h-10 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 text-white hover:text-white hover:opacity-90 transition-opacity"
          onClick={startCamera}
        >
          <QrCode className="mr-2 h-4 w-4" />
          Scan &amp; Pay (UPI)
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-10 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 text-white hover:text-white hover:opacity-90 transition-opacity"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload UPI QR to Pay
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 px-3"
            title="Use webcam to scan QR"
            onClick={startCamera}
          >
            <Camera className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
}
