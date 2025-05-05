
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
// Define collection references with converters for strong typing
const giftsCollectionRef = collection(db, "gifts") as CollectionReference<Omit<GiftItem, 'id'>>;
const settingsDocRef = doc(db, "settings", "main") as DocumentReference<EventSettings>;

// --- Firestore Rules Definition (for reference, implement in Firebase Console) ---
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Settings: Allow anyone to read, only admins to write
    match /settings/main {
      allow read: if true;
      allow write: if isAdmin();
    }

    // Gifts: Allow anyone to read.
    // Allow anyone to write (select/suggest) under specific conditions.
    // Allow admin to do anything.
    match /gifts/{giftId} {
      allow read: if true;

      // Allow creating (suggesting) items as 'selected' by anyone
      allow create: if request.resource.data.status == 'selected' && request.resource.data.selectedBy is string && request.resource.data.selectedBy != '';

      // Allow updating an 'available' item to 'selected' by anyone
      allow update: if isAdmin() || (
                       resource.data.status == 'available' &&
                       request.resource.data.status == 'selected' &&
                       request.resource.data.selectedBy is string && request.resource.data.selectedBy != '' &&
                       request.resource.data.selectionDate is timestamp &&
                       // Prevent changing other fields during selection
                       request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'selectedBy', 'selectionDate'])
                     );

      // Allow admin full write access (includes delete, mark not needed, revert)
      allow write: if isAdmin(); // create, update, delete for admin
    }

    // Simple admin check (replace with actual admin UIDs)
    function isAdmin(){
      // IMPORTANT: Replace with actual admin UIDs from Firebase Authentication
      return request.auth != null && request.auth.uid in ['ADMIN_UID_1_HERE', 'ADMIN_UID_2_HERE'];
    }
  }
}
*/
// --- End Firestore Rules Definition ---


// Helper function to convert Firestore Timestamps in gift items
const giftFromDoc = (docSnapshot: any): GiftItem => {
    const data = docSnapshot.data();
    // Basic validation for required fields during conversion
    if (!data || !data.name || !data.category || !data.status) {
        console.error(`Firestore: Invalid data format for document ID ${docSnapshot.id}`, data);
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
          : data.selectionDate ?? null, // Keep string/null if already so
      createdAt: data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : data.createdAt ?? null, // Keep string/null if already so
    };
  };


// Function to force revalidation of specific paths
const forceRevalidation = () => {
  console.log("Revalidating paths: / and /admin");
  // Use 'layout' to revalidate the entire layout, including data fetches in Server Components
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
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
      console.log("Firestore Init: Settings document not found, initializing...");
      await setDoc(settingsDocRef, defaultEventSettings);
      console.log("Firestore Init: Default settings added.");
    } else {
        // Merge defaults with existing settings to ensure all fields are present
        const existingSettings = settingsSnap.data();
        const mergedSettings = { ...defaultEventSettings, ...existingSettings };
        // Only write if there are missing default fields
        if (JSON.stringify(existingSettings) !== JSON.stringify(mergedSettings)) {
            console.log("Firestore Init: Merging default settings with existing document...");
            await setDoc(settingsDocRef, mergedSettings, { merge: true });
            console.log("Firestore Init: Settings document updated with defaults.");
        } else {
             console.log("Firestore Init: Settings document already exists and is complete.");
        }
    }

    // Check gifts (only add if completely empty)
    const giftsQuerySnapshot = await getDocs(query(giftsCollectionRef));
    if (giftsQuerySnapshot.empty) {
      console.log("Firestore Init: Gifts collection empty, initializing defaults...");
      const batch: WriteBatch = writeBatch(db);
      defaultGiftItems.forEach((item) => {
        const docRef = doc(giftsCollectionRef); // Auto-generate ID
        batch.set(docRef, {
          ...item,
          createdAt: serverTimestamp(),
          description: item.description ?? null, // Ensure null if undefined
          selectedBy: item.selectedBy ?? null, // Ensure null if undefined
          selectionDate: item.selectionDate ?? null, // Ensure null if undefined
        });
      });
      await batch.commit();
      console.log("Firestore Init: Default gifts added.");
    } else {
        console.log(`Firestore Init: Gifts collection already contains ${giftsQuerySnapshot.size} items. Skipping default initialization.`);
    }
    console.log("Firestore Init: Initialization check complete.");
    forceRevalidation(); // Revalidate after potential changes
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
 * Assumes public read access is configured in Firestore rules.
 */
