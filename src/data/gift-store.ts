// gift-store.ts
'use server';

import { revalidatePath } from 'next/cache';
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
  DocumentSnapshot,
  QueryDocumentSnapshot,
  FieldValue,
} from 'firebase/firestore';
import { db, storage } from '@/firebase/config'; // Ensure db and storage are imported correctly
import { uploadImage, deleteImage } from '@/services/storage'; // Import storage service

// --- INTERFACE DEFINITIONS ---

export interface GiftItem {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  status: 'available' | 'selected' | 'not_needed';
  selectedBy?: string | null;
  selectionDate?: string | null | FieldValue;
  createdAt?: string | null | FieldValue;
  imageUrl?: string | null;
  totalQuantity?: number | null;
  selectedQuantity?: number;
  priority?: number | null; // 0: Low, 1: Medium, 2: High
}

export interface SuggestionData {
  itemName: string;
  itemDescription?: string;
  suggesterName: string;
  imageDataUri?: string | null;
}

export interface EventSettings {
  id: string;
  title: string;
  babyName?: string | null;
  date: string;
  time: string;
  location: string;
  address: string;
  welcomeMessage: string;
  duration?: number;
  headerImageUrl?: string | null;
}

export interface Confirmation {
  id: string;
  names: string[];
  confirmedAt: string; // ISO string
}

// --- DEFAULT DATA ---
// Updated to include default priority
const defaultGiftItems: Omit<
  GiftItem,
  'id' | 'createdAt' | 'selectionDate' | 'selectedQuantity'
>[] = [
  {
    name: 'Body Manga Curta (RN)',
    category: 'Roupas',
    status: 'available',
    description: 'Pacote com 3 unidades, cores neutras.',
    imageUrl: null,
    priority: 0,
  },
  {
    name: 'Fraldas Pampers (P)',
    category: 'Higiene',
    status: 'available',
    description: 'Pacote grande.',
    imageUrl: null,
    totalQuantity: 10,
    priority: 1,
  },
  {
    name: 'Mamadeira Anti-cólica',
    category: 'Alimentação',
    status: 'available',
    imageUrl: null,
    priority: 0,
  },
  {
    name: 'Móbile Musical',
    category: 'Brinquedos',
    status: 'available',
    imageUrl: null,
    priority: 0,
  },
  {
    name: 'Lenços Umedecidos',
    category: 'Higiene',
    status: 'available',
    imageUrl: null,
    totalQuantity: 20,
    priority: 1,
  },
  {
    name: 'Termômetro Digital',
    category: 'Higiene',
    status: 'available',
    imageUrl: null,
    priority: 2,
  },
  {
    name: 'Macacão Pijama (M)',
    category: 'Roupas',
    status: 'available',
    description: 'Algodão macio.',
    imageUrl: null,
    priority: 0,
  },
  {
    name: 'Chupeta Calmante',
    category: 'Outros',
    status: 'available',
    imageUrl: null,
    priority: 0,
  },
  {
    name: 'Cadeirinha de Descanso',
    category: 'Outros',
    status: 'available',
    imageUrl: null,
    priority: 1,
  },
  {
    name: 'Pomada para Assaduras',
    category: 'Higiene',
    status: 'available',
    description: 'Marca Bepantol Baby ou similar.',
    imageUrl: null,
    priority: 2,
  },
];

const defaultEventSettings: EventSettings = {
  id: 'main',
  title: 'Chá de Bebê',
  babyName: null,
  date: '2024-12-15',
  time: '14:00',
  location: 'Salão de Festas Felicidade',
  address: 'Rua Exemplo, 123, Bairro Alegre, Cidade Feliz - SP',
  welcomeMessage:
    'Sua presença é o nosso maior presente! Esta lista é apenas um guia carinhoso para quem desejar nos presentear. Sinta-se totalmente à vontade, o importante é celebrar conosco!',
  duration: 180,
  headerImageUrl: null,
};

// --- FIRESTORE REFERENCES ---

const giftsCollectionRef = collection(db, 'gifts') as CollectionReference<
  Omit<GiftItem, 'id'>
>;
const settingsDocRef = doc(
  db,
  'settings',
  'main'
) as DocumentReference<EventSettings>; // Explicitly type if data structure is certain
const confirmationsCollectionRef = collection(
  db,
  'confirmations'
) as CollectionReference<Omit<Confirmation, 'id'>>; // Type for confirmations

// --- HELPER FUNCTIONS ---
const giftFromDoc = (
  docSnapshot: DocumentSnapshot | QueryDocumentSnapshot
): GiftItem | null => {
  if (!docSnapshot.exists()) {
    console.warn(
      `Firestore Convert: Document ID ${docSnapshot.id} does not exist.`
    );
    return null;
  }

  const data = docSnapshot.data() as Partial<Omit<GiftItem, 'id'>>;
  const docId = docSnapshot.id;

  if (!data) {
    console.error(
      `Firestore Convert: No data found for document ID ${docId}.`
    );
    return null;
  }

  if (typeof data.name !== 'string' || data.name.trim() === '') {
    console.error(
      `Firestore Convert: Invalid or missing 'name' for gift ID ${docId}. Found: ${data.name}`
    );
    return null;
  }
  if (typeof data.category !== 'string' || data.category.trim() === '') {
    console.error(
      `Firestore Convert: Invalid or missing 'category' for gift ID ${docId}. Found: ${data.category}`
    );
    return null;
  }
  if (
    typeof data.status !== 'string' ||
    !['available', 'selected', 'not_needed'].includes(data.status)
  ) {
    console.error(
      `Firestore Convert: Invalid or missing 'status' for gift ID ${docId}. Found: ${data.status}`
    );
    return null;
  }

  let selectionDateISO: string | null = null;
  if (data.selectionDate) {
    if (data.selectionDate instanceof Timestamp) {
      selectionDateISO = data.selectionDate.toDate().toISOString();
    } else if (typeof data.selectionDate === 'string') {
      try {
        const parsedDate = new Date(data.selectionDate);
        if (!isNaN(parsedDate.getTime())) {
          selectionDateISO = parsedDate.toISOString();
        } else {
          console.warn(
            `Firestore Convert: Invalid selectionDate string for gift ID ${docId}: ${data.selectionDate}`
          );
        }
      } catch (e) {
        console.warn(
          `Firestore Convert: Error parsing selectionDate string for gift ID ${docId}: ${data.selectionDate}`,
          e
        );
      }
    } else {
      console.warn(
        `Firestore Convert: Unexpected type for selectionDate for gift ID ${docId}: ${typeof data.selectionDate}`
      );
    }
  }

  let createdAtISO: string | null = null;
  if (data.createdAt) {
    if (data.createdAt instanceof Timestamp) {
      createdAtISO = data.createdAt.toDate().toISOString();
    } else if (typeof data.createdAt === 'string') {
      try {
        const parsedDate = new Date(data.createdAt);
        if (!isNaN(parsedDate.getTime())) {
          createdAtISO = parsedDate.toISOString();
        } else {
          console.warn(
            `Firestore Convert: Invalid createdAt string for gift ID ${docId}: ${data.createdAt}`
          );
        }
      } catch (e) {
        console.warn(
          `Firestore Convert: Error parsing createdAt string for gift ID ${docId}: ${data.createdAt}`,
          e
        );
      }
    } else {
      console.warn(
        `Firestore Convert: Unexpected type for createdAt for gift ID ${docId}: ${typeof data.createdAt}`
      );
    }
  }

  return {
    id: docId,
    name: data.name,
    description:
      typeof data.description === 'string' ? data.description : null,
    category: data.category,
    status: data.status as 'available' | 'selected' | 'not_needed',
    selectedBy: typeof data.selectedBy === 'string' ? data.selectedBy : null,
    selectionDate: selectionDateISO,
    createdAt: createdAtISO,
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
    totalQuantity:
      typeof data.totalQuantity === 'number' ? data.totalQuantity : null,
    selectedQuantity:
      typeof data.selectedQuantity === 'number' ? data.selectedQuantity : 0,
    priority: typeof data.priority === 'number' ? data.priority : 0, // Default to 0 if undefined/null
  };
};

