import React, { useRef, useState, useEffect } from 'react';
import { PenTool, RotateCcw, Check, Sparkles } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  sublabel?: string;
  value?: string;
  signerName?: string;
  onSave: (dataUrl: string) => void;
  onClear?: () => void;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  sublabel,
  value,
  signerName,
  onSave,
  onClear,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(Boolean(value));
  const [currentSignature, setCurrentSignature] = useState<string | undefined>(value);

  useEffect(() => {
    setCurrentSignature(value);
    setHasStroke(Boolean(value));
  }, [value]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasStroke(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasStroke) {
      const dataUrl = canvas.toDataURL('image/png');
      setCurrentSignature(dataUrl);
      onSave(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setHasStroke(false);
    setCurrentSignature(undefined);
    onClear?.();
  };

  const useDemoSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e3a8a';

    // Draw stylized cursive initials and flourishes
    const w = canvas.width;
    const h = canvas.height;
    ctx.beginPath();
    ctx.moveTo(w * 0.15, h * 0.65);
    ctx.bezierCurveTo(w * 0.22, h * 0.2, w * 0.35, h * 0.15, w * 0.38, h * 0.55);
    ctx.bezierCurveTo(w * 0.4, h * 0.75, w * 0.48, h * 0.8, w * 0.55, h * 0.45);
    ctx.bezierCurveTo(w * 0.62, h * 0.15, w * 0.7, h * 0.4, w * 0.75, h * 0.6);
    ctx.bezierCurveTo(w * 0.8, h * 0.75, w * 0.88, h * 0.5, w * 0.92, h * 0.52);
    ctx.stroke();

    // Underline flourish
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.8);
    ctx.bezierCurveTo(w * 0.45, h * 0.78, w * 0.7, h * 0.82, w * 0.88, h * 0.75);
    ctx.stroke();

    const dataUrl = canvas.toDataURL('image/png');
    setHasStroke(true);
    setCurrentSignature(dataUrl);
    onSave(dataUrl);
  };

  return (
    <div className="card p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <PenTool className="w-4 h-4 text-red-600" />
            <strong className="text-sm font-bold text-slate-900">{label}</strong>
          </div>
          {sublabel && <p className="text-xs text-slate-500 mt-0.5">{sublabel}</p>}
        </div>
        {signerName && (
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
            {signerName}
          </span>
        )}
      </div>

      <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 overflow-hidden touch-none">
        {currentSignature && !isDrawing && (
          <div className="absolute inset-0 flex items-center justify-center p-2 pointer-events-none bg-white/80">
            <img src={currentSignature} alt="ลายเซ็น" className="max-h-full max-w-full object-contain" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={480}
          height={180}
          className="w-full h-40 sm:h-44 block cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <div className="absolute bottom-2 left-3 pointer-events-none text-[11px] text-slate-400">
          เซ็นชื่อด้วยนิ้วหรือเมาส์ในกรอบนี้
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={clearCanvas}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          ล้างลายเซ็น
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={useDemoSignature}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            ใช้ลายเซ็นตัวอย่าง
          </button>
          {hasStroke && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
              <Check className="w-3.5 h-3.5" />
              บันทึกแล้ว
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