export const getEventSettings = async (): Promise<EventSettings> => {
    const settingsPath = settingsDocRef.path;
    console.log(`Firestore GET: Attempting to fetch event settings from path: ${settingsPath}`);
    try {
      const docSnap = await getDoc(settingsDocRef);
      if (docSnap.exists()) {
        console.log(`Firestore GET: Event settings found at ${settingsPath}.`);
        const fetchedData = docSnap.data();
        // Ensure all keys from default exist, merging fetched data over defaults
        const completeSettings = {
            ...defaultEventSettings,
            ...fetchedData,
            babyName: fetchedData.babyName ?? null, // Explicit null handling
            headerImageUrl: fetchedData.headerImageUrl ?? null, // Explicit null handling
          };
        return completeSettings;
      } else {
        console.warn(`Firestore GET: Settings document '${settingsPath}' does not exist. Returning defaults.`);
        // If the document doesn't exist, we should not attempt to write defaults here
        // as this function might be called by non-admins. Initialization is separate.
        return defaultEventSettings;
      }
    } catch (error) {
      console.error(`Firestore GET: Error fetching event settings from ${settingsPath}:`, error);
       if ((error as FirestoreError)?.code === 'permission-denied') {
          console.error("Firestore GET: PERMISSION DENIED fetching event settings. Check Firestore rules allow read on 'settings/main'.");
       } else {
          console.error("Firestore GET: An unexpected error occurred while fetching settings:", error)
       }
      // Return defaults for resilience, but log the error.
      return defaultEventSettings;
    }
  };

/**
 * Fetches all gift items from Firestore, ordered by creation time.
 * Assumes public read access is configured in Firestore rules.
 */