const confirmationFromDoc = (
  docSnapshot: DocumentSnapshot | QueryDocumentSnapshot
): Confirmation | null => {
  if (!docSnapshot.exists) {
    console.warn(
      `Firestore Convert: Confirmation Document ID ${docSnapshot.id} does not exist.`
    );
    return null;
  }
  const data = docSnapshot.data();
  const docId = docSnapshot.id;

  if (!data || !Array.isArray(data.names) || !data.confirmedAt) {
    console.error(
      `Firestore Convert: Invalid or missing fields for confirmation document ID ${docId}. Data:`,
      data
    );
    return null;
  }

  return {
    id: docId,
    names: data.names,
    confirmedAt:
      data.confirmedAt instanceof Timestamp
        ? data.confirmedAt.toDate().toISOString()
        : typeof data.confirmedAt === 'string'
          ? data.confirmedAt
          : new Date().toISOString(),
  };
};

const forceRevalidation = (path: string = '/') => {
  console.log(`Firestore Revalidate: Revalidating path: ${path}...`);
  try {
    revalidatePath(path, 'layout'); // Revalidate the layout which affects all pages using it
    if (path === '/' || path.startsWith('/?category=')) {
      console.log(
        `Firestore Revalidate: Specific revalidation for admin due to public page change: /admin`
      );
      revalidatePath('/admin', 'layout'); // Revalidate admin page specifically
    } else if (path === '/admin' || path.startsWith('/admin?')) {
      console.log(
        `Firestore Revalidate: Specific revalidation for public due to admin page change: /`
      );
      revalidatePath('/', 'layout'); // Revalidate public page specifically
    }
    console.log(
      `Firestore Revalidate: Revalidation calls initiated for relevant paths related to ${path}.`
    );
  } catch (error) {
    console.error(
      `Firestore Revalidate: Error during revalidatePath for ${path}:`,
      error
    );
  }
};

export async function initializeFirestoreData(): Promise<void> {
  console.log('Firestore Init: Checking initialization status...');
  try {
    const settingsSnap = await getDoc(settingsDocRef);
    if (!settingsSnap.exists()) {
      console.log(
        "Firestore Init: Settings document 'settings/main' not found, initializing..."
      );
      const { id, ...settingsToSave } = defaultEventSettings;
      await setDoc(settingsDocRef, settingsToSave);
      console.log('Firestore Init: Default settings added.');
      forceRevalidation('/admin');
      forceRevalidation('/');
    } else {
      console.log(
        "Firestore Init: Settings document 'settings/main' already exists."
      );
    }

    const giftsQuerySnapshot = await getDocs(query(giftsCollectionRef));
    if (giftsQuerySnapshot.empty) {
      console.log(
        'Firestore Init: Gifts collection empty, initializing defaults...'
      );
      const batch: WriteBatch = writeBatch(db);
      defaultGiftItems.forEach((itemData) => {
        const docRef = doc(giftsCollectionRef); // Create a new document reference for each item
        const fullItem = {
          ...itemData,
          selectedQuantity: 0, // Initialize selectedQuantity
          totalQuantity: itemData.totalQuantity ?? null,
          createdAt: serverTimestamp(), // Use server timestamp for creation
          priority: itemData.priority ?? 0, // Ensure priority has a default
        };
        batch.set(docRef, fullItem);
      });
      await batch.commit();
      console.log('Firestore Init: Default gifts added.');
      forceRevalidation('/admin');
      forceRevalidation('/');
    } else {
      console.log(
        `Firestore Init: Gifts collection already contains ${giftsQuerySnapshot.size} items. Skipping default initialization.`
      );
    }
    console.log('Firestore Init: Initialization check complete.');
  } catch (error) {
    console.error('Firestore Init: Error during initialization check:', error);
    if ((error as FirestoreError).code === 'permission-denied') {
      console.error(
        'Firestore Init: PERMISSION DENIED during initialization. Check Firestore rules.'
      );
    }
    // Consider if you want to re-throw or handle more gracefully for the UI
  }
}
// Ensure initialization is called, e.g., in a layout or global setup, but carefully
// initializeFirestoreData().catch(err => console.error("Initial Firestore check failed:", err));

export const getEventSettings = async (): Promise<EventSettings> => {
  const settingsPath = settingsDocRef.path;
  console.log(
    `Firestore GET_SETTINGS: Attempting to fetch event settings from path: ${settingsPath}`
  );
  try {
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
      console.log(
        `Firestore GET_SETTINGS: Event settings found at ${settingsPath}.`
      );
      const data = docSnap.data() || {};
      // Ensure all fields are present, falling back to defaults if necessary
      const settingsData: EventSettings = {
        id: docSnap.id,
        title: data.title ?? defaultEventSettings.title,
        babyName: data.babyName === undefined ? defaultEventSettings.babyName : data.babyName,
        date: data.date ?? defaultEventSettings.date,
        time: data.time ?? defaultEventSettings.time,
        location: data.location ?? defaultEventSettings.location,
        address: data.address ?? defaultEventSettings.address,
        welcomeMessage: data.welcomeMessage ?? defaultEventSettings.welcomeMessage,
        duration: data.duration ?? defaultEventSettings.duration,
        headerImageUrl: data.headerImageUrl === undefined ? defaultEventSettings.headerImageUrl : data.headerImageUrl,
      };
      return settingsData;
    } else {
      console.warn(
        `Firestore GET_SETTINGS: Settings document '${settingsPath}' does not exist. Returning default settings.`
      );
      return { ...defaultEventSettings }; // Return a copy of defaults
    }
  } catch (error) {
    console.error(
      `Firestore GET_SETTINGS: Error fetching event settings from ${settingsPath}:`,
      error
    );
    // Check if error is permissions related
     if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED fetching event settings. Check Firestore rules.");
     }
    return { ...defaultEventSettings }; // Return defaults on error for resilience
  }
};

