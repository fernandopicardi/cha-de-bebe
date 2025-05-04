
'use server'; // Mark module for server-side execution if potentially used in Server Actions

// Define interfaces for better type safety
export interface GiftItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  status: 'available' | 'selected' | 'not_needed'; // Removed 'pending_suggestion'
  selectedBy?: string; // Name of the guest who selected the item (or suggested and self-selected)
  selectionDate?: Date; // Optional: Track when item was selected/added
  // Removed suggestedBy and suggestionDate as they are redundant now
}

// Define interface for suggestion data (used when adding a new item directly)
export interface SuggestionData {
  itemName: string;
  itemDescription?: string;
  suggesterName: string; // This person is now the 'selector'
}


// In-memory store for gift items
// Initialize with some mock data (updated interface)
let giftItems: GiftItem[] = [
  { id: '1', name: 'Body Manga Curta (RN)', category: 'Roupas', status: 'available', description: 'Pacote com 3 unidades, cores neutras.' },
  { id: '2', name: 'Fraldas Pampers (P)', category: 'Higiene', status: 'available', description: 'Pacote grande.' },
  { id: '3', name: 'Mamadeira Anti-cólica', category: 'Alimentação', status: 'selected', selectedBy: 'Maria Silva', selectionDate: new Date(2024, 6, 10) },
  { id: '4', name: 'Móbile Musical', category: 'Brinquedos', status: 'available' },
  { id: '5', name: 'Lenços Umedecidos', category: 'Higiene', status: 'selected', selectedBy: 'João Pereira', selectionDate: new Date(2024, 6, 11) },
  { id: '6', name: 'Termômetro Digital', category: 'Higiene', status: 'not_needed' }, // Example of not_needed status
  { id: '7', name: 'Macacão Pijama (M)', category: 'Roupas', status: 'available', description: 'Algodão macio.' },
  { id: '8', name: 'Chupeta Calmante', category: 'Outros', status: 'available'},
  { id: '9', name: 'Cadeirinha de Descanso', category: 'Outros', status: 'selected', selectedBy: 'Ana Costa', selectionDate: new Date(2024, 6, 12)},
  { id: '10', name: 'Pomada para Assaduras', category: 'Higiene', status: 'available', description: 'Marca Bepantol Baby ou similar.'},
];

// --- Event Settings ---
export interface EventSettings {
  title: string;
  babyName?: string; // Added baby name
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  location: string;
  address: string;
  welcomeMessage: string;
  duration?: number; // Optional duration in minutes
}

// In-memory store for event settings
let eventSettings: EventSettings = {
  title: 'Chá de Bebê!', // Admin can change this
  babyName: 'Nosso Bebê', // Default baby name, admin can change
  date: '2024-12-15',
  time: '14:00',
  location: 'Salão de Festas Felicidade',
  address: 'Rua Exemplo, 123, Bairro Alegre, Cidade Feliz - SP',
  welcomeMessage: 'Sua presença é o nosso maior presente! Para aqueles que desejam nos presentear, criamos esta lista como um guia carinhoso. Sinta-se à vontade!', // Updated default welcome message
  duration: 180,
};

/**
 * Retrieves the current event settings.
 * @returns A promise resolving to the event settings object.
 */
export async function getEventSettings(): Promise<EventSettings> {
  // Simulate async if needed: await new Promise(resolve => setTimeout(resolve, 0));
  return { ...eventSettings }; // Return a copy
}

/**
 * (Admin) Updates the event settings.
 * @param updates Partial data containing the updates for event settings.
 * @returns A promise resolving to the updated event settings object.
 */
export async function updateEventSettings(updates: Partial<EventSettings>): Promise<EventSettings> {
  eventSettings = {
    ...eventSettings,
    ...updates,
  };
  console.log('Event settings updated by admin.');
  return { ...eventSettings }; // Return a copy of the updated settings
}


// --- Gift Item Functions ---

/**
 * Retrieves the current list of gift items.
 * Simulates async operation if needed in future, but currently synchronous.
 * @returns A promise resolving to the array of gift items.
 */
