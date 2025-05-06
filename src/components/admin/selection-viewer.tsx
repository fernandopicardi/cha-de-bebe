
"use client";

import React, { useState, useMemo, useEffect } from "react"; // Import useState, useMemo, useEffect
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, User, CalendarDays, Loader2, Package } from "lucide-react"; // Added Loader2 and Package
import { revertSelection, type GiftItem } from "@/data/gift-store"; // Import store function
import { useToast } from "@/hooks/use-toast";

interface AdminSelectionViewerProps {
  selectedItems: GiftItem[]; // Items with 'selected' status OR quantity > 0
  onDataChange?: () => void; // Optional: Keep if parent needs immediate UI feedback before revalidation finishes
}

export default function AdminSelectionViewer({
  selectedItems,
  onDataChange,
}: AdminSelectionViewerProps) {
  const { toast } = useToast();
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null); // State to track loading item

  // Log received items when the prop changes
  useEffect(() => {
      console.log(`AdminSelectionViewer: Received ${selectedItems?.length ?? 0} selected items.`); // Use optional chaining
      // console.log("AdminSelectionViewer: Sample selected items:", selectedItems?.slice(0, 3)); // Use optional chaining
  }, [selectedItems]);


  // Filter items that are actually selected (status='selected' or have selectedQuantity > 0)
  // AND are NOT marked as 'not_needed'
   const actuallySelectedItems = useMemo(() => {
       const safeItems = Array.isArray(selectedItems) ? selectedItems : [];
       return safeItems.filter(item =>
           item &&
           item.status !== 'not_needed' &&
           (item.status === 'selected' || (typeof item.selectedQuantity === 'number' && item.selectedQuantity > 0))
       );
   }, [selectedItems]);


  const handleRevert = async (item: GiftItem) => {
    if (loadingItemId) return; // Prevent multiple actions
    // Disable revert for quantity items for now
    if (item.totalQuantity !== null && item.totalQuantity > 0) {
        toast({ title: "Ação Indisponível", description: "Reversão de itens com quantidade não suportada nesta versão.", variant: "default" });
        return;
    }
    if (!item.selectedBy && item.status !== 'not_needed') return; // Should always have selectedBy if selected, but check anyway

    console.log(`SelectionViewer: Attempting to revert item ID: ${item.id}`);
    if (
      confirm(
        `Tem certeza que deseja reverter a seleção de "${item.name}"${item.selectedBy ? ` por ${item.selectedBy}` : ''}? O item voltará a ficar disponível.`,
      )
    ) {
      setLoadingItemId(item.id); // Set loading state for this item
      try {
        // revertSelection now handles revalidation internally
        await revertSelection(item.id);
        console.log(`SelectionViewer: Revert successful for item ID: ${item.id}. Triggering onDataChange.`);

        toast({
          title: "Sucesso!",
          description: `Seleção do item "${item.name}" revertida.`,
        });
        // Call parent refresh AFTER successful operation
        onDataChange?.();
      } catch (error) {
        console.error("Error reverting selection:", error);
        toast({
          title: "Erro!",
          description: `Falha ao reverter a seleção do item "${item.name}".`,
          variant: "destructive",
        });
      } finally {
        setLoadingItemId(null); // Clear loading state
      }
    } else {
        console.log(`SelectionViewer: Revert cancelled for item ID: ${item.id}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>
                <Package className="inline-block mr-1 h-4 w-4" /> {/* Icon for Quantity */}
                Qtd. Selec.
              </TableHead>
              <TableHead>
                <User className="inline-block mr-1 h-4 w-4" />
                Selecionado Por (Último)
              </TableHead>
              <TableHead className="hidden sm:table-cell">
                <CalendarDays className="inline-block mr-1 h-4 w-4" />
                Data (Última)
              </TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actuallySelectedItems.length === 0 ? ( // Use filtered list
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center"> {/* Updated colSpan */}
                  Nenhum item selecionado ainda.
                </TableCell>
              </TableRow>
            ) : (
              actuallySelectedItems.map((item) => { // Use filtered list
                 const isQuantityItem = typeof item.totalQuantity === 'number' && item.totalQuantity > 0;
                 const canRevert = !isQuantityItem; // Disable revert for quantity items

                 return (
                    <TableRow
                    key={item.id}
                    className={loadingItemId === item.id ? "opacity-50" : ""}
                    >
                    <TableCell className="font-medium">{item.name}</TableCell>
                     {/* Quantity Display */}
                     <TableCell className="text-center">
                         {isQuantityItem ? `${item.selectedQuantity ?? 0} / ${item.totalQuantity}` : '1 / 1'}
                    </TableCell>
                    <TableCell>{item.selectedBy || "-"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                        {item.selectionDate
                        ? new Date(item.selectionDate).toLocaleDateString(
                            "pt-BR",
                            {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                            },
                            )
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                        <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevert(item)}
                        title={canRevert ? "Reverter Seleção" : "Reversão Indisponível para Itens com Quantidade"}
                        className={canRevert ? "border-orange-500 text-orange-600 hover:bg-orange-500/10" : ""}
                        disabled={loadingItemId === item.id || !canRevert} // Disable button while loading or if not revertible
                        >
                        {loadingItemId === item.id ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                            <RotateCcw className="mr-1 h-4 w-4" />
                        )}
                        Reverter
                        </Button>
                    </TableCell>
                    </TableRow>
                 );
                 })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
