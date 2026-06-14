"use client";

import { StockMovementType } from "@prisma/client";
import { adjustStock } from "@/actions/inventory";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function InventoryActions({ productId, unit }: { productId: string; unit: string }) {
  const quick = async (type: StockMovementType, qty: number) => {
    try {
      await adjustStock(productId, qty, type, `Quick ${type}`);
      toast.success(`Stock ${type.toLowerCase()}: ${qty} ${unit}`);
    } catch {
      toast.error("Stock update failed");
    }
  };

  return (
    <div className="flex gap-1">
      <Button variant="secondary" size="sm" onClick={() => void quick(StockMovementType.IN, 10)}>
        +10
      </Button>
      <Button variant="secondary" size="sm" onClick={() => void quick(StockMovementType.OUT, 5)}>
        −5
      </Button>
    </div>
  );
}