// No changes to sorting here; sorting will be done client-side in GiftList
export const getGifts = async (): Promise<GiftItem[]> => {
  console.log(
    "Firestore GET_GIFTS: Fetching gifts from 'gifts' collection..."
  );
  try {
    // Keep existing orderBy if it's crucial for initial fetch or other non-priority views
    const q = query(giftsCollectionRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    console.log(
      `Firestore GET_GIFTS: Query executed. Found ${querySnapshot.size} documents.`
    );

    if (querySnapshot.empty) {
      console.log('Firestore GET_GIFTS: Gifts collection is empty.');
      return [];
    } else {
      const gifts: GiftItem[] = querySnapshot.docs
        .map((docSnapshot) => giftFromDoc(docSnapshot))
        .filter((item): item is GiftItem => item !== null); // Type guard

      console.log(
        `Firestore GET_GIFTS: Successfully mapped ${gifts.length} valid gifts from ${querySnapshot.size} documents.`
      );
      if (gifts.length !== querySnapshot.size) {
        console.warn(`Firestore GET_GIFTS: ${querySnapshot.size - gifts.length} documents were filtered out by giftFromDoc due to data validation issues.`);
      }
      return gifts;
    }
  } catch (error) {
    console.error('Firestore GET_GIFTS: Error fetching gifts:', error);
     if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED fetching gifts. Check Firestore rules.");
     }
    return []; // Return empty array on error
  }
};

export async function updateEventSettings(
  updates: Partial<EventSettings>
): Promise<EventSettings | null> {
  const settingsPath = settingsDocRef.path;
  // Destructure to separate id and newImageUrlInput from otherUpdates to prevent id from being written
  const { id, headerImageUrl: newImageUrlInput, ...otherUpdates } = updates;
  const dataToUpdate: Partial<EventSettings> = { ...otherUpdates }; // Initialize with other updates

  console.log(
    `Firestore UPDATE_SETTINGS: Updating event settings at ${settingsPath}...`
  );

  try {
    const currentSettingsSnap = await getDoc(settingsDocRef);
    const currentImageUrl = currentSettingsSnap.exists()
      ? currentSettingsSnap.data()?.headerImageUrl
      : null;

    let finalImageUrl: string | null = currentImageUrl; // Default to current

    // Handle new image upload (data URI)
    if (
      typeof newImageUrlInput === 'string' &&
      newImageUrlInput.startsWith('data:')
    ) {
      console.log(
        'Firestore UPDATE_SETTINGS: New header image data URI found. Uploading...'
      );
      // Delete previous image if it exists
      if (currentImageUrl) {
        console.log(
          'Firestore UPDATE_SETTINGS: Deleting previous header image:',
          currentImageUrl
        );
        await deleteImage(currentImageUrl).catch((err) =>
          console.error(
            'Firestore UPDATE_SETTINGS: Failed to delete previous header image, continuing...',
            err
          )
        );
      }
      finalImageUrl = await uploadImage(
        newImageUrlInput,
        'header',
        'event_header'
      ); // Store new URL
      console.log(
        'Firestore UPDATE_SETTINGS: New header image uploaded. URL:',
        finalImageUrl
      );
    } else if (newImageUrlInput === null && currentImageUrl) {
      // Handle image removal (newImageUrlInput is explicitly null)
      console.log(
        'Firestore UPDATE_SETTINGS: Header image removal requested. Deleting:',
        currentImageUrl
      );
      await deleteImage(currentImageUrl).catch((err) =>
        console.error(
          'Firestore UPDATE_SETTINGS: Failed to delete header image during removal, continuing...',
          err
        )
      );
      finalImageUrl = null; // Set to null after deletion
    } else if (
      typeof newImageUrlInput === 'string' &&
      !newImageUrlInput.startsWith('data:')
    ) {
      // This case implies an existing URL was passed (e.g. from form reset before choosing a new file)
      // We only update if it's different or if no current image was set
      console.log(
        'Firestore UPDATE_SETTINGS: Existing header image URL provided in input:', newImageUrlInput
      );
      // No action needed here if the URL is the same as current, finalImageUrl already holds current
      // If newImageUrlInput is an empty string from the form, it was likely cleared but not meant for deletion
      // unless newImageUrlInput was explicitly set to null (handled above).
      // For safety, if it's just an empty string, we might prefer to keep the existing one
      // or require explicit null for deletion. Here, we assume if it's a non-data URI string,
      // it's intended to be the new URL if different, or the unchanged one.
       if (newImageUrlInput !== currentImageUrl) {
         // This path is less likely for direct user actions that aren't uploads or removals
         // finalImageUrl = newImageUrlInput; // This would allow setting an arbitrary external URL directly
       }
    }
    // If newImageUrlInput is undefined, it means the field wasn't part of the updates,
    // so finalImageUrl (initialized to currentImageUrl) remains correct.

    dataToUpdate.headerImageUrl = finalImageUrl; // Set the potentially updated image URL

    console.log('Firestore UPDATE_SETTINGS: Final data being saved:', {
      ...dataToUpdate, // Spread the rest of the updates
      headerImageUrl: dataToUpdate.headerImageUrl, // Show the final image URL state
    });

    // Use setDoc with merge: true to update or create if not exists
    await setDoc(settingsDocRef, dataToUpdate, { merge: true });
    console.log(
      'Firestore UPDATE_SETTINGS: Event settings updated successfully.'
    );

    // Revalidate relevant paths
    forceRevalidation('/'); // Revalidate public page
    forceRevalidation('/admin'); // Revalidate admin page

    // Fetch and return the latest settings
    const updatedSettings = await getEventSettings();
    return updatedSettings;
  } catch (error) {
    console.error(
      `Firestore UPDATE_SETTINGS: Error updating event settings at ${settingsPath}:`,
      error
    );
     if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED updating event settings. Check Firestore rules.");
     }
    return null; // Indicate failure
  }
}


