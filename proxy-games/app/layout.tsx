import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// The shared shell every game renders inside. One nav, one identity, one
// account menu — this is what "shared player ID and shared UI" means in code.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
