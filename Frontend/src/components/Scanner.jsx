import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

const SAMPLE =
  'upi://pay?pa=shop@okaxis&pn=Test%20Shop&am=10&cu=INR&tn=Order';

export default function Scanner({ onResult, busy }) {
  const videoRef = useRef(null);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState(
    'Camera needs HTTPS or localhost. If it is blocked, upload an image or paste a link.'
  );
  const [manual, setManual] = useState('');

  // Camera loop: starts when `active` becomes true, cleans up when it becomes false.
  useEffect(() => {
    if (!active) return;

    let stream = null;
    let raf = 0;
    let cancelled = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = () => {
      const v = videoRef.current;
      if (cancelled || !v) return;
      if (v.readyState === v.HAVE_ENOUGH_DATA) {
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code && code.data) {
          setActive(false);
          setStatus('QR found.');
          onResult(code.data);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus('Point the camera at a UPI QR code...');
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setStatus(`Camera unavailable (${e.name}). Use "Upload QR image" or paste the link.`);
        setActive(false);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, img.width, img.height);
      const code = jsQR(d.data, d.width, d.height);
      if (code) onResult(code.data);
      else setStatus('No QR code found in that image.');
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  }

  return (
    <div className="card">
      <div className={`vwrap ${active ? 'show' : ''}`}>
        <video ref={videoRef} playsInline muted />
        <div className="frame" />
      </div>

      <div className="row">
        <button onClick={() => setActive(true)} disabled={active || busy}>
          Start camera
        </button>
        <button className="alt" onClick={() => setActive(false)} disabled={!active}>
          Stop
        </button>
        <label className="btn alt">
          Upload QR image
          <input type="file" accept="image/*" hidden onChange={handleFile} />
        </label>
      </div>

      <div className="note">{busy ? 'Analyzing...' : status}</div>

      <textarea
        rows={2}
        value={manual}
        onChange={(e) => setManual(e.target.value)}
        placeholder={`Or paste: ${SAMPLE}`}
      />
      <div className="row">
        <button className="alt" onClick={() => onResult(manual)} disabled={busy || !manual.trim()}>
          Analyze pasted link
        </button>
        <button className="alt" onClick={() => setManual(SAMPLE)}>
          Fill sample
        </button>
      </div>
    </div>
  );
}