export async function selectGift(
  itemId: string,
  guestName: string,
  quantityToSelect: number = 1
): Promise<GiftItem | null> {
  console.log(
    `Firestore SELECT_GIFT: Selecting gift ${itemId} for ${guestName} (Quantity: ${quantityToSelect})`
  );
  const itemDocRef = doc(db, 'gifts', itemId);

  try {
    const itemSnap = await getDoc(itemDocRef);
    if (!itemSnap.exists()) {
      console.error(`Firestore SELECT_GIFT: Item ${itemId} not found.`);
      return null; // Or throw new Error('Item não encontrado.');
    }
    const currentItem = giftFromDoc(itemSnap);
    if (!currentItem) {
      console.error(
        `Firestore SELECT_GIFT: Failed to parse item ${itemId} data.`
      );
      return null; // Or throw new Error('Falha ao ler dados do item.');
    }

    // Handle quantity-based items
    if (currentItem.totalQuantity && currentItem.totalQuantity > 0) {
      const currentSelected = currentItem.selectedQuantity || 0;
      const remaining = currentItem.totalQuantity - currentSelected;

      if (quantityToSelect <= 0) {
         console.error(`Firestore SELECT_GIFT: Quantity to select must be positive. Got ${quantityToSelect}`);
         throw new Error("A quantidade selecionada deve ser maior que zero.");
      }

      if (quantityToSelect > remaining) {
        console.error(
          `Firestore SELECT_GIFT: Cannot select ${quantityToSelect} units of ${itemId}. Only ${remaining} remaining.`
        );
        throw new Error(
          `Quantidade insuficiente. Restam ${remaining} unidade(s).`
        );
      }

      const newSelectedQuantity = currentSelected + quantityToSelect;
      const newStatus =
        newSelectedQuantity >= currentItem.totalQuantity
          ? 'selected'
          : 'available';

      // Update Firestore
      const updateData: Partial<GiftItem> = {
        selectedQuantity: newSelectedQuantity,
        status: newStatus,
        // For quantity items, selectedBy might represent the *last* selector
        // or you might want to store a list of selectors (more complex)
        selectedBy: guestName, // Update/overwrite selectedBy with the current guest
      };
      await updateDoc(itemDocRef, {
        ...updateData,
        selectionDate: serverTimestamp(), // Always update selection date
      });
      console.log(
        `Firestore SELECT_GIFT: Updated quantity for ${itemId}. New selected: ${newSelectedQuantity}. Status: ${newStatus}`
      );
    } else {
      // Handle single-selection items
      if (currentItem.status !== 'available') {
        console.warn(
          `Firestore SELECT_GIFT: Item ${itemId} is not available (Status: ${currentItem.status}).`
        );
        throw new Error('Este item não está mais disponível.');
      }

      const updateData: Partial<GiftItem> = {
        status: 'selected' as const,
        selectedBy: guestName,
        selectedQuantity: 1, // For single items, selected quantity is 1
      };
      await updateDoc(itemDocRef, {
        ...updateData,
        selectionDate: serverTimestamp(),
      });
      console.log(
        `Firestore SELECT_GIFT: Marked single item ${itemId} as selected.`
      );
    }

    forceRevalidation('/');
    forceRevalidation('/admin');

    // Return the updated item
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(
      `Firestore SELECT_GIFT: Error selecting gift ${itemId}:`,
      error
    );
     if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED selecting gift. Check Firestore rules.");
     } else if ((error as any)?.code === 'not-found') {
        console.error(`Firestore SELECT_GIFT: Gift item with ID ${itemId} not found.`);
     }
    // Re-throw the error to be caught by the UI
    throw error; // Ensure UI can display specific error messages
  }
}


export async function addSuggestion(
  suggestionData: SuggestionData
): Promise<GiftItem | null> {
  console.log(
    `Firestore ADD_SUGGESTION: Adding suggestion from ${suggestionData.suggesterName}.`
  );

  let uploadedImageUrl: string | null = null;

  try {
    // Upload image if provided
    if (suggestionData.imageDataUri) {
      console.log(
        'Firestore ADD_SUGGESTION: Image data URI found. Uploading image...'
      );
      uploadedImageUrl = await uploadImage(
        suggestionData.imageDataUri,
        'gifts', // Folder for gift images
        'suggestion' // Filename prefix
      );
      console.log(
        'Firestore ADD_SUGGESTION: Image uploaded successfully. URL:',
        uploadedImageUrl
      );
    }

    // Prepare new gift item data
    const newItemData: Omit<GiftItem, 'id'> & { createdAt: any, selectionDate: any } = {
      name: suggestionData.itemName.trim(),
      description: suggestionData.itemDescription?.trim() || null,
      category: 'Outros', // Default category for suggestions
      status: 'selected' as const, // Mark as selected by the suggester
      selectedBy: suggestionData.suggesterName.trim(),
      selectionDate: serverTimestamp(), // Record when it was selected/suggested
      createdAt: serverTimestamp(), // Record creation time
      imageUrl: uploadedImageUrl,
      selectedQuantity: 1, // Assuming suggestion creates a single selected item
      totalQuantity: 1,    // And total quantity is 1 for such items
      priority: 0, // Default priority for suggestions
    };

    // Basic validation before adding to Firestore
    if (!newItemData.name || !newItemData.selectedBy) {
      console.error(
        'Firestore ADD_SUGGESTION: Invalid suggestion data - name and suggesterName are required.'
      );
      if (uploadedImageUrl)
        await deleteImage(uploadedImageUrl).catch((e) =>
          console.error('Cleanup failed', e)
        );
      return null;
    }

    const docRef = await addFirestoreDoc(giftsCollectionRef, newItemData);
    console.log(
      `Firestore ADD_SUGGESTION: Suggestion added as new gift with ID: ${docRef.id}`
    );
    forceRevalidation('/');
    forceRevalidation('/admin');

    // Fetch and return the newly created document
    const newDocSnap = await getDoc(docRef);
    return newDocSnap.exists() ? giftFromDoc(newDocSnap) : null;
  } catch (error) {
    console.error('Firestore ADD_SUGGESTION: Error adding suggestion:', error);
    // If image upload succeeded but Firestore failed, attempt to delete the orphaned image
    if (uploadedImageUrl) {
      console.error(
        'Firestore ADD_SUGGESTION: Cleaning up potentially uploaded image due to error.'
      );
      await deleteImage(uploadedImageUrl).catch((e) =>
        console.error('Cleanup failed for image:', uploadedImageUrl, e)
      );
    }
     if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED adding suggestion. Check Firestore rules.");
     }
    return null; // Indicate failure
  }
}

