
"use server";

import { revalidatePath } from "next/cache";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc as addFirestoreDoc, // Rename to avoid conflict
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  writeBatch,
  serverTimestamp,
  DocumentReference,
  FirestoreError,
  getDocs,
  WriteBatch,
  CollectionReference,
} from "firebase/firestore";
import { db } from "@/firebase/config"; // Ensure db is imported correctly

// Interface definitions (ensure they are correct)
export interface GiftItem {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  // Allow 'not_needed' status
  status: "available" | "selected" | "not_needed";
  selectedBy?: string | null;
  selectionDate?: string | null; // ISO string date format
  createdAt?: string | null; // ISO string date format
  imageUrl?: string | null; // Optional image URL (data URI or storage URL)
}

export interface SuggestionData {
  itemName: string;
  itemDescription?: string;
  suggesterName: string;
  imageUrl?: string | null; // Image for suggestions too
}

export interface EventSettings {
  id?: string; // Usually 'main'
  title: string;
  babyName?: string | null; // Optional baby name
  date: string; // Format: YYYY-MM-DD
  time: string; // Format: HH:MM
  location: string;
  address: string;
  welcomeMessage: string;
  duration?: number; // Optional duration in minutes
  headerImageUrl?: string | null; // Optional image URL or data URI
}

// Default data (ensure it matches your initial setup needs)
const defaultGiftItems: Omit<GiftItem, "id" | 'createdAt' | 'selectionDate'>[] = [
  { name: "Body Manga Curta (RN)", category: "Roupas", status: "available", description: "Pacote com 3 unidades, cores neutras.", imageUrl: null },
  { name: "Fraldas Pampers (P)", category: "Higiene", status: "available", description: "Pacote grande.", imageUrl: null },
  { name: "Mamadeira Anti-cólica", category: "Alimentação", status: "available", imageUrl: null },
  { name: "Móbile Musical", category: "Brinquedos", status: "available", imageUrl: null },
  { name: "Lenços Umedecidos", category: "Higiene", status: "available", imageUrl: null },
  { name: "Termômetro Digital", category: "Higiene", status: "available", imageUrl: null },
  { name: "Macacão Pijama (M)", category: "Roupas", status: "available", description: "Algodão macio.", imageUrl: null },
  { name: "Chupeta Calmante", category: "Outros", status: "available", imageUrl: null },
  { name: "Cadeirinha de Descanso", category: "Outros", status: "available", imageUrl: null },
  { name: "Pomada para Assaduras", category: "Higiene", status: "available", description: "Marca Bepantol Baby ou similar.", imageUrl: null },
];


const defaultEventSettings: EventSettings = {
  id: 'main', // Explicitly set ID for the single settings document
  title: "Chá de Bebê",
  babyName: null, // Default to null
  date: "2024-12-15", // Example date
  time: "14:00", // Example time
  location: "Salão de Festas Felicidade", // Example location
  address: "Rua Exemplo, 123, Bairro Alegre, Cidade Feliz - SP", // Example address
  welcomeMessage:
    "Sua presença é o nosso maior presente! Esta lista é apenas um guia carinhoso para quem desejar nos presentear. Sinta-se totalmente à vontade, o importante é celebrar conosco!",
  duration: 180, // Default duration 3 hours
  headerImageUrl: null, // Default to no image
};

// Type definitions for Firestore references
const giftsCollectionRef = collection(db, "gifts") as CollectionReference<Omit<GiftItem, 'id'>>;
const settingsCollectionRef = collection(db, "settings");
const settingsDocRef = doc(settingsCollectionRef, "main") as DocumentReference<EventSettings>; // Assuming 'main' is the ID for the single settings document

/**
 * Helper function to map Firestore document data to GiftItem interface.
 * Handles Firestore Timestamps and potential null values.
 */
