import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import type { Servico } from "@/types/proposta";

interface PDFData {
  clienteNome: string;
  clienteEmpresa: string;
  clienteEmail: string;
  clienteWhatsapp: string;
  clienteEndereco?: string;
  servicos: Servico[];
  valorMensal: number;
  valorSetup: number;
  valorTotal: number;
  descontoTipo: string;
  descontoValor: number;
  propostaNumero?: string;
}

// ── Colors ───────────────────────────────────────────────────
const DARK = rgb(0.12, 0.12, 0.12);
const GOLD = rgb(0.85, 0.65, 0.13);
const GRAY = rgb(0.35, 0.35, 0.35);
const WHITE = rgb(1, 1, 1);
const RED = rgb(0.8, 0.2, 0.2);
const LIGHT_GRAY = rgb(0.85, 0.85, 0.85);

// ── Column positions ─────────────────────────────────────────
const COL_NO = 55;
const COL_DESC = 98;         // extracted from template: "DESCRIÇÃO DE ITENS" header x0=97.94
const COL_VALOR = 365;       // extracted from template: "VALOR" header x0=365.05
const COL_QTY = 445;
const COL_SUBTOTAL = 490;
const MAX_DESC_WIDTH = 235;

// ── Column alignment anchors — derived from pdfplumber extraction ─────────
// Template measurements: VALOR x0=365.05 x1=399.20 | QTY center=457.06 | SUBTOTAL center=532.27
const TABLE_RIGHT         = 575;                                      // actual right edge (SUBTOTAL header centering: 490+575/2=532.5 ≈ 532.27)
const COL_VALOR_CENTER    = 382;                                      // template "VALOR" header center = (365.05+399.20)/2 = 382.125
const COL_QTY_CENTER      = 467.5;                                    // center of QTY column cell (445–490)/2 = 467.5
const COL_SUBTOTAL_CENTER = (COL_SUBTOTAL + TABLE_RIGHT) / 2;        // (490+575)/2 = 532.5 — matches "SUBTOTAL" header center 532.27
const COL_VALOR_RIGHT     = COL_QTY - 7;                             // 438 (for discount label)

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function drawTextRight(
  page: ReturnType<typeof PDFDocument.prototype.getPages>[0],
  text: string, rightX: number, y: number,
  size: number, font: PDFFont, color: ReturnType<typeof rgb>,
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - w, y, size, font, color });
}

function drawTextCenter(
  page: ReturnType<typeof PDFDocument.prototype.getPages>[0],
  text: string, centerX: number, y: number,
  size: number, font: PDFFont, color: ReturnType<typeof rgb>,
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: centerX - w / 2, y, size, font, color });
}

/**
 * Pre-calculate the total height a service block will need.
 */
function calcServiceHeight(
  servico: Servico,
  font: PDFFont,
  lineHeight: number,
  descFontSize: number,
  separatorGap: number,
): number {
  let h = lineHeight + 3;
  const subItems = servico.descricao.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  for (const item of subItems) {
    const text = item.startsWith("-") ? item : `- ${item}`;
    const lines = wrapText(text, font, descFontSize, MAX_DESC_WIDTH);
    h += lines.length * lineHeight;
  }
  // Extra line for "Investimento em Tráfego" if applicable
  if (servico.investimento_trafego && servico.investimento_trafego > 0) {
    h += lineHeight;
  }
  h += 4 + separatorGap;
  return h;
}