export async function addGiftAdmin(
  giftData: Partial<GiftItem> & { imageDataUri?: string | null }
): Promise<GiftItem | null> {
  console.log('Firestore ADD_GIFT_ADMIN: Adding new gift item...');
  const { imageDataUri, totalQuantity, name, category, status, description, selectedBy, priority, ...otherItemDetails } = giftData;
  let uploadedImageUrl: string | null = null;

  try {
    // Upload image if provided
    if (imageDataUri) {
      console.log(
        'Firestore ADD_GIFT_ADMIN: Image data URI found. Uploading image...'
      );
      uploadedImageUrl = await uploadImage(imageDataUri, 'gifts', 'admin_add');
      console.log(
        'Firestore ADD_GIFT_ADMIN: Image uploaded. URL:',
        uploadedImageUrl
      );
    }

    // Determine if it's a quantity item
    const isQuantityItem =
      typeof totalQuantity === 'number' && totalQuantity > 0;

    // Basic validation
    if (!name || !category || !status) {
      console.error(
        'Firestore ADD_GIFT_ADMIN: Missing required fields (name, category, status).'
      );
      if (uploadedImageUrl)
        await deleteImage(uploadedImageUrl).catch((e) =>
          console.error('Cleanup failed for image upload:', e)
        );
      throw new Error('Nome, categoria e status são obrigatórios.');
    }

    const finalDataToAdd: Omit<GiftItem, 'id'> & { createdAt: any, selectionDate: any | null } = {
      name: name.trim(),
      description: description?.trim() || null,
      category: category,
      status:
        status === 'not_needed'
          ? 'not_needed' // If "not_needed", status is set regardless of quantity
          : isQuantityItem
            ? 'available' // Quantity items added by admin default to 'available'
            : status, // Non-quantity items use the provided status
      selectedBy:
        status === 'selected' && !isQuantityItem // Only set selectedBy if 'selected' AND NOT a quantity item
          ? selectedBy?.trim() || 'Admin' // Default to 'Admin' if empty
          : null, // Otherwise, null
      selectionDate:
        status === 'selected' && !isQuantityItem // Corresponding selectionDate
          ? serverTimestamp()
          : null,
      createdAt: serverTimestamp(),
      imageUrl: uploadedImageUrl,
      totalQuantity: isQuantityItem ? totalQuantity : null, // Set totalQuantity or null
      selectedQuantity: 0, // New items always start with 0 selected
      priority: typeof priority === 'number' ? priority : 0, // Default priority to Low (0)
       // Spread any other valid GiftItem properties that might have been passed
       ...(otherItemDetails as Partial<Omit<GiftItem, 'id' | 'createdAt' | 'selectionDate' | 'name' | 'category' | 'status' | 'totalQuantity' | 'selectedQuantity' | 'imageUrl' | 'description' | 'selectedBy' | 'priority'>>),
    };


    // Additional logic for 'selected' non-quantity items
    if (
      finalDataToAdd.status === 'selected' &&
      !isQuantityItem &&
      !finalDataToAdd.selectedBy // Ensure selectedBy is set if status is 'selected'
    ) {
      finalDataToAdd.selectedBy = 'Admin'; // Default if somehow missed
    }
    // If 'not_needed', ensure selectedBy and selectionDate are null
    if (finalDataToAdd.status === 'not_needed') {
      finalDataToAdd.selectedBy = null;
      finalDataToAdd.selectionDate = null;
      finalDataToAdd.selectedQuantity = 0; // Ensure selected quantity is 0
    }
    // If status is 'selected' and it's a single item, selectedQuantity should be 1
    if (finalDataToAdd.status === 'selected' && !isQuantityItem) {
        finalDataToAdd.selectedQuantity = 1;
    }


    // Clean up undefined fields before sending to Firestore
    const cleanedData = Object.fromEntries(
      Object.entries(finalDataToAdd).filter(([, value]) => value !== undefined)
    ) as Omit<GiftItem, 'id'> & { createdAt: any, selectionDate: any | null }; // Type assertion

    console.log('Firestore ADD_GIFT_ADMIN: Cleaned Data to Add:', cleanedData);

    const docRef = await addFirestoreDoc(giftsCollectionRef, cleanedData);
    console.log(
      `Firestore ADD_GIFT_ADMIN: Gift added successfully with ID: ${docRef.id}`
    );
    forceRevalidation('/admin');
    forceRevalidation('/'); // Also revalidate public page


    // Fetch and return the newly created document
    const newDocSnap = await getDoc(docRef);
    return newDocSnap.exists() ? giftFromDoc(newDocSnap) : null;
  } catch (error) {
    console.error('Firestore ADD_GIFT_ADMIN: Error adding gift:', error);
    // If image upload succeeded but Firestore failed, attempt to delete the orphaned image
    if (uploadedImageUrl) {
      console.error(
        'Firestore ADD_GIFT_ADMIN: Cleaning up potentially uploaded image due to error.'
      );
      await deleteImage(uploadedImageUrl).catch((e) =>
        console.error('Cleanup failed for image:', uploadedImageUrl, e)
      );
    }
     if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED adding gift. Check Firestore rules.");
     }
    throw error; // Re-throw to allow UI to handle it
  }
}

