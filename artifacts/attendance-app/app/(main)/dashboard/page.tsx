"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  useGetTodayAttendance,
  getGetTodayAttendanceQueryKey,
  useCheckIn,
  useCheckOut,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, Camera, Clock, Loader2, ArrowRightCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const OFFICE_LAT = -6.2088;
const OFFICE_LNG = 106.8456;
const MAX_DISTANCE_METERS = 50;

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [time, setTime] = useState(new Date());

  const { data: attendance, isLoading: isLoadingAttendance } = useGetTodayAttendance({
    query: {
      queryKey: getGetTodayAttendanceQueryKey(),
    },
  });

  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCheckInSuccess = () => {
    queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
    setIsCheckInModalOpen(false);
    toast.success("Check-in successful!");
  };

  const handleCheckOutSuccess = () => {
    queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
    setIsCheckOutModalOpen(false);
    toast.success("Check-out successful!");
  };

  const renderStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="outline">NO RECORD</Badge>;
    switch (status) {
      case "present":
        return <Badge className="bg-green-600">PRESENT</Badge>;
      case "late":
        return <Badge className="bg-amber-500">LATE</Badge>;
      case "absent":
        return <Badge className="bg-red-600">ABSENT</Badge>;
      case "permit":
        return <Badge className="bg-indigo-600">PERMIT</Badge>;
      default:
        return <Badge variant="outline">{status.toUpperCase()}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Good morning, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-sm font-medium text-slate-500">
          {format(time, "EEEE, dd MMMM yyyy • HH:mm:ss")}
        </p>
      </div>

      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center justify-between">
            Today's Status
            {isLoadingAttendance ? (
              <Skeleton className="h-5 w-16" />
            ) : (
              renderStatusBadge(attendance?.status)
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingAttendance ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                    <ArrowRightCircle className="w-3 h-3" /> Check-in
                  </p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {attendance?.checkInTime
                      ? format(new Date(attendance.checkInTime), "HH:mm")
                      : "--:--"}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                    <ArrowRightCircle className="w-3 h-3 rotate-180" /> Check-out
                  </p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {attendance?.checkOutTime
                      ? format(new Date(attendance.checkOutTime), "HH:mm")
                      : "--:--"}
                  </p>
                </div>
              </div>

              {(attendance?.latenessMinutes ?? 0) > 0 && (
                <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-md">
                  Late by {attendance?.latenessMinutes} minutes
                </div>
              )}
              {(attendance?.overtimeMinutes ?? 0) > 0 && (
                <div className="text-xs text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-md">
                  Overtime: {Math.floor((attendance?.overtimeMinutes ?? 0) / 60)}h {(attendance?.overtimeMinutes ?? 0) % 60}m
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="pt-4">
        {!isLoadingAttendance && !attendance?.checkInTime && (
          <Button
            size="lg"
            className="w-full h-16 text-lg bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20"
            onClick={() => setIsCheckInModalOpen(true)}
          >
            Check In Now
          </Button>
        )}

        {!isLoadingAttendance && attendance?.checkInTime && !attendance?.checkOutTime && (
          <Button
            size="lg"
            className="w-full h-16 text-lg bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20"
            onClick={() => setIsCheckOutModalOpen(true)}
          >
            Check Out
          </Button>
        )}

        {!isLoadingAttendance && attendance?.checkOutTime && (
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
            <p className="text-slate-500 font-medium text-sm">
              You have completed your work for today.
            </p>
          </div>
        )}
      </div>

      <AttendanceModal
        isOpen={isCheckInModalOpen}
        onClose={() => setIsCheckInModalOpen(false)}
        type="Check-in"
        mutation={checkIn}
        onSuccess={handleCheckInSuccess}
      />

      <AttendanceModal
        isOpen={isCheckOutModalOpen}
        onClose={() => setIsCheckOutModalOpen(false)}
        type="Check-out"
        mutation={checkOut}
        onSuccess={handleCheckOutSuccess}
      />
    </div>
  );
}

function AttendanceModal({
  isOpen,
  onClose,
  type,
  mutation,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  type: "Check-in" | "Check-out";
  mutation: any;
  onSuccess: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setCamError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setCamError("Camera permission denied or not available.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  const getLocation = useCallback(() => {
    setIsLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng });
        const dist = getDistance(lat, lng, OFFICE_LAT, OFFICE_LNG);
        setDistance(Math.round(dist));
        setIsLocating(false);
      },
      (err) => {
        setLocError("Location permission denied or not available.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCamera();
      getLocation();
    } else {
      stopCamera();
      setPhoto(null);
      setLocation(null);
      setDistance(null);
      setLocError(null);
      setCamError(null);
    }
  }, [isOpen, startCamera, stopCamera, getLocation]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setPhoto(dataUrl);
        stopCamera();
      }
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
    startCamera();
  };

  const handleSubmit = () => {
    if (!photo || !location) return;
    
    // Check base64 size or just send it directly (stripping prefix if needed, though API might accept full data URL)
    const base64Data = photo; // Assuming API accepts data:image/jpeg;base64,...

    mutation.mutate(
      {
        data: {
          selfieBase64: base64Data,
          latitude: location.lat,
          longitude: location.lng,
          notes: "",
        },
      },
      {
        onSuccess,
        onError: (err: any) => {
          toast.error(err.data?.error || `Failed to ${type}`);
        },
      }
    );
  };

  const isWithinGeofence = distance !== null && distance <= MAX_DISTANCE_METERS;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md w-[90vw] rounded-xl overflow-hidden p-0 gap-0">
        <div className="p-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-xl">{type}</DialogTitle>
            <DialogDescription>
              Take a selfie and confirm your location to proceed.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-6">
          {/* Camera Section */}
          <div className="space-y-3">
            <div className="relative aspect-[3/4] bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-800">
              {camError ? (
                <div className="text-center p-4">
                  <Camera className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">{camError}</p>
                </div>
              ) : photo ? (
                <img src={photo} alt="Selfie" className="w-full h-full object-cover" />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              )}
              <canvas ref={canvasRef} className="hidden" />
              
              {!photo && !camError && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <button
                    onClick={capturePhoto}
                    className="w-16 h-16 rounded-full bg-white/20 border-4 border-white backdrop-blur-sm flex items-center justify-center"
                  >
                    <div className="w-12 h-12 bg-white rounded-full"></div>
                  </button>
                </div>
              )}
            </div>
            
            {photo && (
              <Button variant="outline" className="w-full" onClick={retakePhoto}>
                Retake Photo
              </Button>
            )}
          </div>

          {/* Location Section */}
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-100 dark:border-slate-800 flex items-start gap-3">
            <MapPin className={cn("w-5 h-5 mt-0.5", isWithinGeofence ? "text-green-600" : "text-amber-500")} />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Location Verification
              </p>
              {isLocating ? (
                <div className="flex items-center text-xs text-slate-500">
                  <Loader2 className="w-3 h-3 animate-spin mr-2" /> Locating...
                </div>
              ) : locError ? (
                <p className="text-xs text-red-500">{locError}</p>
              ) : distance !== null ? (
                <p className={cn("text-xs font-medium", isWithinGeofence ? "text-green-600" : "text-red-500")}>
                  {isWithinGeofence
                    ? "Within office area"
                    : `Outside office area — ${distance} meters away`}
                </p>
              ) : null}
            </div>
          </div>

          <Button
            className="w-full h-12 text-base font-semibold"
            disabled={!photo || !location || !isWithinGeofence || mutation.isPending}
            onClick={handleSubmit}
          >
            {mutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : null}
            Confirm {type}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}
