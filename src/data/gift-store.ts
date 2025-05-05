// src/data/gift-store.ts
"use server";

import { revalidatePath } from "next/cache";
// import { cache } from "react"; // Removed cache wrapper
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase/config"; // Import Firestore instance

// Data Interfaces (remain the same)
export interface GiftItem {
  id: string; // Firestore document ID
  name: string;
  description?: string;
  category: string;
  status: "available" | "selected" | "not_needed";
  selectedBy?: string;
  selectionDate?: Timestamp | string | undefined; // Use Firestore Timestamp for dates
  createdAt?: Timestamp; // Optional: Track creation time
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
  {
    name: "Body Manga Curta (RN)",
    category: "Roupas",
    status: "available",
    description: "Pacote com 3 unidades, cores neutras.",
  },
  {
    name: "Fraldas Pampers (P)",
    category: "Higiene",
    status: "available",
    description: "Pacote grande.",
  },
  {
    name: "Mamadeira Anti-cólica",
    category: "Alimentação",
    status: "available",
  },
  {
    name: "Móbile Musical",
    category: "Brinquedos",
    status: "available",
  },
  {
    name: "Lenços Umedecidos",
    category: "Higiene",
    status: "available",
  },
  {
    name: "Termômetro Digital",
    category: "Higiene",
    status: "available",
  },
  {
    name: "Macacão Pijama (M)",
    category: "Roupas",
    status: "available",
    description: "Algodão macio.",
  },
  {
    name: "Chupeta Calmante",
    category: "Outros",
    status: "available",
  },
  {
    name: "Cadeirinha de Descanso",
    category: "Outros",
    status: "available",
  },
  {
    name: "Pomada para Assaduras",
    category: "Higiene",
    status: "available",
    description: "Marca Bepantol Baby ou similar.",
  },
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
const settingsDocRef = doc(db, "settings", "main"); // Use a single document for settings

// Helper function to convert Firestore Timestamps in gift items
const giftFromDoc = (docSnapshot: any): GiftItem => {
  const data = docSnapshot.data();
  return {
    ...data,
    id: docSnapshot.id,
    // Convert Timestamps back to ISO strings or keep as Timestamps if components handle them
    selectionDate: data.selectionDate instanceof Timestamp
        ? data.selectionDate.toDate().toISOString()
        : data.selectionDate, // Keep string if already string (for compatibility or if stored differently)
    createdAt: data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : data.createdAt,
  } as GiftItem;
};

// Function to force revalidation
const forceRevalidation = () => {
  revalidatePath("/", "layout"); // Revalidate home page and layout
  revalidatePath("/admin", "layout"); // Revalidate admin page and layout
};

// --- Firestore Data Access Functions ---

/**
 * Fetches event settings from Firestore. Initializes with defaults if not found.
 * Removed React cache wrapper.
 */
export const getEventSettings = (async (): Promise<EventSettings> => {
  console.log("Firestore: Fetching event settings...");
  try {
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
      console.log("Firestore: Event settings found.");
      // Ensure all default fields exist in the fetched data
      const fetchedData = docSnap.data() as EventSettings;
      const completeSettings = { ...defaultEventSettings, ...fetchedData };
      return completeSettings;
    } else {
      console.log("Firestore: Event settings not found, initializing defaults.");
      // Check if initialization should happen here or be handled manually/elsewhere
      // For safety, avoid automatic writes in a read function if possible
      // await setDoc(settingsDocRef, defaultEventSettings);
      // return defaultEventSettings;
      console.warn("Firestore: Settings document 'settings/main' does not exist. Returning defaults without writing.");
      return defaultEventSettings;
    }
  } catch (error) {
    console.error("Firestore: Error fetching event settings:", error);
    // Optionally return defaults or throw error based on desired behavior
    // Check if error is permissions related
     if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED fetching event settings. Check Firestore rules.");
     }
    return defaultEventSettings; // Return defaults on error for resilience
  }
}); // Removed cache wrapper

/**
 * Fetches all gift items from Firestore, ordered by creation time.
 * Initializes with defaults if the collection is empty.
 * Removed React cache wrapper.
 */
