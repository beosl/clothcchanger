import { Outlet, NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Shirt, 
  Users, 
  Settings,
  Sparkles
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { path: "/", icon: Shirt, label: "Giysi Değiştir" },
  { path: "/characters", icon: Users, label: "Karakterler" },
  { path: "/settings", icon: Settings, label: "Ayarlar" },
];

export default function Layout() {
  const location = useLocation();

  return (
    <TooltipProvider delayDuration={0}>
      <div className="grid grid-cols-[80px_1fr] h-screen overflow-hidden bg-[#050505]">
        {/* Sidebar */}
        <aside className="flex flex-col items-center py-6 border-r border-zinc-800/50 bg-[#0a0a0a]">
          {/* Logo */}
          <div className="mb-8" data-testid="logo">
            <div className="w-12 h-12 flex items-center justify-center bg-primary/10 border border-primary/30">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-2 flex-1" data-testid="main-navigation">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={item.path}
                      data-testid={`nav-${item.path.replace("/", "") || "home"}`}
                      className={`sidebar-icon ${isActive ? "active" : ""}`}
                    >
                      <item.icon className="w-5 h-5" />
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-zinc-900 border-zinc-800 text-white">
                    <p className="font-mono text-xs uppercase tracking-wider">{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* Version Badge */}
          <div className="mt-auto">
            <span className="font-mono text-[10px] text-zinc-600 tracking-widest">V1.0</span>
          </div>
        </aside>

        {/* Main Content */}
        <main className="overflow-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </TooltipProvider>
  );
}
