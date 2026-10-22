"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CompanyVehicle } from "@/lib/api";
import { VehicleForm } from "./vehicle-form";

/** Onaylanmamış araç için "Düzelt": form aracın yerinde açılır */
export function VehicleEdit({ vehicle }: { vehicle: CompanyVehicle }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Düzelt
      </Button>
    );
  }
  return (
    <div className="mt-2 w-full rounded-lg border border-zinc-200 p-3">
      <VehicleForm vehicle={vehicle} onDone={() => setOpen(false)} />
    </div>
  );
}
