"use server";

import { revalidatePath } from "next/cache";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  writeBatch,
  serverTimestamp, // Use serverTimestamp for createdAt consistency
  DocumentReference, // Import type
  FirestoreError, // Import type
  getDocs,
  WriteBatch, // Import WriteBatch type
} from "firebase/firestore";
import { db } from "@/firebase/config"; // Import Firestore instance

// Data Interfaces
export interface GiftItem {
  id: string; // Firestore document ID
  name: string;
  description?: string | null; // Allow null
  category: string;
  status: "available" | "selected" | "not_needed";
  selectedBy?: string | null; // Allow null
  selectionDate?: Timestamp | string | null; // Use Firestore Timestamp for dates, allow null
  createdAt?: Timestamp | string | null; // Optional: Track creation time, allow null
}

export interface SuggestionData {
  itemName: string;
  itemDescription?: string;
  suggesterName: string;
}

export interface EventSettings {
  // Using a fixed ID 'main' for the settings document
  title: string;
  babyName?: string | null;
  date: string;
  time: string;
  location: string;
  address: string;
  welcomeMessage: string;
  duration?: number;
  headerImageUrl?: string | null; // Store image URL (or handle uploads separately if needed)
}

// Default Data (used for initial setup if Firestore is empty)
const defaultGiftItems: Omit<GiftItem, "id">[] = [
    { name: "Body Manga Curta (RN)", category: "Roupas", status: "available", description: "Pacote com 3 unidades, cores neutras." },
    { name: "Fraldas Pampers (P)", category: "Higiene", status: "available", description: "Pacote grande." },
    { name: "Mamadeira Anti-cólica", category: "Alimentação", status: "available" },
    { name: "Móbile Musical", category: "Brinquedos", status: "available" },
    { name: "Lenços Umedecidos", category: "Higiene", status: "available" },
    { name: "Termômetro Digital", category: "Higiene", status: "available" },
    { name: "Macacão Pijama (M)", category: "Roupas", status: "available", description: "Algodão macio." },
    { name: "Chupeta Calmante", category: "Outros", status: "available" },
    { name: "Cadeirinha de Descanso", category: "Outros", status: "available" },
    { name: "Pomada para Assaduras", category: "Higiene", status: "available", description: "Marca Bepantol Baby ou similar." },
];

const defaultEventSettings: EventSettings = {
  title: "Chá de Bebê",
  babyName: null,
  date: "2024-12-15",
  time: "14:00",
  location: "Salão de Festas Felicidade",
  address: "Rua Exemplo, 123, Bairro Alegre, Cidade Feliz - SP",
  welcomeMessage:
    "Sua presença é o nosso maior presente! Esta lista é um guia carinhoso para quem desejar nos presentear, mas sinta-se totalmente à vontade, o importante é celebrar conosco!",
  duration: 180,
  headerImageUrl: null,
};

// Firestore Collection References
const giftsCollection = collection(db, "gifts");
const settingsDocRef = doc(db, "settings", "main") as DocumentReference<EventSettings>;

// Helper function to convert Firestore Timestamps in gift items
const giftFromDoc = (docSnapshot: any): GiftItem => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    name: data.name || "Nome Indefinido", // Add default for name
    category: data.category || "Outros", // Add default for category
    status: data.status || "available", // Add default for status
    description: data.description || null,
    selectedBy: data.selectedBy || null,
    selectionDate: data.selectionDate instanceof Timestamp
        ? data.selectionDate.toDate().toISOString()
        : data.selectionDate || null, // Keep string if already string, fallback to null
    createdAt: data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : data.createdAt || null, // Keep string if already string, fallback to null
  };
};


// Function to force revalidation
const forceRevalidation = () => {
  console.log("Revalidating paths: / and /admin");
  revalidatePath("/", "layout"); // Revalidate home page and layout
  revalidatePath("/admin", "layout"); // Revalidate admin page and layout
};

