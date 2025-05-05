
"use client";

import React, { useState, useMemo, useEffect } from "react";
import Image from 'next/image'; // Import next/image
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
  X, // Use X for "Not Needed" badge
  Hourglass,
  User,
  Tag,
  Ban,
  Loader2,
  Image as ImageIcon, // Placeholder icon
} from "lucide-react";
import SelectItemDialog from "./select-item-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { selectGift, type GiftItem } from "@/data/gift-store"; // Ensure correct import
import { useToast } from "@/hooks/use-toast";

interface GiftListProps {
  items: GiftItem[] | null;
  filterStatus?: "all" | "available" | "selected" | "not_needed"; // Added not_needed
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

      // Include 'not_needed' in the status check
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
      // Revalidation is now handled within selectGift
      const updatedItem = await selectGift(itemId, guestName);
      if (updatedItem) {
        console.log(`GiftList (${filterStatus}): Item ${itemId} selected successfully. Triggering onItemAction.`);
        toast({
          title: "Sucesso!",
          description: `Obrigado, ${guestName}! "${updatedItem.name}" foi reservado com sucesso!`,
          variant: "default",
        });
        onItemAction?.(); // Refresh UI from parent
      } else {
        console.warn(
          `GiftList (${filterStatus}): Failed to select item ${itemId}. It might have been selected by someone else or status changed. Triggering onItemAction to refresh list.`,
        );
        toast({
          title: "Ops!",
          description: "Este item pode não estar mais disponível. A lista será atualizada.",
          variant: "destructive",
        });
        onItemAction?.(); // Refresh UI from parent
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
             {/* Removed selectedBy display for public view */}
          </Badge>
        );
      case "not_needed": // Added case for 'not_needed'
        return (
          <Badge
            variant="destructive"
            className="bg-destructive/80 text-destructive-foreground"
          >
            <X className="mr-1 h-3 w-3" /> Não Precisa
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

  const isInitialLoad = items === null; // Check if items is strictly null (initial load)
  const hasLoadedItems = Array.isArray(items); // Check if items is an array (loaded)
  const hasNoItemsInDatabase = hasLoadedItems && items.length === 0; // Loaded but empty array
  const isFilteredListEmpty = hasLoadedItems && filteredItems.length === 0 && !hasNoItemsInDatabase; // Loaded, not globally empty, but filter makes it empty

  console.log(`GiftList (${filterStatus}): Rendering check - isInitialLoad: ${isInitialLoad}, hasLoadedItems: ${hasLoadedItems}, hasNoItemsInDatabase: ${hasNoItemsInDatabase}, isFilteredListEmpty: ${isFilteredListEmpty}`);

  if (isInitialLoad) {
    console.log(`GiftList (${filterStatus}): Parent is likely loading (items prop is null). Rendering loader.`);
    // Render skeleton loaders
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => ( // Show 6 skeletons
                <Card key={index} className="flex flex-col justify-between shadow-md rounded-lg overflow-hidden bg-card">
                    <CardHeader>
                        <Skeleton className="h-6 w-3/4 mb-2" /> {/* Title skeleton */}
                        <Skeleton className="h-4 w-full" /> {/* Description skeleton */}
                        <Skeleton className="h-4 w-1/4 mt-2" /> {/* Category skeleton */}
                    </CardHeader>
                    <CardContent className="pt-4">
                         <Skeleton className="aspect-square w-full rounded-md" /> {/* Image skeleton */}
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-4 border-t">
                        <Skeleton className="h-5 w-24" /> {/* Status badge skeleton */}
                        <Skeleton className="h-9 w-28" /> {/* Button skeleton */}
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
  }

  if (hasNoItemsInDatabase) {
    console.log(`GiftList (${filterStatus}): Rendering empty state (database has no items).`);
    return (
      <div className="text-center pt-16 pb-10 text-muted-foreground">
        <Gift className="mx-auto h-12 w-12 mb-4" />
        <p>A lista de presentes ainda está vazia.</p>
      </div>
    );
  }

  if (isFilteredListEmpty) {
    let emptyMessage = "Nenhum item encontrado com os filtros selecionados.";
    if (filterStatus === "available")
      emptyMessage = "Todos os presentes disponíveis já foram escolhidos.";
    if (filterStatus === "selected")
      emptyMessage = "Nenhum presente foi selecionado ainda.";
    if (filterStatus === "not_needed") // Added message for 'not_needed'
      emptyMessage = "Nenhum item marcado como 'Não Precisa'.";

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => {
          // Log each item being rendered
          // console.log(`GiftList (${filterStatus}): Rendering item card for:`, item.id, item.name, item.status);
          return (
            <Card
              key={item.id}
              className="flex flex-col justify-between shadow-md rounded-lg overflow-hidden animate-fade-in bg-card"
            >
                {/* Image Section */}
                <div className="relative aspect-square w-full bg-muted/50 overflow-hidden">
                    {item.imageUrl ? (
                        <Image
                            src={item.imageUrl}
                            alt={`Imagem de ${item.name}`}
                            fill
                            style={{ objectFit: 'cover' }}
                            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            unoptimized={item.imageUrl.startsWith('data:image/')}
                            priority={filterStatus === 'all'} // Prioritize images in 'all' tab
                            data-ai-hint="baby gift item"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full w-full">
                            <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
                        </div>
                    )}
                </div>

              <CardHeader className="pt-4"> {/* Adjusted padding */}
                <CardTitle className="text-lg">{item.name}</CardTitle>
                {item.description && (
                  <CardDescription className="text-sm">{item.description}</CardDescription>
                )}
                <div className="flex items-center text-sm text-muted-foreground pt-1">
                  <Tag className="mr-1 h-4 w-4" /> {item.category}
                </div>
              </CardHeader>
              {/* Removed empty CardContent */}
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
                  {/* No action button needed for 'selected' or 'not_needed' items in the public view */}
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
