
"use client";

import React, { useState, useMemo, useEffect } from "react"; // Added useEffect
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Gift,
  Check,
  X,
  Hourglass,
  User,
  Tag,
  Ban,
  Loader2,
} from "lucide-react";
import SelectItemDialog from "./select-item-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { selectGift, type GiftItem } from "@/data/gift-store";
import { useToast } from "@/hooks/use-toast";

interface GiftListProps {
  items: GiftItem[]; // Accept items as prop
  filterStatus?: "all" | "available" | "selected" | "not_needed";
  filterCategory?: string;
  onItemAction?: () => void; // Optional callback for parent refresh
}

export default function GiftList({
  items, // Use passed items
  filterStatus = "all",
  filterCategory,
  onItemAction, // Receive the callback
}: GiftListProps) {
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null); // Track loading state per item
  const [selectedItem, setSelectedItem] = useState<GiftItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

   // Log received items whenever the prop changes
   useEffect(() => {
    console.log(`GiftList (${filterStatus}): Received ${items?.length ?? 0} items.`); // Use optional chaining
    console.log(`GiftList (${filterStatus}): Sample items received:`, items?.slice(0, 5) ?? []); // Use optional chaining
  }, [items, filterStatus]);


  // Filter items based on props, now derived from the passed 'items' array
  const filteredItems = useMemo(() => {
     // Ensure items is an array before filtering
    const safeItems = Array.isArray(items) ? items : [];
    console.log(`GiftList (${filterStatus}): Filtering ${safeItems.length} items...`);

    const result = safeItems.filter((item) => {
      // Basic validation: Ensure item and item.status exist and item has an ID
      if (!item || typeof item.status === 'undefined' || !item.id) {
          console.warn(`GiftList (${filterStatus}): Skipping invalid item:`, item);
          return false;
      }

      const statusMatch = filterStatus === "all" || item.status === filterStatus;
      const categoryMatch = !filterCategory || item.category?.toLowerCase() === filterCategory.toLowerCase();

      // Add log for each item being checked
      // console.log(`GiftList (${filterStatus}): Checking item "${item.name}" (ID: ${item.id}, Status: ${item.status}, Category: ${item.category}) -> Status Match: ${statusMatch}, Category Match: ${categoryMatch}`);

      return statusMatch && categoryMatch;
    });
    console.log(`GiftList (${filterStatus}): Filtered down to ${result.length} items.`);
    console.log(`GiftList (${filterStatus}): Filtered items sample:`, result.slice(0, 5));
    return result;
  }, [items, filterStatus, filterCategory]);

  const handleSelectItemClick = (item: GiftItem) => {
    if (loadingItemId) return; // Prevent opening dialog if another action is loading
    setSelectedItem(item);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedItem(null);
  };

  // This function now performs the client-side action.
  // Revalidation is triggered inside the `selectGift` function in the data store.
  const handleItemSelectionSuccess = async (
    itemId: string,
    guestName: string,
  ) => {
    console.log(`GiftList (${filterStatus}): Attempting to select item ${itemId} for ${guestName}...`);
    setLoadingItemId(itemId); // Indicate loading for this specific item
    try {
      // selectGift now handles revalidation internally
      const updatedItem = await selectGift(itemId, guestName);
      if (updatedItem) {
         console.log(`GiftList (${filterStatus}): Item ${itemId} selected successfully. Triggering onItemAction.`);
        toast({
          title: "Sucesso!",
          description: `Obrigado, ${guestName}! "${updatedItem.name}" foi reservado com sucesso!`,
          variant: "default",
        });
        // Call the parent refresh callback after successful action
        onItemAction?.();
      } else {
        console.warn(
          `GiftList (${filterStatus}): Failed to select item ${itemId}. It might have been selected by someone else or status changed. Triggering onItemAction to refresh list.`,
        );
        toast({
          title: "Ops!",
          description: "Este item pode não estar mais disponível. A lista será atualizada.",
          variant: "destructive",
        });
        // Call refresh even on failure if the list might be stale
         onItemAction?.();
      }
    } catch (error) {
      console.error(`GiftList (${filterStatus}): Error during selectGift call for item ${itemId}:`, error);
      toast({
        title: "Erro!",
        description: "Não foi possível selecionar o presente.",
        variant: "destructive",
      });
    } finally {
      setLoadingItemId(null); // Stop loading indicator for this item
      handleDialogClose(); // Close dialog regardless of success/failure after action attempt
       console.log(`GiftList (${filterStatus}): Selection process finished for item ${itemId}.`);
    }
  };

  const getStatusBadge = (status: GiftItem["status"], selectedBy?: string | null) => { // Allow null for selectedBy
    switch (status) {
      case "available":
        return (
          <Badge
            variant="default"
            className="bg-success text-success-foreground"
          >
            <Check className="mr-1 h-3 w-3" /> Disponível
          </Badge>
        );
      case "selected":
        // Public list: Hide the name
        return (
          <Badge
            variant="secondary"
            className="bg-secondary text-secondary-foreground"
          >
            <User className="mr-1 h-3 w-3" /> Selecionado
          </Badge>
        );
      case "not_needed":
        return (
          <Badge
            variant="destructive"
            className="bg-destructive/80 text-destructive-foreground"
          >
            <Ban className="mr-1 h-3 w-3" /> Não Precisa
          </Badge>
        );
      default:
        console.warn(`GiftList: Unknown status encountered: ${status}`);
        return (
          <Badge variant="outline">
            <Hourglass className="mr-1 h-3 w-3" /> Indefinido
          </Badge>
        );
    }
  };


  if (filteredItems.length === 0 && filterStatus !== "all") { // Only show specific empty message if a filter is active
    let emptyMessage = "Nenhum item encontrado com os filtros selecionados.";
    if (filterStatus === "available")
      emptyMessage =
        "Todos os presentes disponíveis já foram escolhidos ou marcados como 'Não Precisa'!";
    if (filterStatus === "selected")
      emptyMessage = "Nenhum presente foi selecionado ainda.";
    if (filterStatus === "not_needed")
      emptyMessage = "Nenhum item marcado como 'Não precisa'.";

      console.log(`GiftList (${filterStatus}): Rendering empty message: ${emptyMessage}`);
    return (
      <div className="text-center pt-16 pb-10 text-muted-foreground">
        <Gift className="mx-auto h-12 w-12 mb-4" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // If filter is 'all' and items is empty, show initial empty state
  if (!items?.length && filterStatus === 'all') { // Check if original items array is empty/null/undefined
    console.log(`GiftList (${filterStatus}): Rendering initial empty state (no items passed).`);
    return (
        <div className="text-center pt-16 pb-10 text-muted-foreground">
            <Gift className="mx-auto h-12 w-12 mb-4" />
            <p>A lista de presentes ainda está vazia.</p>
        </div>
    );
  }

  console.log(`GiftList (${filterStatus}): Rendering ${filteredItems.length} items.`);
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {filteredItems.map((item) => (
          <Card
            key={item.id} // Use item.id as key
            className="flex flex-col justify-between shadow-md rounded-lg overflow-hidden animate-fade-in bg-card"
          >
            <CardHeader>
              <CardTitle className="text-lg">{item.name}</CardTitle>
              {item.description && (
                <CardDescription>{item.description}</CardDescription>
              )}
              <div className="flex items-center text-sm text-muted-foreground pt-1">
                <Tag className="mr-1 h-4 w-4" /> {item.category}
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              {/* Content area can be used for images or more details later */}
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-4 border-t">
              {getStatusBadge(item.status, item.selectedBy)}
              <div className="flex gap-2 flex-wrap justify-end">
                {item.status === "available" && (
                  <Button
                    size="sm"
                    className="bg-accent text-accent-foreground hover:bg-accent/90 hover:animate-pulse-button"
                    onClick={() => handleSelectItemClick(item)}
                    aria-label={`Selecionar ${item.name}`}
                    disabled={!!loadingItemId} // Disable button if any item is being processed
                  >
                    {/* Show loader only if *this specific* item is being processed */}
                    {loadingItemId === item.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Gift className="mr-2 h-4 w-4" />
                    )}
                    Escolher
                  </Button>
                )}
                {/* No buttons for 'selected' or 'not_needed' on public page */}
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Dialog remains the same, but uses the new handleItemSelectionSuccess */}
      {selectedItem && selectedItem.status === "available" && (
        <SelectItemDialog
          item={selectedItem}
          isOpen={isDialogOpen}
          onClose={handleDialogClose}
          onSuccess={handleItemSelectionSuccess} // Pass the updated handler
        />
      )}
    </>
  );
}
