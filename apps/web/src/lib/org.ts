import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

// Plano máximo — o admin da plataforma sempre o tem, sem vencimento.
const PLANO_ADMIN = "scale";

export interface ActiveOrg {
  orgId: string;
  orgName: string;
  email: string;
  plano: string;
  creditosPlano: number;
  creditosExtra: number;
  creditosRenovamEm: string;
  planoExpiraEm: string | null; // vencimento do plano anual (null = não expira)
}

// Retorna a org ativa do usuário logado (a primeira da qual é membro).
// Retorna null se não houver sessão. `cache` deduplica chamadas no mesmo
// render (layout + página não consultam o banco duas vezes).
export const getActiveOrg = cache(async (): Promise<ActiveOrg | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("membros")
    .select("organizacao_id")
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: org } = await supabase
    .from("organizacoes")
    .select("nome, plano, creditos_plano, creditos_extra, creditos_renovam_em, plano_expira_em")
    .eq("id", membership.organizacao_id)
    .maybeSingle();

  const admin = isAdmin(user.email);

  return {
    orgId: membership.organizacao_id,
    orgName: org?.nome ?? "Minha empresa",
    email: user.email ?? "—",
    plano: admin ? PLANO_ADMIN : (org?.plano ?? "free"),
    creditosPlano: org?.creditos_plano ?? 0,
    creditosExtra: org?.creditos_extra ?? 0,
    creditosRenovamEm: org?.creditos_renovam_em ?? new Date().toISOString(),
    planoExpiraEm: admin ? null : (org?.plano_expira_em ?? null),
  };
});
