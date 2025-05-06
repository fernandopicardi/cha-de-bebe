"use server";

import { storage } from "@/firebase/config";
import {
  ref,
  uploadString,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { v4 as uuidv4 } from "uuid"; // For generating unique filenames

/**
 * Uploads an image (provided as a data URI) to Firebase Storage.
 *
 * @param dataUri The image data URI (e.g., 'data:image/jpeg;base64,...').
 * @param folder The folder path within Firebase Storage (e.g., 'gifts' or 'header').
 * @param filenamePrefix Optional prefix for the filename (e.g., item ID). A unique ID will be appended.
 * @returns The public download URL of the uploaded image.
 * @throws Throws an error if the upload fails.
 */
export async function uploadImage(
  dataUri: string,
  folder: string,
  filenamePrefix?: string,
): Promise<string> {
  console.log(
    `Storage Service: Uploading image to folder: ${folder}, Prefix: ${filenamePrefix}`,
  );

  if (!dataUri.startsWith("data:image/")) {
    console.error("Storage Service: Invalid data URI provided.");
    throw new Error("Invalid image data format.");
  }

  // Extract mime type and base64 data
  const matches = dataUri.match(/^data:(image\/(.+));base64,(.*)$/);
  if (!matches || matches.length !== 4) {
    console.error("Storage Service: Could not parse data URI.");
    throw new Error("Could not parse image data URI.");
  }

  const mimeType = matches[1];
  const fileExtension = matches[2]; // e.g., 'jpeg', 'png'
  const base64Data = matches[3];

  // Generate a unique filename to prevent overwrites
  const uniqueId = uuidv4();
  const filename = filenamePrefix
    ? `${filenamePrefix}_${uniqueId}.${fileExtension}`
    : `${uniqueId}.${fileExtension}`;
  const storagePath = `${folder}/${filename}`;
  const storageRef = ref(storage, storagePath);

  console.log(`Storage Service: Uploading to path: ${storagePath}`);

  try {
    // Upload the base64 string
    const snapshot = await uploadString(storageRef, base64Data, "base64", {
      contentType: mimeType,
    });
    console.log(
      "Storage Service: Image uploaded successfully. Snapshot:",
      snapshot.metadata.fullPath,
    );

    // Get the public download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log("Storage Service: Download URL retrieved:", downloadURL);

    return downloadURL;
  } catch (error) {
    console.error("Storage Service: Error uploading image:", error);
    // Consider more specific error handling (e.g., permissions)
    throw new Error(
      `Failed to upload image: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Deletes an image from Firebase Storage using its download URL.
 *
 * @param downloadURL The public download URL of the image to delete.
 * @returns Promise<void>
 * @throws Throws an error if deletion fails.
 */
export async function deleteImage(downloadURL: string): Promise<void> {
  console.log(
    `Storage Service: Attempting to delete image with URL: ${downloadURL}`,
  );
  if (!downloadURL || !downloadURL.includes("firebasestorage.googleapis.com")) {
    console.warn(
      "Storage Service: Invalid or non-Firebase Storage URL provided for deletion.",
    );
    // Decide if this should be an error or just ignored
    // throw new Error('Invalid Firebase Storage URL for deletion.');
    return; // Silently ignore if not a valid storage URL
  }
  try {
    const storageRef = ref(storage, downloadURL);
    await deleteObject(storageRef);
    console.log(
      "Storage Service: Image deleted successfully from URL:",
      downloadURL,
    );
  } catch (error: any) {
    // Firebase Storage throws 'storage/object-not-found' if the file doesn't exist.
    // We can often safely ignore this specific error, especially if trying to clean up old URLs.
    if (error.code === "storage/object-not-found") {
      console.warn(
        `Storage Service: Image not found for deletion (URL: ${downloadURL}). It might have already been deleted.`,
      );
    } else {
      console.error("Storage Service: Error deleting image:", error);
      // Re-throw other errors
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }
}

// Helper function (if needed) to extract storage path from URL
// function getPathFromUrl(downloadURL: string): string | null {
//   try {
//     const url = new URL(downloadURL);
//     // Example URL: https://firebasestorage.googleapis.com/v0/b/your-bucket.appspot.com/o/folder%2Ffilename.jpg?alt=media&token=...
//     const pathSegment = url.pathname.split('/o/')[1];
//     if (!pathSegment) return null;
//     // Decode URL component (e.g., folder%2Ffilename.jpg -> folder/filename.jpg)
//     return decodeURIComponent(pathSegment.split('?')[0]);
//   } catch (e) {
//     console.error("Error parsing storage URL:", e);
//     return null;
//   }
// }
