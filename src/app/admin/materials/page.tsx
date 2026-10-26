import type { Metadata } from "next";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/server/auth/guards";
import { listMaterials } from "@/server/services/materials";
import MaterialForm from "./MaterialForm";
import MaterialToggle from "./MaterialToggle";

export const metadata: Metadata = { title: "Materials | Pacwoods" };

export default async function MaterialsPage() {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  const canEdit = user.role === "SUPER_ADMIN";
  const materials = await listMaterials({ includeInactive: canEdit });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materials"
        description={
          canEdit
            ? "The sheet materials cutlists can use. Retire a material instead of deleting it."
            : "The sheet materials cutlists can use. Only a Super Admin can change this list."
        }
      />
      {canEdit && <MaterialForm />}
      {materials.length === 0 ? (
        <EmptyState title="No materials in the catalogue yet." />
      ) : (
        <div className="rounded-lg bg-card">
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
                  <TableCell className="text-right tabular-nums">{m.thicknessMm} mm</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.sheetLengthMm} × {m.sheetWidthMm} mm
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
