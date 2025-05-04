
'use server'; // Mark module for server-side execution if potentially used in Server Actions

// Define interfaces for better type safety
export interface GiftItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  status: 'available' | 'selected' | 'not_needed' | 'pending_suggestion'; // Added pending status
  selectedBy?: string; // Name of the guest who selected the item
  selectionDate?: Date; // Optional: Track when item was selected
  suggestedBy?: string; // Name of the guest who suggested the item
  suggestionDate?: Date; // Optional: Track when item was suggested
}

// Define interface for suggestion data
export interface SuggestionData {
  itemName: string;
  itemDescription?: string;
  suggesterName: string;
}


// In-memory store for gift items
// Initialize with some mock data
let giftItems: GiftItem[] = [
  { id: '1', name: 'Body Manga Curta (RN)', category: 'Roupas', status: 'available', description: 'Pacote com 3 unidades, cores neutras.' },
  { id: '2', name: 'Fraldas Pampers (P)', category: 'Higiene', status: 'available', description: 'Pacote grande.' },
  { id: '3', name: 'Mamadeira Anti-cólica', category: 'Alimentação', status: 'selected', selectedBy: 'Maria Silva', selectionDate: new Date(2024, 6, 10) },
  { id: '4', name: 'Móbile Musical', category: 'Brinquedos', status: 'available' },
  { id: '5', name: 'Lenços Umedecidos', category: 'Higiene', status: 'selected', selectedBy: 'João Pereira', selectionDate: new Date(2024, 6, 11) },
  { id: '6', name: 'Termômetro Digital', category: 'Higiene', status: 'not_needed' },
  { id: '7', name: 'Macacão Pijama (M)', category: 'Roupas', status: 'available', description: 'Algodão macio.' },
  { id: '8', name: 'Chupeta Calmante', category: 'Outros', status: 'available'},
  { id: '9', name: 'Cadeirinha de Descanso', category: 'Outros', status: 'selected', selectedBy: 'Ana Costa', selectionDate: new Date(2024, 6, 12)},
  { id: '10', name: 'Pomada para Assaduras', category: 'Higiene', status: 'available', description: 'Marca Bepantol Baby ou similar.'},
];

// --- Event Settings ---
export interface EventSettings {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  location: string;
  address: string;
  welcomeMessage: string;
  duration?: number; // Optional duration in minutes
}

// In-memory store for event settings
let eventSettings: EventSettings = {
  title: 'Chá de Bebê!', // Default title, admin can change this
  date: '2024-12-15',
  time: '14:00',
  location: 'Salão de Festas Felicidade',
  address: 'Rua Exemplo, 123, Bairro Alegre, Cidade Feliz - SP',
  welcomeMessage: 'Sua presença é nosso maior presente! Esta lista é apenas um guia para os presentes.',
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

// --- Suggestion Functions ---

/**
 * Adds a new item suggestion to the list with 'pending_suggestion' status.
 * @param suggestionData The data for the suggested item.
 * @returns A promise resolving to the newly added suggestion item.
 */
export async function addSuggestion(suggestionData: SuggestionData): Promise<GiftItem> {
  const newItem: GiftItem = {
    id: `suggestion-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, // Generate a unique ID
    name: suggestionData.itemName,
    description: suggestionData.itemDescription,
    category: 'Sugestão', // Default category for suggestions
    status: 'pending_suggestion',
    suggestedBy: suggestionData.suggesterName,
    suggestionDate: new Date(),
  };

  giftItems = [...giftItems, newItem];

  console.log(`Suggestion "${newItem.name}" added by ${newItem.suggestedBy}.`);
  return newItem;
}


// --- Admin Functions (Placeholders/Examples) ---

/**
 * (Admin) Approves a suggestion, changing its status to 'available'.
 * @param suggestionId The ID of the suggestion item to approve.
 * @returns A promise resolving to the updated item or null if not found/not a suggestion.
 */
export async function approveSuggestion(suggestionId: string): Promise<GiftItem | null> {
    const itemIndex = giftItems.findIndex(item => item.id === suggestionId && item.status === 'pending_suggestion');
    if (itemIndex === -1) {
        console.warn(`Suggestion ${suggestionId} not found or already processed.`);
        return null;
    }

    const updatedItem = {
        ...giftItems[itemIndex],
        status: 'available' as const, // Change status to available
        category: giftItems[itemIndex].category === 'Sugestão' ? 'Outros' : giftItems[itemIndex].category, // Assign a default category or allow admin to set one
    };

     giftItems = [
        ...giftItems.slice(0, itemIndex),
        updatedItem,
        ...giftItems.slice(itemIndex + 1),
    ];

    console.log(`Suggestion ${suggestionId} approved.`);
    return updatedItem;
}

/**
 * (Admin) Rejects a suggestion by removing it.
 * @param suggestionId The ID of the suggestion item to reject.
 * @returns A promise resolving to true if successful, false otherwise.
 */
export async function rejectSuggestion(suggestionId: string): Promise<boolean> {
    const initialLength = giftItems.length;
    giftItems = giftItems.filter(item => !(item.id === suggestionId && item.status === 'pending_suggestion'));
    const success = giftItems.length < initialLength;
    if (success) {
        console.log(`Suggestion ${suggestionId} rejected and removed.`);
    } else {
        console.warn(`Suggestion ${suggestionId} not found or not pending.`);
    }
    return success;
}

/**
 * (Admin) Reverts a selected item back to 'available'.
 * @param itemId The ID of the selected item to revert.
 * @returns A promise resolving to the updated item or null if not found/not selected.
 */
export async function revertSelection(itemId: string): Promise<GiftItem | null> {
    const itemIndex = giftItems.findIndex(item => item.id === itemId && item.status === 'selected');
    if (itemIndex === -1) {
        console.warn(`Item ${itemId} not found or not selected.`);
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

    console.log(`Selection for item ${itemId} reverted.`);
    return updatedItem;
}

/**
 * (Admin) Adds a new gift item directly.
 * @param newItemData Data for the new gift (excluding id, status).
 * @returns A promise resolving to the newly added gift item.
 */
export async function addGift(newItemData: Omit<GiftItem, 'id' | 'status'>): Promise<GiftItem> {
    const newItem: GiftItem = {
        ...newItemData,
        id: `gift-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, // Generate unique ID
        status: 'available', // Default status for admin-added items
    };
    giftItems = [...giftItems, newItem];
    console.log(`Admin added new gift: ${newItem.name}`);
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
         console.warn(`Item ${itemId} not found for update.`);
         return null;
     }

     // Ensure read-only fields like 'id' are not overwritten
     const { id, ...safeUpdates } = updates;

     const updatedItem = {
         ...giftItems[itemIndex],
         ...safeUpdates,
     };

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
        console.warn(`Item ${itemId} not found for deletion.`);
    }
    return success;
}

/**
 * (Admin) Exports gift data to CSV format.
 * @returns A promise resolving to the CSV string.
 */
export async function exportGiftsToCSV(): Promise<string> {
    const headers = ['ID', 'Nome', 'Descrição', 'Categoria', 'Status', 'Selecionado Por', 'Data Seleção', 'Sugerido Por', 'Data Sugestão'];
    const rows = giftItems.map(item => [
        item.id,
        item.name,
        item.description || '',
        item.category,
        item.status,
        item.selectedBy || '',
        item.selectionDate?.toISOString() || '',
        item.suggestedBy || '',
        item.suggestionDate?.toISOString() || ''
    ].map(value => `"${String(value).replace(/"/g, '""')}"`) // Escape quotes
     .join(','));

    return [headers.join(','), ...rows].join('\n');
}

    