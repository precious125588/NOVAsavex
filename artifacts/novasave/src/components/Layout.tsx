import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { NotificationBanner } from "@/components/NotificationBanner";

interface LayoutProps {
  children: React.ReactNode;
  page?: string;
}

export function Layout({ children, page = "all" }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col aurora-bg relative">
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        <NotificationBanner page={page} />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