export const getGifts = (async (): Promise<GiftItem[]> => {
  console.log("Firestore: Fetching gifts...");
  try {
    const q = query(giftsCollection, orderBy("createdAt", "desc")); // Order by creation time
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log("Firestore: Gifts collection empty, initializing defaults.");
       // Check if initialization should happen here or be handled manually/elsewhere
       // For safety, avoid automatic writes in a read function if possible
      // const batch = writeBatch(db);
      // defaultGiftItems.forEach((item) => {
      //   const docRef = doc(giftsCollection); // Auto-generate ID
      //   batch.set(docRef, { ...item, createdAt: Timestamp.now() });
      // });
      // await batch.commit();
      // console.log("Firestore: Default gifts added.");
      // // Re-fetch after adding defaults
      // const newSnapshot = await getDocs(q);
      // const gifts = newSnapshot.docs.map(giftFromDoc);
      // console.log(`Firestore: Fetched ${gifts.length} gifts after initialization.`);
      // return gifts;
      console.warn("Firestore: Gifts collection is empty. Returning empty array without initializing defaults.");
      return [];
    } else {
        const gifts = querySnapshot.docs.map(giftFromDoc);
        console.log(`Firestore: Fetched ${gifts.length} gifts.`);
        return gifts;
    }
  } catch (error) {
    console.error("Firestore: Error fetching gifts:", error);
    if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED fetching gifts. Check Firestore rules.");
     }
    return []; // Return empty array on error
  }
}); // Removed cache wrapper

/**
 * Updates event settings in Firestore.
 */
export async function updateEventSettings(
  updates: Partial<EventSettings>,
): Promise<EventSettings> {
  console.log("Firestore: Updating event settings...");
  try {
    // Ensure headerImageUrl is handled correctly (null vs undefined vs empty string)
    const dataToUpdate = { ...updates };
    // Ensure null is saved if headerImageUrl is explicitly set to null, undefined or empty string
    if (dataToUpdate.hasOwnProperty('headerImageUrl') && !dataToUpdate.headerImageUrl) {
      dataToUpdate.headerImageUrl = null;
    }
     // Ensure null is saved if babyName is explicitly set to null, undefined or empty string
    if (dataToUpdate.hasOwnProperty('babyName') && !dataToUpdate.babyName) {
      dataToUpdate.babyName = null;
    }


    await setDoc(settingsDocRef, dataToUpdate, { merge: true }); // Use setDoc with merge to update or create
    console.log("Firestore: Event settings updated successfully.");
    forceRevalidation();
    // Re-fetch to return the updated data
    // Manually clear cache if using `cache` function on getEventSettings
    // NOTE: Revalidation should ideally handle this, but direct fetch avoids stale cache issues
    const docSnap = await getDoc(settingsDocRef);
    return docSnap.exists() ? { ...defaultEventSettings, ...(docSnap.data() as EventSettings) } : defaultEventSettings;

  } catch (error) {
    console.error("Firestore: Error updating event settings:", error);
    throw error; // Re-throw error to be handled by the caller
  }
}


/**
 * Marks a gift as selected in Firestore.
 */
export async function selectGift(
  itemId: string,
  guestName: string,
): Promise<GiftItem | null> {
  console.log(`Firestore: Selecting gift ${itemId} for ${guestName}...`);
  const itemDocRef = doc(db, "gifts", itemId);
  try {
    const itemSnap = await getDoc(itemDocRef);
    if (!itemSnap.exists() || itemSnap.data()?.status !== "available") {
      console.warn(
        `Firestore: Gift ${itemId} not found or not available for selection.`,
      );
      forceRevalidation(); // Revalidate even if selection failed to update list
      return null; // Item not found or not available
    }

    const updateData = {
      status: "selected",
      selectedBy: guestName,
      selectionDate: Timestamp.now(), // Use Firestore Timestamp
    };
    await updateDoc(itemDocRef, updateData);
    console.log(`Firestore: Gift ${itemId} selected successfully.`);
    forceRevalidation();
    // Return the updated item data
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(`Firestore: Error selecting gift ${itemId}:`, error);
    throw error;
  }
}

/**
 * Marks a gift as 'not_needed' in Firestore.
 */