const giftFromDoc = (docSnapshot: any): GiftItem | null => {
    const data = docSnapshot.data();
    const docId = docSnapshot.id;

    // Basic validation for required fields
    if (!data || !data.name || !data.category || !data.status) {
      console.error(`Firestore Convert: Invalid or missing required fields for gift document ID ${docId}. Data:`, data);
      return null; // Skip invalid documents
    }

    // Map Firestore data to GiftItem structure
    return {
      id: docId,
      name: data.name,
      category: data.category,
      // Ensure status is one of the allowed values
      status: ["available", "selected", "not_needed"].includes(data.status) ? data.status : "available",
      description: data.description ?? null, // Default to null if undefined
      selectedBy: data.selectedBy ?? null, // Default to null if undefined
      // Convert Firestore Timestamp to ISO string safely
      selectionDate: data.selectionDate instanceof Timestamp
        ? data.selectionDate.toDate().toISOString()
        : null,
      createdAt: data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : null,
      imageUrl: data.imageUrl ?? null, // Handle imageUrl, default to null
    };
  };

/**
 * Function to trigger revalidation of Next.js cache for specified paths.
 */
const forceRevalidation = (path: string = "/") => {
    console.log(`Firestore Revalidate: Revalidating path: ${path}...`);
    try {
      // Revalidate the specific path and the admin path layout
      revalidatePath(path, "layout");
      if (path !== '/admin') { // Avoid double revalidation if the path is already /admin
        revalidatePath("/admin", "layout");
      }
      console.log(`Firestore Revalidate: Revalidation calls initiated for ${path} and /admin.`);
    } catch (error) {
      console.error(`Firestore Revalidate: Error during revalidatePath for ${path}:`, error);
    }
  };

/**
 * Initializes Firestore with default settings and gifts if they don't exist.
 * This should ideally run once, perhaps during application startup or a setup script.
 */
export async function initializeFirestoreData(): Promise<void> {
    console.log("Firestore Init: Checking initialization status...");
    try {
      // Check and initialize settings
      const settingsSnap = await getDoc(settingsDocRef);
      if (!settingsSnap.exists()) {
        console.log("Firestore Init: Settings document 'settings/main' not found, initializing...");
        // Ensure default settings have the 'id' if needed for the document path, but don't store it IN the document itself unless required.
        const { id, ...settingsToSave } = defaultEventSettings;
        await setDoc(settingsDocRef, settingsToSave);
        console.log("Firestore Init: Default settings added.");
        forceRevalidation(); // Revalidate after change
      } else {
        console.log("Firestore Init: Settings document 'settings/main' already exists.");
      }

      // Check and initialize gifts
      const giftsQuerySnapshot = await getDocs(query(giftsCollectionRef));
      if (giftsQuerySnapshot.empty) {
        console.log("Firestore Init: Gifts collection empty, initializing defaults...");
        const batch: WriteBatch = writeBatch(db);
        defaultGiftItems.forEach((item) => {
          const docRef = doc(giftsCollectionRef); // Generate a new doc reference
          batch.set(docRef, { ...item, createdAt: serverTimestamp() }); // Add createdAt timestamp
        });
        await batch.commit();
        console.log("Firestore Init: Default gifts added.");
        forceRevalidation(); // Revalidate after change
      } else {
        console.log(`Firestore Init: Gifts collection already contains ${giftsQuerySnapshot.size} items. Skipping default initialization.`);
      }
      console.log("Firestore Init: Initialization check complete.");

    } catch (error) {
      console.error("Firestore Init: Error during initialization check:", error);
      // Handle specific errors like permission denied if necessary
      if ((error as FirestoreError).code === 'permission-denied') {
        console.error("Firestore Init: PERMISSION DENIED during initialization. Check Firestore rules.");
      }
    }
  }


/**
 * Fetches the main event settings from Firestore.
 * Returns default settings if the document doesn't exist or an error occurs.
 */
