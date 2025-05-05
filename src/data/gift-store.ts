
'use server'; // Mark module for server-side execution

import { revalidatePath } from 'next/cache'; // Import revalidatePath

// Define interfaces for better type safety
export interface GiftItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  status: 'available' | 'selected' | 'not_needed';
  selectedBy?: string; // Name of the guest who selected the item (or suggested and self-selected)
  selectionDate?: Date | string; // Optional: Track when item was selected/added (allow string for serialization)
}

// Define interface for suggestion data (used when adding a new item directly)
export interface SuggestionData {
  itemName: string;
  itemDescription?: string;
  suggesterName: string; // This person is now the 'selector'
}

// ======================================================================
// == WARNING: In-Memory Data Store                                    ==
// ======================================================================
// The data below (`giftItems` and `eventSettings`) is stored ONLY in the
// server's memory. This means:
//   - Data WILL BE LOST when the server restarts (e.g., redeployment, crash).
//   - It's NOT suitable for production use where data persistence is required.
//   - Concurrency issues MIGHT occur under heavy load (multiple requests trying
//     to modify data simultaneously).
//
// For production, replace this with a persistent database solution like
// Firebase Firestore, PostgreSQL, MongoDB, etc.
// ======================================================================

let giftItems: GiftItem[] = [
  { id: '1', name: 'Body Manga Curta (RN)', category: 'Roupas', status: 'available', description: 'Pacote com 3 unidades, cores neutras.' },
  { id: '2', name: 'Fraldas Pampers (P)', category: 'Higiene', status: 'available', description: 'Pacote grande.' },
  { id: '3', name: 'Mamadeira Anti-cólica', category: 'Alimentação', status: 'selected', selectedBy: 'Maria Silva', selectionDate: new Date(2024, 6, 10).toISOString() },
  { id: '4', name: 'Móbile Musical', category: 'Brinquedos', status: 'available' },
  { id: '5', name: 'Lenços Umedecidos', category: 'Higiene', status: 'selected', selectedBy: 'João Pereira', selectionDate: new Date(2024, 6, 11).toISOString() },
  { id: '6', name: 'Termômetro Digital', category: 'Higiene', status: 'not_needed' }, // Example of not_needed status
  { id: '7', name: 'Macacão Pijama (M)', category: 'Roupas', status: 'available', description: 'Algodão macio.' },
  { id: '8', name: 'Chupeta Calmante', category: 'Outros', status: 'available'},
  { id: '9', name: 'Cadeirinha de Descanso', category: 'Outros', status: 'selected', selectedBy: 'Ana Costa', selectionDate: new Date(2024, 6, 12).toISOString()},
  { id: '10', name: 'Pomada para Assaduras', category: 'Higiene', status: 'available', description: 'Marca Bepantol Baby ou similar.'},
];

// --- Event Settings ---
export interface EventSettings {
  title: string;
  babyName?: string | null; // Allow null
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  location: string;
  address: string;
  welcomeMessage: string;
  duration?: number; // Optional duration in minutes
  headerImageUrl?: string | null; // Optional URL/Data URI for the header image
}

// In-memory store for Event Settings (see warning above)
let eventSettings: EventSettings = {
  title: 'Chá de Bebê',
  babyName: null,
  date: '2024-12-15',
  time: '14:00',
  location: 'Salão de Festas Felicidade',
  address: 'Rua Exemplo, 123, Bairro Alegre, Cidade Feliz - SP',
  welcomeMessage: 'Sua presença é o nosso maior presente! Esta lista é um guia carinhoso para quem desejar nos presentear, mas sinta-se totalmente à vontade, o importante é celebrar conosco!',
  duration: 180,
  headerImageUrl: null,
};


/**
 * Helper function to trigger cache revalidation for relevant pages.
 * This ensures that Server Components re-fetch the latest data from the store.
 */
const triggerRevalidation = () => {
  console.log(`[${new Date().toISOString()}] Revalidating paths: '/' and '/admin'`);
  try {
    revalidatePath('/');
    revalidatePath('/admin');
    console.log(`[${new Date().toISOString()}] Revalidation triggered successfully.`);
  } catch (error) {
     console.error(`[${new Date().toISOString()}] Error triggering revalidation:`, error);
     // Handle error appropriately, maybe log it more formally
  }
};


/**
 * Retrieves the current event settings.
 * Returns a deep copy to prevent direct mutation of the store.
 * @returns A promise resolving to the event settings object.
 */
export async function getEventSettings(): Promise<EventSettings> {
  // console.log("getEventSettings called."); // Uncomment for debugging fetch calls
  // Simulate async if needed: await new Promise(resolve => setTimeout(resolve, 50));
  return JSON.parse(JSON.stringify(eventSettings));
}

