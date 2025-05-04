
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gift, Check, X, Hourglass, User, Tag, Ban, Loader2 } from 'lucide-react'; // Removed Lightbulb, Added Ban
import SelectItemDialog from './select-item-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getGifts, selectGift, markGiftAsNotNeeded, type GiftItem } from '@/data/gift-store'; // Added markGiftAsNotNeeded
import { useToast } from '@/hooks/use-toast';

interface GiftListProps {
  filterStatus?: 'all' | 'available' | 'selected' | 'not_needed'; // Removed 'pending_suggestion'
  filterCategory?: string;
  showSelectedByName?: boolean; // Prop to control visibility of selector's name on admin page
  onDataChange?: () => void; // Callback to notify parent (Admin page) of data changes
}

export default function GiftList({
  filterStatus = 'all',
  filterCategory,
  showSelectedByName = false,
  onDataChange
}: GiftListProps) {
  const [items, setItems] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<GiftItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [markingItemId, setMarkingItemId] = useState<string | null>(null); // Track item being marked
  const { toast } = useToast();

  // Fetch initial data
  useEffect(() => {
    async function fetchGifts() {
      setLoading(true);
      try {
        const gifts = await getGifts();
        setItems(gifts);
      } catch (error) {
        console.error("Error fetching gifts:", error);
        // Handle error state if needed
      } finally {
        setLoading(false);
      }
    }
    fetchGifts();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Apply status filter
      if (filterStatus !== 'all' && item.status !== filterStatus) {
        return false;
      }

      // Apply category filter (if provided)
      if (filterCategory && item.category.toLowerCase() !== filterCategory.toLowerCase()) {
          return false;
      }

      return true; // Include item if no filters exclude it
    });
  }, [items, filterStatus, filterCategory]);


  const handleSelectItemClick = (item: GiftItem) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedItem(null);
  };

  // Function to update item status using the store function
  const handleItemSelectionSuccess = async (itemId: string, guestName: string) => {
     try {
       const updatedItem = await selectGift(itemId, guestName);
       if (updatedItem) {
         // Update local state
         setItems(prevItems =>
           prevItems.map(item =>
             item.id === itemId ? updatedItem : item
           )
         );
         onDataChange?.(); // Notify admin page if necessary
       } else {
         // Handle case where item couldn't be selected (e.g., already selected)
         console.warn(`Failed to select item ${itemId}, it might have been selected by someone else.`);
         toast({ title: "Ops!", description: "Este item já foi selecionado. Tente atualizar a página.", variant: "destructive" });
         // Re-fetch to get the latest state
         const currentGifts = await getGifts();
         setItems(currentGifts);
       }
     } catch (error) {
       console.error("Error selecting gift:", error);
       toast({ title: "Erro!", description: "Não foi possível selecionar o presente.", variant: "destructive" });
     }
  };

  // Function to mark an item as 'not needed'
  const handleMarkNotNeededClick = async (itemId: string) => {
    setMarkingItemId(itemId); // Show loading state for this specific button
    try {
      const updatedItem = await markGiftAsNotNeeded(itemId);
      if (updatedItem) {
        // Update local state
        setItems(prevItems =>
          prevItems.map(item =>
            item.id === itemId ? updatedItem : item
          )
        );
        toast({ title: "Atualizado!", description: `"${updatedItem.name}" marcado como 'Não Precisa'.` });
        onDataChange?.(); // Notify admin if needed
      } else {
        console.warn(`Failed to mark item ${itemId} as not needed.`);
        toast({ title: "Ops!", description: "Não foi possível marcar o item. Tente atualizar a página.", variant: "destructive" });
         // Re-fetch to get the latest state
         const currentGifts = await getGifts();
         setItems(currentGifts);
      }
    } catch (error) {
      console.error("Error marking item as not needed:", error);
      toast({ title: "Erro!", description: "Falha ao marcar o item como 'Não Precisa'.", variant: "destructive" });
    } finally {
       setMarkingItemId(null); // Hide loading state
    }
  };


  const getStatusBadge = (status: GiftItem['status'], selectedBy?: string) => {
    switch (status) {
      case 'available':
        return <Badge variant="default" className="bg-success text-success-foreground"><Check className="mr-1 h-3 w-3" /> Disponível</Badge>;
      case 'selected':
        const displayName = showSelectedByName && selectedBy ? ` por ${selectedBy}` : '';
        return (
          <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
            <User className="mr-1 h-3 w-3" /> Selecionado{displayName}
          </Badge>
        );
      case 'not_needed':
        return <Badge variant="destructive" className="bg-destructive/80 text-destructive-foreground"><X className="mr-1 h-3 w-3" /> Não Precisa</Badge>;
      // Removed 'pending_suggestion' case
      default:
        return <Badge variant="outline"><Hourglass className="mr-1 h-3 w-3" /> Indefinido</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {[...Array(6)].map((_, index) => (
           <Card key={index} className="animate-pulse">
             <CardHeader>
               <Skeleton className="h-6 w-3/4" />
               <Skeleton className="h-4 w-1/2" />
             </CardHeader>
             <CardContent>
               <Skeleton className="h-4 w-full" />
             </CardContent>
             <CardFooter className="flex justify-between">
                <Skeleton className="h-8 w-1/4" />
               <Skeleton className="h-10 w-1/3" />
             </CardFooter>
           </Card>
        ))}
      </div>
    );
  }

  if (filteredItems.length === 0 && !loading) {
     let emptyMessage = "Nenhum item encontrado com os filtros selecionados.";
     if (filterStatus === 'available') emptyMessage = "Todos os presentes disponíveis já foram escolhidos ou marcados como 'Não Precisa'!";
     if (filterStatus === 'selected') emptyMessage = "Nenhum presente foi selecionado ainda.";
     if (filterStatus === 'not_needed') emptyMessage = "Nenhum item marcado como 'Não precisa'.";
     // Removed pending_suggestion message

    return (
      <div className="text-center pt-16 pb-10 text-muted-foreground">
        <Gift className="mx-auto h-12 w-12 mb-4" />
        <p>{emptyMessage}</p>
        {/* TODO: Implement filter reset logic or remove button if not needed */}
        {/* {filterStatus !== 'all' && (
             <Button variant="link" onClick={() => {}}>
                Limpar filtros
            </Button>
        )} */}
      </div>
    );
  }


  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {filteredItems.map((item) => (
          <Card key={item.id} className="flex flex-col justify-between shadow-md rounded-lg overflow-hidden animate-fade-in bg-card">
            <CardHeader>
              <CardTitle className="text-lg">{item.name}</CardTitle>
              {item.description && (
                <CardDescription>{item.description}</CardDescription>
              )}
              <div className="flex items-center text-sm text-muted-foreground pt-1">
                <Tag className="mr-1 h-4 w-4"/> {item.category}
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
               {/* Optional: Image placeholder */}
              {/* <Image src={`https://picsum.photos/seed/${item.id}/300/200`} alt={item.name} width={300} height={200} className="rounded-md mb-4" data-ai-hint="baby gift item"/> */}
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-4 border-t">
               {/* Pass selectedBy conditionally based on showSelectedByName */}
               {getStatusBadge(item.status, item.selectedBy)}
               <div className="flex gap-2 flex-wrap justify-end"> {/* Wrap buttons */}
                  {item.status === 'available' && (
                    <>
                      <Button
                         size="sm"
                         variant="outline" // Changed variant
                         className="border-destructive text-destructive hover:bg-destructive/10" // Destructive-like style
                         onClick={() => handleMarkNotNeededClick(item.id)}
                         disabled={markingItemId === item.id} // Disable while marking
                         aria-label={`Marcar ${item.name} como não precisa`}
                      >
                         {markingItemId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                         ) : (
                            <Ban className="h-4 w-4" />
                         )}
                         <span className="ml-1">Não Precisa</span>
                      </Button>
                      <Button
                         size="sm"
                         className="bg-accent text-accent-foreground hover:bg-accent/90 hover:animate-pulse-button"
                         onClick={() => handleSelectItemClick(item)}
                         aria-label={`Selecionar ${item.name}`}
                         disabled={markingItemId === item.id} // Also disable if marking
                      >
                         <Gift className="mr-2 h-4 w-4" /> Escolher
                      </Button>
                    </>
                  )}
                  {/* No buttons for 'selected' or 'not_needed' on public page */}
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      {selectedItem && selectedItem.status === 'available' && ( // Only show dialog for available items
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
