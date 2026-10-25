import re
from urllib.parse import parse_qsl

HANDLES = {
    "okaxis", "oksbi", "okhdfcbank", "okicici", "ybl", "ibl", "axl", "paytm",
    "apl", "upi", "sbi", "hdfcbank", "icici", "axisbank", "postbank", "airtel",
    "jio", "fbl", "barodampay", "pnb", "cnrb", "unionbank", "idfcfirst",
    "kotak", "indus", "federal", "aubank", "yesbank",
}
BRANDS = [
    "amazon", "flipkart", "paytm", "phonepe", "swiggy", "zomato",
    "irctc", "airtel", "myntra", "google", "netflix",
]
SCAM_WORDS = [
    "receive", "refund", "cashback", "prize", "lottery",
    "reward", "claim", "winner", "kyc",
]
VPA_RE = re.compile(r"^[A-Za-z0-9.\-_]{2,256}@[A-Za-z]{2,64}$")


def parse_upi(qr: str):
    """Return (params dict, error string). Exactly one of them is None."""
    qr = (qr or "").strip()
    if not qr.lower().startswith("upi://"):
        return None, "Not a UPI payment QR (it does not start with upi://)"
    if "?" not in qr:
        return None, "UPI link has no payment details"
    return dict(parse_qsl(qr.split("?", 1)[1])), None


def levenshtein(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def assess(p: dict, report_count: int = 0):
    """Return (score, level, reasons)."""
    score = 0
    reasons = []

    pa = (p.get("pa") or "").strip()
    pn = (p.get("pn") or "").strip()
    tn = (p.get("tn") or "").lower()

    if not pa:
        return 100, "High", ["No payee UPI ID (pa) in the QR"]

    if not VPA_RE.match(pa):
        score += 50
        reasons.append(f"UPI ID format looks invalid: {pa}")

    handle = pa.split("@")[-1].lower() if "@" in pa else ""
    if handle and handle not in HANDLES:
        score += 15
        reasons.append(f'Unrecognised bank handle "@{handle}" (list is not exhaustive)')

    if not pn:
        score += 20
        reasons.append("QR has no payee name")

    for w in SCAM_WORDS:
        if w in tn:
            score += 40
            reasons.append(
                f'Note contains "{w}". A QR is only for paying money, never for receiving it.'
            )
            break

    words = [
        w for w in re.split(r"[^a-z]+", f"{pn} {pa.split('@')[0]}".lower()) if len(w) >= 5
    ]
    flagged = set()
    for w in words:
        for b in BRANDS:
            if 1 <= levenshtein(w, b) <= 2 and (w, b) not in flagged:
                flagged.add((w, b))
                score += 40
                reasons.append(f'"{w}" looks like a copy of the brand "{b}"')

    try:
        if float(p.get("am", 0)) > 50000:
            score += 20
            reasons.append("Pre-filled amount is unusually high")
    except ValueError:
        score += 10
        reasons.append("Amount in the QR is not a valid number")

    if report_count >= 5:
        score += 60
    elif report_count >= 3:
        score += 40
    elif report_count >= 1:
        score += 20
    if report_count:
        reasons.append(f"Reported by users {report_count} time(s) in the last 30 days")

    if not reasons:
        reasons.append("No red flags found in the QR contents")

    level = "High" if score >= 60 else "Medium" if score >= 25 else "Low"
    return score, level, reasons