export const getEventSettings = async (): Promise<EventSettings> => {
    const settingsPath = settingsDocRef.path;
    console.log(`Firestore GET_SETTINGS: Attempting to fetch event settings from path: ${settingsPath}`);
    try {
      const docSnap = await getDoc(settingsDocRef);
      if (docSnap.exists()) {
        console.log(`Firestore GET_SETTINGS: Event settings found at ${settingsPath}.`);
        // Combine ID with fetched data
        const data = docSnap.data() || {};
        return { id: docSnap.id, ...data } as EventSettings;
      } else {
        console.warn(`Firestore GET_SETTINGS: Settings document '${settingsPath}' does not exist. Returning default settings.`);
        // Return a copy of default settings to avoid mutation issues
        return { ...defaultEventSettings };
      }
    } catch (error) {
      console.error(`Firestore GET_SETTINGS: Error fetching event settings from ${settingsPath}:`, error);
      // Check if error is permissions related
       if ((error as any)?.code === 'permission-denied') {
          console.error("Firestore: PERMISSION DENIED fetching event settings. Check Firestore rules.");
       }
      return { ...defaultEventSettings }; // Return defaults on error for resilience
    }
  };

/**
 * Fetches all gift items from Firestore, ordered by creation date descending.
 * Returns an empty array if the collection is empty or an error occurs.
 */
export const getGifts = async (): Promise<GiftItem[]> => {
    console.log("Firestore GET_GIFTS: Fetching gifts from 'gifts' collection, ordered by createdAt desc...");
    try {
      // Query gifts ordered by 'createdAt' timestamp descending
      const q = query(giftsCollectionRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      console.log(`Firestore GET_GIFTS: Query executed. Found ${querySnapshot.size} documents.`);

      if (querySnapshot.empty) {
        console.log("Firestore GET_GIFTS: Gifts collection is empty.");
        return []; // Return empty array if no gifts found
      } else {
        // Map Firestore documents to GiftItem objects using the helper function
        const gifts: GiftItem[] = querySnapshot.docs
          .map(docSnapshot => giftFromDoc(docSnapshot)) // Map and validate each doc
          .filter((item): item is GiftItem => item !== null); // Filter out any null results from invalid docs

        console.log(`Firestore GET_GIFTS: Successfully mapped ${gifts.length} valid gifts.`);
        return gifts;
      }
    } catch (error) {
      console.error("Firestore GET_GIFTS: Error fetching gifts:", error);
       // Check if error is permissions related
       if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED fetching gifts. Check Firestore rules.");
     }
      return []; // Return empty array on error
    }
  };


/**
 * Updates the main event settings document in Firestore.
 * Merges the provided updates with the existing document.
 */
export async function updateEventSettings(
    updates: Partial<EventSettings>,
  ): Promise<EventSettings | null> {
    const settingsPath = settingsDocRef.path;
    // Remove 'id' from updates if present, as it's the document key, not a field
    const { id, ...dataToUpdate } = updates;
    console.log(`Firestore UPDATE_SETTINGS: Updating event settings at ${settingsPath}...`, {
      ...dataToUpdate,
      headerImageUrl: dataToUpdate.headerImageUrl ? dataToUpdate.headerImageUrl.substring(0, 50) + '...' : null // Log truncated URI
    });
    try {
      // Use setDoc with merge: true to update or create if it doesn't exist
      await setDoc(settingsDocRef, dataToUpdate, { merge: true });
      console.log("Firestore UPDATE_SETTINGS: Event settings updated successfully.");
      forceRevalidation(); // Revalidate paths after update
      // Fetch and return the updated settings
      const updatedSettings = await getEventSettings();
      return updatedSettings;
    } catch (error) {
      console.error(`Firestore UPDATE_SETTINGS: Error updating event settings at ${settingsPath}:`, error);
      // Check if error is permissions related
      if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED updating event settings. Check Firestore rules.");
        // Consider throwing a specific error or returning a specific status
      }
      return null; // Indicate failure
    }
  }


/**
 * Marks a gift item as 'selected' by a guest.
 * Updates the status, selectedBy, and selectionDate fields.
 */
