
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
  CollectionReference, // Import CollectionReference type
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
  selectionDate?: string | null; // Convert Timestamp to ISO string for client
  createdAt?: string | null; // Convert Timestamp to ISO string for client
}


export interface SuggestionData {
  itemName: string;
  itemDescription?: string;
  suggesterName: string;
}

export interface EventSettings {
  // Using a fixed ID 'main' for the settings document
  id?: string; // Keep consistent 'id' field, though it's fixed to 'main'
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
const defaultGiftItems: Omit<GiftItem, "id" | 'createdAt'>[] = [
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
  id: 'main', // Fixed ID
  title: "Chá de Bebê",
  babyName: null,
  date: "2024-12-15",
  time: "14:00",
  location: "Salão de Festas Felicidade",
  address: "Rua Exemplo, 123, Bairro Alegre, Cidade Feliz - SP",
  welcomeMessage:
    "Sua presença é o nosso maior presente! Esta lista é apenas um guia carinhoso para quem desejar nos presentear. Sinta-se totalmente à vontade, o importante é celebrar conosco!",
  duration: 180,
  headerImageUrl: null,
};

// Firestore Collection References
// Define collection references with converters for strong typing
const giftsCollectionRef = collection(db, "gifts") as CollectionReference<Omit<GiftItem, 'id'>>;
// Define the path to the specific settings document
const settingsCollectionRef = collection(db, "settings"); // Reference to the collection
const settingsDocRef = doc(settingsCollectionRef, "main") as DocumentReference<EventSettings>; // Explicit reference to the 'main' doc

// --- Firestore Rules Definition ---
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Settings: Allow anyone to read the 'main' document
    // Allow admin write access
    match /settings/main {
      allow read: if true;
      allow write: if isAdmin();
    }

    // Gifts: Allow anyone to read.
    match /gifts/{giftId} {
      allow read: if true;

      // Allow creating (suggesting) items as 'selected' by anyone (public write)
      allow create: if request.resource.data.status == 'selected'
                    && request.resource.data.selectedBy is string && request.resource.data.selectedBy != ''
                    && request.resource.data.createdAt is timestamp; // Ensure createdAt is set server-side

      // Allow updating an 'available' item to 'selected' by anyone (public write)
      allow update: if resource.data.status == 'available'
                    && request.resource.data.status == 'selected'
                    && request.resource.data.selectedBy is string && request.resource.data.selectedBy != ''
                    && request.resource.data.selectionDate is timestamp // Ensure date is set server-side
                    // Prevent changing other fields during public selection
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'selectedBy', 'selectionDate']);

      // Allow admin full write access (update any field, delete, mark not needed, revert)
      allow write: if isAdmin(); // Includes create, update, delete for admins
    }

    // Simple admin check placeholder (replace with actual admin UIDs/logic in Firebase)
    function isAdmin(){
      // IMPORTANT: Replace with actual admin UIDs from Firebase Authentication
      return request.auth != null && request.auth.uid in ['JoO9fy5roDY6FTtqajp1UG8aYzS2', 'VnCKbFH5nrYijsUda0fhK3HdwSF2'];
    }
  }
}
*/
// --- End Firestore Rules Definition ---


// Helper function to convert Firestore Timestamps in gift items to ISO strings
const giftFromDoc = (docSnapshot: any): GiftItem => {
    const data = docSnapshot.data();
    // Basic validation for required fields during conversion
    if (!data || !data.name || !data.category || !data.status) {
        console.error(`Firestore Convert: Invalid data format for gift document ID ${docSnapshot.id}`, data);
        // Return a placeholder or throw an error, depending on desired handling
        return {
          id: docSnapshot.id,
          name: "Erro: Dados Inválidos",
          category: "Erro",
          status: "available",
          description: "Documento com dados ausentes ou corrompidos.",
          createdAt: new Date().toISOString(), // Provide a default timestamp
        };
      }
    return {
      id: docSnapshot.id,
      name: data.name,
      category: data.category,
      status: data.status,
      description: data.description ?? null, // Use nullish coalescing
      selectedBy: data.selectedBy ?? null,
      selectionDate: data.selectionDate instanceof Timestamp
          ? data.selectionDate.toDate().toISOString()
          : null, // Convert to ISO string or null
      createdAt: data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : null, // Convert to ISO string or null
    };
  };