/**
 * (Admin) Updates the event settings.
 * Modifies the in-memory `eventSettings` object.
 * @param updates Partial data containing the updates for event settings.
 * @returns A promise resolving to the updated event settings object.
 */
export async function updateEventSettings(updates: Partial<EventSettings>): Promise<EventSettings> {
   console.log(`[${new Date().toISOString()}] updateEventSettings called with updates:`, updates);
   // Simulate async operation
   // await new Promise(resolve => setTimeout(resolve, 100));

   const validKeys = Object.keys(eventSettings) as (keyof EventSettings)[];
   const filteredUpdates: Partial<EventSettings> = {};

   for (const key of validKeys) {
       if (Object.prototype.hasOwnProperty.call(updates, key)) { // More robust check
            const value = updates[key];
            if (key === 'babyName') {
                filteredUpdates.babyName = (value === '' || value === undefined || value === null) ? null : value; // Explicitly handle null
            } else if (key === 'headerImageUrl') {
                 filteredUpdates.headerImageUrl = (value === undefined) ? eventSettings.headerImageUrl : value;
            } else if (value !== undefined) {
                filteredUpdates[key] = value as any;
            }
       }
   }

    eventSettings = { ...eventSettings, ...filteredUpdates };

    console.log(`[${new Date().toISOString()}] Event settings updated in store:`, eventSettings);
    triggerRevalidation(); // Revalidate after update

    return JSON.parse(JSON.stringify(eventSettings));
}


// --- Gift Item Functions ---

/**
 * Retrieves the current list of gift items from the in-memory store.
 * Returns a deep copy to prevent direct modification of the store.
 * @returns A promise resolving to the array of gift items.
 */
export async function getGifts(): Promise<GiftItem[]> {
  // console.log("getGifts called."); // Uncomment for debugging fetch calls
  // Simulate async if needed: await new Promise(resolve => setTimeout(resolve, 50));
  return JSON.parse(JSON.stringify(giftItems));
}

/**
 * Selects a gift item by updating its status and recording the selector.
 * Modifies the `giftItems` array.
 * @param itemId The ID of the item to select.
 * @param guestName The name of the guest selecting the item.
 * @returns A promise resolving to the updated item or null if not found/unavailable.
 */
export async function selectGift(itemId: string, guestName: string): Promise<GiftItem | null> {
  console.log(`[${new Date().toISOString()}] selectGift called for item ${itemId} by ${guestName}`);
  // Simulate async
  // await new Promise(resolve => setTimeout(resolve, 100));
  const itemIndex = giftItems.findIndex(item => item.id === itemId && item.status === 'available');
  if (itemIndex === -1) {
    console.warn(`[${new Date().toISOString()}] Item ${itemId} not found or not available for selection.`);
    triggerRevalidation(); // Revalidate even if selection failed, as list might need update for others
    return null;
  }

  const updatedItem: GiftItem = {
    ...giftItems[itemIndex],
    status: 'selected' as const,
    selectedBy: guestName,
    selectionDate: new Date().toISOString(),
  };

  giftItems = [
    ...giftItems.slice(0, itemIndex),
    updatedItem,
    ...giftItems.slice(itemIndex + 1),
  ];

  console.log(`[${new Date().toISOString()}] Item ${itemId} selected by ${guestName}. Total items: ${giftItems.length}`);
  triggerRevalidation(); // Revalidate after successful update
  return JSON.parse(JSON.stringify(updatedItem));
}

/**
 * (Admin Only) Marks an available gift item as 'not_needed'.
 * Modifies the `giftItems` array.
 * @param itemId The ID of the item to mark.
 * @returns A promise resolving to the updated item or null if not found/unavailable.
 */
export async function markGiftAsNotNeeded(itemId: string): Promise<GiftItem | null> {
    console.log(`[${new Date().toISOString()}] markGiftAsNotNeeded called for item ${itemId}`);
    // Simulate async
    // await new Promise(resolve => setTimeout(resolve, 100));
    const itemIndex = giftItems.findIndex(item => item.id === itemId && item.status === 'available');
    if (itemIndex === -1) {
        console.warn(`[${new Date().toISOString()}] Admin: Item ${itemId} not found or not available to be marked as not needed.`);
        return null; // Don't revalidate if item wasn't found/valid to change
    }

    const updatedItem: GiftItem = {
        ...giftItems[itemIndex],
        status: 'not_needed' as const,
        selectedBy: undefined,
        selectionDate: undefined,
    };

    giftItems = [
        ...giftItems.slice(0, itemIndex),
        updatedItem,
        ...giftItems.slice(itemIndex + 1),
    ];

    console.log(`[${new Date().toISOString()}] Admin marked item ${itemId} as not needed. Total items: ${giftItems.length}`);
    triggerRevalidation();
    return JSON.parse(JSON.stringify(updatedItem));
}


