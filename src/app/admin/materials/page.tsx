import type { Metadata } from "next";
import EmptyState from "@/components/EmptyState";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LENGTH_UNITS, fromMm, type LengthUnit } from "@/lib/units";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import { listMaterials } from "@/server/services/materials";
import MaterialForm from "./MaterialForm";
import MaterialToggle from "./MaterialToggle";
import StandardMaterialsButton from "./StandardMaterialsButton";

export const metadata: Metadata = { title: "Materials | Pacwoods" };

export default async function MaterialsPage({ searchParams }: PageProps<"/admin/materials">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const canEdit = true;
  const materials = await listMaterials({ includeInactive: canEdit });
  const asked = String((await searchParams).unit ?? "");
  const unit: LengthUnit = (LENGTH_UNITS as readonly string[]).includes(asked) ? (asked as LengthUnit) : "mm";
  const size = (mm: number) => fromMm(mm, unit);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materials"
        description="The sheet materials cutlists can use. Retire a material instead of deleting it."
        actions={canEdit && <StandardMaterialsButton />}
      />
      <nav aria-label="Measure in" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium">Measure in</span>
        {LENGTH_UNITS.map((u) => (
          <Link
            key={u}
            href={u === "mm" ? "/admin/materials" : `/admin/materials?unit=${u}`}
            aria-current={u === unit ? "true" : undefined}
            className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", u === unit ? "bg-brand-charcoal text-white" : "bg-card text-muted-foreground shadow-xs hover:text-foreground")}
          >
            {u}
          </Link>
        ))}
        <span className="text-xs text-muted-foreground">The catalogue is stored in millimetres; this only changes how sizes are typed and shown.</span>
      </nav>
      {canEdit && <MaterialForm key={unit} unit={unit} />}
      {materials.length === 0 ? (
        <EmptyState title="No materials in the catalogue yet." />
      ) : (
        <div className="panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Thickness</TableHead>
                <TableHead className="text-right">Standard sheet</TableHead>
                <TableHead>Grain</TableHead>
                <TableHead>Supplier</TableHead>
                {canEdit && <TableHead>Status</TableHead>}
                {canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((m) => (
                <TableRow key={m._id.toString()}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.category}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {size(m.thicknessMm)} {unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {size(m.sheetLengthMm)} × {size(m.sheetWidthMm)} {unit}
                  </TableCell>
                  <TableCell>{m.grain === "LENGTHWISE" ? "Lengthwise" : "None"}</TableCell>
                  <TableCell>{m.supplier ?? "—"}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <Badge variant={m.active ? "secondary" : "outline"}>{m.active ? "Active" : "Retired"}</Badge>
                    </TableCell>
                  )}
                  {canEdit && (
                    <TableCell className="text-right">
                      <MaterialToggle id={m._id.toString()} name={m.name} active={m.active} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
