export default function RiskCard({ result }) {
  const level = result.ok ? result.level : 'High';
  const reasons = result.ok ? result.reasons : [result.error];

  return (
    <div className="card">
      <div className="between">
        <strong>Risk check</strong>
        <span className={`badge ${level}`}>{level} risk</span>
      </div>
      <ul>
        {reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
      <div className="note">
        A Low score means no red flags were found. It does not mean the payee is verified.
      </div>
    </div>
  );
}