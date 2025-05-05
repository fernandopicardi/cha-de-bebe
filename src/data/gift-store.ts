

'use server'; // Mark module for server-side execution if potentially used in Server Actions

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


// In-memory store for gift items
// Initialize with some mock data (updated interface)
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

// In-memory store for event settings
let eventSettings: EventSettings = {
  title: 'Chá de Bebê', // Default title, admin can change
  babyName: null, // Default baby name is null, admin can set it
  date: '2024-12-15',
  time: '14:00',
  location: 'Salão de Festas Felicidade',
  address: 'Rua Exemplo, 123, Bairro Alegre, Cidade Feliz - SP',
  welcomeMessage: 'Sua presença é o nosso maior presente! Esta lista é um guia carinhoso para quem desejar nos presentear, mas sinta-se totalmente à vontade, o importante é celebrar conosco!', // Updated default welcome message
  duration: 180,
  headerImageUrl: null, // Initialize header image URL as null
};

/**
 * Retrieves the current event settings.
 * @returns A promise resolving to the event settings object.
 */
export async function getEventSettings(): Promise<EventSettings> {
  // Simulate async if needed: await new Promise(resolve => setTimeout(resolve, 50));
  // Return a deep copy to prevent mutation of the original object
  return JSON.parse(JSON.stringify(eventSettings));
}

/**
 * (Admin) Updates the event settings.
 * @param updates Partial data containing the updates for event settings.
 * @returns A promise resolving to the updated event settings object.
 */
export async function updateEventSettings(updates: Partial<EventSettings>): Promise<EventSettings> {
   // Simulate async operation
   // await new Promise(resolve => setTimeout(resolve, 100));

   // Ensure that only valid keys from EventSettings are applied
   const validKeys = Object.keys(eventSettings) as (keyof EventSettings)[];
   const filteredUpdates: Partial<EventSettings> = {};

   for (const key of validKeys) {
       if (key in updates) { // Check if the key exists in the updates object
            const value = updates[key];
            // Handle specific cases like babyName and headerImageUrl explicitly
            if (key === 'babyName') {
                filteredUpdates.babyName = (value === '' || value === undefined) ? null : value;
            } else if (key === 'headerImageUrl') {
                // Allow setting to null or a string URL/Data URI
                 filteredUpdates.headerImageUrl = (value === undefined) ? eventSettings.headerImageUrl : value; // Keep old value if undefined is passed, allow null
            } else if (value !== undefined) {
                 // Apply other updates only if they are not undefined
                filteredUpdates[key] = value as any; // Cast needed due to complex types
            }
       }
   }

    // Merge filtered updates into the existing settings
    eventSettings = {
        ...eventSettings,
        ...filteredUpdates,
    };

    console.log('Event settings updated in store:', eventSettings);

    // Revalidate paths to ensure pages using this data are updated
    revalidatePath('/'); // Revalidate home page
    revalidatePath('/admin'); // Revalidate admin page

    // Return a deep copy of the updated settings
    return JSON.parse(JSON.stringify(eventSettings));
}


// --- Gift Item Functions ---

/**
 * Retrieves the current list of gift items.
 * Simulates async operation if needed in future, but currently synchronous.
 * @returns A promise resolving to the array of gift items.
 */
export async function getGifts(): Promise<GiftItem[]> {
  // Simulate async if needed: await new Promise(resolve => setTimeout(resolve, 50));
  return JSON.parse(JSON.stringify(giftItems)); // Return a deep copy to prevent direct modification
}

/**
 * Selects a gift item by updating its status and recording the selector.
 * @param itemId The ID of the item to select.
 * @param guestName The name of the guest selecting the item.
 * @returns A promise resolving to the updated item or null if not found/unavailable.
 */
export async function selectGift(itemId: string, guestName: string): Promise<GiftItem | null> {
  // Simulate async
  // await new Promise(resolve => setTimeout(resolve, 100));
  const itemIndex = giftItems.findIndex(item => item.id === itemId && item.status === 'available');
  if (itemIndex === -1) {
    console.warn(`Item ${itemId} not found or not available for selection.`);
    return null; // Item not found or not available
  }

  const updatedItem: GiftItem = { // Ensure the type is correct
    ...giftItems[itemIndex],
    status: 'selected' as const, // Ensure correct type
    selectedBy: guestName,
    selectionDate: new Date().toISOString(), // Store as ISO string
  };

  giftItems = [
    ...giftItems.slice(0, itemIndex),
    updatedItem,
    ...giftItems.slice(itemIndex + 1),
  ];

  console.log(`Item ${itemId} selected by ${guestName}.`);
  revalidatePath('/'); // Revalidate home page when selection changes
  revalidatePath('/admin'); // Revalidate admin page
  return JSON.parse(JSON.stringify(updatedItem)); // Return a copy
}