// --- Suggestion Function (Now Adds Directly) ---

/**
 * Adds a new item directly to the list with 'selected' status,
 * based on user suggestion. Modifies the `giftItems` array.
 * @param suggestionData The data for the suggested item.
 * @returns A promise resolving to the newly added item.
 */
export async function addSuggestion(suggestionData: SuggestionData): Promise<GiftItem> {
  console.log(`[${new Date().toISOString()}] addSuggestion called by ${suggestionData.suggesterName} for item "${suggestionData.itemName}"`);
  // Simulate async
  // await new Promise(resolve => setTimeout(resolve, 100));
  const newItem: GiftItem = {
    id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: suggestionData.itemName,
    description: suggestionData.itemDescription,
    category: 'Outros',
    status: 'selected',
    selectedBy: suggestionData.suggesterName,
    selectionDate: new Date().toISOString(),
  };

  giftItems = [...giftItems, newItem]; // Appends the new item

  console.log(`[${new Date().toISOString()}] Item "${newItem.name}" added and selected by ${newItem.selectedBy}. Total items: ${giftItems.length}`);
  triggerRevalidation();
  return JSON.parse(JSON.stringify(newItem));
}


// --- Admin Functions ---

/**
 * (Admin) Reverts a selected or 'not_needed' item back to 'available'.
 * Modifies the `giftItems` array.
 * @param itemId The ID of the selected item to revert.
 * @returns A promise resolving to the updated item or null if not found/not in a revertible status.
 */
export async function revertSelection(itemId: string): Promise<GiftItem | null> {
    console.log(`[${new Date().toISOString()}] revertSelection called for item ${itemId}`);
    // Simulate async
    // await new Promise(resolve => setTimeout(resolve, 100));
    const itemIndex = giftItems.findIndex(item => item.id === itemId && (item.status === 'selected' || item.status === 'not_needed'));
    if (itemIndex === -1) {
        console.warn(`[${new Date().toISOString()}] Admin: Item ${itemId} not found or not in a revertible status.`);
        return null; // Don't revalidate if item wasn't found/valid to change
    }

    const { selectedBy, selectionDate, ...rest } = giftItems[itemIndex];

    const updatedItem: GiftItem = {
        ...rest,
        status: 'available' as const,
        selectedBy: undefined,
        selectionDate: undefined,
    };

     giftItems = [
        ...giftItems.slice(0, itemIndex),
        updatedItem,
        ...giftItems.slice(itemIndex + 1),
    ];

    console.log(`[${new Date().toISOString()}] Item ${itemId} reverted to available by admin. Total items: ${giftItems.length}`);
    triggerRevalidation();
    return JSON.parse(JSON.stringify(updatedItem));
}

/**
 * (Admin) Adds a new gift item directly.
 * Modifies the `giftItems` array.
 * @param newItemData Data for the new gift (excluding id). Status defaults to available unless specified.
 * @returns A promise resolving to the newly added gift item.
 */