export async function selectGift(
    itemId: string,
    guestName: string,
  ): Promise<GiftItem | null> {
    console.log(`Firestore SELECT_GIFT: Selecting gift ${itemId} for ${guestName}...`);
    const itemDocRef = doc(db, "gifts", itemId);
    try {
      // Prepare update data with server timestamp for selectionDate
      const updateData = {
        status: "selected" as const, // Explicitly set status
        selectedBy: guestName,
        selectionDate: serverTimestamp(), // Use server timestamp
      };
      // Update the document
      await updateDoc(itemDocRef, updateData);
      console.log(`Firestore SELECT_GIFT: Gift ${itemId} selected successfully.`);
      forceRevalidation(); // Revalidate paths
      // Fetch and return the updated item data
      const updatedSnap = await getDoc(itemDocRef);
      return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
    } catch (error) {
      console.error(`Firestore SELECT_GIFT: Error selecting gift ${itemId}:`, error);
       // Check if error is permissions related
       if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED selecting gift. Check Firestore rules.");
      } else if ((error as any)?.code === 'not-found') {
        console.error(`Firestore SELECT_GIFT: Gift item with ID ${itemId} not found.`);
      }
      return null; // Indicate failure
    }
  }

/**
 * Adds a new gift item suggested by a user.
 * The item is automatically marked as 'selected' by the suggester.
 */
export async function addSuggestion(
    suggestionData: SuggestionData,
  ): Promise<GiftItem | null> {
    console.log(
      `Firestore ADD_SUGGESTION: Adding suggestion from ${suggestionData.suggesterName}...`,
      { ...suggestionData, imageUrl: suggestionData.imageUrl ? suggestionData.imageUrl.substring(0, 50) + '...' : null } // Log truncated URI
    );

    // Prepare data for the new gift item
    const newItemData = {
      name: suggestionData.itemName.trim(), // Trim whitespace
      description: suggestionData.itemDescription?.trim() || null, // Trim or set null
      category: "Outros", // Default category for suggestions
      status: "selected" as const, // Automatically selected
      selectedBy: suggestionData.suggesterName.trim(),
      selectionDate: serverTimestamp(), // Use server timestamp
      createdAt: serverTimestamp(), // Use server timestamp for creation
      imageUrl: suggestionData.imageUrl || null, // Add image URL
    };

    // Validate essential fields before adding
    if (!newItemData.name || !newItemData.selectedBy) {
        console.error("Firestore ADD_SUGGESTION: Invalid suggestion data - name and suggesterName are required.");
        return null;
    }

    try {
      // Add the new document to the 'gifts' collection
      const docRef = await addFirestoreDoc(giftsCollectionRef, newItemData);
      console.log(
        `Firestore ADD_SUGGESTION: Suggestion added as new gift with ID: ${docRef.id}`
      );
      forceRevalidation(); // Revalidate paths
      // Fetch and return the newly created item data
      const newDocSnap = await getDoc(docRef);
      return newDocSnap.exists() ? giftFromDoc(newDocSnap) : null;
    } catch (error) {
      console.error("Firestore ADD_SUGGESTION: Error adding suggestion:", error);
       // Check if error is permissions related
       if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED adding suggestion. Check Firestore rules.");
      }
      return null; // Indicate failure
    }
  }


