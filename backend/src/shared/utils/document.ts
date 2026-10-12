export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isRepeatedSequence(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

export function isValidCpf(input: string): boolean {
  const digits = onlyDigits(input);
  if (digits.length !== 11 || isRepeatedSequence(digits)) return false;

  for (const position of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < position; i++) {
      sum += Number(digits[i]) * (position + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    const expected = remainder === 10 ? 0 : remainder;
    if (expected !== Number(digits[position])) return false;
  }
  return true;
}

const CNPJ_WEIGHTS_FIRST = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS_SECOND = [6, ...CNPJ_WEIGHTS_FIRST];

function cnpjCheckDigit(digits: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += (digits.charCodeAt(i) - 48) * weights[i];
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCnpj(input: string): boolean {
  const digits = input.replace(/[./-]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(digits) || isRepeatedSequence(digits)) return false;

  return (
    cnpjCheckDigit(digits, CNPJ_WEIGHTS_FIRST) === Number(digits[12]) &&
    cnpjCheckDigit(digits, CNPJ_WEIGHTS_SECOND) === Number(digits[13])
  );
}
