import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import {
  useCheckIn,
  useCheckOut,
  useGetTodayAttendance,
  getGetTodayAttendanceQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2, MapPin, AlertCircle, CheckCircle2 } from "lucide-react";

const MODEL_URL = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights";

type AbsenStatus =
  | "idle"
  | "loading-model"
  | "camera-error"
  | "detecting"
  | "ready"
  | "capturing"
  | "submitting"
  | "done";

export default function AbsenPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectLoopRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const faceApiRef = useRef<any>(null);

  const [status, setStatus] = useState<AbsenStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [faceDetected, setFaceDetected] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);

  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const { data: today } = useGetTodayAttendance({
    query: { queryKey: getGetTodayAttendanceQueryKey() },
  });

  const hasCheckedIn = !!today?.checkInTime;
  const hasCheckedOut = !!today?.checkOutTime;

  const stopCamera = useCallback(() => {
    if (detectLoopRef.current) cancelAnimationFrame(detectLoopRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const loadFaceApiModel = useCallback(async () => {
    if (modelLoaded) return faceApiRef.current;
    setStatus("loading-model");
    try {
      const faceapi = await import("face-api.js");
      faceApiRef.current = faceapi;
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      setModelLoaded(true);
      return faceapi;
    } catch (err) {
      console.error("Model load error:", err);
      return null;
    }
  }, [modelLoaded]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      return true;
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setErrorMsg("Izin kamera ditolak. Buka Pengaturan Browser > Izin > Kamera, lalu refresh halaman.");
      } else if (err.name === "NotFoundError") {
        setErrorMsg("Kamera tidak ditemukan. Perangkat Anda tidak memiliki kamera depan.");
      } else {
        setErrorMsg("Kamera tidak dapat diakses. Pastikan browser mendukung fitur ini.");
      }
      setStatus("camera-error");
      return false;
    }
  }, []);

  const getGPS = useCallback(() => {
    return new Promise<{ lat: number; lng: number; accuracy: number } | null>((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  }, []);

  const startDetection = useCallback(async (faceapi: any) => {
    setStatus("detecting");
    setFaceDetected(false);
    const detectLoop = async () => {
      if (!videoRef.current || !faceapi) return;
      const options = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.6 });
      const detection = await faceapi.detectSingleFace(videoRef.current, options);
      const detected = !!(detection && detection.score >= 0.6);
      setFaceDetected(detected);
      if (detected) setStatus("ready");
      detectLoopRef.current = requestAnimationFrame(detectLoop);
    };
    detectLoopRef.current = requestAnimationFrame(detectLoop);
  }, []);

  const handleStart = useCallback(async () => {
    if (hasCheckedOut) { toast.info("Absensi hari ini sudah selesai."); return; }
    const faceapi = await loadFaceApiModel();
    const cameraOk = await startCamera();
    if (!cameraOk) return;
    const coords = await getGPS();
    if (!coords) toast.warning("Lokasi tidak terdeteksi. Koordinat akan kosong.");
    setGps(coords);
    if (faceapi) await startDetection(faceapi);
    else setStatus("ready");
  }, [hasCheckedOut, loadFaceApiModel, startCamera, getGPS, startDetection]);

  const captureAndSubmit = useCallback(async () => {
    if (status === "submitting" || status === "done") return;
    setStatus("capturing");
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1]!;
    setCapturedImage(canvas.toDataURL("image/jpeg", 0.7));
    stopCamera();
    setStatus("submitting");

    const body = { data: { selfieBase64: base64, latitude: gps?.lat ?? 0, longitude: gps?.lng ?? 0, accuracy: gps?.accuracy } };
    const mutation = hasCheckedIn ? checkOut : checkIn;
    mutation.mutate(body, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        setStatus("done");
        toast.success(hasCheckedIn ? "Absen keluar berhasil! 🎉" : "Absen masuk berhasil! ✅");
        setTimeout(() => navigate("/dashboard"), 2000);
      },
      onError: (err: any) => {
        const msg = err?.data?.error || err?.message || "Gagal menyimpan absensi.";
        toast.error(msg);
        setStatus("ready");
        setCapturedImage(null);
        handleStart();
      },
    });
  }, [status, gps, hasCheckedIn, checkIn, checkOut, queryClient, navigate, stopCamera, handleStart]);

  if (hasCheckedOut && status === "idle") {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-[#4A4435] mb-2">Absensi Selesai!</h2>
        <p className="text-[#8C8573] text-sm mb-6">Anda sudah absen masuk dan keluar hari ini.</p>
        <Link href="/dashboard" className="bg-[#FACC15] text-[#4A4435] font-bold px-8 py-3 rounded-2xl">
          Kembali ke Beranda
        </Link>
        <p className="mt-8 text-xs text-[#8C8573]/40">PT. Lembayung Wanantara Padha</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="bg-[#FACC15] px-5 pt-12 pb-8 rounded-b-[40px]">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/dashboard" className="w-8 h-8 rounded-full bg-[#4A4435]/10 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-[#4A4435]" />
          </Link>
          <div>
            <h1 className="text-lg font-extrabold text-[#4A4435]">
              {hasCheckedIn ? "Absen Keluar" : "Absen Masuk"}
            </h1>
            <p className="text-xs text-[#4A4435]/60">
              {hasCheckedIn ? "Pindai wajah untuk clock-out" : "Pindai wajah untuk clock-in"}
            </p>
          </div>
        </div>
        {gps && (
          <div className="flex items-center gap-1.5 bg-white/40 rounded-xl px-3 py-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#4A4435]" />
            <span className="text-xs text-[#4A4435] font-medium">{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</span>
            <span className="text-xs text-[#4A4435]/60 ml-1">±{Math.round(gps.accuracy)}m</span>
          </div>
        )}
      </div>

      <div className="flex-1 px-5 pt-6 flex flex-col items-center">
        {status === "idle" && (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <div className="w-32 h-32 rounded-full bg-[#FACC15]/20 border-4 border-dashed border-[#FACC15] flex items-center justify-center mb-6">
              <Camera className="w-12 h-12 text-[#FACC15]" />
            </div>
            <h2 className="text-lg font-bold text-[#4A4435] mb-2">
              {hasCheckedIn ? "Siap untuk Absen Keluar?" : "Siap untuk Absen Masuk?"}
            </h2>
            <p className="text-sm text-[#8C8573] mb-8 max-w-[260px]">
              Kamera depan akan dibuka untuk mendeteksi wajah Anda secara otomatis.
            </p>
            <button
              onClick={handleStart}
              className="flex items-center justify-center gap-2 bg-[#FACC15] text-[#4A4435] font-bold text-base h-14 px-10 rounded-2xl shadow-md active:scale-[0.98] transition-transform"
            >
              <Camera className="w-5 h-5" />
              Buka Kamera
            </button>
          </div>
        )}

        {status === "loading-model" && (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <Loader2 className="w-12 h-12 text-[#FACC15] animate-spin mb-4" />
            <p className="text-[#4A4435] font-semibold">Memuat model deteksi wajah...</p>
            <p className="text-[#8C8573] text-sm mt-1">Membutuhkan koneksi internet</p>
          </div>
        )}

        {status === "camera-error" && (
          <div className="flex flex-col items-center justify-center flex-1 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-[#4A4435] mb-2">Izin Kamera Diperlukan</h2>
            <p className="text-sm text-[#8C8573] leading-relaxed mb-6">{errorMsg}</p>
            <button onClick={() => { setStatus("idle"); setErrorMsg(""); }} className="bg-[#FACC15] text-[#4A4435] font-bold px-8 py-3 rounded-2xl">
              Coba Lagi
            </button>
          </div>
        )}

        {(status === "detecting" || status === "ready" || status === "capturing" || status === "submitting") && (
          <div className="w-full flex flex-col items-center">
            <div className="relative w-72 h-72 rounded-full overflow-hidden border-4 border-[#FACC15] shadow-xl mb-5">
              <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
              {faceDetected ? (
                <div className="absolute inset-0 border-4 border-green-400 rounded-full pointer-events-none" />
              ) : (
                <div className="absolute inset-0 border-4 border-[#FACC15]/60 rounded-full pointer-events-none animate-pulse" />
              )}
              {status === "submitting" && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                  <Loader2 className="w-12 h-12 text-white animate-spin" />
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />

            <div className="flex items-center gap-2 mb-5">
              {faceDetected ? (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-semibold text-green-600">Wajah Terdeteksi ✓</span>
                </>
              ) : (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FACC15] animate-pulse" />
                  <span className="text-sm text-[#8C8573]">Posisikan wajah di dalam lingkaran...</span>
                </>
              )}
            </div>

            {!faceDetected && (
              <p className="text-xs text-[#8C8573] text-center max-w-[240px] mb-4">
                Pastikan wajah Anda berada di tengah frame dengan pencahayaan yang cukup
              </p>
            )}

            <button
              onClick={captureAndSubmit}
              disabled={!faceDetected || status === "submitting" || status === "capturing"}
              className="w-full h-14 rounded-2xl bg-[#FACC15] text-[#4A4435] font-bold text-base flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === "submitting" ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Menyimpan...</>
              ) : (
                <><Camera className="w-5 h-5" /> 📸 Ambil Foto & {hasCheckedIn ? "Keluar" : "Masuk"}</>
              )}
            </button>

            <button onClick={() => { stopCamera(); setStatus("idle"); setFaceDetected(false); }} className="mt-3 text-sm text-[#8C8573] underline">
              Batalkan
            </button>
          </div>
        )}

        {status === "done" && (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            {capturedImage && (
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-green-400 mb-5 shadow-lg">
                <img src={capturedImage} alt="Selfie" className="w-full h-full object-cover scale-x-[-1]" />
              </div>
            )}
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-[#4A4435] mb-1">
              {hasCheckedIn ? "Berhasil Keluar!" : "Berhasil Masuk!"}
            </h2>
            <p className="text-sm text-[#8C8573]">Mengalihkan ke beranda...</p>
          </div>
        )}
      </div>

      <div className="pb-24 text-center pt-4">
        <p className="text-[10px] text-[#8C8573]/40">PT. Lembayung Wanantara Padha</p>
      </div>
    </div>
  );
}