// Function to add a new gift item (typically by admin)
export async function addGift(
    giftData: Omit<GiftItem, "id" | "createdAt" | "selectionDate">
): Promise<GiftItem | null> {
    console.log("Firestore ADD_GIFT: Adding new gift item...", {
      ...giftData,
      imageUrl: giftData.imageUrl ? giftData.imageUrl.substring(0, 50) + '...' : null // Log truncated URI
    });

    // Prepare data, ensure `selectedBy` and `selectionDate` are null if status is not 'selected'
    const dataToAdd = {
        ...giftData,
        description: giftData.description?.trim() || null,
        selectedBy: giftData.status === 'selected' ? (giftData.selectedBy?.trim() || "Admin") : null,
        selectionDate: giftData.status === 'selected' ? serverTimestamp() : null,
        createdAt: serverTimestamp(),
        imageUrl: giftData.imageUrl || null, // Include image URL
    };

    // Validate required fields
    if (!dataToAdd.name || !dataToAdd.category || !dataToAdd.status) {
        console.error("Firestore ADD_GIFT: Missing required fields (name, category, status).");
        return null;
    }
    // Ensure selectedBy is present if status is 'selected'
    if (dataToAdd.status === 'selected' && !dataToAdd.selectedBy) {
        console.error("Firestore ADD_GIFT: 'selectedBy' is required when status is 'selected'.");
        return null; // Or default to 'Admin'? Adjust based on requirements.
    }


    try {
        const docRef = await addFirestoreDoc(giftsCollectionRef, dataToAdd);
        console.log(`Firestore ADD_GIFT: Gift added successfully with ID: ${docRef.id}`);
        forceRevalidation(); // Revalidate relevant paths
        const newDocSnap = await getDoc(docRef);
        return newDocSnap.exists() ? giftFromDoc(newDocSnap) : null;
    } catch (error) {
        console.error("Firestore ADD_GIFT: Error adding gift:", error);
         if ((error as any)?.code === 'permission-denied') {
            console.error("Firestore: PERMISSION DENIED adding gift. Check Firestore rules.");
         } else if (error instanceof Error && error.message.includes("Unsupported field value")) {
            console.error("Firestore ADD_GIFT: Invalid data provided.", error);
         }
        return null;
    }
}


/**
 * Updates an existing gift item in Firestore.
 * Allows updating various fields like name, description, category, status, selectedBy.
 */
export async function updateGift(
    itemId: string,
    updates: Partial<Omit<GiftItem, "id" | "createdAt">>,
  ): Promise<GiftItem | null> {
    console.log(`Firestore UPDATE_GIFT: Updating gift ${itemId}...`, {
      ...updates,
      imageUrl: updates.imageUrl ? updates.imageUrl.substring(0, 50) + '...' : null // Log truncated URI
    });
    const itemDocRef = doc(db, "gifts", itemId);

    // Prepare update data, handling potential status changes
    const dataToUpdate: Record<string, any> = { ...updates };

    // If status is changing TO 'selected', set selectionDate
    if (updates.status === 'selected') {
        dataToUpdate.selectionDate = updates.selectionDate instanceof Date ? Timestamp.fromDate(new Date(updates.selectionDate)) : serverTimestamp(); // Allow passing date or use server time
        // Ensure selectedBy is set if status becomes 'selected'
        dataToUpdate.selectedBy = updates.selectedBy?.trim() || "Admin"; // Default if empty
    }
    // If status is changing FROM 'selected' (to available or not_needed), clear selection fields
    else if (updates.status === 'available' || updates.status === 'not_needed') {
        dataToUpdate.selectedBy = null;
        dataToUpdate.selectionDate = null;
    }

    // Trim string fields if they exist in updates
    if (typeof dataToUpdate.name === 'string') dataToUpdate.name = dataToUpdate.name.trim();
    if (typeof dataToUpdate.description === 'string') dataToUpdate.description = dataToUpdate.description.trim() || null;
    if (typeof dataToUpdate.selectedBy === 'string') dataToUpdate.selectedBy = dataToUpdate.selectedBy.trim();
    // Handle image URL (allow setting to null)
    if ('imageUrl' in dataToUpdate) {
        dataToUpdate.imageUrl = dataToUpdate.imageUrl || null;
    }


    // Remove undefined fields to avoid Firestore errors
    Object.keys(dataToUpdate).forEach(key => dataToUpdate[key] === undefined && delete dataToUpdate[key]);

     // Validate status transition logic if needed (e.g., prevent direct available -> not_needed)

    try {
      // Update the document
      await updateDoc(itemDocRef, dataToUpdate);
      console.log(`Firestore UPDATE_GIFT: Gift ${itemId} updated successfully.`);
      forceRevalidation(); // Revalidate paths
      // Fetch and return the updated item data
      const updatedSnap = await getDoc(itemDocRef);
      return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
    } catch (error) {
      console.error(`Firestore UPDATE_GIFT: Error updating gift ${itemId}:`, error);
       if ((error as any)?.code === 'permission-denied') {
          console.error("Firestore: PERMISSION DENIED updating gift. Check Firestore rules.");
       } else if ((error as any)?.code === 'not-found') {
          console.error(`Firestore UPDATE_GIFT: Gift item with ID ${itemId} not found.`);
       } else if (error instanceof Error && error.message.includes("Unsupported field value")) {
            console.error("Firestore UPDATE_GIFT: Invalid data provided for update.", error);
       }
      throw error; // Re-throw error for the calling component to handle
    }
  }


