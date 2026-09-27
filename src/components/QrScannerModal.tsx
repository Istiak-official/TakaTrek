import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { X, Camera, SwitchCamera, Image as ImageIcon, AlertCircle, ScanLine } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations, Language } from '../lib/translations';
import { triggerHaptic } from '../lib/haptics';
import { toast } from 'sonner';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: string) => void;
  lang: Language;
}

export default function QrScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  lang
}: QrScannerModalProps) {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasCameraError, setHasCameraError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  // Check camera devices
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setHasMultipleCameras(videoInputs.length > 1);
    }).catch(() => {});
  }, []);

  // Scan loop with BarcodeDetector and jsQR
  const scanLoop = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      // 1. Try native BarcodeDetector API if supported (fastest, supports 1D & 2D barcodes)
      if (typeof (window as any).BarcodeDetector !== 'undefined') {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e']
          });
          const detected = await detector.detect(video);
          if (detected && detected.length > 0 && detected[0].rawValue) {
            triggerHaptic('double');
            stopCamera();
            onScanSuccess(detected[0].rawValue);
            return;
          }
        } catch {
          // Fall back to jsQR
        }
      }

      // 2. jsQR canvas fallback
      const width = video.videoWidth;
      const height = video.videoHeight;

      if (width > 0 && height > 0) {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data) {
            triggerHaptic('double');
            stopCamera();
            onScanSuccess(code.data);
            return;
          }
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanLoop);
  }, [onScanSuccess, stopCamera]);

  // Start camera
  const startCamera = useCallback(async () => {
    stopCamera();
    setHasCameraError(false);
    setErrorMessage('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setHasCameraError(true);
      setErrorMessage(t.cameraNotFound);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsScanning(true);
        animationFrameRef.current = requestAnimationFrame(scanLoop);
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setHasCameraError(true);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(
          lang === 'bn'
            ? 'ক্যামেরা ব্যবহারের অনুমতি দেওয়া হয়নি। অনুগ্রহ করে ব্রাউজার সেটিংসে ক্যামেরার পারমিশন চালু করুন অথবা কিউআর ছবির ফাইল আপলোড করুন।'
            : 'Camera permission denied. Please allow camera access in browser settings or upload a QR image.'
        );
      } else {
        setErrorMessage(t.cameraNotFound);
      }
    }
  }, [facingMode, lang, scanLoop, stopCamera, t.cameraNotFound]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Flip camera
  const toggleFacingMode = () => {
    triggerHaptic('single');
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Handle uploaded image file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });

        if (code && code.data) {
          triggerHaptic('double');
          stopCamera();
          onScanSuccess(code.data);
        } else {
          toast.error(t.scanQrError);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Reset file input
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="fixed inset-0 bg-black/75 backdrop-blur-xs"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-950 border-b border-zinc-800 text-white">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-400" />
              <span className="font-extrabold text-sm">{lang === 'bn' ? 'বারকোড ও কিউআর স্ক্যানার' : 'Barcode & QR Scanner'}</span>
            </div>

            <div className="flex items-center gap-2">
              {hasMultipleCameras && !hasCameraError && (
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                  title={t.switchCamera}
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Viewfinder Area */}
          <div className="relative w-full aspect-square bg-black overflow-hidden flex items-center justify-center">
            {/* Hidden canvas for jsQR analysis */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Video element */}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${hasCameraError ? 'hidden' : 'block'}`}
              playsInline
              muted
            />

            {/* Scanning Target Overlay */}
            {!hasCameraError && isScanning && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-8">
                {/* Darkened mask cutout */}
                <div className="relative w-56 h-56 border-2 border-emerald-500 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  {/* Four solid corner brackets */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                  {/* Horizontal laser indicator - solid emerald line, no gradient */}
                  <motion.div
                    animate={{ y: [0, 210, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                    className="w-full h-0.5 bg-emerald-400 shadow-sm"
                  />
                </div>
                <p className="mt-4 text-xs font-bold text-white/90 bg-black/60 px-3 py-1.5 rounded-full text-center max-w-xs">
                  {lang === 'bn' ? 'গ্রাহকের বারকোড বা কিউআর কোড ফ্রেমের মধ্যে রাখুন' : 'Align customer barcode or QR code in frame'}
                </p>
              </div>
            )}

            {/* Camera error message / fallback */}
            {hasCameraError && (
              <div className="p-6 text-center flex flex-col items-center max-w-xs">
                <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
                <p className="text-xs text-zinc-300 font-semibold leading-relaxed mb-4">
                  {errorMessage}
                </p>
                <div className="flex flex-col gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{lang === 'bn' ? 'ক্যামেরা চালু করুন' : 'Enable / Retry Camera'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    <span>{t.uploadQrFile}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Bar / Upload Option */}
          <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              <span>{t.uploadQrFile}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              {lang === 'bn' ? 'বাতিল' : 'Cancel'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