export async function updateGift(
  itemId: string,
  updates: Partial<Omit<GiftItem, 'id' | 'createdAt'>> & {
    imageDataUri?: string | null | undefined; // For new image uploads
  }
): Promise<GiftItem | null> {
  console.log(`Firestore UPDATE_GIFT: Updating gift ${itemId}...`);
  const {
    imageDataUri, // This is for NEW uploads from client (data URI)
    imageUrl: newImageUrlInput, // This could be an existing URL or null for removal
    totalQuantity: newTotalQuantityInput,
    selectedQuantity: newSelectedQuantityInput,
    status: newStatusInput,
    priority: newPriorityInput,
    ...otherUpdates // Other fields like name, description, category
  } = updates;

  const itemDocRef = doc(db, 'gifts', itemId);
  const dataToUpdate: Record<string, any> = { ...otherUpdates }; // Start with basic updates

  try {
    const currentItemSnap = await getDoc(itemDocRef);
    if (!currentItemSnap.exists()) {
      console.error(`Firestore UPDATE_GIFT: Item with ID ${itemId} not found.`);
      throw new Error(`Item with ID ${itemId} não encontrado.`);
    }
    const currentItemData = currentItemSnap.data() as GiftItem; // Assuming GiftItem type for existing data
    const currentImageUrl = currentItemData?.imageUrl || null;


    // Handle image updates
    let finalImageUrl: string | null = currentImageUrl; // Default to current image

    if (typeof imageDataUri === 'string' && imageDataUri.startsWith('data:')) {
      // Case 1: New image upload (imageDataUri is a data URI)
      console.log(
        'Firestore UPDATE_GIFT: New image data URI found. Uploading...'
      );
      if (currentImageUrl) {
        console.log(
          'Firestore UPDATE_GIFT: Deleting previous image:',
          currentImageUrl
        );
        await deleteImage(currentImageUrl).catch((err) =>
          console.warn('Failed to delete previous image, continuing...', err)
        );
      }
      finalImageUrl = await uploadImage(imageDataUri, 'gifts', itemId); // Upload new image
      console.log(
        'Firestore UPDATE_GIFT: New image uploaded. URL:',
        finalImageUrl
      );
    } else if (newImageUrlInput === null && currentImageUrl) {
      // Case 2: Image removal (newImageUrlInput is explicitly null)
      console.log(
        'Firestore UPDATE_GIFT: Image removal requested. Deleting:',
        currentImageUrl
      );
      await deleteImage(currentImageUrl).catch((err) =>
        console.warn(
          'Failed to delete image during removal, continuing...',
          err
        )
      );
      finalImageUrl = null;
    }
     // If newImageUrlInput is a string AND not a data URI, it means the admin might be
     // trying to set an external URL or the form sent back the existing URL.
     // We typically only want to change imageUrl if a new file is uploaded or removal is requested.
     // So, if imageDataUri is not provided and newImageUrlInput is not null, we keep `finalImageUrl` as is (currentImageUrl).
     // This avoids accidentally overwriting a valid URL with an empty string from the form if no new file was chosen.
     dataToUpdate.imageUrl = finalImageUrl;


    // Handle quantity and status updates
    const currentTotalQuantity = currentItemData.totalQuantity ?? null;
    const currentSelectedQuantity = currentItemData.selectedQuantity ?? 0;

    // Determine final totalQuantity
    let finalTotalQuantity = currentTotalQuantity;
    if (typeof newTotalQuantityInput === 'number' && newTotalQuantityInput >= 0) {
        finalTotalQuantity = newTotalQuantityInput;
    } else if (newTotalQuantityInput === null) { // Explicitly set to null for non-quantity items
        finalTotalQuantity = null;
    }
    dataToUpdate.totalQuantity = finalTotalQuantity;

    const isNowQuantityItem = finalTotalQuantity !== null && finalTotalQuantity > 0;

    // Determine final selectedQuantity
    let finalSelectedQuantity = currentSelectedQuantity;
    if (typeof newSelectedQuantityInput === 'number' && newSelectedQuantityInput >= 0) {
        if (isNowQuantityItem && finalTotalQuantity !== null && newSelectedQuantityInput > finalTotalQuantity) {
            console.warn(`Firestore UPDATE_GIFT: Attempted to set selectedQuantity (${newSelectedQuantityInput}) greater than totalQuantity (${finalTotalQuantity}). Clamping to total.`);
            finalSelectedQuantity = finalTotalQuantity; // Clamp to total
        } else {
            finalSelectedQuantity = newSelectedQuantityInput;
        }
    }
    // If it's becoming a non-quantity item, selectedQuantity logic depends on new status
    if (!isNowQuantityItem) {
        finalSelectedQuantity = (newStatusInput === 'selected' || (!newStatusInput && currentItemData.status === 'selected')) ? 1 : 0;
    }
    dataToUpdate.selectedQuantity = finalSelectedQuantity;


    // Determine final status based on quantities and inputs
    let finalStatus = newStatusInput || currentItemData.status;
    if (isNowQuantityItem && finalTotalQuantity !== null) {
        // For quantity items, status is derived
        if (finalSelectedQuantity >= finalTotalQuantity) {
            finalStatus = 'selected';
        } else {
            finalStatus = 'available';
        }
    } else { // Not a quantity item
        if (finalStatus === 'selected' && finalSelectedQuantity < 1) {
            dataToUpdate.selectedQuantity = 1; // Ensure selected single items have quantity 1
        } else if (finalStatus === 'available' || finalStatus === 'not_needed') {
            dataToUpdate.selectedQuantity = 0; // Reset selected quantity if made available/not_needed
        }
    }
    dataToUpdate.status = finalStatus;


    // Handle selectedBy and selectionDate based on new status
    if (dataToUpdate.status === 'selected') {
      if (!isNowQuantityItem) { // Only for single items, quantity items might have many selectors
        dataToUpdate.selectionDate = updates.selectionDate
          ? (new Date(updates.selectionDate as string) instanceof Date ? Timestamp.fromDate(new Date(updates.selectionDate as string)) : serverTimestamp())
          : serverTimestamp(); // Update or set selection date
        dataToUpdate.selectedBy = updates.selectedBy?.trim() || currentItemData.selectedBy || 'Admin'; // Update selectedBy
      }
      // For quantity items, selectedBy and selectionDate might represent the *last* selection or be managed differently.
      // Here, we don't explicitly clear/set them for quantity items during status change to 'selected' via admin,
      // as it's derived from selectedQuantity reaching totalQuantity.
    } else if (dataToUpdate.status === 'available' || dataToUpdate.status === 'not_needed') {
      // If item becomes available or not needed, clear selection details
      dataToUpdate.selectedBy = null;
      dataToUpdate.selectionDate = null;
      // selectedQuantity already handled above
    }

    // Handle priority
    if (typeof newPriorityInput === 'number') {
      dataToUpdate.priority = newPriorityInput;
    } else if (newPriorityInput === null) {
      dataToUpdate.priority = 0; // Or keep existing if null means "don't change"
    }


    // Trim string fields if they are part of the update
    if (typeof dataToUpdate.name === 'string')
      dataToUpdate.name = dataToUpdate.name.trim();
    if (typeof dataToUpdate.description === 'string')
      dataToUpdate.description = dataToUpdate.description.trim() || null; // Ensure empty string becomes null

    // Remove undefined fields from dataToUpdate to avoid Firestore errors
    Object.keys(dataToUpdate).forEach(
      (key) => dataToUpdate[key] === undefined && delete dataToUpdate[key]
    );

    console.log('Firestore UPDATE_GIFT: Final data for update:', dataToUpdate);

    await updateDoc(itemDocRef, dataToUpdate);
    console.log(`Firestore UPDATE_GIFT: Gift ${itemId} updated successfully.`);
    forceRevalidation('/admin');
    forceRevalidation('/'); // Also revalidate public page


    // Fetch and return the updated document
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(
      `Firestore UPDATE_GIFT: Error updating gift ${itemId}:`,
      error
    );
    // If a new image was uploaded but the rest of the update failed, attempt to delete the orphaned image
    if (
      typeof imageDataUri === 'string' &&
      dataToUpdate.imageUrl &&
      dataToUpdate.imageUrl !== currentImageUrl // Check if imageUrl was indeed changed to the new upload
    ) {
      console.error(
        'Firestore UPDATE_GIFT: Cleaning up uploaded image due to update error.'
      );
      await deleteImage(dataToUpdate.imageUrl).catch((e) =>
        console.error('Cleanup failed for image:', dataToUpdate.imageUrl, e)
      );
    }
     if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED updating gift. Check Firestore rules.");
     }
    throw error; // Re-throw to allow UI to handle it
  }
}

