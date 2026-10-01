import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org";
import { sourceLabel } from "@/lib/sources";

// Exporta a lista como planilha .xlsx formatada (abre no Excel e no Google
// Sheets): cabeçalho azul fixo, filtro, zebrado e links clicáveis.
// Exportação é recurso de plano pago (mesma regra do "Exportar CSV").

const AZUL = "FF2563EB";
const ZEBRA = "FFF5F8FF";
const BORDA = "FFE5E7EB";

function linkWhatsapp(telefone: string | null): string | null {
  const dig = (telefone ?? "").replace(/\D/g, "");
  if (dig.length < 10) return null;
  return `https://wa.me/${dig.startsWith("55") ? dig : `55${dig}`}`;
}

function url(v: string | null): string | null {
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function simNao(b: boolean | null): string {
  return b === null ? "—" : b ? "Sim" : "Não";
}

function nomeArquivo(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${base || "lista"}.xlsx`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await getActiveOrg();
  if (!org) return new Response("Sessão expirada.", { status: 401 });
  if (org.plano === "free") {
    return new Response("Exportação disponível a partir do plano Starter.", { status: 403 });
  }

  const supabase = await createClient();
  const { data: list } = await supabase
    .from("listas")
    .select("id, nome, origem")
    .eq("id", id)
    .maybeSingle();
  if (!list) return new Response("Lista não encontrada.", { status: 404 });

  const { data: leads } = await supabase
    .from("leads")
    .select(
      "nome, empresa, telefone, email, website, instagram, seguidores, nota, total_avaliacoes, categoria, endereco, anuncia_google, anuncia_meta, criado_em",
    )
    .eq("lista_id", id)
    .order("criado_em", { ascending: false });

  const wb = new ExcelJS.Workbook();
  wb.creator = "MeuLead";
  wb.created = new Date();

  const ws = wb.addWorksheet("Leads", {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { defaultRowHeight: 20 },
  });

  ws.columns = [
    { header: "Empresa", key: "empresa", width: 38 },
    { header: "Dono", key: "dono", width: 24 },
    { header: "Telefone", key: "telefone", width: 20 },
    { header: "WhatsApp", key: "whatsapp", width: 14 },
    { header: "E-mail", key: "email", width: 30 },
    { header: "Site", key: "site", width: 30 },
    { header: "Instagram", key: "instagram", width: 22 },
    { header: "Seguidores", key: "seguidores", width: 13 },
    { header: "Nota", key: "nota", width: 8 },
    { header: "Avaliações", key: "avaliacoes", width: 12 },
    { header: "Categoria", key: "categoria", width: 24 },
    { header: "Endereço", key: "endereco", width: 55 },
    { header: "Tem site?", key: "temSite", width: 11 },
    { header: "Anuncia Google", key: "google", width: 15 },
    { header: "Anuncia Meta", key: "meta", width: 14 },
    { header: "Origem", key: "origem", width: 14 },
    { header: "Captado em", key: "criado", width: 13 },
  ];

  for (const l of leads ?? []) {
    const wa = linkWhatsapp(l.telefone);
    const site = url(l.website);
    const insta = l.instagram
      ? url(l.instagram.includes("instagram.com") ? l.instagram : `instagram.com/${l.instagram.replace(/^@/, "")}`)
      : null;

    ws.addRow({
      empresa: l.empresa ?? l.nome ?? "",
      dono: l.empresa ? (l.nome ?? "") : "",
      telefone: l.telefone ?? "",
      whatsapp: wa ? { text: "Abrir conversa", hyperlink: wa } : "",
      email: l.email ? { text: l.email, hyperlink: `mailto:${l.email}` } : "",
      site: site ? { text: l.website!, hyperlink: site } : "",
      instagram: insta ? { text: l.instagram!, hyperlink: insta } : "",
      seguidores: l.seguidores ?? null,
      nota: l.nota ?? null,
      avaliacoes: l.total_avaliacoes ?? null,
      categoria: l.categoria ?? "",
      endereco: l.endereco ?? "",
      temSite: l.website ? "Sim" : "Não",
      google: simNao(l.anuncia_google),
      meta: simNao(l.anuncia_meta),
      origem: sourceLabel(list.origem),
      criado: new Date(l.criado_em),
    });
  }

  // Cabeçalho
  const head = ws.getRow(1);
  head.height = 26;
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  });

  // Corpo: zebrado, bordas leves, formatos e links
  const links = new Set(["whatsapp", "email", "site", "instagram"]);
  const centro = new Set(["nota", "avaliacoes", "temSite", "google", "meta", "criado"]);
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    row.eachCell({ includeEmpty: true }, (c, col) => {
      const key = ws.getColumn(col).key ?? "";
      if (r % 2 === 0) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      c.border = { bottom: { style: "thin", color: { argb: BORDA } } };
      c.alignment = {
        vertical: "middle",
        horizontal: centro.has(key) ? "center" : "left",
        wrapText: key === "endereco",
      };
      if (links.has(key) && c.value) c.font = { color: { argb: AZUL }, underline: true };
      if (key === "empresa") c.font = { bold: true };
    });
  }
  ws.getColumn("nota").numFmt = "0.0";
  ws.getColumn("seguidores").numFmt = "#,##0";
  ws.getColumn("avaliacoes").numFmt = "#,##0";
  ws.getColumn("criado").numFmt = "dd/mm/yyyy";

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };

  const buf = await wb.xlsx.writeBuffer();
  const arquivo = nomeArquivo(list.nome);
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${arquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
