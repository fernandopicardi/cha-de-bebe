'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gift, Check, X, Hourglass, User, Tag } from 'lucide-react'; // Added User and Tag icons
import SelectItemDialog from './select-item-dialog'; // Assume this component exists for selection dialog
import { Skeleton } from '@/components/ui/skeleton';

// Define interfaces for better type safety
interface GiftItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  status: 'available' | 'selected' | 'not_needed';
  selectedBy?: string; // Name of the guest who selected the item
}

// Placeholder data - Replace with actual Firestore fetching logic
const mockGiftItems: GiftItem[] = [
  { id: '1', name: 'Body Manga Curta (RN)', category: 'Roupas', status: 'available', description: 'Pacote com 3 unidades, cores neutras.' },
  { id: '2', name: 'Fraldas Pampers (P)', category: 'Higiene', status: 'available', description: 'Pacote grande.' },
  { id: '3', name: 'Mamadeira Anti-cólica', category: 'Alimentação', status: 'selected', selectedBy: 'Maria Silva' },
  { id: '4', name: 'Móbile Musical', category: 'Brinquedos', status: 'available' },
  { id: '5', name: 'Lenços Umedecidos', category: 'Higiene', status: 'selected', selectedBy: 'João Pereira' },
  { id: '6', name: 'Termômetro Digital', category: 'Higiene', status: 'not_needed' },
  { id: '7', name: 'Macacão Pijama (M)', category: 'Roupas', status: 'available', description: 'Algodão macio.' },
  { id: '8', name: 'Chupeta Calmante', category: 'Outros', status: 'available'},
  { id: '9', name: 'Cadeirinha de Descanso', category: 'Outros', status: 'selected', selectedBy: 'Ana Costa'},
  { id: '10', name: 'Pomada para Assaduras', category: 'Higiene', status: 'available', description: 'Marca Bepantol Baby ou similar.'},
];

interface GiftListProps {
  filterStatus?: 'all' | 'available' | 'selected' | 'not_needed';
  filterCategory?: string;
  showSelectedByName?: boolean; // Prop to control visibility of selector's name on admin page
}

export default function GiftList({
  filterStatus = 'all',
  filterCategory,
  showSelectedByName = false // Default to hiding the name on public page
}: GiftListProps) {
  const [items, setItems] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<GiftItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Simulate fetching data from Firestore
  useEffect(() => {
    setLoading(true);
    // TODO: Replace with actual Firestore query
    // e.g., const unsubscribe = onSnapshot(collection(db, 'gifts'), (snapshot) => { ... });
    setTimeout(() => {
      setItems(mockGiftItems);
      setLoading(false);
    }, 1000); // Simulate network delay

    // Cleanup function for Firestore listener if implemented
    // return () => unsubscribe();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Status filtering logic:
      // If filterStatus is 'not_needed', only show 'not_needed' items.
      // If filterStatus is anything else ('all', 'available', 'selected'), hide 'not_needed' items unless explicitly filtered for.
      // If filterStatus is 'all', show 'available' and 'selected'.
      // If filterStatus is 'available', show only 'available'.
      // If filterStatus is 'selected', show only 'selected'.

      if (filterStatus === 'not_needed') {
        if (item.status !== 'not_needed') return false;
      } else {
        // Hide 'not_needed' for all other filters ('all', 'available', 'selected')
        if (item.status === 'not_needed') return false;
        // Apply specific status filter if not 'all'
        if (filterStatus !== 'all' && item.status !== filterStatus) return false;
      }


      // Apply category filter (if provided)
      const categoryMatch = !filterCategory || item.category.toLowerCase() === filterCategory.toLowerCase();

      return categoryMatch; // Status match is handled above
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

  // Function to update item status locally (simulate Firestore update)
  const handleItemSelectionSuccess = (itemId: string, guestName: string) => {
     // TODO: Add actual Firestore update logic here
     // await updateDoc(doc(db, 'gifts', itemId), { status: 'selected', selectedBy: guestName, selectionDate: serverTimestamp() });
     setItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId ? { ...item, status: 'selected', selectedBy: guestName } : item
      )
    );
  };

  const getStatusBadge = (status: GiftItem['status'], selectedBy?: string) => {
    switch (status) {
      case 'available':
        return <Badge variant="default" className="bg-success text-success-foreground"><Check className="mr-1 h-3 w-3" /> Disponível</Badge>;
      case 'selected':
        // Conditionally display the name based on showSelectedByName prop
        const displayName = showSelectedByName && selectedBy ? ` por ${selectedBy}` : '';
        return (
          <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
            <User className="mr-1 h-3 w-3" /> Selecionado{displayName}
          </Badge>
        );
      case 'not_needed':
        // Display the 'Não Precisa' badge consistently
        return <Badge variant="destructive" className="bg-destructive text-destructive-foreground"><X className="mr-1 h-3 w-3" /> Não Precisa</Badge>;
      default:
        return <Badge variant="outline"><Hourglass className="mr-1 h-3 w-3" /> Indefinido</Badge>;
    }
  };

  if (loading) {
    return (
      // Increased top margin from mt-4 to mt-6
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
     // Customize message based on the filter
     let emptyMessage = "Nenhum item encontrado com os filtros selecionados.";
     if (filterStatus === 'available') emptyMessage = "Todos os presentes disponíveis já foram escolhidos!";
     if (filterStatus === 'selected') emptyMessage = "Nenhum presente foi selecionado ainda.";
     if (filterStatus === 'not_needed') emptyMessage = "Nenhum item marcado como 'Não precisa'.";

    return (
       // Increased top margin from py-10 to pt-16 pb-10
      <div className="text-center pt-16 pb-10 text-muted-foreground">
        <Gift className="mx-auto h-12 w-12 mb-4" />
        <p>{emptyMessage}</p>
        {filterStatus !== 'all' && (
             <Button variant="link" onClick={() => {/* Implement filter reset logic, e.g., using query params or state management */ }}>
                Limpar filtros
            </Button>
        )}
      </div>
    );
  }


  return (
    <>
      {/* Increased top margin from mt-4 to mt-6 */}
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
              {/* Pass selectedBy only if showSelectedByName is true */}
              {getStatusBadge(item.status, item.selectedBy)}
              {/* Only show the button if the item is available */}
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
                 {/* Don't show button for 'selected' or 'not_needed' items on the public page */}
            </CardFooter>
          </Card>
        ))}
      </div>

      {selectedItem && (
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
