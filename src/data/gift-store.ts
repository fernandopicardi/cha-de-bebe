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
} from 'firebase/firestore';
import { db, storage } from '@/firebase/config'; // Ensure db and storage are imported correctly
import { uploadImage, deleteImage } from '@/services/storage'; // Import storage service
// Removed: import { sendGiftReminderEmail } from '@/services/email';

// --- INTERFACE DEFINITIONS ---

export interface GiftItem {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  status: 'available' | 'selected' | 'not_needed';
  selectedBy?: string | null;
  selectionDate?: string | null; // ISO string date format
  createdAt?: string | null; // ISO string date format
  imageUrl?: string | null;

  totalQuantity?: number | null;
  selectedQuantity?: number;
  // Added for email reminder functionality - this will be removed if sendGiftReminderEmail is removed
  sendReminderEmail?: boolean;
  guestEmail?: string;
}

export interface SuggestionData {
  itemName: string;
  itemDescription?: string;
  suggesterName: string;
  imageDataUri?: string | null;
  // Removed: sendReminderEmail: boolean;
  // Removed: guestEmail?: string;
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
  confirmedAt: string;
}

// --- DEFAULT DATA ---

const defaultGiftItems: Omit<
  GiftItem,
  'id' | 'createdAt' | 'selectionDate' | 'selectedQuantity' | 'totalQuantity' | 'sendReminderEmail' | 'guestEmail'
>[] = [
  {
    name: 'Body Manga Curta (RN)',
    category: 'Roupas',
    status: 'available',
    description: 'Pacote com 3 unidades, cores neutras.',
    imageUrl: null,
  },
  {
    name: 'Fraldas Pampers (P)',
    category: 'Higiene',
    status: 'available',
    description: 'Pacote grande.',
    imageUrl: null,
    totalQuantity: 10,
  },
  {
    name: 'Mamadeira Anti-cólica',
    category: 'Alimentação',
    status: 'available',
    imageUrl: null,
  },
  {
    name: 'Móbile Musical',
    category: 'Brinquedos',
    status: 'available',
    imageUrl: null,
  },
  {
    name: 'Lenços Umedecidos',
    category: 'Higiene',
    status: 'available',
    imageUrl: null,
    totalQuantity: 20,
  },
  {
    name: 'Termômetro Digital',
    category: 'Higiene',
    status: 'available',
    imageUrl: null,
  },
  {
    name: 'Macacão Pijama (M)',
    category: 'Roupas',
    status: 'available',
    description: 'Algodão macio.',
    imageUrl: null,
  },
  {
    name: 'Chupeta Calmante',
    category: 'Outros',
    status: 'available',
    imageUrl: null,
  },
  {
    name: 'Cadeirinha de Descanso',
    category: 'Outros',
    status: 'available',
    imageUrl: null,
  },
  {
    name: 'Pomada para Assaduras',
    category: 'Higiene',
    status: 'available',
    description: 'Marca Bepantol Baby ou similar.',
    imageUrl: null,
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
) as DocumentReference<EventSettings>;
const confirmationsCollectionRef = collection(
  db,
  'confirmations'
) as CollectionReference<Omit<Confirmation, 'id'>>;

// --- HELPER FUNCTIONS ---

const giftFromDoc = (
  docSnapshot: DocumentSnapshot | QueryDocumentSnapshot
): GiftItem | null => {
  if (!docSnapshot.exists) {
    console.warn(
      `Firestore Convert: Document ID ${docSnapshot.id} does not exist.`
    );
    return null;
  }

  const data = docSnapshot.data() as Partial<Omit<GiftItem, 'id'>>; // Use Partial for incoming data
  const docId = docSnapshot.id;

  if (!data) {
    console.error(
      `Firestore Convert: No data found for document ID ${docId}.`
    );
    return null;
  }

  // Validate required fields with type checks
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
      console.warn(`Firestore Convert: Unexpected type for selectionDate for gift ID ${docId}: ${typeof data.selectionDate}`);
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
       console.warn(`Firestore Convert: Unexpected type for createdAt for gift ID ${docId}: ${typeof data.createdAt}`);
    }
  }

  return {
    id: docId,
    name: data.name,
    description:
      typeof data.description === 'string' ? data.description : null,
    category: data.category,
    status: data.status as 'available' | 'selected' | 'not_needed', // Already validated
    selectedBy: typeof data.selectedBy === 'string' ? data.selectedBy : null,
    selectionDate: selectionDateISO,
    createdAt: createdAtISO,
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
    totalQuantity:
      typeof data.totalQuantity === 'number' ? data.totalQuantity : null,
    selectedQuantity:
      typeof data.selectedQuantity === 'number' ? data.selectedQuantity : 0,
    sendReminderEmail: typeof data.sendReminderEmail === 'boolean' ? data.sendReminderEmail : false,
    guestEmail: typeof data.guestEmail === 'string' ? data.guestEmail : undefined,
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
    revalidatePath(path, 'layout'); // Revalidate the specific path
    // Also revalidate common related paths if necessary
    if (path === '/' || path.startsWith('/?category=')) {
      revalidatePath('/admin', 'layout');
    } else if (path === '/admin') {
      revalidatePath('/', 'layout');
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

// --- INITIALIZATION ---
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
        const docRef = doc(giftsCollectionRef);
        const fullItem = {
          ...itemData,
          selectedQuantity: 0, // Ensure selectedQuantity is 0
          totalQuantity: itemData.totalQuantity ?? null, // Ensure totalQuantity is null if not provided
          createdAt: serverTimestamp(),
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
  }
}

// --- DATA STORE FUNCTIONS ---

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
      const settingsData: EventSettings = {
        id: docSnap.id,
        ...(data as Omit<EventSettings, 'id'>),
        headerImageUrl: data.headerImageUrl || null,
      };
      return settingsData;
    } else {
      console.warn(
        `Firestore GET_SETTINGS: Settings document '${settingsPath}' does not exist. Returning default settings.`
      );
      return { ...defaultEventSettings };
    }
  } catch (error) {
    console.error(
      `Firestore GET_SETTINGS: Error fetching event settings from ${settingsPath}:`,
      error
    );
    if ((error as any)?.code === 'permission-denied') {
      console.error(
        'Firestore: PERMISSION DENIED fetching event settings. Check Firestore rules.'
      );
    }
    return { ...defaultEventSettings };
  }
};