export async function deleteGift(itemId: string): Promise<boolean> {
  console.log(`Firestore DELETE_GIFT: Deleting gift ${itemId}...`);
  const itemDocRef = doc(db, 'gifts', itemId);
  try {
    // Check if item exists and get its data (for image URL)
    const itemSnap = await getDoc(itemDocRef);
    if (itemSnap.exists()) {
      const itemData = itemSnap.data();
      const imageUrlToDelete = itemData?.imageUrl; // Get image URL if present

      // Delete the Firestore document
      await deleteDoc(itemDocRef);
      console.log(
        `Firestore DELETE_GIFT: Gift document ${itemId} deleted successfully.`
      );

      // If there was an image URL, attempt to delete the image from Storage
      if (imageUrlToDelete) {
        console.log(
          `Firestore DELETE_GIFT: Deleting associated image: ${imageUrlToDelete}`
        );
        await deleteImage(imageUrlToDelete).catch((err) => {
          // Log a warning if image deletion fails but don't let it fail the whole operation
          console.warn(
            `Firestore DELETE_GIFT: Failed to delete image ${imageUrlToDelete}, but document was deleted. Error:`,
            err
          );
        });
      }
      forceRevalidation('/admin');
      forceRevalidation('/');
      return true;
    } else {
      console.warn(
        `Firestore DELETE_GIFT: Gift document ${itemId} not found. Cannot delete.`
      );
      return false; // Item didn't exist
    }
  } catch (error) {
    console.error(
      `Firestore DELETE_GIFT: Error deleting gift ${itemId}:`,
      error
    );
     if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED deleting gift. Check Firestore rules.");
     }
    return false; // Deletion failed
  }
}

export async function revertSelection(
  itemId: string
): Promise<GiftItem | null> {
  console.log(
    `Firestore REVERT_SELECTION: Reverting selection/status for gift ${itemId}...`
  );
  const itemDocRef = doc(db, 'gifts', itemId);
  try {
    // For both quantity and single items, reverting means:
    // - status becomes 'available'
    // - selectedBy and selectionDate are cleared
    // - selectedQuantity is reset to 0
    const updateData = {
      status: 'available' as const,
      selectedBy: null,
      selectionDate: null, // Using Firestore's null for removal
      selectedQuantity: 0, // Reset selected quantity
    };
    await updateDoc(itemDocRef, updateData);
    console.log(
      `Firestore REVERT_SELECTION: Selection/status for gift ${itemId} reverted successfully.`
    );
    forceRevalidation('/admin');
    forceRevalidation('/');
    // Fetch and return the updated document
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(
      `Firestore REVERT_SELECTION: Error reverting selection for gift ${itemId}:`,
      error
    );
     if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED reverting selection. Check Firestore rules.");
     }
    throw error; // Re-throw to allow UI to handle it
  }
}

export async function markGiftAsNotNeeded(
  itemId: string
): Promise<GiftItem | null> {
  console.log(
    `Firestore MARK_NOT_NEEDED: Marking gift ${itemId} as not needed...`
  );
  const itemDocRef = doc(db, 'gifts', itemId);
  try {
    const updateData = {
      status: 'not_needed' as const,
      selectedBy: null, // Clear selector info
      selectionDate: null,
      selectedQuantity: 0, // Reset selected quantity
    };
    await updateDoc(itemDocRef, updateData);
    console.log(
      `Firestore MARK_NOT_NEEDED: Gift ${itemId} marked as not needed.`
    );
    forceRevalidation('/admin');
    forceRevalidation('/');
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(
      `Firestore MARK_NOT_NEEDED: Error marking gift ${itemId} as not needed:`,
      error
    );
     if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED marking gift as not needed. Check Firestore rules.");
     }
    throw error; // Re-throw
  }
}

// Helper to escape CSV fields
const escapeCsv = (field: string | number | null | undefined): string => {
  if (field === null || field === undefined) return '""'; // Represent null/undefined as empty quoted string
  const stringField = String(field);
  // If the field contains a double quote, comma, or newline, enclose in double quotes and escape existing double quotes
  if (
    stringField.includes('"') ||
    stringField.includes(',') ||
    stringField.includes('\n')
  ) {
    return `"${stringField.replace(/"/g, '""')}"`; // Escape double quotes by doubling them
  }
  return `"${stringField}"`; // Otherwise, just quote it for consistency, though not strictly necessary if no special chars
};

