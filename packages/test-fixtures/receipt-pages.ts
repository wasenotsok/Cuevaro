export const receiptPhotoPages = [
  [
    "Merchant: Synthetic Page Shop",
    "Date: 2026-10-05",
    "Item: Page test toaster",
    "Total: PHP 1299.00",
  ],
  ["Return by: 2026-10-19", "Warranty ends: 2027-10-05"],
];
export function receiptPageSvg(lines: string[], page: number) {
  const text = [
    `SYNTHETIC RECEIPT PAGE ${page}`,
    ...lines,
    "Not a real purchase",
  ];
  return `<svg width="900" height="1000"><rect width="900" height="1000" fill="white"/>${text.map((line, i) => `<text x="50" y="${115 + i * 110}" font-family="Arial" font-size="36" fill="black">${line.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</text>`).join("")}</svg>`;
}
