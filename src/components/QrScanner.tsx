'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export function QrScanner({ onCode, onClose }: { onCode: (c: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const cb = useRef(onCode);
  useEffect(() => { cb.current = onCode; }, [onCode]);
  const [err, setErr] = useState('');
  useEffect(() => {
    let stream: MediaStream | undefined; let timer: ReturnType<typeof setInterval> | undefined; let alive = true; let fired = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setErr('The camera is not available on this device or browser. Enter the code manually.'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        const el = video.current!; el.srcObject = stream; await el.play();
        const jsQR = (await import('jsqr')).default;
        const cv = document.createElement('canvas'); const cx = cv.getContext('2d', { willReadFrequently: true })!;
        timer = setInterval(() => {
          if (fired || !el.videoWidth) return;
          cv.width = el.videoWidth; cv.height = el.videoHeight; cx.drawImage(el, 0, 0);
          const img = cx.getImageData(0, 0, cv.width, cv.height); const r = jsQR(img.data, img.width, img.height);
          if (r?.data) { fired = true; cb.current(r.data); }
        }, 300);
      } catch (e) { setErr((e as Error).name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser settings, or enter the code manually.' : 'Could not start the camera. Enter the code manually.'); }
    })();
    return () => { alive = false; if (timer) clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <button onClick={onClose} aria-label="Close scanner" className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-2"><X size={20} /></button>
      {err ? <p className="p-6 text-center text-sm text-white">{err}</p> : <><video ref={video} playsInline muted className="aspect-square w-full object-cover" /><div className="pointer-events-none absolute inset-8 rounded-2xl border-4 border-[#14B8A6]/80" /></>}
    </div>
  );
}