export async function exportGiftsToCSV(): Promise<string> {
  console.log('Firestore EXPORT_GIFTS_CSV: Exporting gifts to CSV...');
  try {
    const currentGifts = await getGifts(); // Assumes getGifts fetches all necessary data
    console.log(
      `Firestore EXPORT_GIFTS_CSV: Fetched ${currentGifts.length} gifts for CSV export.`
    );

    const headers = [
      'ID',
      'Nome',
      'Descrição',
      'Categoria',
      'Status',
      'Prioridade', // Added Priority
      'Qtd Total',
      'Qtd Selecionada',
      'Selecionado Por (Último)',
      'Data Seleção (Última)',
      'Data Criação',
      'URL da Imagem',
    ];

    const rows = currentGifts
      .map((item) => {
        // Basic validation for item structure
        if (!item || typeof item !== 'object') {
          console.warn(
            'Firestore EXPORT_GIFTS_CSV: Skipping invalid item during CSV generation:',
            item
          );
          return ''; // Skip invalid item row
        }

        // Format dates or use empty string if null/undefined
        let selectionDateStr = '';
        if (item.selectionDate) {
          try {
            const date = new Date(item.selectionDate as string); // Assume ISO string from giftFromDoc
            if (!isNaN(date.getTime())) {
              selectionDateStr = date.toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              });
            }
          } catch (e) { /* ignore date parsing errors */ }
        }
        let createdAtStr = '';
        if (item.createdAt) {
          try {
            const date = new Date(item.createdAt as string); // Assume ISO string
            if (!isNaN(date.getTime())) {
              createdAtStr = date.toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              });
            }
          } catch (e) { /* ignore date parsing errors */ }
        }

        // Handle potentially null or undefined fields gracefully for CSV
        const description = item.description ?? '';
        const selectedBy = item.selectedBy ?? '';
        const imageUrl = item.imageUrl ?? '';
        const totalQuantity = item.totalQuantity ?? null; // Keep as null if not set
        const selectedQuantity = item.selectedQuantity ?? 0;
        const priorityMap = {0: 'Baixa', 1: 'Média', 2: 'Alta' };
        const priorityText = typeof item.priority === 'number' ? priorityMap[item.priority as keyof typeof priorityMap] || 'Não definida' : 'Não definida';


        return [
          escapeCsv(item.id),
          escapeCsv(item.name),
          escapeCsv(description),
          escapeCsv(item.category),
          escapeCsv(item.status),
          escapeCsv(priorityText), // Added priority
          escapeCsv(totalQuantity),
          escapeCsv(selectedQuantity),
          escapeCsv(selectedBy),
          escapeCsv(selectionDateStr),
          escapeCsv(createdAtStr),
          escapeCsv(imageUrl),
        ].join(',');
      })
      .filter((row) => row !== ''); // Filter out any empty rows from skipped items

    console.log(
      'Firestore EXPORT_GIFTS_CSV: CSV export generated successfully.'
    );
    const escapedHeaders = headers.map((h) => escapeCsv(h)).join(',');
    return [escapedHeaders, ...rows].join('\n');
  } catch (error) {
    console.error(
      'Firestore EXPORT_GIFTS_CSV: Error exporting gifts to CSV:',
      error
    );
    throw new Error('Erro ao gerar o arquivo CSV de presentes.');
  }
}


export async function exportConfirmationsToCSV(): Promise<string> {
  console.log(
    'Firestore EXPORT_CONFIRMATIONS_CSV: Exporting confirmations to CSV...'
  );
  try {
    const currentConfirmations = await getConfirmations();
    console.log(
      `Firestore EXPORT_CONFIRMATIONS_CSV: Fetched ${currentConfirmations.length} confirmation entries.`
    );

    const headers = ['ID Confirmação', 'Nome Convidado', 'Data Confirmação'];

    // Flatten the confirmations into individual rows per name
    const rows = currentConfirmations.flatMap((confirmation) => {
      if (!confirmation || typeof confirmation !== 'object') {
        console.warn(
          'Firestore EXPORT_CONFIRMATIONS_CSV: Skipping invalid confirmation entry:',
          confirmation
        );
        return []; // Skip invalid entry
      }

      let confirmedAtStr = '';
      if (confirmation.confirmedAt) {
        try {
          const date = new Date(confirmation.confirmedAt); // Already an ISO string
          if (!isNaN(date.getTime())) {
            confirmedAtStr = date.toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
            });
          }
        } catch (e) { /* ignore date parsing errors */ }
      }

      // Create a row for each name in the confirmation
      return confirmation.names.map((name) =>
        [
          escapeCsv(confirmation.id),
          escapeCsv(name), // Escape each name
          escapeCsv(confirmedAtStr),
        ].join(',')
      );
    });

    console.log(
      'Firestore EXPORT_CONFIRMATIONS_CSV: CSV export generated successfully.'
    );
    const escapedHeaders = headers.map((h) => escapeCsv(h)).join(',');
    return [escapedHeaders, ...rows].join('\n');
  } catch (error) {
    console.error(
      'Firestore EXPORT_CONFIRMATIONS_CSV: Error exporting confirmations to CSV:',
      error
    );
    throw new Error('Erro ao gerar o arquivo CSV de presença.');
  }
}

export async function addConfirmation(
  names: string[]
): Promise<Confirmation | null> {
  console.log(
    `Firestore ADD_CONFIRMATION: Adding confirmation for names: ${names.join(', ')}`
  );
  // Validate input names
  if (
    !names ||
    names.length === 0 ||
    names.some((name) => typeof name !== 'string' || name.trim() === '')
  ) {
    console.error('Firestore ADD_CONFIRMATION: Invalid names array provided.');
    throw new Error('Por favor, insira nomes válidos.');
  }

  try {
    const confirmationData = {
      names: names.map((name) => name.trim()), // Trim names
      confirmedAt: serverTimestamp(), // Use server timestamp
    };

    const docRef = await addFirestoreDoc(
      confirmationsCollectionRef,
      confirmationData
    );
    console.log(
      `Firestore ADD_CONFIRMATION: Confirmation added successfully with ID: ${docRef.id}`
    );
    forceRevalidation('/'); // Revalidate public page
    forceRevalidation('/admin'); // Revalidate admin page


    // Fetch and return the newly created document
    const newDocSnap = await getDoc(docRef);
    return newDocSnap.exists() ? confirmationFromDoc(newDocSnap) : null;
  } catch (error) {
    console.error(
      'Firestore ADD_CONFIRMATION: Error adding confirmation:',
      error
    );
     if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED adding confirmation. Check Firestore rules.");
     }
    throw new Error('Erro ao confirmar presença. Tente novamente.');
  }
}

export async function getConfirmations(): Promise<Confirmation[]> {
  console.log(
    'Firestore GET_CONFIRMATIONS: Fetching confirmations, ordered by confirmedAt desc...'
  );
  try {
    const q = query(confirmationsCollectionRef, orderBy('confirmedAt', 'desc'));
    const querySnapshot = await getDocs(q);
    console.log(
      `Firestore GET_CONFIRMATIONS: Query executed. Found ${querySnapshot.size} confirmations.`
    );

    if (querySnapshot.empty) {
      console.log(
        'Firestore GET_CONFIRMATIONS: Confirmations collection is empty.'
      );
      return [];
    } else {
      const confirmations: Confirmation[] = querySnapshot.docs
        .map((docSnapshot) => confirmationFromDoc(docSnapshot))
        .filter((item): item is Confirmation => item !== null); // Type guard

      console.log(
        `Firestore GET_CONFIRMATIONS: Successfully mapped ${confirmations.length} valid confirmations.`
      );
      return confirmations;
    }
  } catch (error) {
    console.error(
      'Firestore GET_CONFIRMATIONS: Error fetching confirmations:',
      error
    );
     if ((error as any)?.code === 'permission-denied') {
        console.error("Firestore: PERMISSION DENIED fetching confirmations. Check Firestore rules.");
     }
    return []; // Return empty array on error
  }
}
