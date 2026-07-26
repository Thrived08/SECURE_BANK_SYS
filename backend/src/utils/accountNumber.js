// Generates a random 10-digit account number.
// In production you'd check-digit this (like IBAN/Luhn) to catch typos.
export function generateAccountNumber() {
  let num = '';
  for (let i = 0; i < 10; i++) {
    num += Math.floor(Math.random() * 10);
  }
  return num;
}
