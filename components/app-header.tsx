"use client";

import { usePathname } from "next/navigation";
import { HeartHandshake, Home } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { getToolById, getCategoryByToolId } from "@/lib/tools";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { ColourNotationSelector } from "@/components/colour-notation-selector";
import { APP_NAME } from "@/lib/branding";

export function AppHeader() {
  const pathname = usePathname();

  // Extract tool ID from pathname
  const toolId = pathname.startsWith("/tools/")
    ? pathname.replace("/tools/", "")
    : null;

  const tool = toolId ? getToolById(toolId) : null;
  const category = toolId ? getCategoryByToolId(toolId) : null;

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      {tool ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <tool.icon className="size-4 text-primary" />
            <h1 className="text-sm font-semibold">{tool.name}</h1>
          </div>
          {category && (
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {category.name}
            </Badge>
          )}
        </div>
      ) : pathname === "/" ? (
        <div className="flex items-center gap-2">
          <Home className="size-4 text-primary" />
          <h1 className="text-sm font-semibold">Home</h1>
        </div>
      ) : pathname === "/donate" ? (
        <div className="flex items-center gap-2">
          <HeartHandshake className="size-4 text-primary" />
          <h1 className="text-sm font-semibold">Donate</h1>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <img src="/malpitools-icon.png" width={40} height={40} alt={`${APP_NAME} logo`} className="size-5" />
          <h1 className="text-sm font-semibold">{APP_NAME}</h1>
        </div>
      )}

      <div className="ml-auto flex items-center gap-1">
        {category?.name === "Colour" && toolId !== "colour-converter" && <ColourNotationSelector />}
        <ThemeToggle />
      </div>
    </header>
  );
}
