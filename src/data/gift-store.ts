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
import { db, storage } from "@/firebase/config"; // Ensure db and storage are imported correctly
import { uploadImage, deleteImage } from "@/services/storage"; // Import storage service
// Removed email service import

// --- INTERFACE DEFINITIONS ---

export interface GiftItem {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  // Status can be derived for quantity items, but explicitly stored for simplicity and filtering.
  // 'available', 'selected', 'not_needed'
  status: "available" | "selected" | "not_needed";
  selectedBy?: string | null; // For non-quantity items or the last selector of a quantity item
  selectionDate?: string | null; // ISO string date format
  createdAt?: string | null; // ISO string date format
  imageUrl?: string | null; // Store Firebase Storage URL

  // --- Quantity Fields ---
  totalQuantity?: number | null; // Total units available (optional)
  selectedQuantity?: number; // Units already selected (defaults to 0)
}

export interface SuggestionData {
  itemName: string;
  itemDescription?: string;
  suggesterName: string;
  imageDataUri?: string | null; // Suggestion might include an image data URI
  // Removed email fields
  // sendReminderEmail: boolean;
  // guestEmail?: string;
}

export interface EventSettings {
  id: string; // Usually 'main'
  title: string;
  babyName?: string | null; // Optional baby name
  date: string; // Format: YYYY-MM-DD
  time: string; // Format: HH:MM
  location: string;
  address: string;
  welcomeMessage: string;
  duration?: number; // Optional duration in minutes
  headerImageUrl?: string | null; // Store Firebase Storage URL
}

// Added interface for Presence Confirmation
export interface Confirmation {
  id: string;
  names: string[];
  confirmedAt: string; // ISO string date format
}

// --- DEFAULT DATA ---

const defaultGiftItems: Omit<
  GiftItem,
  "id" | "createdAt" | "selectionDate" | "selectedQuantity"
>[] = [
  {
    name: "Body Manga Curta (RN)",
    category: "Roupas",
    status: "available",
    description: "Pacote com 3 unidades, cores neutras.",
    imageUrl: null,
  },
  // Example quantity item
  {
    name: "Fraldas Pampers (P)",
    category: "Higiene",
    status: "available",
    description: "Pacote grande.",
    imageUrl: null,
    totalQuantity: 10,
  },
  {
    name: "Mamadeira Anti-cólica",
    category: "Alimentação",
    status: "available",
    imageUrl: null,
  },
  {
    name: "Móbile Musical",
    category: "Brinquedos",
    status: "available",
    imageUrl: null,
  },
  {
    name: "Lenços Umedecidos",
    category: "Higiene",
    status: "available",
    imageUrl: null,
    totalQuantity: 20,
  }, // Another quantity item
  {
    name: "Termômetro Digital",
    category: "Higiene",
    status: "available",
    imageUrl: null,
  },
  {
    name: "Macacão Pijama (M)",
    category: "Roupas",
    status: "available",
    description: "Algodão macio.",
    imageUrl: null,
  },
  {
    name: "Chupeta Calmante",
    category: "Outros",
    status: "available",
    imageUrl: null,
  },
  {
    name: "Cadeirinha de Descanso",
    category: "Outros",
    status: "available",
    imageUrl: null,
  },
  {
    name: "Pomada para Assaduras",
    category: "Higiene",
    status: "available",
    description: "Marca Bepantol Baby ou similar.",
    imageUrl: null,
  },
];

const defaultEventSettings: EventSettings = {
  id: "main", // Explicitly set ID for the single settings document
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

// --- FIRESTORE REFERENCES ---

const giftsCollectionRef = collection(db, "gifts") as CollectionReference<
  Omit<GiftItem, "id">
>;
const settingsDocRef = doc(
  db,
  "settings",
  "main",
) as DocumentReference<EventSettings>;
const confirmationsCollectionRef = collection(
  db,
  "confirmations",
) as CollectionReference<Omit<Confirmation, "id">>; // Ref for confirmations

// --- HELPER FUNCTIONS ---

/**
 * Helper function to map Firestore document data to GiftItem interface.
 * Handles Firestore Timestamps and potential null values.
 */
const giftFromDoc = (docSnapshot: any): GiftItem | null => {
  const data = docSnapshot.data();
  const docId = docSnapshot.id;

  // Basic validation for required fields
  if (!data || !data.name || !data.category || !data.status) {
    console.error(
      `Firestore Convert: Invalid or missing required fields for gift document ID ${docId}. Data:`,
      data,
    );
    return null; // Skip invalid documents
  }

  // Map Firestore data to GiftItem structure
  return {
    id: docId,
    name: data.name,
    category: data.category,
    // Ensure status is one of the allowed values
    status: ["available", "selected", "not_needed"].includes(data.status)
      ? data.status
      : "available",
    description: data.description ?? null, // Default to null if undefined
    selectedBy: data.selectedBy ?? null, // Default to null if undefined
    // Convert Firestore Timestamp to ISO string safely
    selectionDate:
      data.selectionDate instanceof Timestamp
        ? data.selectionDate.toDate().toISOString()
        : null,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : null,
    imageUrl: data.imageUrl ?? null, // Handle imageUrl, default to null
    // Quantity fields
    totalQuantity:
      typeof data.totalQuantity === "number" ? data.totalQuantity : null,
    selectedQuantity:
      typeof data.selectedQuantity === "number" ? data.selectedQuantity : 0,
  };
};

/**
 * Helper function to map Firestore document data to Confirmation interface.
 */
const confirmationFromDoc = (docSnapshot: any): Confirmation | null => {
  const data = docSnapshot.data();
  const docId = docSnapshot.id;

  if (!data || !Array.isArray(data.names) || !data.confirmedAt) {
    console.error(
      `Firestore Convert: Invalid or missing fields for confirmation document ID ${docId}. Data:`,
      data,
    );
    return null;
  }

  return {
    id: docId,
    names: data.names,
    confirmedAt:
      data.confirmedAt instanceof Timestamp
        ? data.confirmedAt.toDate().toISOString()
        : typeof data.confirmedAt === "string"
          ? data.confirmedAt
          : new Date().toISOString(), // Fallback
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
    if (path !== "/admin") {
      // Avoid double revalidation if the path is already /admin
      revalidatePath("/admin", "layout");
    }
    console.log(
      `Firestore Revalidate: Revalidation calls initiated for ${path} and /admin.`,
    );
  } catch (error) {
    console.error(
      `Firestore Revalidate: Error during revalidatePath for ${path}:`,
      error,
    );
  }
};

// --- INITIALIZATION ---

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
      console.log(
        "Firestore Init: Settings document 'settings/main' not found, initializing...",
      );
      // Ensure default settings have the 'id' if needed for the document path, but don't store it IN the document itself unless required.
      const { id, ...settingsToSave } = defaultEventSettings;
      await setDoc(settingsDocRef, settingsToSave);
      console.log("Firestore Init: Default settings added.");
      forceRevalidation(); // Revalidate after change
    } else {
      console.log(
        "Firestore Init: Settings document 'settings/main' already exists.",
      );
    }

    // Check and initialize gifts
    const giftsQuerySnapshot = await getDocs(query(giftsCollectionRef));
    if (giftsQuerySnapshot.empty) {
      console.log(
        "Firestore Init: Gifts collection empty, initializing defaults...",
      );
      const batch: WriteBatch = writeBatch(db);
      defaultGiftItems.forEach((item) => {
        const docRef = doc(giftsCollectionRef); // Generate a new doc reference
        // Initialize selectedQuantity to 0 for all items
        batch.set(docRef, {
          ...item,
          createdAt: serverTimestamp(),
          selectedQuantity: 0,
        });
      });
      await batch.commit();
      console.log("Firestore Init: Default gifts added.");
      forceRevalidation(); // Revalidate after change
    } else {
      console.log(
        `Firestore Init: Gifts collection already contains ${giftsQuerySnapshot.size} items. Skipping default initialization.`,
      );
    }
    console.log("Firestore Init: Initialization check complete.");
  } catch (error) {
    console.error("Firestore Init: Error during initialization check:", error);
    // Handle specific errors like permission denied if necessary
    if ((error as FirestoreError).code === "permission-denied") {
      console.error(
        "Firestore Init: PERMISSION DENIED during initialization. Check Firestore rules.",
      );
    }
  }
}