// --- Firestore Data Access Functions ---

/**
 * Initializes Firestore with default data if collections are empty.
 * Ensures settings document exists.
 */
export async function initializeFirestoreData(): Promise<void> {
  console.log("Firestore: Checking initialization status...");
  try {
    // Check settings
    const settingsSnap = await getDoc(settingsDocRef);
    if (!settingsSnap.exists()) {
      console.log("Firestore: Settings document not found, initializing...");
      await setDoc(settingsDocRef, defaultEventSettings);
      console.log("Firestore: Default settings added.");
    } else {
        // Merge defaults with existing settings to ensure all fields are present
        const existingSettings = settingsSnap.data();
        const mergedSettings = { ...defaultEventSettings, ...existingSettings };
        // Only write if there are missing default fields
        if (JSON.stringify(existingSettings) !== JSON.stringify(mergedSettings)) {
            console.log("Firestore: Merging default settings with existing document...");
            await setDoc(settingsDocRef, mergedSettings, { merge: true });
            console.log("Firestore: Settings document updated with defaults.");
        } else {
             console.log("Firestore: Settings document already exists and is complete.");
        }
    }

    // Check gifts (only add if completely empty)
    const giftsQuery = query(giftsCollection); // No ordering needed, just check existence
    const giftsSnapshot = await getDocs(giftsQuery);
    if (giftsSnapshot.empty) {
      console.log("Firestore: Gifts collection empty, initializing defaults...");
      const batch: WriteBatch = writeBatch(db);
      defaultGiftItems.forEach((item) => {
        const docRef = doc(giftsCollection); // Auto-generate ID
        batch.set(docRef, {
          ...item,
          createdAt: serverTimestamp(),
          // Ensure optional fields are null if not present
          description: item.description || null,
          selectedBy: item.selectedBy || null,
          selectionDate: item.selectionDate || null,
        });
      });
      await batch.commit();
      console.log("Firestore: Default gifts added.");
    } else {
        console.log(`Firestore: Gifts collection already contains ${giftsSnapshot.size} items. Skipping default initialization.`);
    }
    console.log("Firestore: Initialization check complete.");
    // Force revalidation after initialization check to ensure UI consistency
    forceRevalidation();
  } catch (error) {
    console.error("Firestore: Error during initialization check:", error);
     if ((error as FirestoreError)?.code === 'permission-denied') {
         console.error("Firestore: PERMISSION DENIED during initialization. Check Firestore rules allow write on 'settings/main' and 'gifts'.");
     }
    // We don't re-throw here, as the app might still function with partial data or defaults
  }
}


/**
 * Fetches event settings from Firestore. Initializes with defaults if not found.
 * This version assumes public read access is configured in Firestore rules.
 */
export const getEventSettings = async (): Promise<EventSettings> => {
    const settingsPath = settingsDocRef.path;
    console.log(`Firestore: Attempting to fetch event settings from path: ${settingsPath}`);
    try {
      const docSnap = await getDoc(settingsDocRef);
      if (docSnap.exists()) {
        console.log(`Firestore: Event settings found at ${settingsPath}.`);
        const fetchedData = docSnap.data();
        const completeSettings = { ...defaultEventSettings, ...fetchedData };
        completeSettings.babyName = completeSettings.babyName ?? null;
        completeSettings.headerImageUrl = completeSettings.headerImageUrl ?? null;
        return completeSettings;
      } else {
        console.warn(`Firestore: Settings document '${settingsPath}' does not exist. Returning defaults.`);
        // Don't attempt to initialize here if reads are public but writes might not be.
        // Initialization should ideally happen via an admin action or setup script.
        return defaultEventSettings;
      }
    } catch (error) {
      console.error(`Firestore: Error fetching event settings from ${settingsPath}:`, error);
      // Check if error is permissions related
       if ((error as any)?.code === 'permission-denied') {
          console.error("Firestore: PERMISSION DENIED fetching event settings. Check Firestore rules.");
       }
      return defaultEventSettings; // Return defaults on error for resilience
    }
  };

