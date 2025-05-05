"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  items: GiftItem[] | null;
  filterStatus?: "all" | "available" | "selected";
  filterCategory?: string;
  onItemAction?: () => void;
}

export default function GiftList({
  items,
  filterStatus = "all",
  filterCategory,
  onItemAction,
}: GiftListProps) {
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<GiftItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log(`GiftList (${filterStatus}): Received items prop update. Count: ${items?.length ?? 0}`);
  }, [items, filterStatus]);

  const filteredItems = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : [];
    console.log(`GiftList (${filterStatus}): Filtering ${safeItems.length} items based on prop...`);

    const result = safeItems.filter((item) => {
      if (!item || typeof item.status === 'undefined' || !item.id) {
        console.warn(`GiftList (${filterStatus}): Skipping invalid item during filtering:`, item);
        return false;
      }

      const statusMatch = filterStatus === "all" || item.status === filterStatus;
      const categoryMatch = !filterCategory || item.category?.toLowerCase() === filterCategory.toLowerCase();

      return statusMatch && categoryMatch;
    });
    console.log(`GiftList (${filterStatus}): Filtered down to ${result.length} items.`);
    return result;
  }, [items, filterStatus, filterCategory]);

  const handleSelectItemClick = (item: GiftItem) => {
    if (loadingItemId) return;
    setSelectedItem(item);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedItem(null);
  };

  const handleItemSelectionSuccess = async (
    itemId: string,
    guestName: string,
  ) => {
    console.log(`GiftList (${filterStatus}): Attempting to select item ${itemId} for ${guestName}...`);
    setLoadingItemId(itemId);
    try {
      const updatedItem = await selectGift(itemId, guestName);
      if (updatedItem) {
        console.log(`GiftList (${filterStatus}): Item ${itemId} selected successfully. Triggering onItemAction.`);
        toast({
          title: "Sucesso!",
          description: `Obrigado, ${guestName}! "${updatedItem.name}" foi reservado com sucesso!`,
          variant: "default",
        });
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
      setLoadingItemId(null);
      handleDialogClose();
      console.log(`GiftList (${filterStatus}): Selection process finished for item ${itemId}.`);
    }
  };

  const getStatusBadge = (status: GiftItem["status"], selectedBy?: string | null) => {
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
        return (
          <Badge
            variant="secondary"
            className="bg-secondary text-secondary-foreground"
          >
            <User className="mr-1 h-3 w-3" /> Selecionado
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

  const isInitialLoad = !items;
  const hasLoadedItems = Array.isArray(items);
  const hasNoItemsInDatabase = hasLoadedItems && items.length === 0;
  const isFilteredListEmpty = hasLoadedItems && filteredItems.length === 0;

  console.log(`GiftList (${filterStatus}): Rendering check - isInitialLoad: ${isInitialLoad}, hasLoadedItems: ${hasLoadedItems}, hasNoItemsInDatabase: ${hasNoItemsInDatabase}, isFilteredListEmpty: ${isFilteredListEmpty}`);

  if (isInitialLoad) {
    console.log(`GiftList (${filterStatus}): Parent is likely loading (items prop is not an array). Rendering loader.`);
    return (
      <div className="text-center pt-16 pb-10 text-muted-foreground">
        <Loader2 className="mx-auto h-12 w-12 animate-spin mb-4" />
        <p>Carregando lista de presentes...</p>
      </div>
    );
  }

  if (hasNoItemsInDatabase && filterStatus === 'all') {
    console.log(`GiftList (${filterStatus}): Rendering empty state (database has no items).`);
    return (
      <div className="text-center pt-16 pb-10 text-muted-foreground">
        <Gift className="mx-auto h-12 w-12 mb-4" />
        <p>A lista de presentes ainda está vazia.</p>
      </div>
    );
  }

  if (isFilteredListEmpty && !hasNoItemsInDatabase) {
    let emptyMessage = "Nenhum item encontrado com os filtros selecionados.";
    if (filterStatus === "available")
      emptyMessage = "Todos os presentes disponíveis já foram escolhidos.";
    if (filterStatus === "selected")
      emptyMessage = "Nenhum presente foi selecionado ainda.";

    console.log(`GiftList (${filterStatus}): Rendering specific empty message for active filter: ${emptyMessage}`);
    return (
      <div className="text-center pt-16 pb-10 text-muted-foreground">
        <Gift className="mx-auto h-12 w-12 mb-4" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  console.log(`GiftList (${filterStatus}): Rendering ${filteredItems.length} items.`);
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {filteredItems.map((item) => {
          console.log(`GiftList (${filterStatus}): Rendering item card for:`, item);
          return (
            <Card
              key={item.id}
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
                      disabled={!!loadingItemId}
                    >
                      {loadingItemId === item.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Gift className="mr-2 h-4 w-4" />
                      )}
                      Escolher
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {selectedItem && selectedItem.status === "available" && (
        <SelectItemDialog
          item={selectedItem}
          isOpen={isDialogOpen}
          onClose={handleDialogClose}
          onSuccess={handleItemSelectionSuccess}
        />
      )}
    </>
  );
}
