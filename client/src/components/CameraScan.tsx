import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera, CameraOff, Check, ImagePlus, Loader2, RefreshCcw, ScanLine, SwitchCamera, TriangleAlert, Upload, X,
} from 'lucide-react';
import { Modal, Button, Progress } from './ui';
import { recognizeLabel, setOcrProgressListener, warmUpOcr } from '../lib/ocr';
import { cn } from '../lib/utils';

type Step = 'capture' | 'reading' | 'review';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the recognised (and user-editable) text. */
  onText: (text: string) => void | Promise<void>;
}

export default function CameraScan({ open, onClose, onText }: Props) {
  const [step, setStep] = useState<Step>('capture');
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'live' | 'unavailable'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [text, setText] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [progress, setProgress] = useState({ status: 'Preparing…', progress: 0 });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);

  /* ------------------------------------------------------------- lifecycle */
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState('idle');
  }, []);

  const reset = useCallback(() => {
    stopCamera();
    setStep('capture');
    setImageUrl(null);
    setImageBlob(null);
    setText('');
    setConfidence(null);
    setError(null);
    setProgress({ status: 'Preparing…', progress: 0 });
    setCameraError(null);
  }, [stopCamera]);

  const handleClose = () => {
    stopCamera();
    reset();
    onClose();
  };

  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('unavailable');
        setCameraError('This browser does not expose a camera to web pages — use “Upload a photo” instead.');
        return;
      }
      setCameraState('starting');
      setCameraError(null);
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraState('live');
      } catch (e: any) {
        setCameraState('unavailable');
        const name = e?.name || '';
        setCameraError(
          name === 'NotAllowedError'
            ? 'Camera permission was blocked. Allow it in your browser, or upload a photo instead.'
            : name === 'NotFoundError'
              ? 'No camera found on this device — upload a photo instead.'
              : 'Could not start the camera — upload a photo instead.'
        );
      }
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    reset();
    warmUpOcr();
    startCamera('environment');
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ------------------------------------------------------------------- OCR */
  const runOcr = useCallback(async (blob: Blob) => {
    setStep('reading');
    setError(null);
    setProgress({ status: 'Preparing image…', progress: 0.05 });
    setOcrProgressListener((p) => setProgress({ status: p.status, progress: p.progress }));
    try {
      const res = await recognizeLabel(blob);
      setConfidence(res.confidence);
      setText(res.text);
      if (!res.text || res.text.replace(/\s/g, '').length < 12) {
        setError('We could not read any text. Get closer so the table fills the frame, keep the phone steady, and avoid glare.');
      }
      setStep('review');
    } catch (e: any) {
      console.error(e);
      setError(
        'The on-device label reader failed to start. You can still use Smart paste or type the values in by hand.'
      );
      setStep('review');
    } finally {
      setOcrProgressListener(null);
    }
  }, []);

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopCamera();
        const url = URL.createObjectURL(blob);
        setImageBlob(blob);
        setImageUrl(url);
        runOcr(blob);
      },
      'image/jpeg',
      0.92
    );
  };

  const onFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('That file is not an image. Try a JPG or PNG photo of the label.');
      return;
    }
    stopCamera();
    const url = URL.createObjectURL(file);
    setImageBlob(file);
    setImageUrl(url);
    runOcr(file);
  };

  const useText = async () => {
    setSubmitting(true);
    try {
      await onText(text);
      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  const lines = text.split('\n').filter((l) => l.trim()).length;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title="Scan a label with your camera"
      description="Point at the nutrition table, keep it flat and inside the frame. Reading happens on your device — the photo never leaves your browser."
    >
      <div className="space-y-4">
        {/* ---------------------------------------------------------- capture */}
        {step === 'capture' && (
          <>
            <div className="relative overflow-hidden rounded-2xl bg-ink-950">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={cn(
                  'w-full object-cover transition-opacity',
                  cameraState === 'live' ? 'aspect-[4/3] opacity-100' : 'aspect-[3/2] opacity-0'
                )}
              />
              {/* framing guide */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div className="relative h-full w-full max-w-[86%] rounded-xl border-2 border-dashed border-white/40">
                  {['left-0 top-0 border-l-4 border-t-4 rounded-tl-xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-xl', 'left-0 bottom-0 border-b-4 border-l-4 rounded-bl-xl', 'right-0 bottom-0 border-b-4 border-r-4 rounded-br-xl'].map((pos) => (
                    <span key={pos} className={cn('absolute h-7 w-7 border-brand-300', pos)} />
                  ))}
                </div>
              </div>
              {cameraState !== 'live' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
                  {cameraState === 'starting' ? (
                    <>
                      <Loader2 size={22} className="animate-spin text-brand-300" />
                      <p className="text-[13px] text-white/70">Starting the camera…</p>
                    </>
                  ) : (
                    <>
                      <CameraOff size={22} className="text-white/50" />
                      <p className="text-[13px] leading-relaxed text-white/60">
                        {cameraError || 'Camera is not available yet.'}
                      </p>
                    </>
                  )}
                </div>
              )}
              {cameraState === 'live' && (
                <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-center text-[11.5px] text-white/80">
                  Fill the frame with the nutrition table — avoid glare and shadows
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button icon={Camera} onClick={captureFrame} disabled={cameraState !== 'live'} size="lg">
                Capture label
              </Button>
              <Button
                variant="secondary"
                icon={SwitchCamera}
                onClick={() => {
                  const next = facing === 'environment' ? 'user' : 'environment';
                  setFacing(next);
                  startCamera(next);
                }}
              >
                Flip
              </Button>
              <Button variant="secondary" icon={Upload} onClick={() => fileInputRef.current?.click()}>
                Upload a photo
              </Button>
            </div>

            {cameraState === 'unavailable' && (
              <button
                onClick={() => captureInputRef.current?.click()}
                className={cn(
                  'flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition',
                  dragging ? 'border-brand-400 bg-brand-50' : 'border-ink-200 hover:border-brand-300 hover:bg-brand-50/40'
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  onFile(e.dataTransfer.files?.[0]);
                }}
              >
                <ImagePlus size={22} className="text-brand-500" />
                <span className="text-[13px] font-semibold text-ink-800">Drop a label photo here, or tap to take one</span>
                <span className="text-[11.5px] text-ink-400">JPG or PNG · a clear photo of the nutrition table works best</span>
              </button>
            )}

            <p className="text-center text-[11px] text-ink-400">
              First scan downloads the on-device reading model (~6 MB) once, then works offline.
            </p>
          </>
        )}

        {/* ---------------------------------------------------------- reading */}
        {step === 'reading' && (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl bg-ink-950">
              {imageUrl && <img src={imageUrl} alt="Captured label" className="aspect-[4/3] w-full object-contain opacity-70" />}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute inset-x-0 h-16 animate-scan bg-gradient-to-b from-transparent via-brand-400/35 to-transparent" />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink-950/30">
                <ScanLine size={22} className="text-brand-300" />
                <p className="text-[13px] font-semibold text-white">Reading the label…</p>
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
                <span className="font-medium text-ink-600">{progress.status}</span>
                <span className="tabular-nums text-ink-400">{Math.round(progress.progress * 100)}%</span>
              </div>
              <Progress value={Math.max(progress.progress * 100, 4)} max={100} />
            </div>
            <div className="flex justify-center">
              <Button variant="ghost" icon={X} onClick={reset}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- review */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              {imageUrl && (
                <img src={imageUrl} alt="Captured label" className="h-24 w-24 shrink-0 rounded-xl border border-ink-100 object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-ink-900">What we read</p>
                  {confidence != null && (
                    <span
                      className={cn(
                        'chip',
                        confidence >= 75
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : confidence >= 50
                            ? 'bg-amber-50 text-amber-700 ring-amber-200'
                            : 'bg-red-50 text-red-700 ring-red-200'
                      )}
                    >
                      {confidence}% confidence
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12px] leading-snug text-ink-500">
                  {lines > 0
                    ? `${lines} lines captured. Fix any garbled numbers below before we decode them — OCR struggles with glare and curly fonts.`
                    : 'Almost nothing was recognised. Try again with the table filling the frame.'}
                </p>
              </div>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              className="input min-h-[190px] w-full resize-y font-mono text-[12px] leading-relaxed"
              placeholder="Energy 450 kcal…"
            />

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-medium text-amber-900">
                <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button block loading={submitting} icon={Check} onClick={useText} disabled={text.trim().length < 8}>
                Use this label
              </Button>
              <Button block variant="secondary" icon={RefreshCcw} onClick={reset}>
                Retake
              </Button>
            </div>
          </div>
        )}

        {/* hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={captureInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </Modal>
  );
}