// --- DATA STORE FUNCTIONS ---

/**
 * Fetches the main event settings from Firestore.
 * Returns default settings if the document doesn't exist or an error occurs.
 */
export const getEventSettings = async (): Promise<EventSettings> => {
  const settingsPath = settingsDocRef.path;
  console.log(
    `Firestore GET_SETTINGS: Attempting to fetch event settings from path: ${settingsPath}`,
  );
  try {
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
      console.log(
        `Firestore GET_SETTINGS: Event settings found at ${settingsPath}.`,
      );
      // Combine ID with fetched data
      const data = docSnap.data() || {};
      // Ensure headerImageUrl is null if empty or undefined
      const settingsData: EventSettings = {
        id: docSnap.id,
        ...(data as Omit<EventSettings, "id">),
        headerImageUrl: data.headerImageUrl || null,
      };
      return settingsData;
    } else {
      console.warn(
        `Firestore GET_SETTINGS: Settings document '${settingsPath}' does not exist. Returning default settings.`,
      );
      // Return a copy of default settings to avoid mutation issues
      return { ...defaultEventSettings };
    }
  } catch (error) {
    console.error(
      `Firestore GET_SETTINGS: Error fetching event settings from ${settingsPath}:`,
      error,
    );
    // Check if error is permissions related
    if ((error as any)?.code === "permission-denied") {
      console.error(
        "Firestore: PERMISSION DENIED fetching event settings. Check Firestore rules.",
      );
    }
    return { ...defaultEventSettings }; // Return defaults on error for resilience
  }
};

/**
 * Fetches all gift items from Firestore, ordered by creation date descending.
 * Returns an empty array if the collection is empty or an error occurs.
 */
