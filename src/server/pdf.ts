// Minimal PDF 1.4 writer (A4, Helvetica, text + filled rectangles). Enough for a clean,
// dependency-free productivity report.

type RGB = [number, number, number];

const WIN_ANSI: Record<string, number> = {
  "€": 0x80, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "™": 0x99,
};

function encode(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    let byte: number;
    if (WIN_ANSI[ch] !== undefined) byte = WIN_ANSI[ch];
    else if (ch === "₱") {
      out += "PHP ";
      continue;
    } else if (code < 256) byte = code;
    else if (code >= 0x1f000 || (code >= 0x2600 && code < 0x2800) || code === 0xfe0f) continue; // emoji & symbols
    else byte = 0x3f; // "?"
    const c = String.fromCharCode(byte);
    out += c === "(" || c === ")" || c === "\\" ? "\\" + c : byte < 32 || byte > 126 ? "\\" + byte.toString(8).padStart(3, "0") : c;
  }
  return out;
}

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const rgb = (c: RGB) => c.map((v) => v.toFixed(3)).join(" ");

export class Pdf {
  readonly width = 595;
  readonly height = 842;
  readonly margin = 48;
  private pages: string[][] = [];
  private ops: string[] = [];
  y = 0;

  constructor() {
    this.newPage();
  }

  newPage() {
    if (this.ops.length) this.pages.push(this.ops);
    this.ops = [];
    this.y = this.height - this.margin;
  }

  /** Starts a new page if fewer than `needed` points remain. */
  ensure(needed: number) {
    if (this.y - needed < this.margin) this.newPage();
  }

  text(x: number, y: number, s: string, opts: { size?: number; bold?: boolean; color?: string } = {}) {
    const size = opts.size ?? 10;
    this.ops.push(`BT /${opts.bold ? "F2" : "F1"} ${size} Tf ${rgb(hex(opts.color ?? "#0F172A"))} rg ${x.toFixed(1)} ${y.toFixed(1)} Td (${encode(s)}) Tj ET`);
  }

  rect(x: number, y: number, w: number, h: number, color: string) {
    this.ops.push(`${rgb(hex(color))} rg ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`);
  }

  /** Rough Helvetica width estimate used for wrapping. */
  static measure(s: string, size: number) {
    return s.length * size * 0.5;
  }

  /** Writes a paragraph at the cursor, wrapping to the content width. */
  paragraph(s: string, opts: { size?: number; bold?: boolean; color?: string; indent?: number; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const indent = opts.indent ?? 0;
    const maxW = this.width - this.margin * 2 - indent;
    const words = s.split(/\s+/);
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      const next = line ? line + " " + w : w;
      if (Pdf.measure(next, size) > maxW && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    for (const l of lines) {
      this.ensure(size + 4);
      this.y -= size + 4;
      this.text(this.margin + indent, this.y, l, opts);
    }
    this.y -= opts.gap ?? 4;
  }

  heading(s: string) {
    this.ensure(40);
    this.y -= 22;
    this.text(this.margin, this.y, s, { size: 13, bold: true, color: "#1539B0" });
    this.y -= 6;
    this.rect(this.margin, this.y, this.width - this.margin * 2, 0.8, "#DCE3F2");
    this.y -= 4;
  }

  /** Simple table with fixed column x-offsets. */
  table(headers: string[], rows: string[][], cols: number[]) {
    const draw = (cells: string[], bold: boolean, color: string) => {
      this.ensure(16);
      this.y -= 15;
      cells.forEach((c, i) => {
        const maxChars = Math.floor(((cols[i + 1] ?? this.width - this.margin * 2) - cols[i]) / 4.6);
        const v = c.length > maxChars ? c.slice(0, Math.max(1, maxChars - 1)) + "…" : c;
        this.text(this.margin + cols[i], this.y, v, { size: 9, bold, color });
      });
    };
    draw(headers, true, "#475569");
    for (const r of rows) draw(r, false, "#0F172A");
    this.y -= 4;
  }

  build(): Buffer {
    const pages = [...this.pages, this.ops];
    const objects: string[] = [];
    const add = (body: string) => objects.push(body) ;
    add("<< /Type /Catalog /Pages 2 0 R >>");
    const kids = pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ");
    add(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    pages.forEach((ops, i) => {
      const footer = `BT /F1 8 Tf 0.58 0.64 0.72 rg ${this.margin} 24 Td (${encode(`ATHENTIV FocusDock  •  Page ${i + 1} of ${pages.length}`)}) Tj ET`;
      const stream = [...ops, footer].join("\n");
      add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
      add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    });

    let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(Buffer.byteLength(out, "latin1"));
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = Buffer.byteLength(out, "latin1");
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(out, "latin1");
  }
}
