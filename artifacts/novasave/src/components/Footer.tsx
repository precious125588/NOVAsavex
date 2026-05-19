import { Link } from "wouter";
import { Download, MessageCircle } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa6";

const WHATSAPP_NUMBER = "2349068551055";
const WHATSAPP_SUPPORT_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi 𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺, I need help with NovaSave:")}`;

export function Footer() {
  return (
    <footer className="border-t border-white/8 mt-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Download className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-sm text-gradient">NovaSave</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/faq">
              <span className="hover:text-foreground transition-colors cursor-pointer">FAQ</span>
            </Link>
            <Link href="/terms">
              <span className="hover:text-foreground transition-colors cursor-pointer">Terms</span>
            </Link>
            <Link href="/privacy">
              <span className="hover:text-foreground transition-colors cursor-pointer">Privacy</span>
            </Link>
            <a
              href={WHATSAPP_SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-green-400 hover:text-green-300 transition-colors font-medium"
            >
              <FaWhatsapp className="w-4 h-4" />
              Report Issue
            </a>
          </div>

          <p className="text-xs text-muted-foreground/50 tracking-wide">
            Made by <span className="text-muted-foreground/70">𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x</span>
          </p>
        </div>

        {/* Support bar */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 border border-green-500/15 bg-green-500/5 rounded-xl px-5 py-3">
          <div className="flex items-center gap-2 text-green-400">
            <MessageCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium">Need help or found a bug?</span>
          </div>
          <a
            href={WHATSAPP_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-green-500 hover:bg-green-400 transition-colors text-white text-sm font-semibold px-4 py-1.5 rounded-lg"
          >
            <FaWhatsapp className="w-4 h-4" />
            WhatsApp 𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x
          </a>
          <span className="text-xs text-muted-foreground hidden sm:inline">+{WHATSAPP_NUMBER}</span>
        </div>
      </div>
    </footer>
  );
}