export async function getGifts(): Promise<GiftItem[]> {
  // Simulate async if needed: await new Promise(resolve => setTimeout(resolve, 0));
  return [...giftItems]; // Return a copy to prevent direct modification
}

/**
 * Selects a gift item by updating its status and recording the selector.
 * @param itemId The ID of the item to select.
 * @param guestName The name of the guest selecting the item.
 * @returns A promise resolving to the updated item or null if not found/unavailable.
 */
export async function selectGift(itemId: string, guestName: string): Promise<GiftItem | null> {
  const itemIndex = giftItems.findIndex(item => item.id === itemId && item.status === 'available');
  if (itemIndex === -1) {
    console.warn(`Item ${itemId} not found or not available for selection.`);
    return null; // Item not found or not available
  }

  const updatedItem = {
    ...giftItems[itemIndex],
    status: 'selected' as const, // Ensure correct type
    selectedBy: guestName,
    selectionDate: new Date(),
  };

  giftItems = [
    ...giftItems.slice(0, itemIndex),
    updatedItem,
    ...giftItems.slice(itemIndex + 1),
  ];

  console.log(`Item ${itemId} selected by ${guestName}.`);
  return updatedItem;
}

/**
 * (Admin Only) Marks an available gift item as 'not_needed'.
 * This function is intended for admin use to manage the list, not for guests.
 * @param itemId The ID of the item to mark.
 * @returns A promise resolving to the updated item or null if not found/unavailable.
 */
export async function markGiftAsNotNeeded(itemId: string): Promise<GiftItem | null> {
    const itemIndex = giftItems.findIndex(item => item.id === itemId && item.status === 'available');
    if (itemIndex === -1) {
        console.warn(`Item ${itemId} not found or not available to be marked as not needed.`);
        return null;
    }

    const updatedItem = {
        ...giftItems[itemIndex],
        status: 'not_needed' as const,
        selectedBy: undefined, // Clear potential selection info if any inconsistency occurred
        selectionDate: undefined,
    };

    giftItems = [
        ...giftItems.slice(0, itemIndex),
        updatedItem,
        ...giftItems.slice(itemIndex + 1),
    ];

    console.log(`Admin marked item ${itemId} as not needed.`);
    return updatedItem;
}


// --- Suggestion Function (Now Adds Directly) ---

/**
 * Adds a new item directly to the list with 'selected' status,
 * based on user suggestion.
 * @param suggestionData The data for the suggested item.
 * @returns A promise resolving to the newly added item.
 */
export async function addSuggestion(suggestionData: SuggestionData): Promise<GiftItem> {
  const newItem: GiftItem = {
    id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, // Generate a unique ID
    name: suggestionData.itemName,
    description: suggestionData.itemDescription,
    category: 'Outros', // Default category for user-added items, admin can change later
    status: 'selected', // Add directly as selected
    selectedBy: suggestionData.suggesterName, // The suggester is the selector
    selectionDate: new Date(), // Record selection date
  };

  giftItems = [...giftItems, newItem];

  console.log(`Item "${newItem.name}" added and selected by ${newItem.selectedBy}.`);
  return newItem;
}


// --- Admin Functions ---

/**
 * (Admin) Reverts a selected item back to 'available'.
 * @param itemId The ID of the selected item to revert.
 * @returns A promise resolving to the updated item or null if not found/not selected.
 */
export async function revertSelection(itemId: string): Promise<GiftItem | null> {
    const itemIndex = giftItems.findIndex(item => item.id === itemId && (item.status === 'selected' || item.status === 'not_needed')); // Can revert selected or not_needed
    if (itemIndex === -1) {
        console.warn(`Item ${itemId} not found or not in a revertible status.`);
        return null;
    }

    const { selectedBy, selectionDate, ...rest } = giftItems[itemIndex]; // Remove selection details

    const updatedItem = {
        ...rest,
        status: 'available' as const,
    };

     giftItems = [
        ...giftItems.slice(0, itemIndex),
        updatedItem,
        ...giftItems.slice(itemIndex + 1),
    ];

    console.log(`Item ${itemId} reverted to available by admin.`);
    return updatedItem;
}