export const getGifts = async (): Promise<GiftItem[]> => {
  console.log(
    "Firestore GET_GIFTS: Fetching gifts from 'gifts' collection, ordered by createdAt desc...",
  );
  try {
    // Query gifts ordered by 'createdAt' timestamp descending
    const q = query(giftsCollectionRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    console.log(
      `Firestore GET_GIFTS: Query executed. Found ${querySnapshot.size} documents.`,
    );

    if (querySnapshot.empty) {
      console.log("Firestore GET_GIFTS: Gifts collection is empty.");
      return []; // Return empty array if no gifts found
    } else {
      // Map Firestore documents to GiftItem objects using the helper function
      const gifts: GiftItem[] = querySnapshot.docs
        .map((docSnapshot) => giftFromDoc(docSnapshot)) // Map and validate each doc
        .filter((item): item is GiftItem => item !== null); // Filter out any null results from invalid docs

      console.log(
        `Firestore GET_GIFTS: Successfully mapped ${gifts.length} valid gifts.`,
      );
      return gifts;
    }
  } catch (error) {
    console.error("Firestore GET_GIFTS: Error fetching gifts:", error);
    // Check if error is permissions related
    if ((error as any)?.code === "permission-denied") {
      console.error(
        "Firestore: PERMISSION DENIED fetching gifts. Check Firestore rules.",
      );
    }
    return []; // Return empty array on error
  }
};

/**
 * Updates the main event settings document in Firestore.
 * Handles header image upload/deletion if a data URI or null is provided.
 */
export async function updateEventSettings(
  updates: Partial<EventSettings>,
): Promise<EventSettings | null> {
  const settingsPath = settingsDocRef.path;
  // Separate image data URI from other updates
  const { id, headerImageUrl: newImageUrlInput, ...otherUpdates } = updates;
  const dataToUpdate: Partial<EventSettings> = { ...otherUpdates };

  console.log(
    `Firestore UPDATE_SETTINGS: Updating event settings at ${settingsPath}...`,
  );

  try {
    // Get current settings to check for existing image URL
    const currentSettingsSnap = await getDoc(settingsDocRef);
    const currentImageUrl = currentSettingsSnap.exists()
      ? currentSettingsSnap.data()?.headerImageUrl
      : null;

    let finalImageUrl: string | null = currentImageUrl; // Start with the current URL

    // Check if a new image (data URI) or removal (null) is requested
    if (
      typeof newImageUrlInput === "string" &&
      newImageUrlInput.startsWith("data:image/")
    ) {
      // New image provided (data URI) - Upload it
      console.log(
        "Firestore UPDATE_SETTINGS: New header image data URI found. Uploading...",
      );
      // Delete old image if it exists
      if (currentImageUrl) {
        console.log(
          "Firestore UPDATE_SETTINGS: Deleting previous header image:",
          currentImageUrl,
        );
        await deleteImage(currentImageUrl).catch((err) =>
          console.error(
            "Firestore UPDATE_SETTINGS: Failed to delete previous header image, continuing...",
            err,
          ),
        ); // Non-critical error
      }
      // Upload new image
      finalImageUrl = await uploadImage(
        newImageUrlInput,
        "header",
        "event_header",
      );
      console.log(
        "Firestore UPDATE_SETTINGS: New header image uploaded. URL:",
        finalImageUrl,
      );
    } else if (newImageUrlInput === null && currentImageUrl) {
      // Explicit removal requested (null) and an image exists
      console.log(
        "Firestore UPDATE_SETTINGS: Header image removal requested. Deleting:",
        currentImageUrl,
      );
      await deleteImage(currentImageUrl).catch((err) =>
        console.error(
          "Firestore UPDATE_SETTINGS: Failed to delete header image during removal, continuing...",
          err,
        ),
      ); // Non-critical error
      finalImageUrl = null;
    } else if (
      typeof newImageUrlInput === "string" &&
      !newImageUrlInput.startsWith("data:image/")
    ) {
      // If it's a string but not a data URI, assume it's an existing URL (likely from initial load, no change needed unless explicitly null)
      console.log(
        "Firestore UPDATE_SETTINGS: Existing header image URL provided, no change needed unless explicitly set to null elsewhere.",
      );
      finalImageUrl = newImageUrlInput; // Keep the existing URL
    }
    // else: No new image URI, no removal requested, or already null - keep finalImageUrl as is (current or initially null)

    // Add the final determined image URL to the update object
    dataToUpdate.headerImageUrl = finalImageUrl;

    console.log("Firestore UPDATE_SETTINGS: Final data being saved:", {
      ...dataToUpdate,
      headerImageUrl: dataToUpdate.headerImageUrl, // Log the final URL
    });

    // Use setDoc with merge: true to update or create if it doesn't exist
    await setDoc(settingsDocRef, dataToUpdate, { merge: true });
    console.log(
      "Firestore UPDATE_SETTINGS: Event settings updated successfully in Firestore.",
    );

    forceRevalidation(); // Revalidate paths after update

    // Fetch and return the updated settings
    const updatedSettings = await getEventSettings();
    return updatedSettings;
  } catch (error) {
    console.error(
      `Firestore UPDATE_SETTINGS: Error updating event settings at ${settingsPath}:`,
      error,
    );
    // Check if error is permissions related
    if ((error as any)?.code === "permission-denied") {
      console.error(
        "Firestore: PERMISSION DENIED updating event settings. Check Firestore rules.",
      );
    }
    return null; // Indicate failure
  }
}

/**
 * Marks a gift item as 'selected' by a guest.
 * Handles both single items and quantity-based items.
 */
export async function selectGift(
  itemId: string,
  guestName: string,
  quantityToSelect: number = 1, // Default to selecting 1 unit
): Promise<GiftItem | null> {
  console.log(
    `Firestore SELECT_GIFT: Selecting gift ${itemId} for ${guestName} (Quantity: ${quantityToSelect})`,
  );
  const itemDocRef = doc(db, "gifts", itemId);

  try {
    // Get current item data first
    const itemSnap = await getDoc(itemDocRef);
    if (!itemSnap.exists()) {
      console.error(`Firestore SELECT_GIFT: Item ${itemId} not found.`);
      return null;
    }
    const currentItem = giftFromDoc(itemSnap);
    if (!currentItem) {
      console.error(
        `Firestore SELECT_GIFT: Failed to parse item ${itemId} data.`,
      );
      return null;
    }

    // --- Handle Quantity Logic ---
    if (currentItem.totalQuantity && currentItem.totalQuantity > 0) {
      // Quantity-based item
      const currentSelected = currentItem.selectedQuantity || 0;
      const remaining = currentItem.totalQuantity - currentSelected;

      if (quantityToSelect > remaining) {
        console.error(
          `Firestore SELECT_GIFT: Cannot select ${quantityToSelect} units of ${itemId}. Only ${remaining} remaining.`,
        );
        throw new Error(
          `Quantidade insuficiente disponível. Restam ${remaining}.`,
        );
      }

      const newSelectedQuantity = currentSelected + quantityToSelect;
      const newStatus =
        newSelectedQuantity >= currentItem.totalQuantity
          ? "selected"
          : "available";

      const updateData = {
        selectedQuantity: newSelectedQuantity,
        status: newStatus, // Update status based on whether all quantity is selected
        selectedBy: guestName, // Update last selected by
        selectionDate: serverTimestamp(), // Update selection date
      };

      await updateDoc(itemDocRef, updateData);
      console.log(
        `Firestore SELECT_GIFT: Updated quantity for ${itemId}. New selected: ${newSelectedQuantity}. Status: ${newStatus}`,
      );
    } else {
      // --- Handle Single Item Logic ---
      if (currentItem.status !== "available") {
        console.warn(
          `Firestore SELECT_GIFT: Item ${itemId} is not available (Status: ${currentItem.status}).`,
        );
        return null; // Item already selected or not needed
      }

      const updateData = {
        status: "selected" as const,
        selectedBy: guestName,
        selectionDate: serverTimestamp(),
      };
      await updateDoc(itemDocRef, updateData);
      console.log(
        `Firestore SELECT_GIFT: Marked single item ${itemId} as selected.`,
      );
    }

    forceRevalidation(); // Revalidate paths

    // --- Fetch Updated Item ---
    const updatedSnap = await getDoc(itemDocRef);
    const updatedItem = updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;

    return updatedItem;
  } catch (error) {
    console.error(
      `Firestore SELECT_GIFT: Error selecting gift ${itemId}:`,
      error,
    );
    // Check if error is permissions related
    if ((error as any)?.code === "permission-denied") {
      console.error(
        "Firestore: PERMISSION DENIED selecting gift. Check Firestore rules.",
      );
    } else if ((error as any)?.code === "not-found") {
      console.error(
        `Firestore SELECT_GIFT: Gift item with ID ${itemId} not found.`,
      );
    }
    // Re-throw the error to be caught by the calling component for user feedback
    throw error;
  }
}

/**
 * Adds a new gift item suggested by a user.
 * Handles optional image upload.
 * The item is automatically marked as 'selected' by the suggester.
 */
export async function addSuggestion(
  suggestionData: SuggestionData,
): Promise<GiftItem | null> {
  console.log(
    `Firestore ADD_SUGGESTION: Adding suggestion from ${suggestionData.suggesterName}.`,
  );

  let uploadedImageUrl: string | null = null;

  try {
    // 1. Upload image if provided
    if (suggestionData.imageDataUri) {
      console.log(
        "Firestore ADD_SUGGESTION: Image data URI found. Uploading image...",
      );
      uploadedImageUrl = await uploadImage(
        suggestionData.imageDataUri,
        "gifts",
        "suggestion",
      );
      console.log(
        "Firestore ADD_SUGGESTION: Image uploaded successfully. URL:",
        uploadedImageUrl,
      );
    }

    // 2. Prepare data for the new gift item in Firestore
    const newItemData = {
      name: suggestionData.itemName.trim(),
      description: suggestionData.itemDescription?.trim() || null,
      category: "Outros", // Default category for suggestions
      status: "selected" as const,
      selectedBy: suggestionData.suggesterName.trim(),
      selectionDate: serverTimestamp(),
      createdAt: serverTimestamp(),
      imageUrl: uploadedImageUrl, // Store the uploaded image URL or null
      selectedQuantity: 1, // Suggestion implies selecting 1 unit
      totalQuantity: 1, // Default total quantity to 1 for suggested items
    };

    // Validate essential fields before adding
    if (!newItemData.name || !newItemData.selectedBy) {
      console.error(
        "Firestore ADD_SUGGESTION: Invalid suggestion data - name and suggesterName are required.",
      );
      // Clean up uploaded image if Firestore add fails due to validation
      if (uploadedImageUrl)
        await deleteImage(uploadedImageUrl).catch((e) =>
          console.error("Cleanup failed", e),
        );
      return null;
    }

    // 3. Add the new document to the 'gifts' collection
    const docRef = await addFirestoreDoc(giftsCollectionRef, newItemData);
    console.log(
      `Firestore ADD_SUGGESTION: Suggestion added as new gift with ID: ${docRef.id}`,
    );
    forceRevalidation(); // Revalidate paths

    // 4. Fetch the newly created item data
    const newDocSnap = await getDoc(docRef);
    const newItem = newDocSnap.exists() ? giftFromDoc(newDocSnap) : null;

    return newItem;
  } catch (error) {
    console.error("Firestore ADD_SUGGESTION: Error adding suggestion:", error);
    // Clean up uploaded image if Firestore add fails
    if (uploadedImageUrl) {
      console.error(
        "Firestore ADD_SUGGESTION: Cleaning up potentially uploaded image due to error.",
      );
      await deleteImage(uploadedImageUrl).catch((e) =>
        console.error("Cleanup failed for image:", uploadedImageUrl, e),
      );
    }
    // Check if error is permissions related
    if ((error as any)?.code === "permission-denied") {
      console.error(
        "Firestore: PERMISSION DENIED adding suggestion. Check Firestore rules.",
      );
    }
    return null; // Indicate failure
  }
}

/**
 * Adds a new gift item (typically by admin). Handles optional image upload and quantity.
 */
export async function addGiftAdmin(
  giftData: Partial<GiftItem> & { imageDataUri?: string | null },
): Promise<GiftItem | null> {
  console.log("Firestore ADD_GIFT_ADMIN: Adding new gift item...");
  const { imageDataUri, totalQuantity, ...itemDetails } = giftData; // Extract totalQuantity
  let uploadedImageUrl: string | null = null;

  try {
    // 1. Upload image if data URI provided
    if (imageDataUri) {
      console.log(
        "Firestore ADD_GIFT_ADMIN: Image data URI found. Uploading image...",
      );
      uploadedImageUrl = await uploadImage(
        imageDataUri,
        "gifts",
        "admin_add",
      );
      console.log(
        "Firestore ADD_GIFT_ADMIN: Image uploaded. URL:",
        uploadedImageUrl,
      );
    }

    // Determine if it's a quantity item
    const isQuantityItem =
      typeof totalQuantity === "number" && totalQuantity > 0;

    // Validate required fields
    if (!itemDetails.name || !itemDetails.category || !itemDetails.status) {
      console.error(
        "Firestore ADD_GIFT_ADMIN: Missing required fields (name, category, status).",
      );
      if (uploadedImageUrl)
        await deleteImage(uploadedImageUrl).catch((e) =>
          console.error("Cleanup failed", e),
        );
      return null;
    }

    const finalDataToAdd: Omit<GiftItem, "id"> & {
      createdAt: any;
      selectionDate: any;
    } = {
      name: itemDetails.name.trim(),
      description: itemDetails.description?.trim() || null,
      category: itemDetails.category,
      // Set status and selectedBy based on quantity or admin input
      status:
        itemDetails.status === "not_needed"
          ? "not_needed"
          : isQuantityItem
            ? "available"
            : itemDetails.status,
      selectedBy:
        itemDetails.status === "selected" && !isQuantityItem
          ? itemDetails.selectedBy?.trim() || "Admin"
          : null,
      selectionDate:
        itemDetails.status === "selected" && !isQuantityItem
          ? serverTimestamp()
          : null,
      createdAt: serverTimestamp(),
      imageUrl: uploadedImageUrl, // Use uploaded URL or null
      // Quantity fields
      totalQuantity: isQuantityItem ? totalQuantity : null,
      selectedQuantity: 0, // Initialize selected quantity to 0,
    };

    // If status is 'selected' (for non-quantity items), selectedBy must not be null or undefined
    if (
      finalDataToAdd.status === "selected" &&
      !isQuantityItem &&
      !finalDataToAdd.selectedBy
    ) {
      console.warn(
        "Firestore ADD_GIFT_ADMIN: Status is 'selected' but 'selectedBy' is missing. Defaulting to 'Admin'.",
      );
      finalDataToAdd.selectedBy = "Admin";
    }
    // If status is 'not_needed', clear selection fields
    if (finalDataToAdd.status === "not_needed") {
      finalDataToAdd.selectedBy = null;
      finalDataToAdd.selectionDate = null;
      finalDataToAdd.selectedQuantity = 0; // Ensure selected quantity is 0
    }

    // Remove undefined fields manually before sending to Firestore
    const cleanedData = Object.fromEntries(
      Object.entries(finalDataToAdd).filter(([, value]) => value !== undefined),
    );

    console.log(
      "Firestore ADD_GIFT_ADMIN: Cleaned Data to Add:",
      cleanedData,
    );

    // 3. Add document to Firestore
    const docRef = await addFirestoreDoc(giftsCollectionRef, cleanedData);
    console.log(
      `Firestore ADD_GIFT_ADMIN: Gift added successfully with ID: ${docRef.id}`,
    );
    forceRevalidation("/admin"); // Revalidate admin page

    // 4. Fetch and return the new item
    const newDocSnap = await getDoc(docRef);
    return newDocSnap.exists() ? giftFromDoc(newDocSnap) : null;
  } catch (error) {
    console.error("Firestore ADD_GIFT_ADMIN: Error adding gift:", error);
    if (uploadedImageUrl) {
      console.error(
        "Firestore ADD_GIFT_ADMIN: Cleaning up potentially uploaded image due to error.",
      );
      await deleteImage(uploadedImageUrl).catch((e) =>
        console.error("Cleanup failed for image:", uploadedImageUrl, e),
      );
    }
    if ((error as any)?.code === "permission-denied") {
      console.error(
        "Firestore: PERMISSION DENIED adding gift. Check Firestore rules.",
      );
    } else if (
      error instanceof Error &&
      error.message.includes("Unsupported field value")
    ) {
      console.error(
        "Firestore ADD_GIFT_ADMIN: Invalid data provided. Potentially undefined field:",
        error,
      );
      console.log("Data attempted to add:", finalDataToAdd);
    }
    throw error; // Re-throw the error for the calling component
  }
}

/**
 * Updates an existing gift item in Firestore.
 * Handles optional image update/removal and quantity changes.
 */
export async function updateGift(
  itemId: string,
  updates: Partial<Omit<GiftItem, "id" | "createdAt" | "selectedQuantity">> & {
    imageDataUri?: string | null | undefined;
  },
): Promise<GiftItem | null> {
  console.log(`Firestore UPDATE_GIFT: Updating gift ${itemId}...`);
  const {
    imageDataUri,
    imageUrl: newImageUrlInput,
    totalQuantity,
    ...otherUpdates
  } = updates;
  const itemDocRef = doc(db, "gifts", itemId);
  const dataToUpdate: Record<string, any> = { ...otherUpdates };

  try {
    // Get current item data to check for existing image URL and quantity
    const currentItemSnap = await getDoc(itemDocRef);
    if (!currentItemSnap.exists()) {
      console.error(`Firestore UPDATE_GIFT: Item with ID ${itemId} not found.`);
      throw new Error(`Item with ID ${itemId} not found.`);
    }
    const currentItemData = currentItemSnap.data();
    const currentImageUrl = currentItemData?.imageUrl || null;
    const currentTotalQuantity =
      typeof currentItemData?.totalQuantity === "number"
        ? currentItemData.totalQuantity
        : null;
    const currentSelectedQuantity =
      typeof currentItemData?.selectedQuantity === "number"
        ? currentItemData.selectedQuantity
        : 0;

    let finalImageUrl: string | null = currentImageUrl; // Start with current URL

    // --- Image Handling Logic ---
    if (
      typeof imageDataUri === "string" &&
      imageDataUri.startsWith("data:image/")
    ) {
      // New image data provided: Upload new, delete old
      console.log(
        "Firestore UPDATE_GIFT: New image data URI found. Uploading...",
      );
      if (currentImageUrl) {
        console.log(
          "Firestore UPDATE_GIFT: Deleting previous image:",
          currentImageUrl,
        );
        await deleteImage(currentImageUrl).catch((err) =>
          console.warn("Failed to delete previous image, continuing...", err),
        );
      }
      finalImageUrl = await uploadImage(imageDataUri, "gifts", itemId); // Use itemId for prefix
      console.log(
        "Firestore UPDATE_GIFT: New image uploaded. URL:",
        finalImageUrl,
      );
    } else if (newImageUrlInput === null && currentImageUrl) {
      // Explicit removal requested (imageUrl: null) and an image exists
      console.log(
        "Firestore UPDATE_GIFT: Image removal requested. Deleting:",
        currentImageUrl,
      );
      await deleteImage(currentImageUrl).catch((err) =>
        console.warn(
          "Failed to delete image during removal, continuing...",
          err,
        ),
      );
      finalImageUrl = null;
    }
    // Add the final determined image URL to the update object
    dataToUpdate.imageUrl = finalImageUrl;
    // --- End Image Handling ---

    // --- Quantity Handling ---
    // Check if totalQuantity is being updated
    const newTotalQuantity =
      typeof totalQuantity === "number" && totalQuantity >= 0
        ? totalQuantity
        : currentTotalQuantity;
    dataToUpdate.totalQuantity = newTotalQuantity;
    const isQuantityItem = newTotalQuantity !== null && newTotalQuantity > 0;

    // Reset selectedQuantity if totalQuantity is removed or set to 0
    if (!isQuantityItem) {
      dataToUpdate.selectedQuantity = 0;
    } else if (
      newTotalQuantity !== null &&
      currentSelectedQuantity > newTotalQuantity
    ) {
      // If new total is less than current selected, reset selected (or handle differently)
      console.warn(
        `Firestore UPDATE_GIFT: New total quantity (${newTotalQuantity}) is less than selected (${currentSelectedQuantity}). Resetting selected quantity to 0.`,
      );
      dataToUpdate.selectedQuantity = 0; // Reset selected quantity
      // Or potentially set status to available, clear selectedBy etc. depending on desired behavior
    }

    // --- Handle status changes and related fields ---
    if (updates.status === "selected" && !isQuantityItem) {
      // Normal item selected
      dataToUpdate.selectionDate = updates.selectionDate
        ? new Date(updates.selectionDate) instanceof Date
          ? Timestamp.fromDate(new Date(updates.selectionDate))
          : serverTimestamp()
        : serverTimestamp();
      dataToUpdate.selectedBy = updates.selectedBy?.trim() || "Admin";
      dataToUpdate.selectedQuantity = 1; // For non-quantity items, selected means 1
    } else if (updates.status === "available") {
      if (isQuantityItem) {
        // Making quantity item available usually means resetting selected count
        console.warn(
          `Firestore UPDATE_GIFT: Setting quantity item ${itemId} to 'available'. Consider resetting selectedQuantity.`,
        );
        // dataToUpdate.selectedQuantity = 0; // Optionally reset here
      }
      dataToUpdate.selectedBy = null;
      dataToUpdate.selectionDate = null;
      // selectedQuantity might need adjustment based on totalQuantity
      if (
        isQuantityItem &&
        newTotalQuantity !== null &&
        dataToUpdate.selectedQuantity >= newTotalQuantity
      ) {
        dataToUpdate.status = "selected"; // Revert status if fully selected
      }
    } else if (updates.status === "not_needed") {
      dataToUpdate.selectedBy = null;
      dataToUpdate.selectionDate = null;
      dataToUpdate.selectedQuantity = 0; // Reset selected quantity
    } else if (isQuantityItem) {
      // If it's a quantity item, status depends on selected vs total
      const finalSelected =
        dataToUpdate.selectedQuantity ?? currentSelectedQuantity;
      if (newTotalQuantity !== null && finalSelected >= newTotalQuantity) {
        dataToUpdate.status = "selected";
      } else {
        dataToUpdate.status = "available";
      }
    }

    // Trim other string fields if they exist in updates
    if (typeof dataToUpdate.name === "string")
      dataToUpdate.name = dataToUpdate.name.trim();
    if (typeof dataToUpdate.description === "string")
      dataToUpdate.description = dataToUpdate.description.trim() || null;

    // Remove undefined fields to avoid Firestore errors
    Object.keys(dataToUpdate).forEach(
      (key) => dataToUpdate[key] === undefined && delete dataToUpdate[key],
    );

    console.log("Firestore UPDATE_GIFT: Final data being saved:", {
      ...dataToUpdate,
      imageUrl: dataToUpdate.imageUrl, // Log final URL
    });

    // Update the document in Firestore
    await updateDoc(itemDocRef, dataToUpdate);
    console.log(`Firestore UPDATE_GIFT: Gift ${itemId} updated successfully.`);
    forceRevalidation("/admin"); // Revalidate admin page

    // Fetch and return the updated item data
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(
      `Firestore UPDATE_GIFT: Error updating gift ${itemId}:`,
      error,
    );
    // Clean up newly uploaded image if update fails
    if (
      typeof imageDataUri === "string" &&
      dataToUpdate.imageUrl &&
      dataToUpdate.imageUrl !== currentImageUrl
    ) {
      console.error(
        "Firestore UPDATE_GIFT: Cleaning up uploaded image due to update error.",
      );
      await deleteImage(dataToUpdate.imageUrl).catch((e) =>
        console.error("Cleanup failed for image:", dataToUpdate.imageUrl, e),
      );
    }
    if ((error as any)?.code === "permission-denied") {
      console.error(
        "Firestore: PERMISSION DENIED updating gift. Check Firestore rules.",
      );
    } else if ((error as any)?.code === "not-found") {
      // This case is handled above, but kept here for completeness
      console.error(
        `Firestore UPDATE_GIFT: Gift item with ID ${itemId} not found.`,
      );
    } else if (
      error instanceof Error &&
      error.message.includes("Unsupported field value")
    ) {
      console.error(
        "Firestore UPDATE_GIFT: Invalid data provided for update. Potentially undefined field:",
        error,
      );
      console.log("Data attempted to update:", dataToUpdate);
    }
    throw error; // Re-throw error for the calling component to handle
  }
}

/**
 * Deletes a gift item from Firestore and its associated image from Storage.
 */
export async function deleteGift(itemId: string): Promise<boolean> {
  console.log(`Firestore DELETE_GIFT: Deleting gift ${itemId}...`);
  const itemDocRef = doc(db, "gifts", itemId);
  try {
    // Get the item data first to find the image URL
    const itemSnap = await getDoc(itemDocRef);
    if (itemSnap.exists()) {
      const itemData = itemSnap.data();
      const imageUrlToDelete = itemData?.imageUrl;

      // Delete the Firestore document
      await deleteDoc(itemDocRef);
      console.log(
        `Firestore DELETE_GIFT: Gift document ${itemId} deleted successfully.`,
      );

      // If an image URL exists, delete the image from Storage
      if (imageUrlToDelete) {
        console.log(
          `Firestore DELETE_GIFT: Deleting associated image: ${imageUrlToDelete}`,
        );
        await deleteImage(imageUrlToDelete).catch((err) => {
          // Log warning but don't fail the whole operation if image deletion fails
          console.warn(
            `Firestore DELETE_GIFT: Failed to delete image ${imageUrlToDelete}, but document was deleted. Error:`,
            err,
          );
        });
      }
      forceRevalidation("/admin"); // Revalidate paths after successful deletion
      return true; // Indicate success
    } else {
      console.warn(
        `Firestore DELETE_GIFT: Gift document ${itemId} not found. Cannot delete.`,
      );
      return false; // Indicate document not found
    }
  } catch (error) {
    console.error(
      `Firestore DELETE_GIFT: Error deleting gift ${itemId}:`,
      error,
    );
    if ((error as any)?.code === "permission-denied") {
      console.error(
        "Firestore: PERMISSION DENIED deleting gift. Check Firestore rules.",
      );
    }
    return false; // Indicate failure
  }
}

/**
 * Reverts a gift item's status from 'selected' or 'not_needed' back to 'available'.
 * Clears the selectedBy and selectionDate fields.
 * Resets selectedQuantity to 0 for quantity items.
 */
export async function revertSelection(
  itemId: string,
): Promise<GiftItem | null> {
  console.log(
    `Firestore REVERT_SELECTION: Reverting selection/status for gift ${itemId}...`,
  );
  const itemDocRef = doc(db, "gifts", itemId);
  try {
    // Prepare update data to reset status and selection fields
    const updateData = {
      status: "available" as const, // Set status to available
      selectedBy: null, // Clear selectedBy
      selectionDate: null, // Clear selectionDate
      selectedQuantity: 0, // Reset selected quantity regardless of item type
    };
    // Update the document
    await updateDoc(itemDocRef, updateData);
    console.log(
      `Firestore REVERT_SELECTION: Selection/status for gift ${itemId} reverted successfully.`,
    );
    forceRevalidation("/admin"); // Revalidate paths
    // Fetch and return the updated item data
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(
      `Firestore REVERT_SELECTION: Error reverting selection for gift ${itemId}:`,
      error,
    );
    if ((error as any)?.code === "permission-denied") {
      console.error(
        "Firestore: PERMISSION DENIED reverting selection. Check Firestore rules.",
      );
    } else if ((error as any)?.code === "not-found") {
      console.error(
        `Firestore REVERT_SELECTION: Gift item with ID ${itemId} not found.`,
      );
    }
    throw error; // Re-throw error for the calling component
  }
}

/**
 * Marks a gift item as 'not_needed'.
 * Updates status and clears selection fields. Resets selected quantity.
 */
export async function markGiftAsNotNeeded(
  itemId: string,
): Promise<GiftItem | null> {
  console.log(
    `Firestore MARK_NOT_NEEDED: Marking gift ${itemId} as not needed...`,
  );
  const itemDocRef = doc(db, "gifts", itemId);
  try {
    // Prepare update data
    const updateData = {
      status: "not_needed" as const, // Set status
      selectedBy: null, // Clear selection info
      selectionDate: null, // Clear selection info
      selectedQuantity: 0, // Reset selected quantity
    };
    // Update the document
    await updateDoc(itemDocRef, updateData);
    console.log(
      `Firestore MARK_NOT_NEEDED: Gift ${itemId} marked as not needed.`,
    );
    forceRevalidation("/admin"); // Revalidate paths
    // Fetch and return the updated item data
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(
      `Firestore MARK_NOT_NEEDED: Error marking gift ${itemId} as not needed:`,
      error,
    );
    if ((error as any)?.code === "permission-denied") {
      console.error(
        "Firestore: PERMISSION DENIED marking gift as not needed. Check Firestore rules.",
      );
    } else if ((error as any)?.code === "not-found") {
      console.error(
        `Firestore MARK_NOT_NEEDED: Gift item with ID ${itemId} not found.`,
      );
    }
    throw error; // Re-throw error for the calling component
  }
}

// Helper function to escape CSV fields correctly
const escapeCsv = (field: string | number | null | undefined): string => {
  if (field === null || field === undefined) return '""'; // Handle null/undefined
  const stringField = String(field);
  // Quote the field if it contains commas, double quotes, or newlines
  if (
    stringField.includes('"') ||
    stringField.includes(",") ||
    stringField.includes("\n")
  ) {
    // Escape double quotes within the field by doubling them
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  // Otherwise, just quote the field
  return `"${stringField}"`;
};

/**
 * Exports the current gift list data to a CSV formatted string.
 * Includes quantity information.
 */
export async function exportGiftsToCSV(): Promise<string> {
  console.log("Firestore EXPORT_GIFTS_CSV: Exporting gifts to CSV...");
  try {
    // Fetch the current gifts data
    const currentGifts = await getGifts(); // Assumes getGifts fetches fresh data
    console.log(
      `Firestore EXPORT_GIFTS_CSV: Fetched ${currentGifts.length} gifts for CSV export.`,
    );

    // Define CSV headers including quantity
    const headers = [
      "ID",
      "Nome",
      "Descrição",
      "Categoria",
      "Status",
      "Qtd Total", // New header
      "Qtd Selecionada", // New header
      "Selecionado Por (Último)", // Clarified header
      "Data Seleção (Última)", // Clarified header
      "Data Criação",
      "URL da Imagem",
    ];

    // Map gift items to CSV rows
    const rows = currentGifts
      .map((item) => {
        if (!item || typeof item !== "object") {
          console.warn(
            "Firestore EXPORT_GIFTS_CSV: Skipping invalid item during CSV generation:",
            item,
          );
          return ""; // Skip invalid items
        }

        // Format dates safely
        let selectionDateStr = "";
        if (item.selectionDate) {
          try {
            const date = new Date(item.selectionDate);
            if (!isNaN(date.getTime())) {
              // Format to locale string (e.g., "dd/mm/yyyy, HH:MM:SS")
              selectionDateStr = date.toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              });
            } else {
              console.warn(
                "Firestore EXPORT_GIFTS_CSV: Invalid selection date string for CSV:",
                item.selectionDate,
              );
            }
          } catch (e) {
            console.warn(
              "Firestore EXPORT_GIFTS_CSV: Could not parse selection date string for CSV:",
              item.selectionDate,
              e,
            );
          }
        }
        let createdAtStr = "";
        if (item.createdAt) {
          try {
            const date = new Date(item.createdAt);
            if (!isNaN(date.getTime())) {
              // Format to locale string
              createdAtStr = date.toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              });
            } else {
              console.warn(
                "Firestore EXPORT_GIFTS_CSV: Invalid creation date string for CSV:",
                item.createdAt,
              );
            }
          } catch (e) {
            console.warn(
              "Firestore EXPORT_GIFTS_CSV: Could not parse creation date string for CSV:",
              item.createdAt,
              e,
            );
          }
        }

        // Get optional fields or default to empty string/0
        const description = item.description ?? "";
        const selectedBy = item.selectedBy ?? "";
        const imageUrl = item.imageUrl ?? "";
        const totalQuantity = item.totalQuantity ?? null; // Empty string if null
        const selectedQuantity = item.selectedQuantity ?? null;

        // Create CSV row array and join with commas
        return [
          escapeCsv(item.id),
          escapeCsv(item.name),
          escapeCsv(description),
          escapeCsv(item.category),
          escapeCsv(item.status),
          escapeCsv(totalQuantity), // Add total quantity
          escapeCsv(selectedQuantity), // Add selected quantity
          escapeCsv(selectedBy),
          escapeCsv(selectionDateStr),
          escapeCsv(createdAtStr),
          escapeCsv(imageUrl), // Add image URL to row
        ].join(",");
      })
      .filter((row) => row !== ""); // Filter out any empty rows from skipped items

    console.log(
      "Firestore EXPORT_GIFTS_CSV: CSV export generated successfully.",
    );
    // Combine headers and rows with newline characters
    const escapedHeaders = headers.map((h) => escapeCsv(h)).join(",");
    return [escapedHeaders, ...rows].join("\n");
  } catch (error) {
    console.error(
      "Firestore EXPORT_GIFTS_CSV: Error exporting gifts to CSV:",
      error,
    );
    throw new Error("Erro ao gerar o arquivo CSV de presentes."); // Throw error for user feedback
  }
}

