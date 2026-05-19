import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Download, History, Shield, HelpCircle, Menu, X, Sun, Moon, Monitor,
  Scissors, Music, Flame, Swords, Radio, Code2, Wrench, ChevronDown,
  Film, Zap,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const mainLinks = [
  { href: "/", label: "Download", icon: Download },
  { href: "/movies", label: "Movies", icon: Film },
  { href: "/music", label: "Music", icon: Music },
  { href: "/trending", label: "Trending", icon: Flame },
  { href: "/boost", label: "Boost", icon: Zap },
];

const moreLinks = [
  { href: "/studio", label: "Video Studio", icon: Scissors },
  { href: "/anime", label: "Anime", icon: Swords },
  { href: "/status", label: "Status Hub", icon: Radio },
  { href: "/debug", label: "Code Debugger", icon: Code2 },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/adult", label: "Adults Only 🔞", icon: Shield },
  { href: "/history", label: "History", icon: History },
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/faq", label: "FAQ", icon: HelpCircle },
];

export function Navbar() {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const allMobileLinks = [...mainLinks, ...moreLinks];

  return (
    <nav className="sticky top-0 z-50 glass-card border-b border-white/8 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg neon-glow">
              <Download className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gradient leading-none">NOVAsavex</span>
              <span className="text-[9px] text-muted-foreground leading-none">by 𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x</span>
            </div>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-0.5">
          {mainLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <button
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  location === href
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            </Link>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200">
                More <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-card w-52 border-white/10">
              <DropdownMenuLabel className="text-xs text-muted-foreground px-2">Features</DropdownMenuLabel>
              {moreLinks.slice(0, 5).map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}>
                  <DropdownMenuItem className="cursor-pointer gap-2 text-sm">
                    <Icon className="w-4 h-4" />{label}
                  </DropdownMenuItem>
                </Link>
              ))}
              <DropdownMenuSeparator className="bg-white/8" />
              <DropdownMenuLabel className="text-xs text-muted-foreground px-2">Account</DropdownMenuLabel>
              {moreLinks.slice(5).map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}>
                  <DropdownMenuItem className="cursor-pointer gap-2 text-sm">
                    <Icon className="w-4 h-4" />{label}
                  </DropdownMenuItem>
                </Link>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-9 h-9">
                {theme === "dark" ? <Moon className="w-4 h-4" /> : theme === "light" ? <Sun className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-card border-white/10">
              <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2"><Moon className="w-4 h-4" /> Dark</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2"><Sun className="w-4 h-4" /> Light</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("auto")} className="gap-2"><Monitor className="w-4 h-4" /> Auto</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            className="md:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden pb-4 pt-2 border-t border-white/8 grid grid-cols-3 gap-1">
          {allMobileLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <button
                onClick={() => setMobileOpen(false)}
                className={`w-full flex flex-col items-center gap-1 px-2 py-3 rounded-lg text-xs font-medium transition-all ${
                  location === href
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-center leading-tight">{label.replace(" 🔞", "")}</span>
              </button>
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
