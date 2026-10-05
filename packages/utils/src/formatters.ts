/**
 * Indian Rupee (INR) formatting and financial helpers
 * Ensures strict decimal precision for financial numbers
 */

export function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function formatINR(amount: number): string {
  const rounded = roundCurrency(amount);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function convertBelowThousand(n: number): string {
  let str = "";
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + " Hundred ";
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + " ";
    n %= 10;
  }
  if (n > 0) {
    str += ONES[n] + " ";
  }
  return str.trim();
}

/**
 * Converts numeric amounts into formal Indian numbering words:
 * Crores, Lakhs, Thousands, Hundreds, Paise
 */
export function numberToIndianWords(amount: number): string {
  const rounded = roundCurrency(amount);
  if (rounded === 0) return "Rupees Zero Only";

  const integerPart = Math.floor(rounded);
  const paise = Math.round((rounded - integerPart) * 100);

  let num = integerPart;
  let words = "";

  const crore = Math.floor(num / 10000000);
  num %= 10000000;

  const lakh = Math.floor(num / 100000);
  num %= 100000;

  const thousand = Math.floor(num / 1000);
  num %= 1000;

  const hundredAndBelow = num;

  if (crore > 0) {
    words += convertBelowThousand(crore) + " Crore ";
  }
  if (lakh > 0) {
    words += convertBelowThousand(lakh) + " Lakh ";
  }
  if (thousand > 0) {
    words += convertBelowThousand(thousand) + " Thousand ";
  }
  if (hundredAndBelow > 0) {
    words += convertBelowThousand(hundredAndBelow) + " ";
  }

  let result = "Rupees " + words.trim();

  if (paise > 0) {
    result += " and " + convertBelowThousand(paise) + " Paise";
  }

  return result + " Only";
}