/**
 * Exports the current presence confirmation data to a CSV formatted string.
 */
export async function exportConfirmationsToCSV(): Promise<string> {
  console.log(
    "Firestore EXPORT_CONFIRMATIONS_CSV: Exporting confirmations to CSV...",
  );
  try {
    // Fetch the current confirmations data
    const currentConfirmations = await getConfirmations();
    console.log(
      `Firestore EXPORT_CONFIRMATIONS_CSV: Fetched ${currentConfirmations.length} confirmation entries.`,
    );

    const headers = ["ID Confirmação", "Nome Convidado", "Data Confirmação"];

    // Flatten the confirmations into individual rows for each name
    const rows = currentConfirmations.flatMap((confirmation) => {
      if (!confirmation || typeof confirmation !== "object") {
        console.warn(
          "Firestore EXPORT_CONFIRMATIONS_CSV: Skipping invalid confirmation entry:",
          confirmation,
        );
        return []; // Skip invalid entries
      }

      // Format confirmation date safely
      let confirmedAtStr = "";
      if (confirmation.confirmedAt) {
        try {
          const date = new Date(confirmation.confirmedAt);
          if (!isNaN(date.getTime())) {
            confirmedAtStr = date.toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            });
          } else {
            console.warn(
              "Firestore EXPORT_CONFIRMATIONS_CSV: Invalid confirmation date string for CSV:",
              confirmation.confirmedAt,
            );
          }
        } catch (e) {
          console.warn(
            "Firestore EXPORT_CONFIRMATIONS_CSV: Could not parse confirmation date string for CSV:",
            confirmation.confirmedAt,
            e,
          );
        }
      }

      // Create a row for each name in the confirmation entry
      return confirmation.names.map((name) =>
        [
          escapeCsv(confirmation.id),
          escapeCsv(name),
          escapeCsv(confirmedAtStr),
        ].join(","),
      );
    });

    console.log(
      "Firestore EXPORT_CONFIRMATIONS_CSV: CSV export generated successfully.",
    );
    // Combine headers and rows
    const escapedHeaders = headers.map((h) => escapeCsv(h)).join(",");
    return [escapedHeaders, ...rows].join("\n");
  } catch (error) {
    console.error(
      "Firestore EXPORT_CONFIRMATIONS_CSV: Error exporting confirmations to CSV:",
      error,
    );
    throw new Error("Erro ao gerar o arquivo CSV de presença.");
  }
}

