// Synthetic ASCII PDF with an actual cross-reference table; no sensitive content.
export function syntheticPdf(
  pages: string[][],
  encrypted = false,
  invisible = false,
): Uint8Array {
  const objects = [
    "",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const ids: number[] = [];
  for (const lines of pages) {
    const id = objects.length;
    ids.push(id);
    const content = lines
      .map(
        (line, i) =>
          `BT ${invisible ? "3 Tr " : ""}/F1 14 Tf 40 ${750 - (i % 28) * 24} Td (${line.replace(/[\\()]/g, "\\$&")}) Tj ET`,
      )
      .join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id + 1} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  }
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${ids.map((id) => `${id} 0 R`).join(" ")}] >>`;
  const encryptionId = objects.length;
  if (encrypted)
    objects.push(
      `<< /Filter /Standard /V 1 /R 2 /O <${"00".repeat(32)}> /U <${"00".repeat(32)}> /P -4 >>`,
    );
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${objects.length} /Root 1 0 R${encrypted ? ` /Encrypt ${encryptionId} 0 R /ID [<${"00".repeat(16)}> <${"00".repeat(16)}>]` : ""} >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
