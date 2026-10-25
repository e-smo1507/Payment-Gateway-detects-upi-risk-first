import { useState } from 'react';
import Scanner from './components/Scanner.jsx';
import RiskCard from './components/RiskCard.jsx';
import PayCard from './components/PayCard.jsx';
import { analyze } from './api.js';

export default function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleScan(qrText) {
    setLoading(true);
    setError('');
    try {
      setResult(await analyze(qrText));
    } catch (e) {
      setResult(null);
      setError('Could not reach the server. Is uvicorn running on port 8000?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <h1>UPI Safe Scan</h1>
      <div className="sub">Scan a UPI QR, check the risk, then pay.</div>

      <Scanner onResult={handleScan} busy={loading} />

      {error && <div className="card error">{error}</div>}
      {result && <RiskCard result={result} />}
      {result?.ok && <PayCard key={result.params.pa + result.params.am} params={result.params} />}
    </div>
  );
}