export const getGifts = async (): Promise<GiftItem[]> => {
  console.log(
    "Firestore GET_GIFTS: Fetching gifts from 'gifts' collection, ordered by createdAt desc..."
  );
  try {
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
        .filter((item): item is GiftItem => item !== null);

      console.log(
        `Firestore GET_GIFTS: Successfully mapped ${gifts.length} valid gifts from ${querySnapshot.size} documents.`
      );
      if (gifts.length !== querySnapshot.size) {
        console.warn(`Firestore GET_GIFTS: ${querySnapshot.size - gifts.length} documents were filtered out by giftFromDoc due to data validation issues.`);
      }
      // console.log("Firestore GET_GIFTS: Sample gifts:", JSON.stringify(gifts.slice(0, 2), null, 2));
      return gifts;
    }
  } catch (error) {
    console.error('Firestore GET_GIFTS: Error fetching gifts:', error);
    if ((error as any)?.code === 'permission-denied') {
      console.error(
        'Firestore: PERMISSION DENIED fetching gifts. Check Firestore rules.'
      );
    }
    return [];
  }
};

export async function updateEventSettings(
  updates: Partial<EventSettings>
): Promise<EventSettings | null> {
  const settingsPath = settingsDocRef.path;
  const { id, headerImageUrl: newImageUrlInput, ...otherUpdates } = updates;
  const dataToUpdate: Partial<EventSettings> = { ...otherUpdates };

  console.log(
    `Firestore UPDATE_SETTINGS: Updating event settings at ${settingsPath}...`
  );

  try {
    const currentSettingsSnap = await getDoc(settingsDocRef);
    const currentImageUrl = currentSettingsSnap.exists()
      ? currentSettingsSnap.data()?.headerImageUrl
      : null;

    let finalImageUrl: string | null = currentImageUrl;

    if (
      typeof newImageUrlInput === 'string' &&
      newImageUrlInput.startsWith('data:') // Simplified check for data URI (image or video)
    ) {
      console.log(
        'Firestore UPDATE_SETTINGS: New header image data URI found. Uploading...'
      );
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
      );
      console.log(
        'Firestore UPDATE_SETTINGS: New header image uploaded. URL:',
        finalImageUrl
      );
    } else if (newImageUrlInput === null && currentImageUrl) {
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
      finalImageUrl = null;
    } else if (
      typeof newImageUrlInput === 'string' &&
      !newImageUrlInput.startsWith('data:')
    ) {
      console.log(
        'Firestore UPDATE_SETTINGS: Existing header image URL provided, no change needed unless explicitly set to null elsewhere.'
      );
      finalImageUrl = newImageUrlInput;
    }

    dataToUpdate.headerImageUrl = finalImageUrl;

    console.log('Firestore UPDATE_SETTINGS: Final data being saved:', {
      ...dataToUpdate,
      headerImageUrl: dataToUpdate.headerImageUrl,
    });

    await setDoc(settingsDocRef, dataToUpdate, { merge: true });
    console.log(
      'Firestore UPDATE_SETTINGS: Event settings updated successfully.'
    );

    forceRevalidation('/');
    forceRevalidation('/admin');

    const updatedSettings = await getEventSettings();
    return updatedSettings;
  } catch (error) {
    console.error(
      `Firestore UPDATE_SETTINGS: Error updating event settings at ${settingsPath}:`,
      error
    );
    if ((error as any)?.code === 'permission-denied') {
      console.error(
        'Firestore: PERMISSION DENIED updating event settings. Check Firestore rules.'
      );
    }
    return null;
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
      return null;
    }
    const currentItem = giftFromDoc(itemSnap);
    if (!currentItem) {
      console.error(
        `Firestore SELECT_GIFT: Failed to parse item ${itemId} data.`
      );
      return null;
    }

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

      const updateData: Partial<GiftItem> = {
        selectedQuantity: newSelectedQuantity,
        status: newStatus,
        selectedBy: guestName,
        selectionDate: new Date().toISOString(),
      };
      await updateDoc(itemDocRef, {
        ...updateData,
        selectionDate: serverTimestamp(), // Use serverTimestamp for actual update
      });
      console.log(
        `Firestore SELECT_GIFT: Updated quantity for ${itemId}. New selected: ${newSelectedQuantity}. Status: ${newStatus}`
      );
    } else {
      if (currentItem.status !== 'available') {
        console.warn(
          `Firestore SELECT_GIFT: Item ${itemId} is not available (Status: ${currentItem.status}).`
        );
        throw new Error('Este item não está mais disponível.');
      }

      const updateData: Partial<GiftItem> = {
        status: 'selected' as const,
        selectedBy: guestName,
        selectionDate: new Date().toISOString(), // For optimistic update
        selectedQuantity: 1, // Explicitly set for single items
      };
      await updateDoc(itemDocRef, {
        ...updateData,
        selectionDate: serverTimestamp(), // Use serverTimestamp
      });
      console.log(
        `Firestore SELECT_GIFT: Marked single item ${itemId} as selected.`
      );
    }

    forceRevalidation('/');
    forceRevalidation('/admin');

    const updatedSnap = await getDoc(itemDocRef);
    const updatedItem = updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;

    // Email sending logic removed
    // if (updatedItem && currentItem.sendReminderEmail && currentItem.guestEmail) {
    //   const eventSettings = await getEventSettings();
    //   if (eventSettings) {
    //      try {
    //         await sendGiftReminderEmail(currentItem.guestEmail, updatedItem, eventSettings, guestName, quantityToSelect);
    //      } catch (emailError) {
    //         console.error("Failed to send reminder email:", emailError);
    //         // Do not let email failure break the main gift selection flow
    //      }
    //   }
    // }


    return updatedItem;
  } catch (error) {
    console.error(
      `Firestore SELECT_GIFT: Error selecting gift ${itemId}:`,
      error
    );
    if ((error as any)?.code === 'permission-denied') {
      console.error(
        'Firestore: PERMISSION DENIED selecting gift. Check Firestore rules.'
      );
    } else if ((error as any)?.code === 'not-found') {
      console.error(
        `Firestore SELECT_GIFT: Gift item with ID ${itemId} not found.`
      );
    }
    throw error;
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
    if (suggestionData.imageDataUri) {
      console.log(
        'Firestore ADD_SUGGESTION: Image data URI found. Uploading image...'
      );
      uploadedImageUrl = await uploadImage(
        suggestionData.imageDataUri,
        'gifts',
        'suggestion'
      );
      console.log(
        'Firestore ADD_SUGGESTION: Image uploaded successfully. URL:',
        uploadedImageUrl
      );
    }

    const newItemData: Omit<GiftItem, 'id'> & { createdAt: any, selectionDate: any } = {
      name: suggestionData.itemName.trim(),
      description: suggestionData.itemDescription?.trim() || null,
      category: 'Outros', // Default category for suggestions
      status: 'selected' as const, // Suggestions are immediately marked as selected
      selectedBy: suggestionData.suggesterName.trim(),
      selectionDate: serverTimestamp(),
      createdAt: serverTimestamp(),
      imageUrl: uploadedImageUrl,
      selectedQuantity: 1, // Quantity is 1 for user-suggested items
      totalQuantity: 1, // Total quantity is also 1
      // sendReminderEmail and guestEmail are no longer part of SuggestionData or GiftItem for this purpose
    };

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

    const newDocSnap = await getDoc(docRef);
    const newItem = newDocSnap.exists() ? giftFromDoc(newDocSnap) : null;

    // Email sending logic removed
    // if (newItem && suggestionData.sendReminderEmail && suggestionData.guestEmail) {
    //   const eventSettings = await getEventSettings(); // Fetch current event settings
    //   if (eventSettings) {
    //     try {
    //       await sendGiftReminderEmail(
    //         suggestionData.guestEmail,
    //         newItem,
    //         eventSettings,
    //         suggestionData.suggesterName,
    //         1 // Quantity is 1 for suggested items
    //       );
    //     } catch (emailError) {
    //       console.error("Firestore ADD_SUGGESTION: Failed to send reminder email:", emailError);
    //       // Log error but don't fail the suggestion addition
    //     }
    //   } else {
    //     console.warn("Firestore ADD_SUGGESTION: Event settings not found, cannot send email.");
    //   }
    // }


    return newItem;
  } catch (error) {
    console.error('Firestore ADD_SUGGESTION: Error adding suggestion:', error);
    if (uploadedImageUrl) {
      console.error(
        'Firestore ADD_SUGGESTION: Cleaning up potentially uploaded image due to error.'
      );
      await deleteImage(uploadedImageUrl).catch((e) =>
        console.error('Cleanup failed for image:', uploadedImageUrl, e)
      );
    }
    if ((error as any)?.code === 'permission-denied') {
      console.error(
        'Firestore: PERMISSION DENIED adding suggestion. Check Firestore rules.'
      );
    }
    return null;
  }
}

