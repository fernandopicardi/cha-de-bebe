import type { Metadata } from 'next';
import { Poppins } from 'next/font/google'; // Import Poppins
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

// Configure Poppins font
const poppins = Poppins({
  weight: ['400', '600'], // Specify weights needed (400 for body, 600 for titles maybe)
  subsets: ['latin'],
  variable: '--font-poppins', // Define CSS variable
});


export const metadata: Metadata = {
  title: 'Chá de Bebê', // Update App Name
  description: 'Lista de presentes para o Chá de Bebê', // Update description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR"> {/* Set language to Portuguese Brazil */}
      {/* Apply Poppins font class and variable */}
      <body className={`${poppins.variable} font-sans antialiased`}>
        {children}
        <Toaster /> {/* Add Toaster component */}
      </body>
    </html>
  );
}
