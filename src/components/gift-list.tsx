'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gift, Check, X, Hourglass, User, Tag, Lightbulb } from 'lucide-react'; // Added Lightbulb for suggestions
import SelectItemDialog from './select-item-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getGifts, selectGift, type GiftItem } from '@/data/gift-store'; // Import from store

// Define interface locally if needed, otherwise rely on imported one
// interface GiftItem { ... }


interface GiftListProps {
  filterStatus?: 'all' | 'available' | 'selected' | 'not_needed' | 'pending_suggestion'; // Added pending_suggestion
  filterCategory?: string;
  showSelectedByName?: boolean; // Prop to control visibility of selector's name on admin page
  onDataChange?: () => void; // Callback to notify parent (Admin page) of data changes
}

export default function GiftList({
  filterStatus = 'all',
  filterCategory,
  showSelectedByName = false,
  onDataChange // Receive the callback
}: GiftListProps) {
  const [items, setItems] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true); // Keep loading state for initial fetch
  const [selectedItem, setSelectedItem] = useState<GiftItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
  }, []); // Fetch only once on mount

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Status filtering logic:
      // Show only 'pending_suggestion' if filtered specifically for it.
      // Otherwise, hide 'pending_suggestion' unless filter is 'all' (if admin page wants to show them).
      // Hide 'not_needed' unless filtered specifically for it.
      // Apply other status filters ('all', 'available', 'selected').

      if (filterStatus === 'pending_suggestion') {
          if (item.status !== 'pending_suggestion') return false;
      } else if (filterStatus === 'not_needed') {
        if (item.status !== 'not_needed') return false;
      } else {
         // Hide pending suggestions unless the filter is 'all' (intended for admin view possibly)
         if (item.status === 'pending_suggestion' && filterStatus !== 'all') return false;
         // Hide 'not_needed' for all other filters
         if (item.status === 'not_needed') return false;
        // Apply specific status filter if not 'all'
        if (filterStatus !== 'all' && item.status !== filterStatus) return false;
      }

      // Apply category filter (if provided)
      const categoryMatch = !filterCategory || item.category.toLowerCase() === filterCategory.toLowerCase();

      return categoryMatch;
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
         // Update local state optimistically or re-fetch
         setItems(prevItems =>
           prevItems.map(item =>
             item.id === itemId ? updatedItem : item
           )
         );
         onDataChange?.(); // Notify admin page if necessary
       } else {
         // Handle case where item couldn't be selected (e.g., already selected)
         console.warn(`Failed to select item ${itemId}, it might have been selected by someone else.`);
         // Optionally show a toast to the user
         // Re-fetch to get the latest state
         const currentGifts = await getGifts();
         setItems(currentGifts);
       }
     } catch (error) {
       console.error("Error selecting gift:", error);
       // Handle error state
     }
  };

  const getStatusBadge = (status: GiftItem['status'], selectedBy?: string, suggestedBy?: string) => {
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
        return <Badge variant="destructive" className="bg-destructive text-destructive-foreground"><X className="mr-1 h-3 w-3" /> Não Precisa</Badge>;
      case 'pending_suggestion': // Badge for pending suggestions
        const suggesterName = showSelectedByName && suggestedBy ? ` por ${suggestedBy}` : ''; // Show suggester name on admin?
         return (
             <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                 <Lightbulb className="mr-1 h-3 w-3" /> Sugestão Pendente{suggesterName}
             </Badge>
         );
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
     if (filterStatus === 'available') emptyMessage = "Todos os presentes disponíveis já foram escolhidos!";
     if (filterStatus === 'selected') emptyMessage = "Nenhum presente foi selecionado ainda.";
     if (filterStatus === 'not_needed') emptyMessage = "Nenhum item marcado como 'Não precisa'.";
     if (filterStatus === 'pending_suggestion') emptyMessage = "Nenhuma sugestão pendente.";


    return (
      <div className="text-center pt-16 pb-10 text-muted-foreground">
        <Gift className="mx-auto h-12 w-12 mb-4" />
        <p>{emptyMessage}</p>
        {filterStatus !== 'all' && (
             <Button variant="link" onClick={() => {/* TODO: Implement filter reset logic */ }}>
                Limpar filtros
            </Button>
        )}
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
               {/* Pass selectedBy and suggestedBy conditionally based on showSelectedByName */}
               {getStatusBadge(item.status, item.selectedBy, item.suggestedBy)}
              {item.status === 'available' && (
                <Button
                   size="sm"
                   className="bg-accent text-accent-foreground hover:bg-accent/90 hover:animate-pulse-button"
                   onClick={() => handleSelectItemClick(item)}
                   aria-label={`Selecionar ${item.name}`}
                >
                  <Gift className="mr-2 h-4 w-4" /> Escolher este presente
                </Button>
              )}
                 {/* No button for 'selected', 'not_needed', or 'pending_suggestion' on public page */}
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