export async function addGiftAdmin(
  giftData: Partial<GiftItem> & { imageDataUri?: string | null }
): Promise<GiftItem | null> {
  console.log('Firestore ADD_GIFT_ADMIN: Adding new gift item...');
  const { imageDataUri, totalQuantity, name, category, status, description, selectedBy, ...otherItemDetails } = giftData;
  let uploadedImageUrl: string | null = null;

  try {
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

    const isQuantityItem =
      typeof totalQuantity === 'number' && totalQuantity > 0;

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

    const finalDataToAdd: Omit<GiftItem, 'id'> & { createdAt: any, selectionDate: any | null } = { // Allow null for selectionDate
      name: name.trim(),
      description: description?.trim() || null,
      category: category,
      status:
        status === 'not_needed'
          ? 'not_needed'
          : isQuantityItem
            ? 'available' // Quantity items added by admin default to available
            : status,
      selectedBy:
        status === 'selected' && !isQuantityItem
          ? selectedBy?.trim() || 'Admin' // Admin default for selected non-quantity items
          : null,
      selectionDate:
        status === 'selected' && !isQuantityItem
          ? serverTimestamp()
          : null,
      createdAt: serverTimestamp(),
      imageUrl: uploadedImageUrl,
      totalQuantity: isQuantityItem ? totalQuantity : null,
      selectedQuantity: 0, // Always initialize to 0 for new items
       ...(otherItemDetails as Partial<Omit<GiftItem, 'id' | 'createdAt' | 'selectionDate' | 'name' | 'category' | 'status' | 'totalQuantity' | 'selectedQuantity' | 'imageUrl' | 'description' | 'selectedBy'>>), // Include any other valid GiftItem fields
    };


    if (
      finalDataToAdd.status === 'selected' &&
      !isQuantityItem &&
      !finalDataToAdd.selectedBy
    ) {
      finalDataToAdd.selectedBy = 'Admin';
    }
    if (finalDataToAdd.status === 'not_needed') {
      finalDataToAdd.selectedBy = null;
      finalDataToAdd.selectionDate = null;
      finalDataToAdd.selectedQuantity = 0;
    }
     // Explicitly set selectedQuantity for single selected items if not a quantity item
    if (finalDataToAdd.status === 'selected' && !isQuantityItem) {
        finalDataToAdd.selectedQuantity = 1;
    }


    const cleanedData = Object.fromEntries(
      Object.entries(finalDataToAdd).filter(([, value]) => value !== undefined)
    ) as Omit<GiftItem, 'id'> & { createdAt: any, selectionDate: any | null }; // Type assertion

    console.log('Firestore ADD_GIFT_ADMIN: Cleaned Data to Add:', cleanedData);

    const docRef = await addFirestoreDoc(giftsCollectionRef, cleanedData);
    console.log(
      `Firestore ADD_GIFT_ADMIN: Gift added successfully with ID: ${docRef.id}`
    );
    forceRevalidation('/admin');
    forceRevalidation('/');


    const newDocSnap = await getDoc(docRef);
    return newDocSnap.exists() ? giftFromDoc(newDocSnap) : null;
  } catch (error) {
    console.error('Firestore ADD_GIFT_ADMIN: Error adding gift:', error);
    if (uploadedImageUrl) {
      console.error(
        'Firestore ADD_GIFT_ADMIN: Cleaning up potentially uploaded image due to error.'
      );
      await deleteImage(uploadedImageUrl).catch((e) =>
        console.error('Cleanup failed for image:', uploadedImageUrl, e)
      );
    }
    if ((error as any)?.code === 'permission-denied') {
      console.error(
        'Firestore: PERMISSION DENIED adding gift. Check Firestore rules.'
      );
    }
    throw error;
  }
}