export async function markGiftAsNotNeeded(
  itemId: string,
): Promise<GiftItem | null> {
  console.log(`Firestore: Marking gift ${itemId} as not needed...`);
  const itemDocRef = doc(db, "gifts", itemId);
  try {
    const itemSnap = await getDoc(itemDocRef);
    if (!itemSnap.exists() || itemSnap.data()?.status !== "available") {
      console.warn(
        `Firestore: Gift ${itemId} not found or not available to mark as not needed.`,
      );
      return null;
    }

    const updateData = {
      status: "not_needed",
      selectedBy: undefined, // Remove selector info
      selectionDate: undefined, // Remove selection date
    };
    await updateDoc(itemDocRef, updateData);
    console.log(`Firestore: Gift ${itemId} marked as not needed.`);
    forceRevalidation();
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(`Firestore: Error marking gift ${itemId} as not needed:`, error);
    throw error;
  }
}

/**
 * Adds a user suggestion as a new 'selected' gift item in Firestore.
 */
export async function addSuggestion(
  suggestionData: SuggestionData,
): Promise<GiftItem> {
  console.log(
    `Firestore: Adding suggestion from ${suggestionData.suggesterName}...`,
  );
  const newItemData = {
    name: suggestionData.itemName,
    description: suggestionData.itemDescription || "",
    category: "Outros", // Suggestions default to 'Outros'
    status: "selected" as const, // Add as already selected
    selectedBy: suggestionData.suggesterName,
    selectionDate: Timestamp.now(), // Use Firestore Timestamp
    createdAt: Timestamp.now(), // Track creation time
  };
  try {
    const docRef = await addDoc(giftsCollection, newItemData);
    console.log(
      `Firestore: Suggestion added as new gift with ID: ${docRef.id}`,
    );
    forceRevalidation();
    return { id: docRef.id, ...newItemData };
  } catch (error) {
    console.error("Firestore: Error adding suggestion:", error);
    throw error;
  }
}

/**
 * Reverts a 'selected' or 'not_needed' gift back to 'available' in Firestore.
 */
export async function revertSelection(itemId: string): Promise<GiftItem | null> {
  console.log(`Firestore: Reverting selection for gift ${itemId}...`);
  const itemDocRef = doc(db, "gifts", itemId);
  try {
    const itemSnap = await getDoc(itemDocRef);
    if (!itemSnap.exists()) {
      console.warn(`Firestore: Gift ${itemId} not found for reverting.`);
      return null;
    }
    const currentStatus = itemSnap.data()?.status;
    if (currentStatus !== "selected" && currentStatus !== "not_needed") {
      console.warn(
        `Firestore: Gift ${itemId} is already available or in an unexpected state (${currentStatus}).`,
      );
      return giftFromDoc(itemSnap); // Return current state if no action needed
    }

    const updateData = {
      status: "available",
      selectedBy: undefined, // Remove selector info
      selectionDate: undefined, // Remove selection date
    };
    await updateDoc(itemDocRef, updateData);
    console.log(`Firestore: Gift ${itemId} reverted to available.`);
    forceRevalidation();
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(`Firestore: Error reverting gift ${itemId}:`, error);
    throw error;
  }
}

/**
 * Adds a new gift item via the admin panel to Firestore.
 */