export async function addGift(newItemData: Omit<GiftItem, 'id' | 'selectionDate'> & { selectionDate?: Date | string }): Promise<GiftItem> {
    console.log(`[${new Date().toISOString()}] addGift called with data:`, newItemData);
    // Simulate async
    // await new Promise(resolve => setTimeout(resolve, 100));
    const newItem: GiftItem = {
        id: `gift-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...newItemData,
        status: newItemData.status || 'available',
        selectionDate: newItemData.selectionDate instanceof Date ? newItemData.selectionDate.toISOString() : newItemData.selectionDate,
    };
    if (newItem.status !== 'selected') {
        newItem.selectedBy = undefined;
        newItem.selectionDate = undefined;
    } else if (newItem.status === 'selected' && !newItem.selectionDate) {
        newItem.selectionDate = new Date().toISOString();
    }

    giftItems = [...giftItems, newItem]; // Appends the new item
    console.log(`[${new Date().toISOString()}] Admin added new gift: ${newItem.name} with status ${newItem.status}. Total items: ${giftItems.length}`);
    triggerRevalidation();
    return JSON.parse(JSON.stringify(newItem));
}


/**
 * (Admin) Updates an existing gift item.
 * Modifies the `giftItems` array.
 * @param itemId The ID of the item to update.
 * @param updates Partial data containing the updates.
 * @returns A promise resolving to the updated item or null if not found.
 */
export async function updateGift(itemId: string, updates: Partial<Omit<GiftItem, 'id' | 'selectionDate'> & { selectionDate?: Date | string }>): Promise<GiftItem | null> {
     console.log(`[${new Date().toISOString()}] updateGift called for item ${itemId} with updates:`, updates);
     // Simulate async
     // await new Promise(resolve => setTimeout(resolve, 100));
     const itemIndex = giftItems.findIndex(item => item.id === itemId);
     if (itemIndex === -1) {
         console.warn(`[${new Date().toISOString()}] Item ${itemId} not found for update by admin.`);
         return null; // Don't revalidate if item wasn't found
     }

     const originalItem = giftItems[itemIndex];
     const { id, ...restUpdates } = updates;

     let updatedItem: GiftItem = {
         ...originalItem,
         ...restUpdates,
         ...(updates.status && ['available', 'selected', 'not_needed'].includes(updates.status)
             ? { status: updates.status as GiftItem['status'] }
             : {}),
        selectionDate: updates.selectionDate instanceof Date ? updates.selectionDate.toISOString() : updates.selectionDate ?? originalItem.selectionDate,
     };

     if (updatedItem.status === 'available' || updatedItem.status === 'not_needed') {
         updatedItem.selectedBy = undefined;
         updatedItem.selectionDate = undefined;
     } else if (updatedItem.status === 'selected') {
         if (!originalItem.selectedBy && !updatedItem.selectedBy) {
             updatedItem.selectedBy = updates.selectedBy || 'Admin';
         }
         if (!originalItem.selectionDate && !updatedItem.selectionDate) {
             updatedItem.selectionDate = new Date().toISOString();
         } else if (updates.selectedBy && updatedItem.selectedBy !== originalItem.selectedBy) {
            updatedItem.selectionDate = new Date().toISOString();
         }
     }


      giftItems = [
         ...giftItems.slice(0, itemIndex),
         updatedItem,
         ...giftItems.slice(itemIndex + 1),
     ];

     console.log(`[${new Date().toISOString()}] Item ${itemId} updated by admin. New data:`, updatedItem);
     triggerRevalidation();
     return JSON.parse(JSON.stringify(updatedItem));
}

/**
 * (Admin) Deletes a gift item.
 * Modifies the `giftItems` array.
 * @param itemId The ID of the item to delete.
 * @returns A promise resolving to true if successful, false otherwise.
 */
export async function deleteGift(itemId: string): Promise<boolean> {
    console.log(`[${new Date().toISOString()}] deleteGift called for item ${itemId}`);
    // Simulate async
    // await new Promise(resolve => setTimeout(resolve, 100));
    const initialLength = giftItems.length;
    giftItems = giftItems.filter(item => item.id !== itemId);
    const success = giftItems.length < initialLength;
    if (success) {
        console.log(`[${new Date().toISOString()}] Item ${itemId} deleted by admin. Total items: ${giftItems.length}`);
        triggerRevalidation();
    } else {
        console.warn(`[${new Date().toISOString()}] Item ${itemId} not found for deletion by admin.`);
    }
    return success;
}

/**
 * (Admin) Exports gift data to CSV format.
 * Retrieves data using `getGifts`.
 * @returns A promise resolving to the CSV string.
 */
export async function exportGiftsToCSV(): Promise<string> {
    console.log(`[${new Date().toISOString()}] exportGiftsToCSV called`);
    // Simulate async
    // await new Promise(resolve => setTimeout(resolve, 50));
    const headers = ['ID', 'Nome', 'Descrição', 'Categoria', 'Status', 'Selecionado Por', 'Data Seleção'];
    const currentGifts = await getGifts(); // Fetch current data
    const rows = currentGifts.map(item => [
        item.id,
        item.name,
        item.description || '',
        item.category,
        item.status,
        item.selectedBy || '',
        item.selectionDate
            ? new Date(item.selectionDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short'})
            : '',
    ].map(value => `"${String(value).replace(/"/g, '""')}"`)
     .join(','));

    console.log(`[${new Date().toISOString()}] CSV export generated with ${rows.length} rows.`);
    return [headers.join(','), ...rows].join('\n');
}

// Example: Function to log the current state of the store (for debugging)
export async function logCurrentStoreState() {
    console.log("--- Current In-Memory Store State ---");
    console.log("Event Settings:", JSON.stringify(eventSettings, null, 2)); // Pretty print
    console.log("Gift Items:", JSON.stringify(giftItems, null, 2)); // Pretty print
    console.log("-------------------------------------");
}
