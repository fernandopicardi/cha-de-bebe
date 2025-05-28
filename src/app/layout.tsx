import type { Metadata } from 'next';
import { Poppins } from 'next/font/google'; // Import Poppins
import './globals.css';
import { Toaster } from '@/components/ui/toaster'; // Import Toaster
import { ThemeProvider } from '@/components/theme-provider'; // Import ThemeProvider

// Configure Poppins font
const poppins = Poppins({
  weight: ['400', '600'], // Specify weights needed (400 for body, 600 for titles maybe)
  subsets: ['latin'],
  variable: '--font-poppins', // Define CSS variable
});

export const metadata: Metadata = {
  title: 'Chá de Bebê', // Update App Name
  description: 'Confirme sua presença no Chá de Bebê', // Update description
  icons: {
    icon: '/favicon.ico', // Path to your favicon
    // Add other icon sizes and types as needed
    // apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Chá de Bebê',
    description: 'Confirme sua presença no Chá de Bebê',
    images: ['/opengraph-image.png'], // Path to your image
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${poppins.variable} font-sans antialiased flex flex-col min-h-screen`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex-grow">{children}</div>
          <Toaster />
          <footer className="py-8 mt-auto text-center">
            <div className="container mx-auto">
              <p className="text-sm text-muted-foreground">
                Desenvolvido com <span role="img" aria-label="coração">❤️</span> por{' '}
                <a
                  href="https://fernandopicardi.com" // Replace with actual link if desired
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline underline-offset-4"
                >
                  Fernando Picardi
                </a>
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                © {new Date().getFullYear()} Todos os direitos reservados.
              </p>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
