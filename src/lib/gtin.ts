const VALID_LENGTHS = [8, 12, 13, 14] as const;

export function gs1CheckDigit(bodyWithoutCheck: string): number {
  if (!/^\d+$/.test(bodyWithoutCheck)) {
    throw new Error("GS1 body must be digits");
  }
  const digits = bodyWithoutCheck.split("").map((d) => parseInt(d, 10));
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const fromRight = digits.length - 1 - i;
    const multiplier = fromRight % 2 === 0 ? 3 : 1;
    sum += digits[i] * multiplier;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin(value: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(value)) return false;
  const body = value.slice(0, -1);
  const check = parseInt(value.slice(-1), 10);
  return gs1CheckDigit(body) === check;
}

export function expandScientificNotation(raw: string): string | null {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(raw.trim());
  if (!m) return null;
  if (m[1] === "-") return null;
  const intPart = m[2];
  const fracPart = m[3] || "";
  const exp = parseInt(m[4], 10);
  const digits = intPart + fracPart;
  const newIntLen = intPart.length + exp;
  if (newIntLen <= 0) return null;
  if (newIntLen >= digits.length) {
    return digits + "0".repeat(newIntLen - digits.length);
  }
  const frac = digits.slice(newIntLen);
  if (!/^0*$/.test(frac)) return null;
  return digits.slice(0, newIntLen);
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function stripGtinNoise(value: string): string {
  return value.trim().replace(/[\s-]/g, "");
}

export type GtinRepair = {
  input: string;
  value: string;
  repaired: boolean;
  valid: boolean;
  error?: string;
};

function candidateLengths(digitCount: number): number[] {
  const out: number[] = [];
  for (const len of VALID_LENGTHS) {
    if (len >= digitCount) out.push(len);
  }
  return out;
}

export function repairGtin(raw: string): GtinRepair {
  const input = raw ?? "";
  const trimmed = input.trim();
  if (!trimmed) {
    return { input, value: "", repaired: false, valid: true };
  }

  let working = stripGtinNoise(trimmed);
  const expanded = expandScientificNotation(working);
  if (expanded) working = expanded;
  if (/^\d+\.0+$/.test(working)) working = working.split(".")[0];

  const digits = digitsOnly(working);
  if (!digits) {
    return {
      input,
      value: input,
      repaired: false,
      valid: false,
      error: "GTIN is not a number",
    };
  }

  if (digits.length > 14) {
    return {
      input,
      value: input,
      repaired: false,
      valid: false,
      error: "GTIN longer than 14 digits",
    };
  }

  for (const len of candidateLengths(digits.length)) {
    const padded = digits.padStart(len, "0");
    if (isValidGtin(padded)) {
      const repaired = padded !== trimmed;
      return { input, value: padded, repaired, valid: true };
    }
  }

  return {
    input,
    value: input,
    repaired: false,
    valid: false,
    error: "GTIN check digit is invalid — original left unchanged",
  };
}