// --- Presence Confirmation Functions ---

/**
 * Adds a new presence confirmation to Firestore.
 * Accepts an array of names.
 */
export async function addConfirmation(
  names: string[],
): Promise<Confirmation | null> {
  console.log(
    `Firestore ADD_CONFIRMATION: Adding confirmation for names: ${names.join(", ")}`,
  );
  if (
    !names ||
    names.length === 0 ||
    names.some((name) => typeof name !== "string" || name.trim() === "")
  ) {
    console.error("Firestore ADD_CONFIRMATION: Invalid names array provided.");
    throw new Error("Por favor, insira nomes válidos.");
  }

  try {
    const confirmationData = {
      names: names.map((name) => name.trim()), // Trim whitespace from each name
      confirmedAt: serverTimestamp(),
    };

    const docRef = await addFirestoreDoc(
      confirmationsCollectionRef,
      confirmationData,
    );
    console.log(
      `Firestore ADD_CONFIRMATION: Confirmation added successfully with ID: ${docRef.id}`,
    );
    forceRevalidation(); // Revalidate home page or admin page if needed

    // Fetch and return the new confirmation
    const newDocSnap = await getDoc(docRef);
    return newDocSnap.exists() ? confirmationFromDoc(newDocSnap) : null;
  } catch (error) {
    console.error(
      "Firestore ADD_CONFIRMATION: Error adding confirmation:",
      error,
    );
    if ((error as any)?.code === "permission-denied") {
      console.error(
        "Firestore: PERMISSION DENIED adding confirmation. Check Firestore rules.",
      );
    }
    throw new Error("Erro ao confirmar presença. Tente novamente."); // Throw generic error for UI
  }
}