/**
 * Deletes a gift item from Firestore.
 */
export async function deleteGift(itemId: string): Promise<boolean> {
    console.log(`Firestore DELETE_GIFT: Deleting gift ${itemId}...`);
    const itemDocRef = doc(db, "gifts", itemId);
    try {
      // Delete the document
      await deleteDoc(itemDocRef);
      console.log(`Firestore DELETE_GIFT: Gift ${itemId} deleted successfully.`);
      forceRevalidation(); // Revalidate paths
      return true; // Indicate success
    } catch (error) {
      console.error(`Firestore DELETE_GIFT: Error deleting gift ${itemId}:`, error);
       if ((error as any)?.code === 'permission-denied') {
          console.error("Firestore: PERMISSION DENIED deleting gift. Check Firestore rules.");
       }
      return false; // Indicate failure
    }
  }


/**
 * Reverts a gift item's status from 'selected' or 'not_needed' back to 'available'.
 * Clears the selectedBy and selectionDate fields.
 */
export async function revertSelection(itemId: string): Promise<GiftItem | null> {
    console.log(`Firestore REVERT_SELECTION: Reverting selection for gift ${itemId}...`);
    const itemDocRef = doc(db, "gifts", itemId);
    try {
      // Prepare update data to reset status and selection fields
      const updateData = {
        status: "available" as const, // Set status to available
        selectedBy: null, // Clear selectedBy
        selectionDate: null, // Clear selectionDate
      };
      // Update the document
      await updateDoc(itemDocRef, updateData);
      console.log(`Firestore REVERT_SELECTION: Selection for gift ${itemId} reverted successfully.`);
      forceRevalidation(); // Revalidate paths
      // Fetch and return the updated item data
      const updatedSnap = await getDoc(itemDocRef);
      return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
    } catch (error) {
      console.error(`Firestore REVERT_SELECTION: Error reverting selection for gift ${itemId}:`, error);
       if ((error as any)?.code === 'permission-denied') {
          console.error("Firestore: PERMISSION DENIED reverting selection. Check Firestore rules.");
       } else if ((error as any)?.code === 'not-found') {
          console.error(`Firestore REVERT_SELECTION: Gift item with ID ${itemId} not found.`);
       }
      throw error; // Re-throw error for the calling component
    }
  }


/**
 * Marks a gift item as 'not_needed'.
 * Updates status and clears selection fields if it was selected.
 */
export async function markGiftAsNotNeeded(
    itemId: string,
  ): Promise<GiftItem | null> {
    console.log(`Firestore MARK_NOT_NEEDED: Marking gift ${itemId} as not needed...`);
    const itemDocRef = doc(db, "gifts", itemId);
    try {
      // Prepare update data
      const updateData = {
        status: "not_needed" as const, // Set status
        selectedBy: null, // Clear selection info
        selectionDate: null, // Clear selection info
      };
      // Update the document
      await updateDoc(itemDocRef, updateData);
      console.log(`Firestore MARK_NOT_NEEDED: Gift ${itemId} marked as not needed.`);
      forceRevalidation(); // Revalidate paths
      // Fetch and return the updated item data
      const updatedSnap = await getDoc(itemDocRef);
      return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
    } catch (error) {
      console.error(`Firestore MARK_NOT_NEEDED: Error marking gift ${itemId} as not needed:`, error);
      if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED marking gift as not needed. Check Firestore rules.");
     } else if ((error as any)?.code === 'not-found') {
        console.error(`Firestore MARK_NOT_NEEDED: Gift item with ID ${itemId} not found.`);
     }
      throw error; // Re-throw error for the calling component
    }
  }