/**
 * (Admin Only) Marks an available gift item as 'not_needed'.
 * This function is intended for admin use to manage the list, not for guests.
 * @param itemId The ID of the item to mark.
 * @returns A promise resolving to the updated item or null if not found/unavailable.
 */
export async function markGiftAsNotNeeded(itemId: string): Promise<GiftItem | null> {
    // Simulate async
    // await new Promise(resolve => setTimeout(resolve, 100));
    const itemIndex = giftItems.findIndex(item => item.id === itemId && item.status === 'available');
    if (itemIndex === -1) {
        console.warn(`Admin: Item ${itemId} not found or not available to be marked as not needed.`);
        return null;
    }

    const updatedItem: GiftItem = {
        ...giftItems[itemIndex],
        status: 'not_needed' as const,
        selectedBy: undefined, // Clear selection info
        selectionDate: undefined,
    };

    giftItems = [
        ...giftItems.slice(0, itemIndex),
        updatedItem,
        ...giftItems.slice(itemIndex + 1),
    ];

    console.log(`Admin marked item ${itemId} as not needed.`);
    revalidatePath('/'); // Revalidate home page
    revalidatePath('/admin'); // Revalidate admin page
    return JSON.parse(JSON.stringify(updatedItem)); // Return a copy
}


// --- Suggestion Function (Now Adds Directly) ---

/**
 * Adds a new item directly to the list with 'selected' status,
 * based on user suggestion.
 * @param suggestionData The data for the suggested item.
 * @returns A promise resolving to the newly added item.
 */
export async function addSuggestion(suggestionData: SuggestionData): Promise<GiftItem> {
  // Simulate async
  // await new Promise(resolve => setTimeout(resolve, 100));
  const newItem: GiftItem = {
    id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, // Generate a unique ID
    name: suggestionData.itemName,
    description: suggestionData.itemDescription,
    category: 'Outros', // Default category for user-added items, admin can change later
    status: 'selected', // Add directly as selected
    selectedBy: suggestionData.suggesterName, // The suggester is the selector
    selectionDate: new Date().toISOString(), // Record selection date as ISO string
  };

  giftItems = [...giftItems, newItem];

  console.log(`Item "${newItem.name}" added and selected by ${newItem.selectedBy}.`);
  revalidatePath('/'); // Revalidate home page
  revalidatePath('/admin'); // Revalidate admin page
  return JSON.parse(JSON.stringify(newItem)); // Return a copy
}


// --- Admin Functions ---

/**
 * (Admin) Reverts a selected or 'not_needed' item back to 'available'.
 * @param itemId The ID of the selected item to revert.
 * @returns A promise resolving to the updated item or null if not found/not in a revertible status.
 */
export async function revertSelection(itemId: string): Promise<GiftItem | null> {
    // Simulate async
    // await new Promise(resolve => setTimeout(resolve, 100));
    const itemIndex = giftItems.findIndex(item => item.id === itemId && (item.status === 'selected' || item.status === 'not_needed')); // Can revert selected or not_needed
    if (itemIndex === -1) {
        console.warn(`Admin: Item ${itemId} not found or not in a revertible status.`);
        return null;
    }

    const { selectedBy, selectionDate, ...rest } = giftItems[itemIndex]; // Remove selection details

    const updatedItem: GiftItem = {
        ...rest,
        status: 'available' as const,
        selectedBy: undefined, // Explicitly clear
        selectionDate: undefined, // Explicitly clear
    };

     giftItems = [
        ...giftItems.slice(0, itemIndex),
        updatedItem,
        ...giftItems.slice(itemIndex + 1),
    ];

    console.log(`Item ${itemId} reverted to available by admin.`);
    revalidatePath('/'); // Revalidate home page
    revalidatePath('/admin'); // Revalidate admin page
    return JSON.parse(JSON.stringify(updatedItem)); // Return a copy
}

/**
 * (Admin) Adds a new gift item directly.
 * @param newItemData Data for the new gift (excluding id). Status defaults to available unless specified.
 * @returns A promise resolving to the newly added gift item.
 */