// Function to force revalidation of specific paths AFTER a mutation
const forceRevalidation = (path: string = "/") => {
  console.log(`Firestore Revalidate: Revalidating path: ${path}`);
  // Use 'layout' to attempt revalidating the entire layout, including data fetches in Server Components
  try {
    revalidatePath(path, "layout");
    // Optionally revalidate /admin path specifically if needed
    if (path !== '/admin') {
       revalidatePath("/admin", "layout");
    }
    console.log(`Firestore Revalidate: Revalidation calls initiated for ${path} and potentially /admin.`);
  } catch (error) {
     console.error(`Firestore Revalidate: Error during revalidatePath for ${path}:`, error);
     // Log the error but don't let it crash the mutation flow
  }
};

// --- Firestore Data Access Functions ---

/**
 * Initializes Firestore with default data if collections are empty.
 * Ensures settings document exists. Should be called cautiously, ideally via admin action or setup script.
 * Assumes write permissions for the caller.
 */
export async function initializeFirestoreData(): Promise<void> {
  console.log("Firestore Init: Checking initialization status...");
  try {
    // Check settings
    const settingsSnap = await getDoc(settingsDocRef);
    if (!settingsSnap.exists()) {
      console.log("Firestore Init: Settings document 'settings/main' not found, initializing...");
      // Use defaultEventSettings which already includes id:'main'
      await setDoc(settingsDocRef, {
        ...defaultEventSettings, // Spread defaults
        // Ensure no conflicting ID is added if present in default (it shouldn't be)
      });
      console.log("Firestore Init: Default settings added.");
      forceRevalidation(); // Revalidate after potential change
    } else {
        // Merge defaults with existing settings to ensure all fields are present
        const existingSettings = settingsSnap.data();
        const mergedSettings = { ...defaultEventSettings, ...existingSettings, id: 'main' }; // Ensure ID remains main
        // Only write if there are missing default fields
        if (JSON.stringify(existingSettings) !== JSON.stringify(mergedSettings)) {
            console.log("Firestore Init: Merging default settings with existing document...");
            await setDoc(settingsDocRef, mergedSettings, { merge: true });
            console.log("Firestore Init: Settings document updated with defaults.");
            forceRevalidation(); // Revalidate after potential change
        } else {
             console.log("Firestore Init: Settings document 'settings/main' already exists and is complete.");
        }
    }

    // Check gifts (only add if completely empty)
    const giftsQuerySnapshot = await getDocs(query(giftsCollectionRef));
    if (giftsQuerySnapshot.empty) {
      console.log("Firestore Init: Gifts collection empty, initializing defaults...");
      const batch: WriteBatch = writeBatch(db);
      defaultGiftItems.forEach((item) => {
        const docRef = doc(giftsCollectionRef); // Auto-generate ID
        // Prepare data, ensuring Timestamps are used for date fields where applicable
        const dataToAdd = {
            ...item,
            createdAt: serverTimestamp(), // Use server timestamp for creation
            description: item.description ?? null,
            selectedBy: item.selectedBy ?? null,
            selectionDate: item.selectionDate instanceof Date ? Timestamp.fromDate(item.selectionDate) : null, // Convert Date to Timestamp if needed, otherwise null
        };
        batch.set(docRef, dataToAdd);
      });
      await batch.commit();
      console.log("Firestore Init: Default gifts added.");
      forceRevalidation(); // Revalidate after potential change
    } else {
        console.log(`Firestore Init: Gifts collection already contains ${giftsQuerySnapshot.size} items. Skipping default initialization.`);
    }
    console.log("Firestore Init: Initialization check complete.");

  } catch (error) {
    console.error("Firestore Init: Error during initialization check:", error);
     if ((error as FirestoreError)?.code === 'permission-denied') {
         console.error("Firestore Init: PERMISSION DENIED during initialization. Check Firestore rules allow write on 'settings/main' and 'gifts'.");
     }
    // Avoid re-throwing initialization errors unless critical
  }
}


/**
 * Fetches event settings from Firestore. Initializes with defaults if not found.
 * Assumes public read access is configured in Firestore rules for 'settings/main'.
 */
