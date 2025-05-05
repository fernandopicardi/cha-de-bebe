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
  serverTimestamp,
  DocumentReference,
  FirestoreError,
  getDocs,
  WriteBatch,
  CollectionReference,
} from "firebase/firestore";
import { db } from "@/firebase/config";

export interface GiftItem {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  status: "available" | "selected";
  selectedBy?: string | null;
  selectionDate?: string | null;
  createdAt?: string | null;
}

export interface SuggestionData {
  itemName: string;
  itemDescription?: string;
  suggesterName: string;
}

export interface EventSettings {
  id?: string;
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

const defaultGiftItems: Omit<GiftItem, "id" | 'createdAt' | 'selectionDate'>[] = [
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
  id: 'main',
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

const giftsCollectionRef = collection(db, "gifts") as CollectionReference<Omit<GiftItem, 'id'>>;
const settingsCollectionRef = collection(db, "settings");
const settingsDocRef = doc(settingsCollectionRef, "main") as DocumentReference<EventSettings>;

// Adjust Firestore rules for more granular control
/*
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Settings document access (adjust as needed)
    match /settings/main {
      allow read: if true;
      allow write: if isAdmin();
    }

    // Gift items collection
    match /gifts/{giftId} {
      allow read: if true; // Allow public read

      // Allow creating with status 'selected' for suggestions
      allow create: if request.resource.data.status == 'selected'
                    && request.resource.data.name is string && request.resource.data.name != ''
                    && request.resource.data.category is string && request.resource.data.category != ''
                    && request.resource.data.selectedBy is string && request.resource.data.selectedBy != '';

      // Allow updating status to 'selected' under specific conditions
      allow update: if resource.data.status == 'available'
                    && request.resource.data.status == 'selected'
                    && request.resource.data.selectedBy is string && request.resource.data.selectedBy != ''
                    && request.resource.data.selectionDate is timestamp
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'selectedBy', 'selectionDate']);

      // Allow admin full write access
      allow write: if isAdmin();
    }

    // Centralized isAdmin function
    function isAdmin() {
      return request.auth != null && request.auth.uid in ['JoO9fy5roDY6FTtqajp1UG8aYzS2', 'VnCKbFH5nrYijsUda0fhK3HdwSF2'];
    }
  }
}
*/

const giftFromDoc = (docSnapshot: any): GiftItem | null => {
  const data = docSnapshot.data();
  const docId = docSnapshot.id;

  if (!data || !data.name || !data.category || !data.status) {
    console.error(`Firestore Convert: Invalid or missing required fields for gift document ID ${docId}.`);
    return null;
  }

  return {
    id: docId,
    name: data.name,
    category: data.category,
    status: data.status,
    description: data.description ?? null,
    selectedBy: data.selectedBy ?? null,
    selectionDate: data.selectionDate instanceof Timestamp
      ? data.selectionDate.toDate().toISOString()
      : null,
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : null,
  };
};

const forceRevalidation = (path: string = "/") => {
  console.log(`Firestore Revalidate: Revalidating path: ${path}...`);
  try {
    revalidatePath(path, "layout");
    if (path !== '/admin') {
      revalidatePath("/admin", "layout");
    }
    console.log(`Firestore Revalidate: Revalidation calls initiated for ${path} and potentially /admin.`);
  } catch (error) {
    console.error(`Firestore Revalidate: Error during revalidatePath for ${path}:`, error);
  }
};

export async function initializeFirestoreData(): Promise<void> {
  console.log("Firestore Init: Checking initialization status...");
  try {
    const settingsSnap = await getDoc(settingsDocRef);
    if (!settingsSnap.exists()) {
      console.log("Firestore Init: Settings document 'settings/main' not found, initializing...");
      await setDoc(settingsDocRef, defaultEventSettings);
      console.log("Firestore Init: Default settings added.");
      forceRevalidation();
    } else {
      console.log("Firestore Init: Settings document 'settings/main' already exists.");
    }

    const giftsQuerySnapshot = await getDocs(query(giftsCollectionRef));
    if (giftsQuerySnapshot.empty) {
      console.log("Firestore Init: Gifts collection empty, initializing defaults...");
      const batch: WriteBatch = writeBatch(db);
      defaultGiftItems.forEach((item) => {
        const docRef = doc(giftsCollectionRef);
        batch.set(docRef, { ...item, createdAt: serverTimestamp() });
      });
      await batch.commit();
      console.log("Firestore Init: Default gifts added.");
      forceRevalidation();
    } else {
      console.log(`Firestore Init: Gifts collection already contains ${giftsQuerySnapshot.size} items. Skipping default initialization.`);
    }
    console.log("Firestore Init: Initialization check complete.");

  } catch (error) {
    console.error("Firestore Init: Error during initialization check:", error);
  }
}

export const getEventSettings = async (): Promise<EventSettings> => {
  const settingsPath = settingsDocRef.path;
  console.log(`Firestore GET: Attempting to fetch event settings from path: ${settingsPath}`);
  try {
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
      console.log(`Firestore GET: Event settings found at ${settingsPath}.`);
      return docSnap.data() as EventSettings;
    } else {
      console.warn(`Firestore GET: Settings document '${settingsPath}' does not exist. Returning default settings.`);
      return defaultEventSettings;
    }
  } catch (error) {
    console.error(`Firestore GET: Error fetching event settings from ${settingsPath}:`, error);
    return defaultEventSettings;
  }
};

export const getGifts = async (): Promise<GiftItem[]> => {
  console.log("Firestore GET_GIFTS: Fetching gifts from 'gifts' collection...");
  try {
    const q = query(giftsCollectionRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    console.log(`Firestore GET_GIFTS: Query executed. Found ${querySnapshot.size} documents.`);

    if (querySnapshot.empty) {
      console.log("Firestore GET_GIFTS: Gifts collection is empty.");
      return [];
    } else {
      const gifts: GiftItem[] = querySnapshot.docs.map(docSnapshot => {
        const mappedGift = giftFromDoc(docSnapshot);
        if (mappedGift === null) {
          console.warn(`Firestore GET_GIFTS: Skipping document ID ${docSnapshot.id} due to mapping error.`);
          return null;
        }
        return mappedGift;
      }).filter((item): item is GiftItem => item !== null);

      console.log(`Firestore GET_GIFTS: Successfully mapped ${gifts.length} valid gifts.`);
      return gifts;
    }
  } catch (error) {
    console.error("Firestore GET_GIFTS: Error fetching gifts:", error);
    return [];
  }
};

export async function updateEventSettings(
  updates: Partial<EventSettings>,
): Promise<EventSettings | null> {
  const settingsPath = settingsDocRef.path;
  console.log(`Firestore UPDATE_SETTINGS: Updating event settings at ${settingsPath}...`, updates);
  try {
    await setDoc(settingsDocRef, updates, { merge: true });
    console.log("Firestore UPDATE_SETTINGS: Event settings updated successfully.");
    forceRevalidation();
    return await getEventSettings();
  } catch (error) {
    console.error(`Firestore UPDATE_SETTINGS: Error updating event settings at ${settingsPath}:`, error);
    return null;
  }
}

export async function selectGift(
  itemId: string,
  guestName: string,
): Promise<GiftItem | null> {
  console.log(`Firestore SELECT: Selecting gift ${itemId} for ${guestName}...`);
  const itemDocRef = doc(db, "gifts", itemId);
  try {
    const updateData = {
      status: "selected" as const,
      selectedBy: guestName,
      selectionDate: serverTimestamp(),
    };
    await updateDoc(itemDocRef, updateData);
    console.log(`Firestore SELECT: Gift ${itemId} selected successfully.`);
    forceRevalidation();
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(`Firestore SELECT: Error selecting gift ${itemId}:`, error);
    return null;
  }
}

export async function markGiftAsNotNeeded(
  itemId: string,
): Promise<GiftItem | null> {
  console.log(`Firestore MARK_NOT_NEEDED: Marking gift ${itemId} as not needed...`);
  const itemDocRef = doc(db, "gifts", itemId);
  try {
    const updateData = {
      status: "available" as const,
      selectedBy: null,
      selectionDate: null,
    };
    await updateDoc(itemDocRef, updateData);
    console.log(`Firestore MARK_NOT_NEEDED: Gift ${itemId} marked as not needed.`);
    forceRevalidation();
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(`Firestore MARK_NOT_NEEDED: Error marking gift ${itemId} as not needed:`, error);
    throw error;
  }
}

export async function addSuggestion(
  suggestionData: SuggestionData,
): Promise<GiftItem | null> {
  console.log(
    `Firestore ADD_SUGGESTION: Adding suggestion from ${suggestionData.suggesterName}...`,
    suggestionData
  );

  const newItemData = {
    name: suggestionData.itemName,
    description: suggestionData.itemDescription,
    category: "Outros",
    status: "selected" as const,
    selectedBy: suggestionData.suggesterName,
    selectionDate: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
  try {
    const docRef = await addDoc(giftsCollectionRef, newItemData);
    console.log(
      `Firestore ADD_SUGGESTION: Suggestion added as new gift with ID: ${docRef.id}`
    );
    forceRevalidation();
    const newDocSnap = await getDoc(docRef);
    return newDocSnap.exists() ? giftFromDoc(newDocSnap) : null;
  } catch (error) {
    console.error("Firestore ADD_SUGGESTION: Error adding suggestion:", error);
    return null;
  }
}

export async function updateGift(
  itemId: string,
  updates: Partial<Omit<GiftItem, "id" | "createdAt">>,
): Promise<GiftItem | null> {
  console.log(`Firestore UPDATE_GIFT: Updating gift ${itemId}...`, updates);
  const itemDocRef = doc(db, "gifts", itemId);
  try {
    await updateDoc(itemDocRef, updates);
    console.log(`Firestore UPDATE_GIFT: Gift ${itemId} updated successfully.`);
    forceRevalidation();
    const updatedSnap = await getDoc(itemDocRef);
    return updatedSnap.exists() ? giftFromDoc(updatedSnap) : null;
  } catch (error) {
    console.error(`Firestore UPDATE_GIFT: Error updating gift ${itemId}:`, error);
    throw error;
  }
}

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
    return false;
  }
}

export async function exportGiftsToCSV(): Promise<string> {
  console.log("Firestore EXPORT: Exporting gifts to CSV...");
  try {
    const currentGifts = await getGifts();
    console.log(`Firestore EXPORT: Fetched ${currentGifts.length} gifts for CSV export.`);

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

    const escapeCsv = (field: string | number | null | undefined): string => {
      if (field === null || field === undefined) return '""';
      const stringField = String(field);
      if (stringField.includes('"') || stringField.includes(',') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return `"${stringField}"`;
    };

    const rows = currentGifts.map((item) => {
      if (!item || typeof item !== 'object') {
        console.warn("Firestore EXPORT: Skipping invalid item during CSV generation:", item);
        return "";
      }

      let selectionDateStr = "";
      if (item.selectionDate) {
        try {
          const date = new Date(item.selectionDate);
          if (!isNaN(date.getTime())) {
            selectionDateStr = date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
          } else {
            console.warn("Firestore EXPORT: Invalid selection date string for CSV:", item.selectionDate);
          }
        } catch (e) { console.warn("Firestore EXPORT: Could not parse selection date string for CSV:", item.selectionDate, e); }
      }
      let createdAtStr = "";
      if (item.createdAt) {
        try {
          const date = new Date(item.createdAt);
          if (!isNaN(date.getTime())) {
            createdAtStr = date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
          } else {
            console.warn("Firestore EXPORT: Invalid creation date string for CSV:", item.createdAt);
          }
        } catch (e) { console.warn("Firestore EXPORT: Could not parse creation date string for CSV:", item.createdAt, e); }
      }

      const description = item.description ?? "";
      const selectedBy = item.selectedBy ?? "";

      return [
        escapeCsv(item.id),
        escapeCsv(item.name),
        escapeCsv(description),
        escapeCsv(item.category),
        escapeCsv(item.status),
        escapeCsv(selectedBy),
        escapeCsv(selectionDateStr),
        escapeCsv(createdAtStr),
      ].join(",");
    }).filter(row => row !== "");

    console.log("Firestore EXPORT: CSV export generated successfully.");
    const escapedHeaders = headers.map(h => escapeCsv(h)).join(",");
    return [escapedHeaders, ...rows].join("\n");
  } catch (error) {
    console.error("Firestore EXPORT: Error exporting gifts to CSV:", error);
    throw new Error("Erro ao gerar o arquivo CSV.");
  }
}
