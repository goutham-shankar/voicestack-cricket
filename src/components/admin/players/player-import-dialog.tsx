"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PLAYER_ROLES } from "@/lib/constants";
import type { PlayerInput } from "@/lib/validators/player";
import type { CategoryRecord } from "@/components/admin/settings/category-form-dialog";
import type { TagRecord } from "@/components/admin/settings/tag-form-dialog";
import { Loader2, Upload, Download, CircleAlert, CircleCheck } from "lucide-react";

type ParsedRow =
  | { status: "valid"; source: Record<string, string>; player: PlayerInput }
  | { status: "error"; source: Record<string, string>; error: string };

const EXPECTED_HEADERS = [
  "name",
  "role",
  "gender",
  "category",
  "basePriceOverride",
  "tags",
  "info",
];

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.trim() !== "")) rows.push(row);
  }
  return rows;
}

function downloadTemplate(categories: CategoryRecord[]) {
  const sampleCategory = categories[0]?.name ?? "Professional";
  const lines = [
    EXPECTED_HEADERS.join(","),
    `"Rahul Kumar","${PLAYER_ROLES[0]}","M","${sampleCategory}","","",""`,
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "players-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function PlayerImportDialog({
  categories,
  tags,
  onSaved,
}: {
  categories: CategoryRecord[];
  tags: TagRecord[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = rows.filter((r): r is Extract<ParsedRow, { status: "valid" }> =>
    r.status === "valid"
  );

  function reset() {
    setRows([]);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const table = parseCSV(text);
      if (table.length === 0) {
        setRows([]);
        return;
      }
      const header = table[0].map((h) => h.trim().toLowerCase());
      const dataRows = table.slice(1);

      const parsed: ParsedRow[] = dataRows.map((cells) => {
        const source: Record<string, string> = {};
        header.forEach((key, i) => {
          source[key] = (cells[i] ?? "").trim();
        });

        const name = source.name ?? "";
        if (name.length < 2) {
          return { status: "error", source, error: "Name is required (min 2 characters)" };
        }

        const roleInput = source.role ?? "";
        const role = PLAYER_ROLES.find(
          (r) => r.toLowerCase() === roleInput.toLowerCase()
        );
        if (!role) {
          return {
            status: "error",
            source,
            error: `Unknown role "${roleInput}" — expected one of ${PLAYER_ROLES.join(", ")}`,
          };
        }

        const genderInput = (source.gender ?? "").toUpperCase();
        if (genderInput !== "M" && genderInput !== "F") {
          return {
            status: "error",
            source,
            error: `Unknown gender "${source.gender ?? ""}" — expected M or F`,
          };
        }

        const categoryInput = source.category ?? "";
        const category = categories.find(
          (c) => c.name.toLowerCase() === categoryInput.toLowerCase()
        );
        if (!category) {
          return {
            status: "error",
            source,
            error: `Unknown category "${categoryInput}"`,
          };
        }

        let basePriceOverride: number | null = null;
        const priceInput = (source.basepriceoverride ?? "").trim();
        if (priceInput !== "") {
          const n = Number(priceInput);
          if (!Number.isFinite(n) || n < 0) {
            return { status: "error", source, error: `Invalid base price "${priceInput}"` };
          }
          basePriceOverride = Math.round(n);
        }

        const tagIds = (source.tags ?? "")
          .split(";")
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => tags.find((tag) => tag.name.toLowerCase() === t.toLowerCase())?._id)
          .filter((id): id is string => Boolean(id));

        return {
          status: "valid",
          source,
          player: {
            name,
            avatarUrl: null,
            role,
            gender: genderInput,
            categoryId: category._id,
            basePriceOverride,
            tagIds,
            info: source.info ?? "",
          },
        };
      });

      setRows(parsed);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (validRows.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/players/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: validRows.map((r) => r.player) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Import failed");
        return;
      }
      if (data.errors?.length) {
        toast.warning(`Imported ${data.created} player(s), ${data.errors.length} failed`);
      } else {
        toast.success(`Imported ${data.created} player(s)`);
      }
      setOpen(false);
      reset();
      onSaved();
    } finally {
      setLoading(false);
    }
  }

  const errorCount = rows.length - validRows.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Upload className="size-4" />
            Import CSV
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Players from CSV</DialogTitle>
          <DialogDescription>
            Columns: name, role, gender (M or F), category, basePriceOverride (optional), tags
            (optional, semicolon-separated), info (optional). Role and category
            must match existing values exactly (case-insensitive).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            {fileName ?? "Choose CSV file"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => downloadTemplate(categories)}
          >
            <Download className="size-4" />
            Download template
          </Button>
        </div>

        {rows.length > 0 && (
          <>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-sold">
                <CircleCheck className="size-4" /> {validRows.length} ready
              </span>
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <CircleAlert className="size-4" /> {errorCount} skipped
                </span>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.source.name || "—"}</TableCell>
                      <TableCell>{row.source.role || "—"}</TableCell>
                      <TableCell>{row.source.gender || "—"}</TableCell>
                      <TableCell>{row.source.category || "—"}</TableCell>
                      <TableCell>
                        {row.status === "valid" ? (
                          <Badge className="border-0 bg-sold/15 text-sold">Ready</Badge>
                        ) : (
                          <span className="text-xs text-destructive">{row.error}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            type="button"
            disabled={validRows.length === 0 || loading}
            onClick={handleImport}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Import {validRows.length > 0 ? validRows.length : ""} player
            {validRows.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