export const getGifts = async (): Promise<GiftItem[]> => {
    console.log("Firestore GET: Fetching gifts...");
    try {
        // Order by createdAt (desc) then by name (asc) for consistent ordering
        const q = query(giftsCollectionRef, orderBy("createdAt", "desc"), orderBy("name", "asc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.log("Firestore GET: Gifts collection is empty.");
            return [];
        } else {
            const gifts = querySnapshot.docs.map(giftFromDoc);
            console.log(`Firestore GET: Fetched ${gifts.length} gifts.`);
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
 * Assumes admin privileges are required by Firestore rules.
 */
export async function updateEventSettings(
  updates: Partial<EventSettings>,
): Promise<EventSettings> {
   const settingsPath = settingsDocRef.path;
  console.log(`Firestore UPDATE: Updating event settings at ${settingsPath}...`, updates);
  try {
    const dataToUpdate: Partial<EventSettings> = {};
    // Ensure only valid keys are updated and handle nulls correctly
    (Object.keys(updates) as Array<keyof EventSettings>).forEach(key => {
        if (key in defaultEventSettings) { // Only update keys that exist in the model
            if (key === 'babyName' || key === 'headerImageUrl') {
                dataToUpdate[key] = updates[key] || null; // Set to null if falsy
            } else if (updates[key] !== undefined) { // Allow explicit nulls, skip undefined
                dataToUpdate[key] = updates[key];
            }
        }
    });

    // Use setDoc with merge:true for safer updates (won't overwrite missing fields)
    await setDoc(settingsDocRef, dataToUpdate, { merge: true });
    console.log("Firestore UPDATE: Event settings updated successfully.");
    forceRevalidation(); // Revalidate paths after successful update

    // Fetch and return the updated settings to confirm
    const updatedSnap = await getDoc(settingsDocRef);
    if (!updatedSnap.exists()) {
        console.error("Firestore UPDATE: Settings document disappeared after update!");
        return defaultEventSettings; // Should not happen
    }
    const fetchedData = updatedSnap.data();
    return {
        ...defaultEventSettings,
        ...fetchedData,
        babyName: fetchedData?.babyName ?? null,
        headerImageUrl: fetchedData?.headerImageUrl ?? null,
     };

  } catch (error) {
    console.error(`Firestore UPDATE: Error updating event settings at ${settingsPath}:`, error);
    if ((error as FirestoreError)?.code === 'permission-denied') {
        console.error(`Firestore UPDATE: PERMISSION DENIED updating event settings at ${settingsPath}. Requires admin privileges.`);
     }
    throw error; // Re-throw for the UI to handle
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
    // It's safer to perform this check within Firestore rules using transactions or checks.
    // Client-side checks can lead to race conditions. Assume rules handle the 'available' check.
    const effectiveGuestName = guestName?.trim() || "Convidado(a)"; // Ensure name is not empty

    const updateData = {
      status: "selected" as const,
      selectedBy: effectiveGuestName,
      selectionDate: serverTimestamp(), // Use Firestore server Timestamp
    };

    // This update might fail if rules aren't met (e.g., item not 'available')
    await updateDoc(itemDocRef, updateData);
    console.log(`Firestore SELECT: Gift ${itemId} selected successfully.`);
    forceRevalidation(); // Revalidate after successful selection

    const updatedSnap = await getDoc(itemDocRef); // Re-fetch the updated item
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;

  } catch (error) {
    console.error(`Firestore SELECT: Error selecting gift ${itemId}:`, error);
     if ((error as FirestoreError)?.code === 'permission-denied') {
        console.error(`Firestore SELECT: PERMISSION DENIED selecting gift ${itemId}. Check Firestore rules allow update on 'gifts/{giftId}' when status is 'available'.`);
     } else if ((error as FirestoreError)?.message.includes("satisfy the constraint")) {
         console.warn(`Firestore SELECT: Gift ${itemId} likely already selected or status changed. Rule constraint not met.`);
         // Optionally revalidate here too, as the state might have changed
         forceRevalidation();
     } else {
         console.error(`Firestore SELECT: An unexpected error occurred:`, error);
     }
    // Don't re-throw permission/constraint errors usually, let UI handle gracefully.
    // Re-throw other unexpected errors.
     if (!( (error as FirestoreError)?.code === 'permission-denied' || (error as FirestoreError)?.message.includes("satisfy the constraint"))) {
        throw error;
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
    forceRevalidation();
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(`Firestore MARK_NOT_NEEDED: Error marking gift ${itemId} as not needed:`, error);
    if ((error as FirestoreError)?.code === 'permission-denied') {
        console.error(`Firestore MARK_NOT_NEEDED: PERMISSION DENIED marking gift ${itemId}. Requires admin privileges.`);
     }
    throw error; // Re-throw for UI handling
  }
}

/**
 * Adds a user suggestion as a new 'selected' gift item in Firestore. (User Action)
 * Assumes Firestore rules allow creating new documents with status 'selected'.
 */
export async function addSuggestion(
  suggestionData: SuggestionData,
): Promise<GiftItem> {
  console.log(
    `Firestore ADD_SUGGESTION: Adding suggestion from ${suggestionData.suggesterName}...`,
    suggestionData
  );
  const effectiveSuggesterName = suggestionData.suggesterName?.trim() || "Convidado(a)";

  const newItemData: Omit<GiftItem, "id"> = {
    name: suggestionData.itemName.trim(), // Trim whitespace
    description: suggestionData.itemDescription?.trim() || null, // Use null for empty optional fields
    category: "Outros", // Suggestions default to 'Outros'
    status: "selected" as const, // Add as already selected
    selectedBy: effectiveSuggesterName,
    selectionDate: serverTimestamp(), // Use Firestore server Timestamp
    createdAt: serverTimestamp(), // Track creation time with server Timestamp
  };
  try {
    const docRef = await addDoc(giftsCollectionRef, newItemData);
    console.log(
      `Firestore ADD_SUGGESTION: Suggestion added as new gift with ID: ${docRef.id}`
    );
    forceRevalidation(); // Revalidate after adding
    const newDocSnap = await getDoc(docRef); // Fetch the newly created document
    if (!newDocSnap.exists()) {
        console.error(`Firestore ADD_SUGGESTION: Failed to fetch newly created suggestion document ${docRef.id}.`);
        // Attempt to return the data sent, though ID and timestamps will be missing/client-side
        return {
            id: docRef.id, // At least we have the ID
            ...newItemData,
            selectionDate: new Date().toISOString(), // Placeholder
            createdAt: new Date().toISOString(), // Placeholder
        }
    }
    return giftFromDoc(newDocSnap);
  } catch (error) {
    console.error("Firestore ADD_SUGGESTION: Error adding suggestion:", error);
    if ((error as FirestoreError)?.code === 'permission-denied') {
        console.error(`Firestore ADD_SUGGESTION: PERMISSION DENIED adding suggestion. Check Firestore rules allow create in 'gifts' collection with status 'selected'.`);
     }
    throw error; // Re-throw for UI handling
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
    forceRevalidation();
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(`Firestore REVERT: Error reverting gift ${itemId}:`, error);
    if ((error as FirestoreError)?.code === 'permission-denied') {
        console.error(`Firestore REVERT: PERMISSION DENIED reverting gift ${itemId}. Requires admin privileges.`);
     }
    throw error; // Re-throw for UI handling
  }
}

/**
 * Adds a new gift item via the admin panel to Firestore. (Admin Action)
 * Assumes admin privileges are required by Firestore rules.
 */
export async function addGift(
    newItemData: Omit<GiftItem, "id" | "createdAt" | "selectionDate"> & {
      selectionDate?: string | Date | Timestamp | null; // Allow various date inputs + null for form flexibility
    }
  ): Promise<GiftItem> {
    console.log(`Firestore ADD_GIFT: Admin adding new gift "${newItemData.name}"...`, newItemData);

    let selectionTimestamp: Timestamp | null = null;
    let finalSelectedBy: string | null = null;
    const finalStatus = newItemData.status || "available"; // Default to available if not provided

    if (finalStatus === "selected") {
        finalSelectedBy = newItemData.selectedBy?.trim() || "Admin"; // Default to Admin if selected and no name provided
        // Convert provided date or use server time
        if (newItemData.selectionDate) {
            if (newItemData.selectionDate instanceof Timestamp) {
                selectionTimestamp = newItemData.selectionDate;
            } else if (newItemData.selectionDate instanceof Date) {
                selectionTimestamp = Timestamp.fromDate(newItemData.selectionDate);
            } else if (typeof newItemData.selectionDate === 'string') {
                 try {
                   const parsedDate = new Date(newItemData.selectionDate);
                   if (!isNaN(parsedDate.getTime())) {
                       selectionTimestamp = Timestamp.fromDate(parsedDate);
                   } else {
                       console.warn("Invalid date string for selectionDate, using server time.", newItemData.selectionDate);
                       selectionTimestamp = serverTimestamp() as Timestamp; // Fallback
                   }
                 } catch (e) {
                     console.warn("Error parsing date string for selectionDate, using server time.", newItemData.selectionDate, e);
                     selectionTimestamp = serverTimestamp() as Timestamp; // Fallback
                 }
            } else {
                console.warn("Invalid type for selectionDate, using server time.", typeof newItemData.selectionDate);
                selectionTimestamp = serverTimestamp() as Timestamp; // Fallback
            }
        } else {
            selectionTimestamp = serverTimestamp() as Timestamp; // Use server time if no selectionDate provided for 'selected' status
        }
    } else { // Status is 'available' or 'not_needed'
        finalSelectedBy = null;
        selectionTimestamp = null;
    }


    const giftToAdd: Omit<GiftItem, "id"> = {
      name: newItemData.name.trim(),
      description: newItemData.description?.trim() || null,
      category: newItemData.category.trim(), // Ensure category is required and trimmed
      status: finalStatus,
      selectedBy: finalSelectedBy,
      selectionDate: selectionTimestamp,
      createdAt: serverTimestamp(), // Use server Timestamp
    };

    console.log("Firestore ADD_GIFT: Data being sent to addDoc:", giftToAdd);

    try {
      // Ensure no 'undefined' values are sent. Firestore supports 'null'.
      const cleanGiftToAdd = Object.fromEntries(
          Object.entries(giftToAdd).filter(([_, v]) => v !== undefined)
      ) as Omit<GiftItem, "id">; // Should be safe if types are right


      const docRef = await addDoc(giftsCollectionRef, cleanGiftToAdd);
      console.log(`Firestore ADD_GIFT: Gift added with ID: ${docRef.id}`);
      forceRevalidation();
      const newDocSnap = await getDoc(docRef);
       if (!newDocSnap.exists()) {
           console.error(`Firestore ADD_GIFT: Failed to fetch newly created gift document ${docRef.id}.`);
           // Return optimistic data (ID known, timestamps estimated)
           return {
                id: docRef.id,
                ...cleanGiftToAdd,
                createdAt: new Date().toISOString(), // Client time approximation
                selectionDate: selectionTimestamp instanceof Timestamp
                    ? selectionTimestamp.toDate().toISOString()
                    : null,
           } as GiftItem;
      }
      return giftFromDoc(newDocSnap);
    } catch (error) {
      console.error(`Firestore ADD_GIFT: Error adding gift "${newItemData.name}":`, error);
      if ((error as FirestoreError)?.code === 'permission-denied') {
          console.error(`Firestore ADD_GIFT: PERMISSION DENIED adding gift ${newItemData.name}. Requires admin privileges.`);
       } else if ((error as FirestoreError)?.code === 'invalid-argument') {
          console.error("Firestore ADD_GIFT: Invalid argument error. Check data types and ensure no undefined values:", giftToAdd, error);
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
            // Skip undefined values entirely to avoid Firestore errors
             console.warn(`Undefined value received for field '${key}' during update. Skipping field.`);
             return; // Skip this key
        }

        if (key === 'selectionDate') {
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
                 updateData[key] = value;
             } else {
                  console.warn("Invalid type provided for selectionDate, setting to null:", value);
                  updateData[key] = null;
             }
        } else if ((key === 'description' || key === 'selectedBy') && value === "") {
            // Treat empty strings as null for optional text fields
            updateData[key] = null;
        } else if (key === 'status') {
            statusChanged = true;
            newStatus = value as GiftItem['status']; // Keep track of the new status
            updateData[key] = value;
        } else if (key === 'name' || key === 'category') {
             // Trim required string fields
             updateData[key] = typeof value === 'string' ? value.trim() : value;
        } else {
            // Assign other valid values directly
            updateData[key] = value;
        }
    });

    // Apply logic based on status change *after* processing all direct updates
    if (statusChanged && newStatus) {
        if (newStatus !== "selected") {
            // If changing to 'available' or 'not_needed', ensure selection info is cleared
            // Only set to null if not already explicitly set to null in the original updates
            if (!updateData.hasOwnProperty('selectedBy')) updateData.selectedBy = null;
            if (!updateData.hasOwnProperty('selectionDate')) updateData.selectionDate = null;
        } else { // Changing to 'selected'
            // Ensure selectedBy exists (fetch current if not provided, default to "Admin")
            if (!updateData.hasOwnProperty('selectedBy') || updateData.selectedBy === null || updateData.selectedBy === "") {
                 // We might need the current value if not provided in updates
                 // Let's assume if 'selectedBy' isn't in updates, we shouldn't force it here either
                 // unless the caller *intended* to set status=selected without a name?
                 // For safety, let's default to "Admin" if status is set to selected but name is missing/null/empty
                 if (updateData.selectedBy === null || updateData.selectedBy === "") {
                    updateData.selectedBy = "Admin"; // Default admin selector
                 }
                 // If selectedBy was not even in the updates object, we should probably fetch the original name?
                 // This logic gets complex. Simplification: If status changes to 'selected',
                 // 'selectedBy' *must* be provided in the updates or it defaults to 'Admin'.
                 if (!updates.hasOwnProperty('selectedBy')) {
                    updateData.selectedBy = "Admin";
                 }

            }
            // Ensure selectionDate exists (set to now if not provided or explicitly null)
            if (!updateData.hasOwnProperty('selectionDate') || updateData.selectionDate === null) {
                updateData.selectionDate = serverTimestamp(); // Set to now
            }
        }
    }

    // Remove internal tracking variables if they ended up in updateData
    delete updateData.statusChanged;
    delete updateData.newStatus;

     console.log("Firestore UPDATE_GIFT: Final update data:", updateData);

    if (Object.keys(updateData).length === 0) {
        console.log("Firestore UPDATE_GIFT: No valid fields to update. Aborting.");
        // Fetch current data to return consistency
        const currentSnap = await getDoc(itemDocRef);
        return currentSnap.exists() ? giftFromDoc(currentSnap) : null;
    }

    try {
        await updateDoc(itemDocRef, updateData);
        console.log(`Firestore UPDATE_GIFT: Gift ${itemId} updated successfully.`);
        forceRevalidation();
        const updatedSnap = await getDoc(itemDocRef);
        return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
    } catch (error) {
        console.error(`Firestore UPDATE_GIFT: Error updating gift ${itemId}:`, error);
        if ((error as FirestoreError)?.code === 'permission-denied') {
            console.error(`Firestore UPDATE_GIFT: PERMISSION DENIED updating gift ${itemId}. Requires admin privileges.`);
        } else if ((error as FirestoreError)?.code === 'invalid-argument') {
            console.error("Firestore UPDATE_GIFT: Invalid argument error during update. Check data types:", updateData, error);
        }
        throw error; // Re-throw for UI handling
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
    forceRevalidation();
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
            if (item.selectionDate) {
                try {
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

            const description = item.description ?? "";
            const selectedBy = item.selectedBy ?? "";

            return [
                item.id,
                `"${item.name.replace(/"/g, '""')}"`, // Escape quotes in name
                `"${description.replace(/"/g, '""')}"`, // Escape quotes
                item.category,
                item.status,
                `"${selectedBy.replace(/"/g, '""')}"`, // Escape quotes
                selectionDateStr,
                createdAtStr,
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


    