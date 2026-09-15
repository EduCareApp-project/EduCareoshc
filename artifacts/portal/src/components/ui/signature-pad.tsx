import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "./button";
import { Eraser } from "lucide-react";

interface SignaturePadProps {
  onSign?: (signatureUrl: string) => void;
  disabled?: boolean;
}

export function SignaturePad({ onSign, disabled = false }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const getCoordinates = (
    e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: (e as any).clientX - rect.left,
      y: (e as any).clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setIsEmpty(false);
  };

  const stopDrawing = () => {
    if (!isDrawing || disabled) return;
    setIsDrawing(false);

    if (canvasRef.current && onSign) {
      onSign(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    if (onSign) {
      onSign("");
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }

      // Handle resize to make it responsive
      const resizeCanvas = () => {
        const parent = canvas.parentElement;
        if (parent) {
          // Keep old image data
          const tempCanvas = document.createElement("canvas");
          const tCtx = tempCanvas.getContext("2d");
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          if (tCtx) {
            tCtx.drawImage(canvas, 0, 0);
          }

          canvas.width = parent.clientWidth;

          // Restore
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 2;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
          }
        }
      };

      window.addEventListener("resize", resizeCanvas);
      resizeCanvas();

      return () => window.removeEventListener("resize", resizeCanvas);
    }
    return undefined;
  }, []);

  return (
    <div className="space-y-2">
      <div className="border border-input rounded-md overflow-hidden bg-white touch-none">
        <canvas
          ref={canvasRef}
          height={150}
          className={`w-full cursor-crosshair ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      {!disabled && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            className="text-muted-foreground h-8 px-2 text-xs"
          >
            <Eraser className="h-3 w-3 mr-1" />
            Clear signature
          </Button>
        </div>
      )}
    </div>
  );
}