export const getEventSettings = async (): Promise<EventSettings | null> => {
    const settingsPath = settingsDocRef.path;
    console.log(`Firestore GET: Attempting to fetch event settings from path: ${settingsPath}`);
    try {
      const docSnap = await getDoc(settingsDocRef);
      if (docSnap.exists()) {
        console.log(`Firestore GET: Event settings found at ${settingsPath}.`);
        const fetchedData = docSnap.data();
        // Ensure all keys from default exist, merging fetched data over defaults
        const completeSettings = {
            ...defaultEventSettings, // Start with defaults
            ...(fetchedData as EventSettings), // Spread fetched data over defaults
            id: 'main', // Ensure ID is always main
            babyName: fetchedData?.babyName ?? null, // Explicit null handling
            headerImageUrl: fetchedData?.headerImageUrl ?? null, // Explicit null handling
          };
        console.log("Firestore GET: Returning event settings:", completeSettings);
        return completeSettings;
      } else {
        console.warn(`Firestore GET: Settings document '${settingsPath}' does not exist. Cannot return settings.`);
        // If the document doesn't exist, return null. Initialization is separate.
        return null; // Indicate settings are not available
      }
    } catch (error) {
      console.error(`Firestore GET: Error fetching event settings from ${settingsPath}:`, error);
       if ((error as FirestoreError)?.code === 'permission-denied') {
          console.error("Firestore: PERMISSION DENIED fetching event settings. Check Firestore rules.");
       } else {
          console.error("Firestore GET: An unexpected error occurred while fetching settings:", error)
       }
      // Return null on error to indicate failure.
      return null;
    }
  };

/**
 * Fetches all gift items from Firestore, ordered by creation time.
 * Assumes public read access is configured in Firestore rules.
 */
