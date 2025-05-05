
'use server';

import { revalidatePath } from 'next/cache';

/**
 * Revalidates the cache for the home page ('/').
 * Can be called from client components after actions that modify data shown on the home page.
 */
export async function revalidateHomePage() {
  console.log("Revalidating home page ('/') cache...");
  revalidatePath('/');
  console.log("Home page ('/') cache revalidated.");
}

/**
 * Revalidates the cache for the admin page ('/admin').
 * Can be called from client components after actions that modify data shown on the admin page.
 */
export async function revalidateAdminPage() {
    console.log("Revalidating admin page ('/admin') cache...");
    revalidatePath('/admin');
    console.log("Admin page ('/admin') cache revalidated.");
}