/**
 * Fetches all gift items from Firestore, ordered by creation time.
 * This version assumes public read access is configured in Firestore rules.
 */
export const getGifts = async (): Promise<GiftItem[]> => {
    console.log("Firestore: Fetching gifts...");
    try {
        const q = query(giftsCollection, orderBy("createdAt", "desc"), orderBy("name"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.log("Firestore: Gifts collection is empty.");
            return []; // Return empty if no gifts found
        } else {
            const gifts = querySnapshot.docs.map(giftFromDoc);
            console.log(`Firestore: Fetched ${gifts.length} gifts.`);
            return gifts;
        }
    } catch (error) {
        console.error("Firestore: Error fetching gifts:", error);
         if ((error as FirestoreError)?.code === 'permission-denied') {
            console.error("Firestore: PERMISSION DENIED fetching gifts. Check Firestore rules allow read on the 'gifts' collection.");
         }
        return []; // Return empty array on error
    }
};

/**
 * Updates event settings in Firestore. (Admin Action)
 * Assumes admin privileges are required by Firestore rules.
 */
export async function updateEventSettings(
  updates: Partial<EventSettings>,
): Promise<EventSettings> {
   const settingsPath = settingsDocRef.path;
  console.log(`Firestore: Updating event settings at ${settingsPath}...`, updates);
  try {
    const dataToUpdate = { ...updates };
    dataToUpdate.babyName = dataToUpdate.babyName || null;
    dataToUpdate.headerImageUrl = dataToUpdate.headerImageUrl || null;

    // Use setDoc with merge:true to update or create if missing (admin might create)
    await setDoc(settingsDocRef, dataToUpdate, { merge: true });
    console.log("Firestore: Event settings updated successfully.");
    forceRevalidation();

    const updatedSnap = await getDoc(settingsDocRef);
    return updatedSnap.exists()
      ? { ...defaultEventSettings, ...updatedSnap.data() }
      : defaultEventSettings; // Should exist after setDoc

  } catch (error) {
    console.error(`Firestore: Error updating event settings at ${settingsPath}:`, error);
    if ((error as FirestoreError)?.code === 'permission-denied') {
        console.error(`Firestore: PERMISSION DENIED updating event settings at ${settingsPath}. Requires admin privileges.`);
     }
    throw error; // Re-throw for the UI to handle
  }
}


/**
 * Marks a gift as selected in Firestore.
 * Assumes Firestore rules allow any authenticated user (or specific logic) to perform this update
 * on an 'available' item.
 */
export async function selectGift(
  itemId: string,
  guestName: string,
): Promise<GiftItem | null> {
  console.log(`Firestore: Selecting gift ${itemId} for ${guestName}...`);
  const itemDocRef = doc(db, "gifts", itemId);
  try {
    // Transaction might be better here to prevent race conditions, but keeping it simple for now.
    const itemSnap = await getDoc(itemDocRef);
    if (!itemSnap.exists()) {
      console.warn(`Firestore: Gift ${itemId} not found for selection.`);
      forceRevalidation(); // Revalidate if item disappeared
      return null;
    }
    const currentData = itemSnap.data();
    if (currentData?.status !== "available") {
       console.warn(
           `Firestore: Gift ${itemId} is not available (status: ${currentData?.status}). Selection aborted.`
         );
        forceRevalidation(); // Revalidate as state is different
        return giftFromDoc(itemSnap); // Return current state
    }

    const updateData = {
      status: "selected" as const,
      selectedBy: guestName || "Convidado(a)", // Use fallback name if empty
      selectionDate: serverTimestamp(), // Use Firestore server Timestamp
    };
    await updateDoc(itemDocRef, updateData);
    console.log(`Firestore: Gift ${itemId} selected successfully.`);
    forceRevalidation();
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(`Firestore: Error selecting gift ${itemId}:`, error);
     if ((error as FirestoreError)?.code === 'permission-denied') {
        // This permission error depends on your rules for who can select an item
        console.error(`Firestore: PERMISSION DENIED selecting gift ${itemId}. Check Firestore rules for write access to 'gifts/{giftId}' when status is 'available'.`);
     }
    throw error; // Re-throw for UI handling
  }
}

/**
 * Marks a gift as 'not_needed' in Firestore. (Admin Action)
 * Assumes admin privileges are required by Firestore rules.
 */
export async function markGiftAsNotNeeded(
  itemId: string,
): Promise<GiftItem | null> {
  console.log(`Firestore: Marking gift ${itemId} as not needed...`);
  const itemDocRef = doc(db, "gifts", itemId);
  try {
    const itemSnap = await getDoc(itemDocRef);
    if (!itemSnap.exists()) {
      console.warn(`Firestore: Gift ${itemId} not found to mark as not needed.`);
      return null;
    }

    const updateData = {
      status: "not_needed" as const,
      selectedBy: null, // Clear selector info
      selectionDate: null, // Clear selection date
    };
    await updateDoc(itemDocRef, updateData);
    console.log(`Firestore: Gift ${itemId} marked as not needed.`);
    forceRevalidation();
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(`Firestore: Error marking gift ${itemId} as not needed:`, error);
    if ((error as FirestoreError)?.code === 'permission-denied') {
        console.error(`Firestore: PERMISSION DENIED marking gift ${itemId} as not needed. Requires admin privileges.`);
     }
    throw error; // Re-throw for UI handling
  }
}

/**
 * Adds a user suggestion as a new 'selected' gift item in Firestore.
 * Assumes Firestore rules allow any authenticated user (or specific logic) to create new documents
 * in the 'gifts' collection.
 */
export async function addSuggestion(
  suggestionData: SuggestionData,
): Promise<GiftItem> {
  console.log(
    `Firestore: Adding suggestion from ${suggestionData.suggesterName}...`,
  );
  const newItemData = {
    name: suggestionData.itemName,
    description: suggestionData.itemDescription || null, // Use null for empty optional fields
    category: "Outros", // Suggestions default to 'Outros'
    status: "selected" as const, // Add as already selected
    selectedBy: suggestionData.suggesterName || "Convidado(a)", // Fallback name
    selectionDate: serverTimestamp(), // Use Firestore server Timestamp
    createdAt: serverTimestamp(), // Track creation time with server Timestamp
  };
  try {
    const docRef = await addDoc(giftsCollection, newItemData);
    console.log(
      `Firestore: Suggestion added as new gift with ID: ${docRef.id}`,
    );
    forceRevalidation();
    const newDocSnap = await getDoc(docRef);
    if (!newDocSnap.exists()) {
        throw new Error("Failed to fetch newly created suggestion document.");
    }
    return giftFromDoc(newDocSnap);
  } catch (error) {
    console.error("Firestore: Error adding suggestion:", error);
    if ((error as FirestoreError)?.code === 'permission-denied') {
        // This permission error depends on rules for creating new gift items
        console.error(`Firestore: PERMISSION DENIED adding suggestion. Check Firestore rules allow create in 'gifts' collection.`);
     }
    throw error; // Re-throw for UI handling
  }
}

/**
 * Reverts a 'selected' or 'not_needed' gift back to 'available' in Firestore. (Admin Action)
 * Assumes admin privileges are required by Firestore rules.
 */
export async function revertSelection(itemId: string): Promise<GiftItem | null> {
  console.log(`Firestore: Reverting selection/status for gift ${itemId}...`);
  const itemDocRef = doc(db, "gifts", itemId);
  try {
    const itemSnap = await getDoc(itemDocRef);
    if (!itemSnap.exists()) {
      console.warn(`Firestore: Gift ${itemId} not found for reverting.`);
      return null;
    }
    const currentStatus = itemSnap.data()?.status;
    if (currentStatus === "available") {
      console.warn(
        `Firestore: Gift ${itemId} is already available. No reversion needed.`,
      );
      return giftFromDoc(itemSnap); // Return current state
    }

    const updateData = {
      status: "available" as const,
      selectedBy: null, // Remove selector info
      selectionDate: null, // Remove selection date
    };
    await updateDoc(itemDocRef, updateData);
    console.log(`Firestore: Gift ${itemId} reverted to available.`);
    forceRevalidation();
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(`Firestore: Error reverting gift ${itemId}:`, error);
    if ((error as FirestoreError)?.code === 'permission-denied') {
        console.error(`Firestore: PERMISSION DENIED reverting gift ${itemId}. Requires admin privileges.`);
     }
    throw error; // Re-throw for UI handling
  }
}

/**
 * Adds a new gift item via the admin panel to Firestore. (Admin Action)
 * Assumes admin privileges are required by Firestore rules.
 */
export async function addGift(
  newItemData: Omit<GiftItem, "id" | "createdAt"> & {
    selectionDate?: string | Date | Timestamp | null; // Allow various date inputs + null
  },
): Promise<GiftItem> {
  console.log(`Firestore: Admin adding new gift "${newItemData.name}"...`, newItemData);

  let selectionTimestamp: Timestamp | null = null;
  let finalSelectedBy: string | null = null;

  if (newItemData.status === "selected") {
    finalSelectedBy = newItemData.selectedBy || "Admin"; // Default to Admin if selected and no name provided
    if (newItemData.selectionDate) {
      if (newItemData.selectionDate instanceof Timestamp) {
        selectionTimestamp = newItemData.selectionDate;
      } else if (newItemData.selectionDate instanceof Date) {
        selectionTimestamp = Timestamp.fromDate(newItemData.selectionDate);
      } else if (typeof newItemData.selectionDate === 'string') {
         try {
           const parsedDate = new Date(newItemData.selectionDate);
           selectionTimestamp = !isNaN(parsedDate.getTime()) ? Timestamp.fromDate(parsedDate) : serverTimestamp() as Timestamp;
         } catch (e) {
             console.warn("Error parsing date string for selectionDate, using server time.", newItemData.selectionDate, e);
             selectionTimestamp = serverTimestamp() as Timestamp;
         }
      } else {
          selectionTimestamp = serverTimestamp() as Timestamp; // Use server time if selectionDate is invalid type or missing
      }
    } else {
      selectionTimestamp = serverTimestamp() as Timestamp; // Use server time if no selectionDate provided for 'selected' status
    }
  } else if (newItemData.status === "not_needed") {
      // Ensure selection info is null if status is 'not_needed'
      finalSelectedBy = null;
      selectionTimestamp = null;
  } else { // Status is 'available'
      finalSelectedBy = null;
      selectionTimestamp = null;
  }


  const giftToAdd = {
    name: newItemData.name,
    description: newItemData.description || null,
    category: newItemData.category,
    status: newItemData.status || "available",
    selectedBy: finalSelectedBy, // Use the determined value
    selectionDate: selectionTimestamp, // Use the determined value
    createdAt: serverTimestamp(), // Use server Timestamp
  };

  console.log("Firestore: Data being sent to addDoc:", giftToAdd);

  try {
    // Ensure all values are either non-undefined or explicitly null
    const cleanGiftToAdd = Object.entries(giftToAdd).reduce((acc, [key, value]) => {
       acc[key] = value === undefined ? null : value;
       return acc;
    }, {} as { [key: string]: any });


    const docRef = await addDoc(giftsCollection, cleanGiftToAdd);
    console.log(`Firestore: Gift added with ID: ${docRef.id}`);
    forceRevalidation();
    const newDocSnap = await getDoc(docRef);
     if (!newDocSnap.exists()) {
        throw new Error("Failed to fetch newly created gift document.");
    }
    return giftFromDoc(newDocSnap);
  } catch (error) {
    console.error(`Firestore: Error adding gift "${newItemData.name}":`, error);
    if ((error as FirestoreError)?.code === 'permission-denied') {
        console.error(`Firestore: PERMISSION DENIED adding gift ${newItemData.name}. Requires admin privileges.`);
     } else if ((error as FirestoreError)?.code === 'invalid-argument') {
        console.error("Firestore: Invalid argument error. Check data types and ensure no undefined values:", giftToAdd, error);
     }
    throw error; // Re-throw to allow UI to handle it
  }
}


/**
 * Updates an existing gift item in Firestore. (Admin Action)
 * Assumes admin privileges are required by Firestore rules.
 */
export async function updateGift(
  itemId: string,
  updates: Partial<Omit<GiftItem, "id" | "createdAt">>,
): Promise<GiftItem | null> {
  console.log(`Firestore: Updating gift ${itemId}...`, updates);
  const itemDocRef = doc(db, "gifts", itemId);

  // Prepare update data, cleaning potential undefined values and handling dates
  const updateData: { [key: string]: any } = {};

  // Explicitly handle each field to ensure nulls are set correctly
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) {
      // Firestore doesn't support undefined, map to null or handle as needed
      // For most optional fields, null is appropriate.
      // If a field should *never* be null, you might skip it or throw an error.
      if (key === 'description' || key === 'selectedBy' || key === 'selectionDate') {
        updateData[key] = null;
      } else {
          // For required fields like name, category, status, undefined shouldn't happen with proper types,
          // but log a warning if it does.
          console.warn(`Undefined value received for potentially required field '${key}' during update. Skipping field.`);
      }
    } else if (key === 'selectionDate') {
      // Convert date to Timestamp if necessary
      if (value instanceof Date) {
          updateData[key] = Timestamp.fromDate(value);
      } else if (typeof value === 'string') {
          try {
               const parsedDate = new Date(value);
               updateData[key] = !isNaN(parsedDate.getTime()) ? Timestamp.fromDate(parsedDate) : null;
          } catch(e) {
              console.warn("Could not parse selection date string for update, setting to null:", value, e);
              updateData[key] = null;
          }
      } else if (value instanceof Timestamp || value === null) {
          updateData[key] = value; // Already correct type or null
      } else {
           console.warn("Invalid type provided for selectionDate, setting to null:", value);
           updateData[key] = null;
      }
    } else {
      // Assign other values directly (handle empty strings as null for optional text fields)
      if ((key === 'description' || key === 'selectedBy') && value === "") {
         updateData[key] = null;
      } else {
         updateData[key] = value;
      }
    }
  });


  // Handle status changes and associated fields logic AFTER initial processing
  if (updateData.hasOwnProperty('status')) {
      if (updateData.status !== "selected") {
          // If changing *to* available or not_needed, explicitly clear selection info in the update object
          updateData.selectedBy = null;
          updateData.selectionDate = null;
      } else {
           // If changing *to* selected...
           // Ensure selectedBy exists (fetch current value if not in updateData and needed)
           if (!updateData.hasOwnProperty('selectedBy') || updateData.selectedBy === null || updateData.selectedBy === undefined) {
               const currentDocSnap = await getDoc(itemDocRef); // Fetch only if needed
               updateData.selectedBy = currentDocSnap.data()?.selectedBy || "Admin"; // Keep existing or default
           }
           // Ensure selectionDate exists (set to now if not in updateData or explicitly null)
           if (!updateData.hasOwnProperty('selectionDate') || updateData.selectionDate === null || updateData.selectionDate === undefined) {
                 updateData.selectionDate = serverTimestamp(); // Set to now
           }
      }
  }

   console.log("Firestore: Final update data:", updateData);


  try {
    await updateDoc(itemDocRef, updateData);
    console.log(`Firestore: Gift ${itemId} updated successfully.`);
    forceRevalidation();
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(`Firestore: Error updating gift ${itemId}:`, error);
    if ((error as FirestoreError)?.code === 'permission-denied') {
        console.error(`Firestore: PERMISSION DENIED updating gift ${itemId}. Requires admin privileges.`);
     } else if ((error as FirestoreError)?.code === 'invalid-argument') {
        console.error("Firestore: Invalid argument error during update. Check data types:", updateData, error);
     }
    throw error; // Re-throw for UI handling
  }
}