export async function addGift(newItemData: Omit<GiftItem, 'id' | 'selectionDate'> & { selectionDate?: Date | string }): Promise<GiftItem> {
    // Simulate async
    // await new Promise(resolve => setTimeout(resolve, 100));
    const newItem: GiftItem = {
        id: `gift-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, // Generate unique ID
        ...newItemData,
        // Status defaults to 'available' if not provided, otherwise use provided status
        status: newItemData.status || 'available',
        selectionDate: newItemData.selectionDate instanceof Date ? newItemData.selectionDate.toISOString() : newItemData.selectionDate, // Ensure date is string
    };
    // Clear selection details if status is not 'selected'
    if (newItem.status !== 'selected') {
        newItem.selectedBy = undefined;
        newItem.selectionDate = undefined;
    } else if (newItem.status === 'selected' && !newItem.selectionDate) {
        // If adding directly as selected, set selection date if not provided
        newItem.selectionDate = new Date().toISOString();
    }

    giftItems = [...giftItems, newItem];
    console.log(`Admin added new gift: ${newItem.name} with status ${newItem.status}`);
    revalidatePath('/'); // Revalidate home page
    revalidatePath('/admin'); // Revalidate admin page
    return JSON.parse(JSON.stringify(newItem)); // Return a copy
}


/**
 * (Admin) Updates an existing gift item.
 * @param itemId The ID of the item to update.
 * @param updates Partial data containing the updates.
 * @returns A promise resolving to the updated item or null if not found.
 */
export async function updateGift(itemId: string, updates: Partial<Omit<GiftItem, 'id' | 'selectionDate'> & { selectionDate?: Date | string }>): Promise<GiftItem | null> {
     // Simulate async
     // await new Promise(resolve => setTimeout(resolve, 100));
     const itemIndex = giftItems.findIndex(item => item.id === itemId);
     if (itemIndex === -1) {
         console.warn(`Item ${itemId} not found for update by admin.`);
         return null;
     }

     // Get the original item
     const originalItem = giftItems[itemIndex];

     // Ensure read-only fields like 'id' are not overwritten
     const { id, ...restUpdates } = updates;

     // Merge updates with the original item
     let updatedItem: GiftItem = {
         ...originalItem,
         ...restUpdates,
         // Ensure status update is valid, if provided
         ...(updates.status && ['available', 'selected', 'not_needed'].includes(updates.status)
             ? { status: updates.status as GiftItem['status'] }
             : {}),
        // Ensure date is stored as string
        selectionDate: updates.selectionDate instanceof Date ? updates.selectionDate.toISOString() : updates.selectionDate ?? originalItem.selectionDate,
     };

     // Logic for clearing/setting selection details based on status change
     if (updatedItem.status === 'available' || updatedItem.status === 'not_needed') {
         // If status becomes available or not_needed, clear selection details
         updatedItem.selectedBy = undefined;
         updatedItem.selectionDate = undefined;
     } else if (updatedItem.status === 'selected') {
         // If status becomes selected
         if (!originalItem.selectedBy && !updatedItem.selectedBy) {
             // If it wasn't selected before and no selector is provided in update, check if one exists in the update object
             updatedItem.selectedBy = updates.selectedBy || 'Admin'; // Use provided name or default to 'Admin' if still none
         }
         if (!originalItem.selectionDate && !updatedItem.selectionDate) {
             // If it wasn't selected before and no date provided, set current date
             updatedItem.selectionDate = new Date().toISOString();
         } else if (updates.selectedBy && updatedItem.selectedBy !== originalItem.selectedBy) {
            // If the selector name is explicitly changed, update the date
             updatedItem.selectionDate = new Date().toISOString();
         }
     }


      giftItems = [
         ...giftItems.slice(0, itemIndex),
         updatedItem,
         ...giftItems.slice(itemIndex + 1),
     ];

     console.log(`Item ${itemId} updated by admin. New data:`, updatedItem);
     revalidatePath('/'); // Revalidate home page
     revalidatePath('/admin'); // Revalidate admin page
     return JSON.parse(JSON.stringify(updatedItem)); // Return a copy
}

/**
 * (Admin) Deletes a gift item.
 * @param itemId The ID of the item to delete.
 * @returns A promise resolving to true if successful, false otherwise.
 */
export async function deleteGift(itemId: string): Promise<boolean> {
    // Simulate async
    // await new Promise(resolve => setTimeout(resolve, 100));
    const initialLength = giftItems.length;
    giftItems = giftItems.filter(item => item.id !== itemId);
    const success = giftItems.length < initialLength;
    if (success) {
        console.log(`Item ${itemId} deleted by admin.`);
        revalidatePath('/'); // Revalidate home page
        revalidatePath('/admin'); // Revalidate admin page
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
    // Simulate async
    // await new Promise(resolve => setTimeout(resolve, 50));
    // Updated headers to remove suggestion columns
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
            : '', // Format date for locale
    ].map(value => `"${String(value).replace(/"/g, '""')}"`) // Escape quotes
     .join(','));

    return [headers.join(','), ...rows].join('\n');
}
    