export async function generatePDF(data: PDFData) {
  const templateBytes = await fetch("/Orcamento_MODELO_1.pdf").then((res) => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes);

  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ══════════════════════════════════════════════════════════════
  // HEADER — Date + Nº Orçamento
  // ══════════════════════════════════════════════════════════════
  const headerValueY = height - 105;

  const hoje = new Date();
  const diasSemana = [
    "Domingo", "Segunda Feira", "Terça Feira", "Quarta Feira",
    "Quinta Feira", "Sexta Feira", "Sábado",
  ];
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const dataStr = `${diasSemana[hoje.getDay()]}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
  page.drawText(dataStr, {
    x: 42, y: headerValueY, size: 8, font: helvetica, color: WHITE,
  });

  const numOrcamento = data.propostaNumero || `#${String(Math.floor(Math.random() * 9000 + 1000)).padStart(4, "0")}`;
  page.drawText(numOrcamento, {
    x: 220, y: headerValueY, size: 8, font: helvetica, color: WHITE,
  });

  // ══════════════════════════════════════════════════════════════
  // CLIENT NAME
  // ══════════════════════════════════════════════════════════════
  const clienteNome = data.clienteEmpresa || data.clienteNome;
  page.drawText(clienteNome.toUpperCase(), {
    x: 42, y: height - 166, size: 16, font: helveticaBold, color: GOLD,
  });

  // ══════════════════════════════════════════════════════════════
  // LAYOUT — Auto-compact to fit everything on one page
  // ══════════════════════════════════════════════════════════════
  const TABLE_TOP = height - 253;
  const TABLE_BOTTOM = height - 645;
  const TOTAL_SPACE = 30;
  const available = TABLE_TOP - TABLE_BOTTOM - TOTAL_SPACE;

  // Compaction levels: try each until content fits
  const levels = [
    { lineHeight: 11, descFontSize: 8, separatorGap: 38, topGap: 28 },
    { lineHeight: 10, descFontSize: 8, separatorGap: 36, topGap: 26 },
    { lineHeight: 9,  descFontSize: 7, separatorGap: 34, topGap: 24 },
    { lineHeight: 8,  descFontSize: 7, separatorGap: 30, topGap: 20 },
    { lineHeight: 7,  descFontSize: 6, separatorGap: 26, topGap: 16 },
  ];

  let chosen = levels[0];
  for (const level of levels) {
    const total = data.servicos.reduce(
      (sum, s) => sum + calcServiceHeight(s, helvetica, level.lineHeight, level.descFontSize, level.separatorGap), 0,
    );
    chosen = level;
    if (total <= available) break;
  }

  const { lineHeight, descFontSize, separatorGap, topGap } = chosen;

  // ══════════════════════════════════════════════════════════════
  // CLEAR TABLE BODY
  // ══════════════════════════════════════════════════════════════
  page.drawRectangle({
    x: 40, y: TABLE_BOTTOM,
    width: width - 80,
    height: TABLE_TOP - TABLE_BOTTOM,
    color: WHITE, borderWidth: 0,
  });

  // ══════════════════════════════════════════════════════════════
  // SERVICES TABLE
  // ══════════════════════════════════════════════════════════════
  let currentY = TABLE_TOP - topGap;

  data.servicos.forEach((servico, index) => {
    const num = String(index + 1).padStart(2, "0") + ".";

    page.drawText(num, {
      x: COL_NO, y: currentY, size: 10, font: helveticaBold, color: DARK,
    });

    page.drawText(servico.nome, {
      x: COL_DESC, y: currentY, size: 10, font: helveticaBold, color: DARK,
    });

    const valorServico = servico.valor_mensal > 0 ? servico.valor_mensal : servico.valor_setup;
    drawTextCenter(page, formatCurrency(valorServico), COL_VALOR_CENTER, currentY, 9, helvetica, DARK);
    drawTextCenter(page, "1", COL_QTY_CENTER, currentY, 9, helvetica, DARK);
    drawTextCenter(page, formatCurrency(valorServico), COL_SUBTOTAL_CENTER, currentY, 9, helvetica, DARK);

    currentY -= lineHeight + 3;

    const subItems = servico.descricao.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    subItems.forEach((item) => {
      const text = item.startsWith("-") ? item : `- ${item}`;
      const wrappedLines = wrapText(text, helvetica, descFontSize, MAX_DESC_WIDTH);
      wrappedLines.forEach((line) => {
        page.drawText(line, {
          x: COL_DESC, y: currentY, size: descFontSize, font: helvetica, color: GRAY,
        });
        currentY -= lineHeight;
      });
    });

    // Add "Investimento em Tráfego" line if applicable
    if (servico.investimento_trafego && servico.investimento_trafego > 0) {
      page.drawText(`Investimento em Tráfego: ${formatCurrency(servico.investimento_trafego)}`, {
        x: COL_DESC, y: currentY, size: descFontSize, font: helveticaBold, color: GOLD,
      });
      currentY -= lineHeight;
    }

    currentY -= 4;

    if (index < data.servicos.length - 1) {
      const halfGap = Math.floor(separatorGap / 2);
      currentY -= halfGap;
      page.drawLine({
        start: { x: 45, y: currentY }, end: { x: 555, y: currentY },
        thickness: 0.5, color: LIGHT_GRAY,
      });
      currentY -= separatorGap - halfGap;
    }
  });

  // ══════════════════════════════════════════════════════════════
  // TOTALS
  // ══════════════════════════════════════════════════════════════
  currentY -= 10;

  if (data.descontoValor > 0) {
    const descontoLabel =
      data.descontoTipo === "percentual"
        ? `Desconto (${data.descontoValor}%)`
        : "Desconto";
    const descontoAmount =
      data.descontoTipo === "percentual"
        ? (data.valorMensal + data.valorSetup) * (data.descontoValor / 100)
        : data.descontoValor;

    drawTextRight(page, descontoLabel, COL_VALOR_RIGHT, currentY, 9, helvetica, RED);
    drawTextCenter(page, `-${formatCurrency(descontoAmount)}`, COL_SUBTOTAL_CENTER, currentY, 9, helvetica, RED);
    currentY -= lineHeight + 8;
  }

  drawTextCenter(page, "TOTAL:", COL_VALOR_CENTER, currentY, 11, helveticaBold, DARK);
  drawTextCenter(page, formatCurrency(data.valorTotal), COL_SUBTOTAL_CENTER, currentY, 11, helveticaBold, GOLD);

  // ══════════════════════════════════════════════════════════════
  // SAVE & DOWNLOAD
  // ══════════════════════════════════════════════════════════════
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `proposta-${data.clienteNome.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const w = font.widthOfTextAtSize(testLine, fontSize);
    if (w > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}