export async function updateGift(
  itemId: string,
  updates: Partial<Omit<GiftItem, 'id' | 'createdAt'>> & { // selectedQuantity can be updated
    imageDataUri?: string | null | undefined;
  }
): Promise<GiftItem | null> {
  console.log(`Firestore UPDATE_GIFT: Updating gift ${itemId}...`);
  const {
    imageDataUri,
    imageUrl: newImageUrlInput, // This might be a new URL or null for removal
    totalQuantity: newTotalQuantityInput,
    selectedQuantity: newSelectedQuantityInput,
    status: newStatusInput,
    ...otherUpdates
  } = updates;

  const itemDocRef = doc(db, 'gifts', itemId);
  const dataToUpdate: Record<string, any> = { ...otherUpdates };

  try {
    const currentItemSnap = await getDoc(itemDocRef);
    if (!currentItemSnap.exists()) {
      console.error(`Firestore UPDATE_GIFT: Item with ID ${itemId} not found.`);
      throw new Error(`Item with ID ${itemId} não encontrado.`);
    }
    const currentItemData = currentItemSnap.data() as GiftItem; // Assuming data matches GiftItem
    const currentImageUrl = currentItemData?.imageUrl || null;


    let finalImageUrl: string | null = currentImageUrl;

    if (typeof imageDataUri === 'string' && imageDataUri.startsWith('data:')) {
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
      finalImageUrl = await uploadImage(imageDataUri, 'gifts', itemId);
      console.log(
        'Firestore UPDATE_GIFT: New image uploaded. URL:',
        finalImageUrl
      );
    } else if (newImageUrlInput === null && currentImageUrl) {
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
     dataToUpdate.imageUrl = finalImageUrl;


    // Handle totalQuantity and selectedQuantity
    const currentTotalQuantity = currentItemData.totalQuantity ?? null;
    const currentSelectedQuantity = currentItemData.selectedQuantity ?? 0;

    let finalTotalQuantity = currentTotalQuantity;
    if (typeof newTotalQuantityInput === 'number' && newTotalQuantityInput >= 0) {
        finalTotalQuantity = newTotalQuantityInput;
    } else if (newTotalQuantityInput === null) {
        finalTotalQuantity = null; // Explicitly setting to null (single item)
    }
    dataToUpdate.totalQuantity = finalTotalQuantity;

    const isNowQuantityItem = finalTotalQuantity !== null && finalTotalQuantity > 0;

    let finalSelectedQuantity = currentSelectedQuantity;
    if (typeof newSelectedQuantityInput === 'number' && newSelectedQuantityInput >= 0) {
        if (isNowQuantityItem && finalTotalQuantity !== null && newSelectedQuantityInput > finalTotalQuantity) {
            console.warn(`Firestore UPDATE_GIFT: Attempted to set selectedQuantity (${newSelectedQuantityInput}) greater than totalQuantity (${finalTotalQuantity}). Clamping to total.`);
            finalSelectedQuantity = finalTotalQuantity;
        } else {
            finalSelectedQuantity = newSelectedQuantityInput;
        }
    }
     // If item becomes non-quantity, selectedQuantity should be 0 or 1 based on status
    if (!isNowQuantityItem) {
        finalSelectedQuantity = (newStatusInput === 'selected' || (!newStatusInput && currentItemData.status === 'selected')) ? 1 : 0;
    }
    dataToUpdate.selectedQuantity = finalSelectedQuantity;


    // Determine status based on quantity and input
    let finalStatus = newStatusInput || currentItemData.status;
    if (isNowQuantityItem && finalTotalQuantity !== null) {
        if (finalSelectedQuantity >= finalTotalQuantity) {
            finalStatus = 'selected';
        } else {
            finalStatus = 'available';
        }
    } else { // Single item
        if (finalStatus === 'selected' && finalSelectedQuantity < 1) {
            // If admin manually sets to selected but selectedQuantity is 0, make it 1
            dataToUpdate.selectedQuantity = 1;
        } else if (finalStatus === 'available' || finalStatus === 'not_needed') {
            dataToUpdate.selectedQuantity = 0;
        }
    }
    dataToUpdate.status = finalStatus;


    // Handle selectedBy and selectionDate
    if (dataToUpdate.status === 'selected') {
      if (!isNowQuantityItem) { // Only for single items set via admin
        dataToUpdate.selectionDate = updates.selectionDate
          ? (new Date(updates.selectionDate) instanceof Date ? Timestamp.fromDate(new Date(updates.selectionDate)) : serverTimestamp())
          : serverTimestamp();
        dataToUpdate.selectedBy = updates.selectedBy?.trim() || currentItemData.selectedBy || 'Admin';
      }
       // For quantity items, selectedBy and selectionDate are typically updated by user actions, not directly here unless specified
    } else if (dataToUpdate.status === 'available' || dataToUpdate.status === 'not_needed') {
      dataToUpdate.selectedBy = null;
      dataToUpdate.selectionDate = null;
    }


    if (typeof dataToUpdate.name === 'string')
      dataToUpdate.name = dataToUpdate.name.trim();
    if (typeof dataToUpdate.description === 'string')
      dataToUpdate.description = dataToUpdate.description.trim() || null;

    Object.keys(dataToUpdate).forEach(
      (key) => dataToUpdate[key] === undefined && delete dataToUpdate[key]
    );

    console.log('Firestore UPDATE_GIFT: Final data for update:', dataToUpdate);

    await updateDoc(itemDocRef, dataToUpdate);
    console.log(`Firestore UPDATE_GIFT: Gift ${itemId} updated successfully.`);
    forceRevalidation('/admin');
    forceRevalidation('/');


    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(
      `Firestore UPDATE_GIFT: Error updating gift ${itemId}:`,
      error
    );
    if (
      typeof imageDataUri === 'string' &&
      dataToUpdate.imageUrl &&
      dataToUpdate.imageUrl !== currentImageUrl
    ) {
      console.error(
        'Firestore UPDATE_GIFT: Cleaning up uploaded image due to update error.'
      );
      await deleteImage(dataToUpdate.imageUrl).catch((e) =>
        console.error('Cleanup failed for image:', dataToUpdate.imageUrl, e)
      );
    }
    if ((error as any)?.code === 'permission-denied') {
      console.error(
        'Firestore: PERMISSION DENIED updating gift. Check Firestore rules.'
      );
    }
    throw error;
  }
}

export async function deleteGift(itemId: string): Promise<boolean> {
  console.log(`Firestore DELETE_GIFT: Deleting gift ${itemId}...`);
  const itemDocRef = doc(db, 'gifts', itemId);
  try {
    const itemSnap = await getDoc(itemDocRef);
    if (itemSnap.exists()) {
      const itemData = itemSnap.data();
      const imageUrlToDelete = itemData?.imageUrl;

      await deleteDoc(itemDocRef);
      console.log(
        `Firestore DELETE_GIFT: Gift document ${itemId} deleted successfully.`
      );

      if (imageUrlToDelete) {
        console.log(
          `Firestore DELETE_GIFT: Deleting associated image: ${imageUrlToDelete}`
        );
        await deleteImage(imageUrlToDelete).catch((err) => {
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
      return false;
    }
  } catch (error) {
    console.error(
      `Firestore DELETE_GIFT: Error deleting gift ${itemId}:`,
      error
    );
    if ((error as any)?.code === 'permission-denied') {
      console.error(
        'Firestore: PERMISSION DENIED deleting gift. Check Firestore rules.'
      );
    }
    return false;
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
    const updateData = {
      status: 'available' as const,
      selectedBy: null,
      selectionDate: null,
      selectedQuantity: 0,
    };
    await updateDoc(itemDocRef, updateData);
    console.log(
      `Firestore REVERT_SELECTION: Selection/status for gift ${itemId} reverted successfully.`
    );
    forceRevalidation('/admin');
    forceRevalidation('/');
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(
      `Firestore REVERT_SELECTION: Error reverting selection for gift ${itemId}:`,
      error
    );
    if ((error as any)?.code === 'permission-denied') {
      console.error(
        'Firestore: PERMISSION DENIED reverting selection. Check Firestore rules.'
      );
    }
    throw error;
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
      selectedBy: null,
      selectionDate: null,
      selectedQuantity: 0,
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
      console.error(
        'Firestore: PERMISSION DENIED marking gift as not needed. Check Firestore rules.'
      );
    }
    throw error;
  }
}

const escapeCsv = (field: string | number | null | undefined): string => {
  if (field === null || field === undefined) return '""';
  const stringField = String(field);
  if (
    stringField.includes('"') ||
    stringField.includes(',') ||
    stringField.includes('\n')
  ) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return `"${stringField}"`;
};

export async function exportGiftsToCSV(): Promise<string> {
  console.log('Firestore EXPORT_GIFTS_CSV: Exporting gifts to CSV...');
  try {
    const currentGifts = await getGifts();
    console.log(
      `Firestore EXPORT_GIFTS_CSV: Fetched ${currentGifts.length} gifts for CSV export.`
    );

    const headers = [
      'ID',
      'Nome',
      'Descrição',
      'Categoria',
      'Status',
      'Qtd Total',
      'Qtd Selecionada',
      'Selecionado Por (Último)',
      'Data Seleção (Última)',
      'Data Criação',
      'URL da Imagem',
    ];

    const rows = currentGifts
      .map((item) => {
        if (!item || typeof item !== 'object') {
          console.warn(
            'Firestore EXPORT_GIFTS_CSV: Skipping invalid item during CSV generation:',
            item
          );
          return '';
        }

        let selectionDateStr = '';
        if (item.selectionDate) {
          try {
            const date = new Date(item.selectionDate);
            if (!isNaN(date.getTime())) {
              selectionDateStr = date.toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              });
            }
          } catch (e) { /* ignore */ }
        }
        let createdAtStr = '';
        if (item.createdAt) {
          try {
            const date = new Date(item.createdAt);
            if (!isNaN(date.getTime())) {
              createdAtStr = date.toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              });
            }
          } catch (e) { /* ignore */ }
        }

        const description = item.description ?? '';
        const selectedBy = item.selectedBy ?? '';
        const imageUrl = item.imageUrl ?? '';
        const totalQuantity = item.totalQuantity ?? null;
        const selectedQuantity = item.selectedQuantity ?? 0; // Default to 0 if undefined

        return [
          escapeCsv(item.id),
          escapeCsv(item.name),
          escapeCsv(description),
          escapeCsv(item.category),
          escapeCsv(item.status),
          escapeCsv(totalQuantity),
          escapeCsv(selectedQuantity),
          escapeCsv(selectedBy),
          escapeCsv(selectionDateStr),
          escapeCsv(createdAtStr),
          escapeCsv(imageUrl),
        ].join(',');
      })
      .filter((row) => row !== '');

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

    const rows = currentConfirmations.flatMap((confirmation) => {
      if (!confirmation || typeof confirmation !== 'object') {
        console.warn(
          'Firestore EXPORT_CONFIRMATIONS_CSV: Skipping invalid confirmation entry:',
          confirmation
        );
        return [];
      }

      let confirmedAtStr = '';
      if (confirmation.confirmedAt) {
        try {
          const date = new Date(confirmation.confirmedAt);
          if (!isNaN(date.getTime())) {
            confirmedAtStr = date.toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
            });
          }
        } catch (e) { /* ignore */ }
      }

      return confirmation.names.map((name) =>
        [
          escapeCsv(confirmation.id),
          escapeCsv(name),
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

// --- Presence Confirmation Functions ---

export async function addConfirmation(
  names: string[]
): Promise<Confirmation | null> {
  console.log(
    `Firestore ADD_CONFIRMATION: Adding confirmation for names: ${names.join(', ')}`
  );
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
      names: names.map((name) => name.trim()),
      confirmedAt: serverTimestamp(),
    };

    const docRef = await addFirestoreDoc(
      confirmationsCollectionRef,
      confirmationData
    );
    console.log(
      `Firestore ADD_CONFIRMATION: Confirmation added successfully with ID: ${docRef.id}`
    );
    forceRevalidation('/');
    forceRevalidation('/admin');


    const newDocSnap = await getDoc(docRef);
    return newDocSnap.exists() ? confirmationFromDoc(newDocSnap) : null;
  } catch (error) {
    console.error(
      'Firestore ADD_CONFIRMATION: Error adding confirmation:',
      error
    );
    if ((error as any)?.code === 'permission-denied') {
      console.error(
        'Firestore: PERMISSION DENIED adding confirmation. Check Firestore rules.'
      );
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
        .filter((item): item is Confirmation => item !== null);

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
      console.error(
        'Firestore: PERMISSION DENIED fetching confirmations. Check Firestore rules.'
      );
    }
    return [];
  }
}

// Consider moving initializeFirestoreData to a separate script or a development-only call.
// Calling it on every server render of a component using this module might be excessive.
// initializeFirestoreData().catch(err => console.error("Initial Firestore check failed:", err));
