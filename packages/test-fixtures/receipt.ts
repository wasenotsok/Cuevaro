export const syntheticReceiptText =
  "Merchant: Synthetic Appliances\nDate: 2026-10-05\nItem: Electric kettle\nTotal: PHP 1299.00\nReturn by: 2026-10-19\nWarranty ends: 2027-10-05";
export function syntheticReceiptSvg() {
  const lines = [
    "SYNTHETIC TEST RECEIPT",
    ...syntheticReceiptText.split("\n"),
    "Not a real purchase",
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1000"><rect width="900" height="1000" fill="#eee"/><rect x="25" y="25" width="850" height="950" fill="white" stroke="black" stroke-width="2"/>${lines.map((line, i) => `<text x="65" y="${115 + i * 90}" font-family="Arial" font-size="36" fill="black">${line}</text>`).join("")}</svg>`;
}