export const getGifts = async (): Promise<GiftItem[]> => {
    console.log("Firestore GET: Fetching gifts from 'gifts' collection...");
    try {
        // Order by createdAt (desc) then by name (asc) for consistent ordering
        const q = query(giftsCollectionRef, orderBy("createdAt", "desc"), orderBy("name", "asc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.log("Firestore GET: Gifts collection is empty.");
            return [];
        } else {
            const gifts = querySnapshot.docs.map(giftFromDoc); // Use converter
            console.log(`Firestore GET: Fetched ${gifts.length} gifts.`);
            console.log("Firestore GET: Sample Gifts after conversion:", gifts.slice(0, 5)); // Log sample for debugging
            return gifts;
        }
    } catch (error) {
        console.error("Firestore GET: Error fetching gifts:", error);
         if ((error as FirestoreError)?.code === 'permission-denied') {
            console.error("Firestore GET: PERMISSION DENIED fetching gifts. Check Firestore rules allow read on the 'gifts' collection.");
         } else {
            console.error("Firestore GET: An unexpected error occurred while fetching gifts:", error);
         }
         // Return empty array on error, but log it.
        return [];
    }
};

// --- Mutation Functions (Require appropriate permissions) ---

/**
 * Updates event settings in Firestore. (Admin Action)
 * Assumes admin privileges are required by Firestore rules for 'settings/main'.
 */
export async function updateEventSettings(
  updates: Partial<EventSettings>,
): Promise<EventSettings | null> { // Return null on failure
   const settingsPath = settingsDocRef.path;
   // Remove 'id' from updates if present, as it's fixed
   const { id, ...validUpdates } = updates;
  console.log(`Firestore UPDATE: Updating event settings at ${settingsPath}...`, validUpdates);
  try {
    const dataToUpdate: Partial<EventSettings> = {};
    // Ensure only valid keys are updated and handle nulls correctly
    (Object.keys(validUpdates) as Array<keyof Omit<EventSettings, 'id'>>).forEach(key => {
        if (key in defaultEventSettings) { // Only update keys that exist in the model
            const value = validUpdates[key];
            // Keep valid values (including null), skip undefined
             if (value !== undefined) {
                 dataToUpdate[key] = value;
             } else {
                 console.warn(`Firestore UPDATE_SETTINGS: Skipping undefined value for key '${key}'`);
             }

            // Explicit null handling for specific fields if needed
            // if ((key === 'babyName' || key === 'headerImageUrl') && !value) {
            //     dataToUpdate[key] = null; // Set to null if falsy/empty/undefined
            // } else if (value !== undefined) {
            //     dataToUpdate[key] = value;
            // }
        } else {
             console.warn(`Firestore UPDATE_SETTINGS: Skipping update for unknown key '${key}'`);
        }
    });

    // Clean out undefined values before sending (shouldn't be necessary with above check)
    // Object.keys(dataToUpdate).forEach(key => dataToUpdate[key as keyof EventSettings] === undefined && delete dataToUpdate[key as keyof EventSettings]);


    if (Object.keys(dataToUpdate).length === 0) {
        console.log("Firestore UPDATE: No valid settings fields to update.");
        return await getEventSettings(); // Return current settings
    }

    console.log("Firestore UPDATE: Data being sent to setDoc:", dataToUpdate);

    // Use setDoc with merge:true for safer updates (won't overwrite missing fields)
    await setDoc(settingsDocRef, dataToUpdate, { merge: true });
    console.log("Firestore UPDATE: Event settings updated successfully.");
    forceRevalidation(); // Revalidate paths AFTER successful update

    // Fetch and return the updated settings to confirm
    const updatedSettings = await getEventSettings(); // Use the existing fetch function
     console.log("Firestore UPDATE: Returning updated settings:", updatedSettings);
     return updatedSettings;

  } catch (error) {
    console.error(`Firestore UPDATE: Error updating event settings at ${settingsPath}:`, error);
    if ((error as FirestoreError)?.code === 'permission-denied') {
        console.error(`Firestore UPDATE: PERMISSION DENIED updating event settings at ${settingsPath}. Requires admin privileges.`);
     } else if ((error as FirestoreError)?.code === 'invalid-argument') {
        console.error("Firestore UPDATE: Invalid argument error. Check data types:", dataToUpdate, error);
     }
    // Return null to indicate failure
    return null;
  }
}


/**
 * Marks a gift as selected in Firestore. (User Action)
 * Assumes Firestore rules allow this update under specific conditions.
 */
export async function selectGift(
  itemId: string,
  guestName: string,
): Promise<GiftItem | null> {
  console.log(`Firestore SELECT: Selecting gift ${itemId} for ${guestName}...`);
  const itemDocRef = doc(db, "gifts", itemId); // Use generic doc ref here
  try {
    // Client-side check (can have race conditions, rules are the source of truth)
    const currentSnap = await getDoc(itemDocRef);
    if (!currentSnap.exists() || currentSnap.data()?.status !== 'available') {
        console.warn(`Firestore SELECT: Item ${itemId} not found or not available.`);
        forceRevalidation(); // Trigger revalidation as state might be stale
        return null;
    }

    const effectiveGuestName = guestName?.trim() || "Convidado(a)"; // Ensure name is not empty

    const updateData = {
      status: "selected" as const,
      selectedBy: effectiveGuestName,
      selectionDate: serverTimestamp(), // Use Firestore server Timestamp
    };

    // This update might fail if rules aren't met (e.g., item not 'available')
    await updateDoc(itemDocRef, updateData);
    console.log(`Firestore SELECT: Gift ${itemId} selected successfully.`);
    forceRevalidation(); // Revalidate AFTER successful selection

    const updatedSnap = await getDoc(itemDocRef); // Re-fetch the updated item
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;

  } catch (error) {
    console.error(`Firestore SELECT: Error selecting gift ${itemId}:`, error);
     if ((error as FirestoreError)?.code === 'permission-denied') {
        console.error(`Firestore SELECT: PERMISSION DENIED selecting gift ${itemId}. Check Firestore rules allow update on 'gifts/{giftId}' when status is 'available'.`);
     } else if ((error as FirestoreError)?.message?.includes("constraint")) { // Check generic constraint message
         console.warn(`Firestore SELECT: Gift ${itemId} likely already selected or status changed. Rule constraint not met.`);
         forceRevalidation(); // Revalidate to get latest state
     } else {
         console.error(`Firestore SELECT: An unexpected error occurred:`, error);
     }
     // Don't re-throw permission/constraint errors usually, let UI handle gracefully.
     // Re-throw other unexpected errors.
     if (!( (error as FirestoreError)?.code === 'permission-denied' || (error as FirestoreError)?.message?.includes("constraint"))) {
        throw error; // Rethrow unexpected errors
     }
     return null; // Indicate failure to the UI
  }
}

/**
 * Marks a gift as 'not_needed' in Firestore. (Admin Action)
 * Assumes admin privileges are required by Firestore rules.
 */
export async function markGiftAsNotNeeded(
  itemId: string,
): Promise<GiftItem | null> {
  console.log(`Firestore MARK_NOT_NEEDED: Marking gift ${itemId} as not needed...`);
  const itemDocRef = doc(db, "gifts", itemId);
  try {
    const itemSnap = await getDoc(itemDocRef);
    if (!itemSnap.exists()) {
      console.warn(`Firestore MARK_NOT_NEEDED: Gift ${itemId} not found.`);
      return null;
    }
    // Check if already marked to avoid unnecessary write/revalidation
    if (itemSnap.data()?.status === 'not_needed') {
        console.log(`Firestore MARK_NOT_NEEDED: Gift ${itemId} is already marked as not needed.`);
        return giftFromDoc(itemSnap);
    }

    const updateData = {
      status: "not_needed" as const,
      selectedBy: null, // Clear selector info
      selectionDate: null, // Clear selection date
    };
    await updateDoc(itemDocRef, updateData);
    console.log(`Firestore MARK_NOT_NEEDED: Gift ${itemId} marked as not needed.`);
    forceRevalidation(); // Revalidate AFTER success
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(`Firestore MARK_NOT_NEEDED: Error marking gift ${itemId} as not needed:`, error);
    if ((error as FirestoreError)?.code === 'permission-denied') {
        console.error(`Firestore MARK_NOT_NEEDED: PERMISSION DENIED marking gift ${itemId}. Requires admin privileges.`);
     }
    // Rethrow to indicate failure
     throw error;
  }
}

/**
 * Adds a user suggestion as a new 'selected' gift item in Firestore. (User Action)
 * Assumes Firestore rules allow creating new documents with status 'selected'.
 */
export async function addSuggestion(
  suggestionData: SuggestionData,
): Promise<GiftItem | null> { // Return null on failure
  console.log(
    `Firestore ADD_SUGGESTION: Adding suggestion from ${suggestionData.suggesterName}...`,
    suggestionData
  );
  const effectiveSuggesterName = suggestionData.suggesterName?.trim() || "Convidado(a)";

  // Prepare data using serverTimestamps for dates
  const newItemData = {
    name: suggestionData.itemName.trim(), // Trim whitespace
    description: suggestionData.itemDescription?.trim() || null, // Use null for empty optional fields
    category: "Outros", // Suggestions default to 'Outros'
    status: "selected" as const, // Add as already selected
    selectedBy: effectiveSuggesterName,
    selectionDate: serverTimestamp(), // Use Firestore server Timestamp
    createdAt: serverTimestamp(), // Track creation time with server Timestamp
  };
  try {
    // Ensure no 'undefined' values are accidentally sent
    const cleanItemData: { [key: string]: any } = {};
    for (const key in newItemData) {
        if (newItemData[key as keyof typeof newItemData] !== undefined) {
            cleanItemData[key] = newItemData[key as keyof typeof newItemData];
        }
    }

    const docRef = await addDoc(giftsCollectionRef, cleanItemData);
    console.log(
      `Firestore ADD_SUGGESTION: Suggestion added as new gift with ID: ${docRef.id}`
    );
    forceRevalidation(); // Revalidate AFTER adding
    const newDocSnap = await getDoc(docRef); // Fetch the newly created document
    if (!newDocSnap.exists()) {
        console.error(`Firestore ADD_SUGGESTION: Failed to fetch newly created suggestion document ${docRef.id}.`);
         return null; // Indicate failure
    }
    return giftFromDoc(newDocSnap);
  } catch (error) {
    console.error("Firestore ADD_SUGGESTION: Error adding suggestion:", error);
    if ((error as FirestoreError)?.code === 'permission-denied') {
        console.error(`Firestore ADD_SUGGESTION: PERMISSION DENIED adding suggestion. Check Firestore rules allow create in 'gifts' collection with status 'selected'.`);
     } else if ((error as FirestoreError)?.code === 'invalid-argument') {
        console.error("Firestore ADD_SUGGESTION: Invalid argument error. Check data:", newItemData, error);
     }
     // Return null to indicate failure
    return null;
  }
}

/**
 * Reverts a 'selected' or 'not_needed' gift back to 'available' in Firestore. (Admin Action)
 * Assumes admin privileges are required by Firestore rules.
 */
export async function revertSelection(itemId: string): Promise<GiftItem | null> {
  console.log(`Firestore REVERT: Reverting selection/status for gift ${itemId}...`);
  const itemDocRef = doc(db, "gifts", itemId);
  try {
    const itemSnap = await getDoc(itemDocRef);
    if (!itemSnap.exists()) {
      console.warn(`Firestore REVERT: Gift ${itemId} not found for reverting.`);
      return null;
    }
    const currentStatus = itemSnap.data()?.status;
    if (currentStatus === "available") {
      console.warn(
        `Firestore REVERT: Gift ${itemId} is already available. No reversion needed.`
      );
      return giftFromDoc(itemSnap); // Return current state
    }

    const updateData = {
      status: "available" as const,
      selectedBy: null, // Remove selector info
      selectionDate: null, // Remove selection date
    };
    await updateDoc(itemDocRef, updateData);
    console.log(`Firestore REVERT: Gift ${itemId} reverted to available.`);
    forceRevalidation(); // Revalidate AFTER success
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(`Firestore REVERT: Error reverting gift ${itemId}:`, error);
    if ((error as FirestoreError)?.code === 'permission-denied') {
        console.error(`Firestore REVERT: PERMISSION DENIED reverting gift ${itemId}. Requires admin privileges.`);
     }
    // Re-throw to indicate failure
    throw error;
  }
}

/**
 * Adds a new gift item via the admin panel to Firestore. (Admin Action)
 * Assumes admin privileges are required by Firestore rules.
 */
export async function addGift(
    newItemData: Omit<GiftItem, "id" | "createdAt" | "selectionDate">
  ): Promise<GiftItem | null> { // Return null on failure
    console.log(`Firestore ADD_GIFT: Admin adding new gift "${newItemData.name}"...`, newItemData);

    let selectionTimestamp: Timestamp | null = null;
    let finalSelectedBy: string | null = null;
    const finalStatus = newItemData.status || "available"; // Default to available if not provided

    if (finalStatus === "selected") {
        finalSelectedBy = newItemData.selectedBy?.trim() || "Admin"; // Default to Admin if selected and no name provided
        selectionTimestamp = serverTimestamp() as Timestamp; // Use server time for admin additions marked selected initially
    } else { // Status is 'available' or 'not_needed'
        finalSelectedBy = null;
        selectionTimestamp = null;
    }


    const giftToAdd = {
      name: newItemData.name.trim(),
      description: newItemData.description?.trim() || null,
      category: newItemData.category.trim(), // Ensure category is required and trimmed
      status: finalStatus,
      selectedBy: finalSelectedBy, // Use null if not selected
      selectionDate: selectionTimestamp, // Use null if not selected
      createdAt: serverTimestamp(), // Use server Timestamp
    };

     // Ensure no 'undefined' values are sent. Firestore supports 'null'.
     const cleanGiftToAdd: { [key: string]: any } = {};
     for (const key in giftToAdd) {
       const value = giftToAdd[key as keyof typeof giftToAdd];
       if (value !== undefined) {
         cleanGiftToAdd[key] = value;
       }
     }

    console.log("Firestore ADD_GIFT: Data being sent to addDoc:", cleanGiftToAdd);


    try {
      const docRef = await addDoc(giftsCollectionRef, cleanGiftToAdd);
      console.log(`Firestore ADD_GIFT: Gift added with ID: ${docRef.id}`);
      forceRevalidation(); // Revalidate AFTER adding
      const newDocSnap = await getDoc(docRef);
       if (!newDocSnap.exists()) {
           console.error(`Firestore ADD_GIFT: Failed to fetch newly created gift document ${docRef.id}.`);
           return null; // Indicate failure
      }
      return giftFromDoc(newDocSnap);
    } catch (error) {
      console.error(`Firestore ADD_GIFT: Error adding gift "${newItemData.name}":`, error);
      if ((error as FirestoreError)?.code === 'permission-denied') {
          console.error(`Firestore ADD_GIFT: PERMISSION DENIED adding gift ${newItemData.name}. Requires admin privileges.`);
       } else if ((error as FirestoreError)?.code === 'invalid-argument') {
          console.error("Firestore ADD_GIFT: Invalid argument error. Check data types and ensure no undefined values:", cleanGiftToAdd, error);
       }
      // Return null to indicate failure
      return null;
    }
  }


/**
 * Updates an existing gift item in Firestore. (Admin Action)
 * Assumes admin privileges are required by Firestore rules.
 */
export async function updateGift(
    itemId: string,
    updates: Partial<Omit<GiftItem, "id" | "createdAt">>
  ): Promise<GiftItem | null> {
    console.log(`Firestore UPDATE_GIFT: Updating gift ${itemId}...`, updates);
    const itemDocRef = doc(db, "gifts", itemId);

    // Prepare update data, cleaning potential undefined values and handling dates
    const updateData: { [key: string]: any } = {};
    let statusChanged = false;
    let newStatus: GiftItem['status'] | undefined = undefined;

    // Iterate over updates to build the data object, handle types and nulls
    (Object.keys(updates) as Array<keyof typeof updates>).forEach(key => {
        const value = updates[key];
        if (value === undefined) {
             console.warn(`Firestore UPDATE_GIFT: Undefined value received for field '${key}'. Skipping field.`);
             return; // Skip undefined values entirely
        }

        if (key === 'selectionDate') {
             // Handle potential date strings or null
              if (value instanceof Date) {
                  updateData[key] = Timestamp.fromDate(value);
              } else if (typeof value === 'string') {
                  try {
                      const parsedDate = new Date(value);
                      updateData[key] = !isNaN(parsedDate.getTime()) ? Timestamp.fromDate(parsedDate) : null;
                  } catch (e) {
                      console.warn("Firestore UPDATE_GIFT: Could not parse selection date string, setting to null:", value, e);
                      updateData[key] = null;
                  }
              } else {
                  updateData[key] = null; // Default to null if not a valid date string or Date object
              }
        } else if ((key === 'description' || key === 'selectedBy') && value === "") {
            // Treat empty strings as null for optional text fields
            updateData[key] = null;
        } else if (key === 'status') {
            statusChanged = updates.status !== undefined; // Check if status is explicitly in updates
            newStatus = updates.status;
            updateData[key] = updates.status;
        } else if (key === 'name' || key === 'category') {
             // Trim required string fields
             updateData[key] = typeof value === 'string' ? value.trim() : value;
        } else if (key === 'selectedBy') {
             updateData[key] = typeof value === 'string' ? value.trim() : null; // Trim or null
        }
        else {
            // Assign other valid values directly
            updateData[key] = value;
        }
    });


    // Apply logic based on status change *after* processing all direct updates
    if (statusChanged && newStatus) {
        if (newStatus !== "selected") {
            // If changing to 'available' or 'not_needed', ensure selection info is cleared
            updateData.selectedBy = null;
            updateData.selectionDate = null;
        } else { // Changing to 'selected'
             // Ensure selectedBy exists (default to "Admin" if missing/null/empty when status becomes 'selected')
             updateData.selectedBy = updateData.selectedBy || "Admin";
             // Ensure selectionDate exists (set to now if not provided or explicitly null)
             updateData.selectionDate = updateData.selectionDate || serverTimestamp();
        }
    } else if (updateData.status === 'selected') { // Ensure consistency if status remains 'selected'
         updateData.selectedBy = updateData.selectedBy || "Admin";
         updateData.selectionDate = updateData.selectionDate || serverTimestamp();
    } else if (updateData.status === 'available' || updateData.status === 'not_needed') {
         // Ensure consistency if status remains non-selected
         updateData.selectedBy = null;
         updateData.selectionDate = null;
    }

    // Clean out any remaining undefined keys just in case
     Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

     console.log("Firestore UPDATE_GIFT: Final update data:", updateData);

    if (Object.keys(updateData).length === 0) {
        console.log("Firestore UPDATE_GIFT: No valid fields to update. Aborting.");
        const currentSnap = await getDoc(itemDocRef);
        return currentSnap.exists() ? giftFromDoc(currentSnap) : null;
    }

    try {
        await updateDoc(itemDocRef, updateData);
        console.log(`Firestore UPDATE_GIFT: Gift ${itemId} updated successfully.`);
        forceRevalidation(); // Revalidate AFTER success
        const updatedSnap = await getDoc(itemDocRef);
        return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
    } catch (error) {
        console.error(`Firestore UPDATE_GIFT: Error updating gift ${itemId}:`, error);
        if ((error as FirestoreError)?.code === 'permission-denied') {
            console.error(`Firestore UPDATE_GIFT: PERMISSION DENIED updating gift ${itemId}. Requires admin privileges.`);
        } else if ((error as FirestoreError)?.code === 'invalid-argument') {
            console.error("Firestore UPDATE_GIFT: Invalid argument error during update. Check data types:", updateData, error);
        }
        // Re-throw to indicate failure
        throw error;
    }
}

/**
 * Deletes a gift item from Firestore. (Admin Action)
 * Assumes admin privileges are required by Firestore rules.
 */
export async function deleteGift(itemId: string): Promise<boolean> {
  console.log(`Firestore DELETE: Deleting gift ${itemId}...`);
  const itemDocRef = doc(db, "gifts", itemId);
  try {
    await deleteDoc(itemDocRef);
    console.log(`Firestore DELETE: Gift ${itemId} deleted successfully.`);
    forceRevalidation(); // Revalidate AFTER success
    return true;
  } catch (error) {
    console.error(`Firestore DELETE: Error deleting gift ${itemId}:`, error);
     if ((error as FirestoreError)?.code === 'permission-denied') {
        console.error(`Firestore DELETE: PERMISSION DENIED deleting gift ${itemId}. Requires admin privileges.`);
     }
    // Return false to indicate failure, don't re-throw unless critical
    return false;
  }
}

/**
 * Exports gift data to a CSV string. (Admin Action or Public Read)
 * Assumes caller has read access to gifts collection.
 */
export async function exportGiftsToCSV(): Promise<string> {
    console.log("Firestore EXPORT: Exporting gifts to CSV...");
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
            if (item.selectionDate) { // Now expecting ISO string or null
                try {
                    const date = new Date(item.selectionDate);
                     if (!isNaN(date.getTime())) {
                       selectionDateStr = date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
                     }
                } catch (e) { console.warn("Could not parse selection date string for CSV:", item.selectionDate); }
            }
            let createdAtStr = "";
             if (item.createdAt) { // Now expecting ISO string or null
                try {
                     const date = new Date(item.createdAt);
                      if (!isNaN(date.getTime())) {
                        createdAtStr = date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
                     }
                } catch (e) { console.warn("Could not parse creation date string for CSV:", item.createdAt); }
            }

            const description = item.description ?? "";
            const selectedBy = item.selectedBy ?? "";

            // Function to escape CSV special characters (quotes and commas)
             const escapeCsv = (field: string | number | null | undefined): string => {
               if (field === null || field === undefined) return '""';
               const stringField = String(field);
               // Escape double quotes by doubling them and enclose in double quotes if it contains comma, quote, or newline
               if (stringField.includes('"') || stringField.includes(',') || stringField.includes('\n')) {
                 return `"${stringField.replace(/"/g, '""')}"`;
               }
               return stringField; // Return as is if no special characters
             };


            return [
                escapeCsv(item.id),
                escapeCsv(item.name),
                escapeCsv(description),
                escapeCsv(item.category),
                escapeCsv(item.status),
                escapeCsv(selectedBy),
                escapeCsv(selectionDateStr),
                escapeCsv(createdAtStr),
            ]
            .join(","); // Join escaped values
        });

        console.log("Firestore EXPORT: CSV export generated successfully.");
        // Ensure headers are also properly handled if they contain commas or quotes
        const escapedHeaders = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",");
        return [escapedHeaders, ...rows].join("\n");
    } catch (error) {
        console.error("Firestore EXPORT: Error exporting gifts to CSV:", error);
        throw new Error("Erro ao gerar o arquivo CSV."); // Throw a user-friendly error
    }
}

// Consider calling initialization only under specific conditions,
// e.g., via an admin interface button or a setup script, not on every server start.
// initializeFirestoreData().catch(err => console.error("Initial Firestore check failed:", err));
