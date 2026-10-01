import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org";
import { enriquecerDonos, donosPendentes } from "@/lib/captura";
import { LeadsTable } from "@/components/LeadsTable";
import { AddLeadDialog } from "@/components/AddLeadDialog";
import { ImportCsvDialog } from "@/components/ImportCsvDialog";
import { AutoRefresh } from "@/components/AutoRefresh";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { Download } from "lucide-react";
import { sourceLabel } from "@/lib/sources";

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Enriquece o dono em segundo plano (roda também aqui).
  const org = await getActiveOrg();
  let donosFaltando = 0;
  if (org) {
    try {
      await enriquecerDonos(org.orgId);
      donosFaltando = await donosPendentes(org.orgId);
    } catch {
      /* segue carregando */
    }
  }

  const { data: list } = await supabase
    .from("listas")
    .select("id, nome, origem, dono_processado")
    .eq("id", id)
    .maybeSingle();

  if (!list) notFound();

  const buscandoDonos = list.origem === "google_maps" && !list.dono_processado;

  const { data: leads } = await supabase
    .from("leads")
    .select(
      "id, nome, empresa, telefone, email, origem, website, instagram, seguidores, nota, total_avaliacoes, endereco, criado_em",
    )
    .eq("lista_id", id)
    .order("criado_em", { ascending: false });

  return (
    <div>
      <AutoRefresh ativo={buscandoDonos || donosFaltando > 0} />
      <Link href="/dashboard/lists" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-800">
        ← Listas
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{list.nome}</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {sourceLabel(list.origem)} · {leads?.length ?? 0} leads
          </p>
        </div>
        <div className="flex gap-2">
          {org && org.plano !== "free" ? (
            <a
              href={`/dashboard/lists/${id}/exportar`}
              download
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-all duration-150 hover:bg-neutral-50 active:scale-[0.98] dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
            >
              <Download className="h-4 w-4" />
              Exportar planilha
            </a>
          ) : (
            <UpgradeDialog
              planoAtual={org?.plano ?? "free"}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-500 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            >
              🔒 Exportar planilha
              <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                Starter+
              </span>
            </UpgradeDialog>
          )}
          <ImportCsvDialog listId={id} />
          <AddLeadDialog listId={id} />
        </div>
      </div>

      {buscandoDonos && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          Buscando o nome dos donos… isto roda em segundo plano e atualiza sozinho (~1-2 min).
        </div>
      )}

      <div className="mt-6">
        <LeadsTable listId={id} leads={leads ?? []} />
      </div>
    </div>
  );
}