/**
 * Deletes a gift item from Firestore. (Admin Action)
 * Assumes admin privileges are required by Firestore rules.
 */
export async function deleteGift(itemId: string): Promise<boolean> {
  console.log(`Firestore: Deleting gift ${itemId}...`);
  const itemDocRef = doc(db, "gifts", itemId);
  try {
    await deleteDoc(itemDocRef);
    console.log(`Firestore: Gift ${itemId} deleted successfully.`);
    forceRevalidation();
    return true;
  } catch (error) {
    console.error(`Firestore: Error deleting gift ${itemId}:`, error);
     if ((error as FirestoreError)?.code === 'permission-denied') {
        console.error(`Firestore: PERMISSION DENIED deleting gift ${itemId}. Requires admin privileges.`);
     }
    // Don't re-throw, return false to indicate failure
    return false;
  }
}

/**
 * Exports gift data to a CSV string.
 * Assumes public read access to gifts collection.
 */
export async function exportGiftsToCSV(): Promise<string> {
    console.log("Firestore: Exporting gifts to CSV...");
    try {
        // Fetch current gifts directly to ensure latest data
        const currentGifts = await getGifts(); // Uses the public read function

        const headers = [
            "ID",
            "Nome",
            "Descrição",
            "Categoria",
            "Status",
            "Selecionado Por",
            "Data Seleção",
            "Data Criação",
        ];

        const rows = currentGifts.map((item) => {
            let selectionDateStr = "";
            if (item.selectionDate) {
                try {
                    // Handle both Timestamp and ISO string formats
                    const date = item.selectionDate instanceof Timestamp
                        ? item.selectionDate.toDate()
                        : typeof item.selectionDate === 'string'
                            ? new Date(item.selectionDate)
                            : null;
                     if (date && !isNaN(date.getTime())) {
                       selectionDateStr = date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
                     }
                } catch (e) { console.warn("Could not parse selection date for CSV:", item.selectionDate); }
            }
            let createdAtStr = "";
             if (item.createdAt) {
                try {
                     const date = item.createdAt instanceof Timestamp
                        ? item.createdAt.toDate()
                        : typeof item.createdAt === 'string'
                            ? new Date(item.createdAt)
                            : null;
                      if (date && !isNaN(date.getTime())) {
                        createdAtStr = date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
                     }
                } catch (e) { console.warn("Could not parse creation date for CSV:", item.createdAt); }
            }

            // Use nullish coalescing for potentially null fields
            const description = item.description ?? "";
            const selectedBy = item.selectedBy ?? "";

            return [
                item.id,
                item.name,
                description,
                item.category,
                item.status,
                selectedBy,
                selectionDateStr,
                createdAtStr,
            ]
            .map((value) => `"${String(value).replace(/"/g, '""')}"`) // Escape quotes
            .join(",");
        });

        console.log("Firestore: CSV export generated successfully.");
        return [headers.join(","), ...rows].join("\n");
    } catch (error) {
        console.error("Firestore: Error exporting gifts to CSV:", error);
        throw new Error("Erro ao gerar o arquivo CSV."); // Throw a user-friendly error
    }
}

// Call initialization on server start or via admin action.
// Avoid calling directly at top level in production builds if it involves writes
// that non-admins shouldn't perform.
// Consider an admin page button or a separate setup script.
// initializeFirestoreData().catch(err => console.error("Initial Firestore check failed:", err));
