import { jsPDF } from "jspdf";
import logoMspas from "../../Imagenes/Logotipo-MSPAS-2024-2028_AZUL_H.png";

export const COLORS = {
  primary: [0, 94, 184],
  primaryDark: [0, 71, 141],
  teal: [0, 106, 113],
  ink: [33, 37, 41],
  body: [64, 72, 84],
  gray: [120, 128, 138],
  line: [210, 216, 224],
  light: [243, 246, 250],
  softBlue: [232, 240, 251],
  softRed: [253, 235, 235],
  red: [176, 42, 55],
  white: [255, 255, 255],
  negro: [20, 20, 20],
  HUEHUE_VERDE: [21, 101, 52],
  HUEHUE_AMARILLO: [235, 176, 0],
  HUEHUE_ROJO: [196, 43, 43],
};

let logoDataUrl = null;
let logoRatio = 3;

// Carga el logo MSPAS una sola vez y lo convierte a dataURL para jsPDF.
export function preloadLogo() {
  if (logoDataUrl) return Promise.resolve(logoDataUrl);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d").drawImage(img, 0, 0);
        logoDataUrl = canvas.toDataURL("image/png");
        if (img.height > 0) logoRatio = img.width / img.height;
      } catch (e) {
        logoDataUrl = null;
      }
      resolve(logoDataUrl);
    };
    img.onerror = () => resolve(null);
    img.src = logoMspas;
  });
}

export function edadDe(fechaNacimiento, referencia) {
  if (!fechaNacimiento) return null;
  const ref = referencia ? new Date(referencia) : new Date();
  const nac = new Date(fechaNacimiento);
  let anos = ref.getFullYear() - nac.getFullYear();
  const m = ref.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < nac.getDate())) anos--;
  return anos >= 0 ? anos : null;
}

