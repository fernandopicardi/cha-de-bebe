// src/data/gift-store.ts
"use server";

/*
Required Firestore Rules for this component:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Settings document: Anyone can read, only admin can write
    match /settings/main {
      allow read: if true;
      allow write: if isAdmin();
    }

    // Gifts collection
    match /gifts/{giftId} {
      // Anyone can read gifts
      allow read: if true;

      // Anyone can suggest a gift (create a new one marked as selected)
      allow create: if request.resource.data.status == 'selected' && request.resource.data.selectedBy != null && request.resource.data.name != null && request.resource.data.category != null;

      // Anyone can select an available gift (update status)
      allow update: if request.resource.data.status == 'selected' && request.resource.data.selectedBy != null && resource.data.status == 'available';

      // Admins can perform any update or delete
      allow update, delete: if isAdmin();
    }

    // User profiles (if used - placeholder)
    match /users/{userId} {
      allow read, write: if request.auth != null && (request.auth.uid == userId || isAdmin());
    }

    // Admin check function
    function isAdmin() {
      return request.auth != null && request.auth.uid in ['ADMIN_UID_1', 'ADMIN_UID_2']; // Replace with actual Admin UIDs
    }
  }
}

*/


import { revalidatePath } from "next/cache";
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
  serverTimestamp, // Use serverTimestamp for createdAt consistency
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
    // Order by name as a secondary sort criteria after createdAt might be useful
    const q = query(giftsCollection, orderBy("createdAt", "desc"), orderBy("name"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log("Firestore: Gifts collection empty, attempting to initialize defaults.");
       // Let's try initializing defaults here if collection is truly empty.
       // This should only run once. Ensure Firestore rules allow admin/server writes.
       try {
          const batch = writeBatch(db);
          defaultGiftItems.forEach((item) => {
            const docRef = doc(giftsCollection); // Auto-generate ID
            // Use serverTimestamp() for createdAt
            batch.set(docRef, { ...item, createdAt: serverTimestamp() });
          });
          await batch.commit();
          console.log("Firestore: Default gifts added.");
          // Re-fetch after adding defaults
          const newSnapshot = await getDocs(q);
          const gifts = newSnapshot.docs.map(giftFromDoc);
          console.log(`Firestore: Fetched ${gifts.length} gifts after initialization.`);
          return gifts;
       } catch (initError) {
          console.error("Firestore: Error initializing default gifts:", initError);
          // If initialization fails, return empty array
          return [];
       }
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
    if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED updating event settings. Check Firestore rules.");
     }
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
      selectionDate: serverTimestamp(), // Use Firestore server Timestamp
    };
    await updateDoc(itemDocRef, updateData);
    console.log(`Firestore: Gift ${itemId} selected successfully.`);
    forceRevalidation();
    // Return the updated item data
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(`Firestore: Error selecting gift ${itemId}:`, error);
     if ((error as any)?.code === 'permission-denied') {
        console.error(`Firestore: PERMISSION DENIED selecting gift ${itemId}. Check Firestore rules allow update.`);
     }
    throw error;
  }
}

