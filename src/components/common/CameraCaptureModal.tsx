import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw, X, Check, RotateCcw, CreditCard, User, AlertCircle, Upload } from 'lucide-react';
import { resizeImageFile } from '../../utils/camera';

export type CameraGuideMode = 'idcard' | 'portrait' | 'general';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string, fileName: string) => void;
  mode?: CameraGuideMode;
  title?: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  mode = 'general',
  title = 'ถ่ายรูป',
}) => {
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileFallbackRef = useRef<HTMLInputElement | null>(null);
  const cameraRequestRef = useRef(0);

  // Stop media stream tracks cleanly without triggering re-renders
  const stopStream = useCallback(() => {
    // Invalidate pending permission requests before stopping the active stream.
    cameraRequestRef.current += 1;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.onloadedmetadata = null;
      videoRef.current.onloadeddata = null;
      videoRef.current.onplaying = null;
      videoRef.current.onresize = null;
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start media stream
  const startCamera = useCallback(
    async (facing: 'environment' | 'user') => {
      setIsStarting(true);
      setCameraError(null);
      stopStream();
      const requestId = cameraRequestRef.current;

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('เบราว์เซอร์นี้ไม่รองรับการเปิดกล้องโดยตรง กรุณาใช้การถ่ายผ่านระบบปกติ');
        setIsStarting(false);
        return;
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        const video = videoRef.current;
        if (requestId !== cameraRequestRef.current || !video) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = mediaStream;
        const updateReadiness = () => {
          if (requestId !== cameraRequestRef.current || video.srcObject !== mediaStream) return;
          setIsStarting(video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0);
        };
        video.onloadedmetadata = () => {
          video.play().catch(() => {});
          updateReadiness();
        };
        video.onloadeddata = updateReadiness;
        video.onplaying = updateReadiness;
        video.onresize = updateReadiness;
        video.srcObject = mediaStream;
        video.play().catch(() => {});
        updateReadiness();
      } catch (err: unknown) {
        if (requestId !== cameraRequestRef.current) return;
        const error = err as { name?: string; message?: string };
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setCameraError('ไม่ได้รับอนุญาตให้เข้าถึงกล้อง กรุณาเปิดการอนุญาตในเบราว์เซอร์ หรือเลือกไฟล์จากเครื่อง');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          setCameraError('ไม่พบอุปกรณ์กล้องบนอุปกรณ์นี้');
        } else {
          setCameraError('ไม่สามารถเปิดกล้องได้ กรุณาใช้การถ่ายรูปผ่านกล้องมาตรฐาน');
        }
        setIsStarting(false);
      }
    },
    [stopStream]
  );

  // When modal opens or camera facing mode changes
  useEffect(() => {
    if (isOpen) {
      setCapturedPhoto(null);
      setCameraError(null);
      startCamera(facingMode);
    } else {
      stopStream();
      setCapturedPhoto(null);
    }
    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, startCamera, stopStream]);

  // Flip camera
  const handleToggleFacing = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
  };

  // Capture frame to canvas
  const handleShutter = () => {
    const video = videoRef.current;
    if (!video || video.srcObject !== streamRef.current || video.readyState < 2 ||
        !video.videoWidth || !video.videoHeight) return;

    // Trigger visual flash
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If using user-facing camera, mirror the frame horizontally so it matches the preview
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedPhoto(dataUrl);
  };

  // Confirm photo
  const handleConfirmPhoto = async () => {
    if (!capturedPhoto) return;
    try {
      // Compress using existing utility if large
      // Convert dataUrl to blob/file
      const res = await fetch(capturedPhoto);
      const blob = await res.blob();
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const compressed = await resizeImageFile(file, 1280, 0.85);

      onCapture(compressed, file.name);
      onClose();
    } catch {
      onCapture(capturedPhoto, `photo_${Date.now()}.jpg`);
      onClose();
    }
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedPhoto(null);
    if (videoRef.current && streamRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  // Fallback upload file handler
  const handleFallbackFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await resizeImageFile(file, 1280, 0.85);
      onCapture(compressed, file.name);
      onClose();
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col select-none overflow-hidden touch-none" role="dialog" aria-modal="true">
      {/* Visual Flash effect */}
      {isFlashing && (
        <div className="absolute inset-0 bg-white z-40 opacity-80 pointer-events-none transition-opacity duration-200" />
      )}

      {/* Top Navigation Bar */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent text-white pt-safe">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition active:scale-95"
          aria-label="ปิดกล้อง"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center px-2">
          <span className="text-sm font-semibold text-white drop-shadow-md block truncate max-w-[200px]">
            {title}
          </span>
          <span className="text-[11px] text-white/80 font-normal">
            {mode === 'idcard' ? 'กรอบบัตรประชาชน' : mode === 'portrait' ? 'กรอบภาพถ่ายบุคคล' : 'กรอบภาพถ่ายทั่วไป'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleToggleFacing}
          disabled={!!capturedPhoto || !!cameraError}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition active:scale-95 disabled:opacity-40"
          aria-label="สลับกล้องหน้าหลัง"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Viewfinder / Video Feed Area */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center bg-black overflow-hidden">
        {/* Keep the stream attached during preview so retake needs no camera restart. */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-hidden={!!capturedPhoto}
          className={`absolute inset-0 w-full h-full object-cover ${capturedPhoto ? 'invisible' : ''} ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {/* Captured Preview */}
        {capturedPhoto && (
          <img
            src={capturedPhoto}
            alt="ภาพตัวอย่าง"
            className="w-full h-full object-cover"
          />
        )}

        {/* Loading Spinner */}
        {isStarting && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white gap-3 z-20">
            <RefreshCw className="w-8 h-8 animate-spin text-white/80" />
            <span className="text-sm">กำลังเปิดกล้อง...</span>
          </div>
        )}

        {/* Camera Permission / Error Fallback */}
        {cameraError && !capturedPhoto && (
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 p-6 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white text-center space-y-4 z-20">
            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
            <h4 className="text-base font-bold">ไม่สามารถเปิดกล้องได้</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
            <div className="pt-2 flex flex-col gap-2">
              <label className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition">
                <Upload className="w-4 h-4" />
                <span>เปิดกล้องมาตรฐาน / เลือกรูปภาพ</span>
                <input
                  ref={fileFallbackRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={handleFallbackFile}
                />
              </label>
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition"
              >
                ลองใหม่อีกครั้ง
              </button>
            </div>
          </div>
        )}

        {/* Guideline Overlays (Only visible during live capture, not during preview) */}
        {!capturedPhoto && !cameraError && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10 p-6">
            {/* 1. ID CARD GUIDELINE */}
            {mode === 'idcard' && (
              <div className="w-full max-w-sm sm:max-w-md aspect-[1.58/1] relative rounded-2xl border-2 border-dashed border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex flex-col items-center justify-between p-4 transition-all">
                {/* 4 Corner Brackets */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

                {/* Top Badge */}
                <div className="flex items-center gap-1.5 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-emerald-300 text-[11px] font-semibold border border-emerald-400/30">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>กรอบวางบัตรประชาชน</span>
                </div>

                {/* Center Hint */}
                <div className="text-center space-y-1">
                  <p className="text-xs sm:text-sm font-semibold text-white drop-shadow">
                    วางบัตรประชาชนให้ตรงกรอบเส้นประ
                  </p>
                  <p className="text-[10px] text-slate-200 drop-shadow">
                    ตัวหนังสือชัดเจน ไม่สะท้อนแสง และเห็นขอบบัตรครบ 4 ด้าน
                  </p>
                </div>

                {/* Bottom chip indicator */}
                <div className="w-10 h-7 border border-dashed border-white/40 rounded-md bg-white/5 flex items-center justify-center self-start">
                  <span className="text-[9px] text-white/50">CHIP</span>
                </div>
              </div>
            )}

            {/* 2. PORTRAIT GUIDELINE */}
            {mode === 'portrait' && (
              <div className="w-full max-w-xs aspect-[3/4] relative rounded-3xl border-2 border-dashed border-cyan-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex flex-col items-center justify-between p-5 transition-all">
                {/* 4 Corner Brackets */}
                <div className="absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 border-cyan-400 rounded-tl-2xl" />
                <div className="absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 border-cyan-400 rounded-tr-2xl" />
                <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 border-cyan-400 rounded-bl-2xl" />
                <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 border-cyan-400 rounded-br-2xl" />

                {/* Top Badge */}
                <div className="flex items-center gap-1.5 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-cyan-300 text-[11px] font-semibold border border-cyan-400/30">
                  <User className="w-3.5 h-3.5" />
                  <span>กรอบภาพถ่ายบุคคล</span>
                </div>

                {/* Center Oval Face Guide */}
                <div className="w-40 h-52 rounded-[50%] border-2 border-dashed border-white/60 flex items-center justify-center bg-white/5">
                  <span className="text-[11px] text-white/80 font-medium">ตำแหน่งใบหน้า</span>
                </div>

                {/* Bottom Hint */}
                <div className="text-center space-y-0.5">
                  <p className="text-xs sm:text-sm font-semibold text-white drop-shadow">
                    จัดตำแหน่งบุคคลให้อยู่ในกรอบ
                  </p>
                  <p className="text-[10px] text-slate-200 drop-shadow">
                    มองตรง เห็นใบหน้าชัดเจน ถอดหมวกและแว่นตาดำ
                  </p>
                </div>
              </div>
            )}

            {/* 3. GENERAL GUIDELINE */}
            {mode === 'general' && (
              <div className="w-full max-w-sm aspect-[4/3] relative rounded-2xl border-2 border-dashed border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex flex-col items-center justify-between p-4 transition-all">
                {/* 4 Corner Brackets */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-xl" />

                <div className="text-center space-y-1 my-auto">
                  <p className="text-xs sm:text-sm font-semibold text-white drop-shadow">
                    จัดวางให้อยู่ภายในกรอบภาพ
                  </p>
                  <p className="text-[10px] text-slate-200 drop-shadow">
                    มีแสงสว่างเพียงพอและภาพคมชัด
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="relative z-30 px-6 py-6 bg-gradient-to-t from-black via-black/80 to-transparent flex items-center justify-around pb-safe">
        {/* Live Capture Mode Controls */}
        {!capturedPhoto && (
          <div className="w-full flex items-center justify-between max-w-xs mx-auto">
            {/* Gallery Upload fallback button */}
            <label
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center cursor-pointer transition backdrop-blur-md"
              title="เลือกรูปภาพจากเครื่อง"
            >
              <Upload className="w-5 h-5 text-white/90" />
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFallbackFile}
              />
            </label>

            {/* Shutter Button */}
            <button
              type="button"
              onClick={handleShutter}
              disabled={isStarting || !!cameraError}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:scale-90 transition p-1 disabled:opacity-40"
              aria-label="ถ่ายภาพ"
            >
              <div className="w-full h-full rounded-full bg-white shadow-lg active:bg-slate-200 transition" />
            </button>

            {/* Placeholder to balance layout */}
            <div className="w-12 h-12" />
          </div>
        )}

        {/* Preview Confirmation Mode Controls */}
        {capturedPhoto && (
          <div className="w-full flex items-center justify-around max-w-xs mx-auto gap-4">
            {/* Retake Button */}
            <button
              type="button"
              onClick={handleRetake}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-2 active:scale-95 transition shadow-lg"
            >
              <RotateCcw className="w-4 h-4" />
              <span>ถ่ายใหม่</span>
            </button>

            {/* Confirm & Use Photo Button */}
            <button
              type="button"
              onClick={handleConfirmPhoto}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition shadow-lg"
            >
              <Check className="w-4 h-4" />
              <span>ใช้รูปนี้</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