export async function addGift(
  newItemData: Omit<GiftItem, "id" | "selectionDate" | "createdAt"> & {
    selectionDate?: string | Date | Timestamp | undefined;
  }, // Allow various date inputs
): Promise<GiftItem> {
  console.log(`Firestore: Adding new gift "${newItemData.name}"...`);
  let selectionTimestamp: Timestamp | undefined = undefined;
  if (newItemData.status === "selected" && newItemData.selectionDate) {
    if (newItemData.selectionDate instanceof Timestamp) {
      selectionTimestamp = newItemData.selectionDate;
    } else if (newItemData.selectionDate instanceof Date) {
      selectionTimestamp = Timestamp.fromDate(newItemData.selectionDate);
    } else if (typeof newItemData.selectionDate === 'string') {
       try {
         selectionTimestamp = Timestamp.fromDate(new Date(newItemData.selectionDate));
       } catch (e) { console.warn("Invalid date string for selectionDate", newItemData.selectionDate)}
    }
  } else if (newItemData.status === "selected" && !newItemData.selectedBy) {
      // If status is selected but no selector provided, default to Admin
      newItemData.selectedBy = "Admin";
      selectionTimestamp = Timestamp.now();
  }


  const giftToAdd = {
    name: newItemData.name,
    description: newItemData.description || "",
    category: newItemData.category,
    status: newItemData.status || "available",
    selectedBy: newItemData.status === "selected" ? newItemData.selectedBy : undefined,
    selectionDate: newItemData.status === "selected" ? selectionTimestamp : undefined,
    createdAt: Timestamp.now(),
  };

   // Clear fields if status is not 'selected'
   if (giftToAdd.status !== "selected") {
      giftToAdd.selectedBy = undefined;
      giftToAdd.selectionDate = undefined;
    }


  try {
    const docRef = await addDoc(giftsCollection, giftToAdd);
    console.log(`Firestore: Gift added with ID: ${docRef.id}`);
    forceRevalidation();
    return { id: docRef.id, ...giftToAdd };
  } catch (error) {
    console.error(`Firestore: Error adding gift "${newItemData.name}":`, error);
    throw error;
  }
}

/**
 * Updates an existing gift item in Firestore.
 */
export async function updateGift(
  itemId: string,
  updates: Partial<Omit<GiftItem, "id" | "createdAt">>,
): Promise<GiftItem | null> {
  console.log(`Firestore: Updating gift ${itemId}...`);
  const itemDocRef = doc(db, "gifts", itemId);

  // Prepare update data, converting date string/Date to Timestamp if necessary
  const updateData: { [key: string]: any } = { ...updates };

  if (updateData.selectionDate) {
      if (updateData.selectionDate instanceof Date) {
          updateData.selectionDate = Timestamp.fromDate(updateData.selectionDate);
      } else if (typeof updateData.selectionDate === 'string') {
          try {
              updateData.selectionDate = Timestamp.fromDate(new Date(updateData.selectionDate));
          } catch(e) {
              console.warn("Invalid date string in update, removing selectionDate", updateData.selectionDate);
              delete updateData.selectionDate; // Remove invalid date
          }
      }
      // If it's already a Timestamp, do nothing
  }


  // Handle status changes and associated fields
  if (updateData.hasOwnProperty('status')) {
      if (updateData.status !== "selected") {
          updateData.selectedBy = undefined;
          updateData.selectionDate = undefined;
      } else {
           // If setting to selected, ensure selectedBy exists (default to Admin?)
           if (!updateData.selectedBy) {
               const currentDoc = await getDoc(itemDocRef);
               updateData.selectedBy = currentDoc.data()?.selectedBy || "Admin"; // Keep existing or default
           }
           // Ensure selectionDate exists if setting to selected
           if (!updateData.selectionDate) {
                updateData.selectionDate = Timestamp.now();
           }
      }
  }


  try {
    await updateDoc(itemDocRef, updateData);
    console.log(`Firestore: Gift ${itemId} updated successfully.`);
    forceRevalidation();
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(`Firestore: Error updating gift ${itemId}:`, error);
    throw error;
  }
}

/**
 * Deletes a gift item from Firestore.
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
    return false;
  }
}

/**
 * Exports gift data to a CSV string.
 * Fetches fresh data from Firestore before exporting.
 */
export async function exportGiftsToCSV(): Promise<string> {
  console.log("Firestore: Exporting gifts to CSV...");
  try {
    const currentGifts = await getGifts(); // Fetch latest data

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
                const date = item.selectionDate instanceof Timestamp
                    ? item.selectionDate.toDate()
                    : new Date(item.selectionDate);
                selectionDateStr = date.toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                });
            } catch (e) {
                console.warn("Could not parse selection date for CSV:", item.selectionDate);
            }
        }
        let createdAtStr = "";
         if (item.createdAt) {
            try {
                 const date = item.createdAt instanceof Timestamp
                    ? item.createdAt.toDate()
                    : new Date(item.createdAt);
                createdAtStr = date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
            } catch (e) {
                console.warn("Could not parse creation date for CSV:", item.createdAt);
            }
        }


        return [
            item.id,
            item.name,
            item.description || "",
            item.category,
            item.status,
            item.selectedBy || "",
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
    throw error;
  }
}
