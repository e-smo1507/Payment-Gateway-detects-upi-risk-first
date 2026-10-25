import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { reportVpa } from '../api.js';

export default function PayCard({ params }) {
  const [amount, setAmount] = useState(params.am || '');
  const [showQr, setShowQr] = useState(false);
  const [msg, setMsg] = useState(
    'On a phone, the Pay button opens your installed UPI apps. This raw link gives no payment confirmation back to your site. For that, use a gateway such as Razorpay or Cashfree.'
  );

  function buildLink() {
    const q = new URLSearchParams({ pa: params.pa, pn: params.pn || '', cu: 'INR' });
    const amt = parseFloat(amount);
    if (amt > 0) q.set('am', amt.toFixed(2));
    if (params.tn) q.set('tn', params.tn);
    return `upi://pay?${q.toString()}`;
  }

  async function handleReport() {
    try {
      const d = await reportVpa(params.pa);
      setMsg(`Thanks. This UPI ID now has ${d.reports} report(s) in the last 30 days.`);
    } catch {
      setMsg('Could not send the report. Try again.');
    }
  }

  const rows = [
    ['UPI ID', params.pa],
    ['Name', params.pn],
    ['Amount', params.am],
    ['Note', params.tn],
    ['Category (MC)', params.mc],
  ].filter(([, v]) => v);

  return (
    <div className="card">
      <strong>Payee details</strong>
      <dl>
        {rows.map(([k, v]) => (
          <div className="kv" key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <label className="label">Amount (INR)</label>
      <input
        type="number"
        min="1"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <div className="row">
        <a className="btn" href={buildLink()}>
          Pay with UPI
        </a>
        <button className="alt" onClick={() => setShowQr((s) => !s)}>
          {showQr ? 'Hide QR' : 'Show as QR (desktop)'}
        </button>
        <button className="danger" onClick={handleReport}>
          Report this UPI ID
        </button>
      </div>

      {showQr && (
        <div className="qrbox">
          <QRCodeSVG value={buildLink()} size={200} />
        </div>
      )}

      <div className="note">{msg}</div>
    </div>
  );
}