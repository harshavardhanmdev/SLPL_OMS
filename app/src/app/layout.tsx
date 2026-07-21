import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { site } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-heading",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://store.theslpl.in"),
  title: {
    default: `${site.name} - School Books, Novels & Bundles`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  keywords: [
    "school books online India", "buy school textbooks", "English material for kids",
    "English course book", "English grammar book", "Telugu textbook", "Hindi textbook",
    "Maths book for kids", "EVS book", "Science textbook", "Social studies book",
    "Nursery books", "LKG books", "UKG books", "pre-primary books", "kindergarten books",
    "Grade 1 books", "Grade 2 books", "Grade 3 books", "Grade 4 books", "Grade 5 books",
    "Class 6 textbooks", "Class 7 textbooks", "Class 8 textbooks", "Class 9 textbooks",
    "Class 10 textbooks", "SSC study material", "Telangana state syllabus books",
    "UPSC Civils foundation books", "IAS preparation for school students",
    "cursive writing book", "handwriting practice book", "drawing and coloring book",
    "rhymes book for nursery", "general knowledge book for kids", "class book bundles",
    "school book kits", "Baby Steps books", "Little Leaps books", "Skill Builders books",
    "SLPL Store", "Saaradaa Learknowations", "school books Hyderabad",
  ],
  openGraph: {
    siteName: site.name,
    type: "website",
    locale: "en_IN",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1222" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