/**
 * (Admin) Adds a new gift item directly.
 * @param newItemData Data for the new gift (excluding id). Status defaults to available unless specified.
 * @returns A promise resolving to the newly added gift item.
 */
export async function addGift(newItemData: Omit<GiftItem, 'id'>): Promise<GiftItem> {
    const newItem: GiftItem = {
        id: `gift-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, // Generate unique ID
        ...newItemData,
        // Status defaults to 'available' if not provided, otherwise use provided status
        status: newItemData.status || 'available',
    };
    // Clear selection details if status is not 'selected'
    if (newItem.status !== 'selected') {
        newItem.selectedBy = undefined;
        newItem.selectionDate = undefined;
    }
    giftItems = [...giftItems, newItem];
    console.log(`Admin added new gift: ${newItem.name} with status ${newItem.status}`);
    return newItem;
}


/**
 * (Admin) Updates an existing gift item.
 * @param itemId The ID of the item to update.
 * @param updates Partial data containing the updates.
 * @returns A promise resolving to the updated item or null if not found.
 */
export async function updateGift(itemId: string, updates: Partial<Omit<GiftItem, 'id'>>): Promise<GiftItem | null> {
     const itemIndex = giftItems.findIndex(item => item.id === itemId);
     if (itemIndex === -1) {
         console.warn(`Item ${itemId} not found for update by admin.`);
         return null;
     }

     // Ensure read-only fields like 'id' are not overwritten
     const { id, ...restUpdates } = updates;

     const updatedItem: GiftItem = {
         ...giftItems[itemIndex],
         ...restUpdates,
         // Ensure status update is valid, if provided
         ...(updates.status && ['available', 'selected', 'not_needed'].includes(updates.status) && { status: updates.status as GiftItem['status'] }),
     };

      // Clear selection details if status changes FROM 'selected' TO something else
      if (giftItems[itemIndex].status === 'selected' && updatedItem.status !== 'selected') {
          updatedItem.selectedBy = undefined;
          updatedItem.selectionDate = undefined;
      }
      // Clear selection details if status is explicitly set to 'available' or 'not_needed'
      if (updatedItem.status === 'available' || updatedItem.status === 'not_needed') {
          updatedItem.selectedBy = undefined;
          updatedItem.selectionDate = undefined;
      }


      giftItems = [
         ...giftItems.slice(0, itemIndex),
         updatedItem,
         ...giftItems.slice(itemIndex + 1),
     ];

     console.log(`Item ${itemId} updated by admin.`);
     return updatedItem;
}

/**
 * (Admin) Deletes a gift item.
 * @param itemId The ID of the item to delete.
 * @returns A promise resolving to true if successful, false otherwise.
 */
export async function deleteGift(itemId: string): Promise<boolean> {
    const initialLength = giftItems.length;
    giftItems = giftItems.filter(item => item.id !== itemId);
    const success = giftItems.length < initialLength;
    if (success) {
        console.log(`Item ${itemId} deleted by admin.`);
    } else {
        console.warn(`Item ${itemId} not found for deletion by admin.`);
    }
    return success;
}

/**
 * (Admin) Exports gift data to CSV format.
 * @returns A promise resolving to the CSV string.
 */
export async function exportGiftsToCSV(): Promise<string> {
    // Updated headers to remove suggestion columns
    const headers = ['ID', 'Nome', 'Descrição', 'Categoria', 'Status', 'Selecionado Por', 'Data Seleção'];
    const rows = giftItems.map(item => [
        item.id,
        item.name,
        item.description || '',
        item.category,
        item.status,
        item.selectedBy || '',
        item.selectionDate ? item.selectionDate.toLocaleString('pt-BR') : '', // Format date for locale
    ].map(value => `"${String(value).replace(/"/g, '""')}"`) // Escape quotes
     .join(','));

    return [headers.join(','), ...rows].join('\n');
}