export function fechaCorta(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return d.toLocaleDateString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const TIPO_VISITA_LABEL = {
  CONSULTA: "Primera consulta",
  RECONSULTA: "Reconsulta",
  AMBAS: "Primera consulta y reconsulta",
};

export function tipoVisitaLegible(v) {
  if (!v) return "—";
  return TIPO_VISITA_LABEL[v] || v;
}

export function factoresLegibles(v) {
  const out = [];
  if (v.sobrepeso) out.push(`Sobrepeso${v.sobrepeso_imc ? ` (IMC ${v.sobrepeso_imc})` : ""}`);
  if (v.obesidad) out.push(`Obesidad${v.obesidad_imc ? ` (IMC ${v.obesidad_imc})` : ""}`);
  if (v.circ_abdominal) out.push(`Circunferencia abdominal${v.circ_abdominal_cm ? `: ${v.circ_abdominal_cm} cm` : ""}`);
  if (v.riesgo_ecv_elevado) out.push(`Riesgo cardiovascular elevado${v.riesgo_ecv_observacion ? `: ${v.riesgo_ecv_observacion}` : ""}`);
  return out;
}

export class PdfBuilder {
  constructor({ format = "a4", orientation = "portrait" } = {}) {
    this.doc = new jsPDF({ unit: "mm", format, orientation });
    this.pageW = this.doc.internal.pageSize.getWidth();
    this.pageH = this.doc.internal.pageSize.getHeight();
    this.M = format && Array.isArray(format) ? 9 : 14;
    this.innerW = this.pageW - this.M * 2;
    this.y = this.M;
    this.docTitle = "";
    this.generatedAt = new Date().toLocaleString("es-GT");
    this.footerLabel = "Centro Médico Público de Zaculeu · Huehuetenango";
  }

  ensure(alto) {
    if (this.y + alto > this.pageH - 16) {
      this.doc.addPage();
      this._encabezadoCompacto();
    }
  }

  _banderaHuehue(y = 0, h = 4) {
    const d = this.doc;
    const w = this.pageW;
    const sep = 0.6;
    const verdeW = w * 0.45;
    const amarW = w * 0.40;
    d.setFillColor(...COLORS.HUEHUE_VERDE);
    d.rect(0, y, verdeW - sep / 2, h, "F");
    d.setFillColor(...COLORS.HUEHUE_AMARILLO);
    d.rect(verdeW + sep / 2, y, amarW - sep, h, "F");
    d.setFillColor(...COLORS.HUEHUE_ROJO);
    d.rect(verdeW + amarW + sep / 2, y, w - verdeW - amarW - sep / 2, h, "F");
  }

  _banderaMini(x, y, ancho, alto) {
    const d = this.doc;
    const seg = ancho / 3;
    d.setFillColor(...COLORS.HUEHUE_VERDE);
    d.rect(x, y, seg, alto, "F");
    d.setFillColor(...COLORS.HUEHUE_AMARILLO);
    d.rect(x + seg, y, seg, alto, "F");
    d.setFillColor(...COLORS.HUEHUE_ROJO);
    d.rect(x + seg * 2, y, seg, alto, "F");
    d.setDrawColor(...COLORS.negro);
    d.setLineWidth(0.2);
    d.rect(x, y, seg, alto, "S");
    d.rect(x + seg, y, seg, h0(), "S");
    d.rect(x + seg * 2, y, seg, h, "S");
  }

  _generadoRow() {
    const d = this.doc;
    const yy = this.y + 1.3;
    d.setFont("helvetica", "bold");
    d.setFontSize(7.4);
    const label = "Generado:";
    const labelW = d.getTextWidth(label);
    d.setFont("helvetica", "normal");
    const fechaTxt = ` ${this.generatedAt}`;
    const fechaW = d.getTextWidth(fechaTxt);
    const flagW = 6.2;
    const flagH = 3.4;
    const gap = 2.4;
    const total = flagW + gap + labelW + fechaW;
    const x0 = this.pageW - this.M - total;

    d.setFillColor(...COLORS.HUEHUE_VERDE);
    d.rect(x0, yy, flagW / 3 - 0.2, flagH, "F");
    d.setFillColor(...COLORS.HUEHUE_AMARILLO);
    d.rect(x0 + flagW / 3, yy, flagW / 3 - 0.2, flagH, "F");
    d.setFillColor(...COLORS.HUEHUE_ROJO);
    d.rect(x0 + (flagW / 3) * 2, yy, flagW / 3, flagH, "F");
    d.setDrawColor(...COLORS.negro);
    d.setLineWidth(0.2);
    d.rect(x0, yy, flagW, flagH, "S");

    d.setFont("helvetica", "bold");
    d.setTextColor(...COLORS.HUEHUE_VERDE);
    d.text(label, x0 + flagW + gap, yy + 2.7);
    d.setFont("helvetica", "normal");
    d.setTextColor(...COLORS.body);
    d.text(fechaTxt, x0 + flagW + gap + labelW, yy + 2.7);
  }

  _encabezadoCompacto() {
    const d = this.doc;
    this._banderaHuehue(0, 3);
    d.setFont("helvetica", "bold");
    d.setFontSize(8.5);
    d.setTextColor(...COLORS.primaryDark);
    d.text("Centro Médico Público de Zaculeu", this.M, this.M + 1);
    d.setFont("helvetica", "normal");
    d.setTextColor(...COLORS.gray);
    d.text(this.docTitle || "", this.pageW - this.M, this.M + 1, { align: "right" });
    d.setDrawColor(...COLORS.line);
    d.setLineWidth(0.3);
    d.line(this.M, this.M + 3.5, this.pageW - this.M, this.M + 3.5);
    this.y = this.M + 8;
  }

  header(title, subtitle) {
    const d = this.doc;
    this.docTitle = title || "";
    const grande = this.innerW > 150;

    this._banderaHuehue(0, 4);

    const logoH = grande ? 13 : 11;
    const logoW = logoH * logoRatio;
    if (this.logo) d.addImage(this.logo, "PNG", this.M, 7, logoW, logoH);

    const tx = this.M + (this.logo ? logoW + 4 : 0);
    d.setFont("helvetica", "bold");
    d.setFontSize(grande ? 13 : 10.5);
    d.setTextColor(...COLORS.primaryDark);
    d.text("Centro Médico Público de Zaculeu", tx, 12.5);
    d.setFont("helvetica", "normal");
    d.setFontSize(7.8);
    d.setTextColor(...COLORS.gray);
    d.text("Consulta externa · Huehuetenango, Guatemala", tx, 17);

    this.y = 24;
    d.setFillColor(...COLORS.softBlue);
    d.roundedRect(this.M, this.y, this.innerW, 13, 1.5, 1.5, "F");
    d.setFillColor(...COLORS.HUEHUE_VERDE);
    d.rect(this.M, this.y, 2, 13, "F");
    d.setFont("helvetica", "bold");
    d.setFontSize(grande ? 12 : 10.5);
    d.setTextColor(...COLORS.primaryDark);
    d.text(title, this.pageW / 2, this.y + 6, { align: "center" });
    if (subtitle) {
      d.setFont("helvetica", "normal");
      d.setFontSize(8);
      d.setTextColor(...COLORS.body);
      d.text(subtitle, this.pageW / 2, this.y + 10.5, { align: "center" });
    }
    this.y += 13;

    this._generadoRow();
    this.y += 10;
  }

  sectionTitle(text) {
    this.ensure(9);
    const d = this.doc;
    d.setFillColor(...COLORS.primary);
    d.rect(this.M, this.y - 3.1, 1.6, 4, "F");
    d.setFont("helvetica", "bold");
    d.setFontSize(10);
    d.setTextColor(...COLORS.primaryDark);
    d.text(String(text).toUpperCase(), this.M + 3.5, this.y);
    d.setDrawColor(...COLORS.line);
    d.setLineWidth(0.3);
    d.line(this.M, this.y + 1.8, this.pageW - this.M, this.y + 1.8);
    this.y += 6.5;
  }

  subheader(text, right) {
    this.ensure(11);
    const d = this.doc;
    d.setFillColor(...COLORS.softBlue);
    d.roundedRect(this.M, this.y, this.innerW, 8, 1, 1, "F");
    d.setFont("helvetica", "bold");
    d.setFontSize(9);
    d.setTextColor(...COLORS.primaryDark);
    d.text(String(text), this.M + 3, this.y + 5.3);
    if (right) {
      d.setFont("helvetica", "normal");
      d.setFontSize(7.3);
      d.setTextColor(...COLORS.body);
      d.text(String(right), this.pageW - this.M - 3, this.y + 5.3, { align: "right" });
    }
    this.y += 10.5;
  }

  keyValue(label, value) {
    if (value === null || value === undefined || value === "") return;
    const d = this.doc;
    d.setFont("helvetica", "bold");
    d.setFontSize(9);
    const l = `${label}: `;
    const lw = d.getTextWidth(l);
    d.setFont("helvetica", "normal");
    const lines = d.splitTextToSize(String(value), this.innerW - lw);
    this.ensure(Math.max(lines.length, 1) * 4.3 + 1);
    d.setFont("helvetica", "bold");
    d.setTextColor(...COLORS.ink);
    d.text(l, this.M, this.y);
    d.setFont("helvetica", "normal");
    d.setTextColor(...COLORS.body);
    d.text(lines[0], this.M + lw, this.y);
    for (let i = 1; i < lines.length; i++) d.text(lines[i], this.M, this.y + i * 4.3);
    this.y += Math.max(lines.length, 1) * 4.3 + 1;
  }

  paragraph(text, { size = 9, color = COLORS.body, italic = false } = {}) {
    if (!text) return;
    const d = this.doc;
    d.setFont("helvetica", italic ? "italic" : "normal");
    d.setFontSize(size);
    d.setTextColor(...color);
    const lines = d.splitTextToSize(String(text), this.innerW);
    this.ensure(lines.length * 4.4 + 1);
    d.text(lines, this.M, this.y);
    this.y += lines.length * 4.4 + 1;
  }

  infoGrid(items, cols = 2) {
    const valid = items.filter((it) => it && it.value !== null && it.value !== undefined && it.value !== "");
    if (!valid.length) return;
    const gap = 4;
    const cellW = (this.innerW - gap * (cols - 1)) / cols;
    const rowH = 11;
    for (let i = 0; i < valid.length; i += cols) {
      this.ensure(rowH + 2);
      const row = valid.slice(i, i + cols);
      row.forEach((it, j) => {
        const x = this.M + j * (cellW + gap);
        const d = this.doc;
        d.setFillColor(...COLORS.light);
        d.roundedRect(x, this.y, cellW, rowH, 1.2, 1.2, "F");
        d.setFont("helvetica", "normal");
        d.setFontSize(7);
        d.setTextColor(...COLORS.gray);
        d.text(String(it.label).toUpperCase(), x + 2.5, this.y + 4);
        d.setFont("helvetica", "bold");
        d.setFontSize(9);
        d.setTextColor(...COLORS.ink);
        const val = d.splitTextToSize(String(it.value), cellW - 5);
        d.text(val[0], x + 2.5, this.y + 8.5);
      });
      this.y += rowH + gap - 1;
    }
    this.y += 2;
  }

  table(headers, rows, widths) {
    const d = this.doc;
    const total = widths.reduce((a, b) => a + b, 0);
    const scale = this.innerW / total;
    const w = widths.map((x) => x * scale);
    const rowH = 6.5;

    const drawHead = () => {
      d.setFillColor(...COLORS.primaryDark);
      d.rect(this.M, this.y, this.innerW, 7, "F");
      d.setFont("helvetica", "bold");
      d.setFontSize(8);
      d.setTextColor(...COLORS.white);
      let x = this.M;
      headers.forEach((h, i) => {
        d.text(String(h), x + 2, this.y + 4.7);
        x += w[i];
      });
      this.y += 7;
    };

    this.ensure(14);
    drawHead();

    rows.forEach((row, ri) => {
      const wrapped = row.map((c, i) => d.splitTextToSize(String(c ?? "—"), w[i] - 4));
      const h = Math.max(...wrapped.map((c) => c.length)) * 4 + 3.5;
      if (this.y + h > this.pageH - 16) {
        d.addPage();
        this._encabezadoCompacto();
        drawHead();
      }
      if (ri % 2 === 1) {
        d.setFillColor(...COLORS.light);
        d.rect(this.M, this.y, this.innerW, h, "F");
      }
      d.setFont("helvetica", "normal");
      d.setFontSize(8);
      d.setTextColor(...COLORS.body);
      let x = this.M;
      wrapped.forEach((cellLines, i) => {
        d.text(cellLines, x + 2, this.y + 4.5);
        x += w[i];
      });
      d.setDrawColor(...COLORS.line);
      d.setLineWidth(0.15);
      d.line(this.M, this.y + h, this.pageW - this.M, this.y + h);
      this.y += h;
    });
    this.y += 2;
  }

  callout(text, tipo = "info") {
    if (!text) return;
    const d = this.doc;
    d.setFont("helvetica", "bold");
    d.setFontSize(8.5);
    const lines = d.splitTextToSize(String(text), this.innerW - 6);
    const h = lines.length * 4.3 + 4;
    this.ensure(h + 2);
    const bg = tipo === "danger" ? COLORS.softRed : COLORS.light;
    const bar = tipo === "danger" ? COLORS.red : COLORS.teal;
    d.setFillColor(...bg);
    d.rect(this.M, this.y, this.innerW, h, "F");
    d.setFillColor(...bar);
    d.rect(this.M, this.y, 1.4, h, "F");
    d.setTextColor(...bar);
    d.text(lines, this.M + 4, this.y + 5);
    this.y += h + 2;
  }

  separador() {
    this.ensure(4);
    const d = this.doc;
    d.setDrawColor(...COLORS.line);
    d.setLineWidth(0.3);
    d.line(this.M, this.y, this.pageW - this.M, this.y);
    this.y += 4;
  }

  firma(nombre, rol = "Médico tratante") {
    const d = this.doc;
    const fy = Math.min(this.y + 14, this.pageH - 22);
    this.ensure(24);
    const y = Math.max(this.y + 14, fy);
    d.setDrawColor(...COLORS.gray);
    d.setLineWidth(0.3);
    d.line(this.M, y, this.M + 60, y);
    d.setFont("helvetica", "bold");
    d.setFontSize(8.5);
    d.setTextColor(...COLORS.ink);
    d.text(nombre || rol, this.M, y + 4);
    d.setFont("helvetica", "normal");
    d.setTextColor(...COLORS.gray);
    d.text("Firma y sello", this.M, y + 8);
    this.y = y + 12;
  }

  attachLogo(dataUrl) {
    this.logo = dataUrl;
    return this;
  }

  save(filename) {
    const d = this.doc;
    const total = d.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      d.setPage(p);
      d.setDrawColor(...COLORS.line);
      d.setLineWidth(0.3);
      d.line(this.M, this.pageH - 11, this.pageW - this.M, this.pageH - 11);
      d.setFont("helvetica", "normal");
      d.setFontSize(7.3);
      d.setTextColor(...COLORS.gray);
      d.text(this.footerLabel, this.M, this.pageH - 6.5);
      d.text(`Página ${p} de ${total}`, this.pageW - this.M, this.pageH - 6.5, { align: "right" });
    }
    d.save(filename);
  }
}

export function nombreArchivo(parte) {
  return String(parte || "documento").replace(/[^\w\-]+/g, "_").replace(/_+/g, "_");
}