/**
 * Exports the current gift list data to a CSV formatted string.
 */
export async function exportGiftsToCSV(): Promise<string> {
    console.log("Firestore EXPORT_CSV: Exporting gifts to CSV...");
    try {
      // Fetch the current gifts data
      const currentGifts = await getGifts(); // Assumes getGifts fetches fresh data
      console.log(`Firestore EXPORT_CSV: Fetched ${currentGifts.length} gifts for CSV export.`);

      // Define CSV headers
      const headers = [
        "ID",
        "Nome",
        "Descrição",
        "Categoria",
        "Status",
        "Selecionado Por",
        "Data Seleção",
        "Data Criação",
        "URL da Imagem", // Added Image URL header
      ];

      // Helper function to escape CSV fields correctly
      const escapeCsv = (field: string | number | null | undefined): string => {
        if (field === null || field === undefined) return '""'; // Handle null/undefined
        const stringField = String(field);
        // Quote the field if it contains commas, double quotes, or newlines
        if (stringField.includes('"') || stringField.includes(',') || stringField.includes('\n')) {
          // Escape double quotes within the field by doubling them
          return `"${stringField.replace(/"/g, '""')}"`;
        }
        // Otherwise, just quote the field
        return `"${stringField}"`;
      };

      // Map gift items to CSV rows
      const rows = currentGifts.map((item) => {
        if (!item || typeof item !== 'object') {
          console.warn("Firestore EXPORT_CSV: Skipping invalid item during CSV generation:", item);
          return ""; // Skip invalid items
        }

        // Format dates safely
        let selectionDateStr = "";
        if (item.selectionDate) {
          try {
            const date = new Date(item.selectionDate);
            if (!isNaN(date.getTime())) {
              // Format to locale string (e.g., "dd/mm/yyyy, HH:MM:SS")
              selectionDateStr = date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
            } else {
              console.warn("Firestore EXPORT_CSV: Invalid selection date string for CSV:", item.selectionDate);
            }
          } catch (e) { console.warn("Firestore EXPORT_CSV: Could not parse selection date string for CSV:", item.selectionDate, e); }
        }
        let createdAtStr = "";
        if (item.createdAt) {
          try {
            const date = new Date(item.createdAt);
            if (!isNaN(date.getTime())) {
              // Format to locale string
              createdAtStr = date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
            } else {
              console.warn("Firestore EXPORT_CSV: Invalid creation date string for CSV:", item.createdAt);
            }
          } catch (e) { console.warn("Firestore EXPORT_CSV: Could not parse creation date string for CSV:", item.createdAt, e); }
        }

        // Get optional fields or default to empty string
        const description = item.description ?? "";
        const selectedBy = item.selectedBy ?? "";
        const imageUrl = item.imageUrl ?? ""; // Get image URL

        // Create CSV row array and join with commas
        return [
          escapeCsv(item.id),
          escapeCsv(item.name),
          escapeCsv(description),
          escapeCsv(item.category),
          escapeCsv(item.status),
          escapeCsv(selectedBy),
          escapeCsv(selectionDateStr),
          escapeCsv(createdAtStr),
          escapeCsv(imageUrl), // Add image URL to row
        ].join(",");
      }).filter(row => row !== ""); // Filter out any empty rows from skipped items

      console.log("Firestore EXPORT_CSV: CSV export generated successfully.");
      // Combine headers and rows with newline characters
      const escapedHeaders = headers.map(h => escapeCsv(h)).join(",");
      return [escapedHeaders, ...rows].join("\n");

    } catch (error) {
      console.error("Firestore EXPORT_CSV: Error exporting gifts to CSV:", error);
      throw new Error("Erro ao gerar o arquivo CSV."); // Throw error for user feedback
    }
  }

// Optional: Call initialization if needed, but be cautious about running this on every server start
initializeFirestoreData().catch(err => console.error("Initial Firestore check failed:", err));