/**
 * Fetches all presence confirmations from Firestore, ordered by confirmation date descending.
 */
export async function getConfirmations(): Promise<Confirmation[]> {
  console.log(
    "Firestore GET_CONFIRMATIONS: Fetching confirmations, ordered by confirmedAt desc...",
  );
  try {
    const q = query(confirmationsCollectionRef, orderBy("confirmedAt", "desc"));
    const querySnapshot = await getDocs(q);
    console.log(
      `Firestore GET_CONFIRMATIONS: Query executed. Found ${querySnapshot.size} confirmations.`,
    );

    if (querySnapshot.empty) {
      console.log(
        "Firestore GET_CONFIRMATIONS: Confirmations collection is empty.",
      );
      return [];
    } else {
      const confirmations: Confirmation[] = querySnapshot.docs
        .map((docSnapshot) => confirmationFromDoc(docSnapshot))
        .filter((item): item is Confirmation => item !== null);

      console.log(
        `Firestore GET_CONFIRMATIONS: Successfully mapped ${confirmations.length} valid confirmations.`,
      );
      return confirmations;
    }
  } catch (error) {
    console.error(
      "Firestore GET_CONFIRMATIONS: Error fetching confirmations:",
      error,
    );
    if ((error as any)?.code === "permission-denied") {
      console.error(
        "Firestore: PERMISSION DENIED fetching confirmations. Check Firestore rules.",
      );
    }
    return []; // Return empty array on error
  }
}
