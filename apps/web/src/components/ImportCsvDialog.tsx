"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Upload } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { importLeads, type LeadInput } from "@/app/dashboard/lists/[id]/actions";

// Mapeia cabeçalhos comuns (PT/EN) para os campos do lead.
function pick(row: Record<string, string>, keys: string[]): string | undefined {
  for (const k of Object.keys(row)) {
    const norm = k.trim().toLowerCase();
    if (keys.includes(norm)) return row[k];
  }
  return undefined;
}

function mapRow(row: Record<string, string>): LeadInput {
  return {
    name: pick(row, ["name", "nome", "contato", "responsável", "responsavel"]),
    company: pick(row, ["company", "empresa", "negócio", "negocio", "razão social", "razao social"]),
    phone: pick(row, ["phone", "telefone", "fone", "whatsapp", "celular", "tel"]),
    email: pick(row, ["email", "e-mail", "mail"]),
  };
}

export function ImportCsvDialog({ listId }: { listId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<LeadInput[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const mapped = res.data.map(mapRow).filter((r) => r.name || r.company || r.phone || r.email);
        if (mapped.length === 0) {
          setError("Não encontrei colunas reconhecíveis (nome, empresa, telefone, e-mail).");
          setRows(null);
          return;
        }
        setRows(mapped);
      },
      error: () => setError("Não consegui ler o arquivo. Confira se é um CSV válido."),
    });
  }

  return (
    <Modal
      title="Importar CSV"
      description="Colunas aceitas: nome, empresa, telefone/whatsapp, e-mail (em PT ou EN)."
      trigger={(open) => (
        <Button variant="outline" onClick={open}>
          <Upload className="h-4 w-4" />
          Importar CSV
        </Button>
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-4">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-4 py-8 text-center hover:border-neutral-400">
            <span className="text-2xl">📄</span>
            <span className="text-sm text-neutral-700 dark:text-neutral-200">
              {fileName || "Clique para escolher um arquivo .csv"}
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>

          {rows && (
            <p className="rounded-md bg-blue-500/10 px-3 py-2 text-sm text-blue-600 dark:text-blue-400">
              ✓ {rows.length} leads prontos para importar.
            </p>
          )}
          {error && (
            <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!rows || pending}
              onClick={() => {
                if (!rows) return;
                start(async () => {
                  const res = await importLeads(listId, rows);
                  if (!res.ok) return setError(res.error);
                  close();
                  router.refresh();
                });
              }}
            >
              {pending ? "Importando…" : rows ? `Importar ${rows.length}` : "Importar"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