/**
 * Marks a gift as 'not_needed' in Firestore. (Admin only action)
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
       forceRevalidation();
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
    if ((error as any)?.code === 'permission-denied') {
        console.error(`Firestore: PERMISSION DENIED marking gift ${itemId} as not needed. Check Firestore rules allow admin update.`);
     }
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
    selectionDate: serverTimestamp(), // Use Firestore server Timestamp
    createdAt: serverTimestamp(), // Track creation time with server Timestamp
  };
  try {
    const docRef = await addDoc(giftsCollection, newItemData);
    console.log(
      `Firestore: Suggestion added as new gift with ID: ${docRef.id}`,
    );
    forceRevalidation();
     // Fetch the newly created doc to get server-generated timestamps
    const newDocSnap = await getDoc(docRef);
    return giftFromDoc(newDocSnap);
  } catch (error) {
    console.error("Firestore: Error adding suggestion:", error);
    if ((error as any)?.code === 'permission-denied') {
        console.error(`Firestore: PERMISSION DENIED adding suggestion. Check Firestore rules allow create.`);
     }
    throw error;
  }
}

/**
 * Reverts a 'selected' or 'not_needed' gift back to 'available' in Firestore. (Admin only action)
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
       forceRevalidation(); // Still revalidate if status was unexpected but existed
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
    if ((error as any)?.code === 'permission-denied') {
        console.error(`Firestore: PERMISSION DENIED reverting gift ${itemId}. Check Firestore rules allow admin update.`);
     }
    throw error;
  }
}

/**
 * Adds a new gift item via the admin panel to Firestore. (Admin only action)
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
      selectionTimestamp = Timestamp.now(); // Use client time for this default case, or consider serverTimestamp
  }


  const giftToAdd = {
    name: newItemData.name,
    description: newItemData.description || "",
    category: newItemData.category,
    status: newItemData.status || "available",
    selectedBy: newItemData.status === "selected" ? newItemData.selectedBy : undefined,
    selectionDate: newItemData.status === "selected" ? selectionTimestamp : undefined,
    createdAt: serverTimestamp(), // Use server Timestamp
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
    // Fetch the newly created doc to get server-generated timestamps
    const newDocSnap = await getDoc(docRef);
    return giftFromDoc(newDocSnap);
  } catch (error) {
    console.error(`Firestore: Error adding gift "${newItemData.name}":`, error);
    if ((error as any)?.code === 'permission-denied') {
        console.error(`Firestore: PERMISSION DENIED adding gift ${newItemData.name}. Check Firestore rules allow admin create.`);
     }
    throw error;
  }
}

/**
 * Updates an existing gift item in Firestore. (Admin only action)
 */
export async function updateGift(
  itemId: string,
  updates: Partial<Omit<GiftItem, "id" | "createdAt">>,
): Promise<GiftItem | null> {
  console.log(`Firestore: Updating gift ${itemId}...`);
  const itemDocRef = doc(db, "gifts", itemId);

  // Prepare update data, converting date string/Date to Timestamp if necessary
  const updateData: { [key: string]: any } = { ...updates };

  // Convert selectionDate if present
  if (updateData.hasOwnProperty('selectionDate') && updateData.selectionDate) {
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
          // If changing *to* available or not_needed, clear selection info
          updateData.selectedBy = undefined;
          updateData.selectionDate = undefined;
      } else {
           // If changing *to* selected, ensure selectedBy exists
           if (!updateData.selectedBy) {
               // Get current doc to preserve existing selector if available, else default
               const currentDoc = await getDoc(itemDocRef);
               updateData.selectedBy = currentDoc.data()?.selectedBy || "Admin"; // Keep existing or default
           }
           // Ensure selectionDate exists if setting to selected
           if (!updateData.selectionDate) {
                // Use client time for this default case, or consider serverTimestamp
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
    if ((error as any)?.code === 'permission-denied') {
        console.error(`Firestore: PERMISSION DENIED updating gift ${itemId}. Check Firestore rules allow admin update.`);
     }
    throw error;
  }
}

/**
 * Deletes a gift item from Firestore. (Admin only action)
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
    if ((error as any)?.code === 'permission-denied') {
        console.error(`Firestore: PERMISSION DENIED deleting gift ${itemId}. Check Firestore rules allow admin delete.`);
     }
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
                 // Check if date is valid before formatting
                 if (!isNaN(date.getTime())) {
                   selectionDateStr = date.toLocaleString("pt-BR", {
                       dateStyle: "short",
                       timeStyle: "short",
                   });
                 } else {
                    console.warn("Invalid selection date encountered during CSV export:", item.selectionDate);
                 }
            } catch (e) {
                console.warn("Could not parse selection date for CSV:", item.selectionDate, e);
            }
        }
        let createdAtStr = "";
         if (item.createdAt) {
            try {
                 const date = item.createdAt instanceof Timestamp
                    ? item.createdAt.toDate()
                    : new Date(item.createdAt);
                 // Check if date is valid before formatting
                 if (!isNaN(date.getTime())) {
                    createdAtStr = date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
                 } else {
                    console.warn("Invalid creation date encountered during CSV export:", item.createdAt);
                 }
            } catch (e) {
                console.warn("Could not parse creation date for CSV:", item.createdAt, e);
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

