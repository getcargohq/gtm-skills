"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

// The control needs JavaScript, so the static HTML renders none; it appears
// once the page hydrates and knows the resolved theme.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const dark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={dark}
      aria-label={dark ? "Use light theme" : "Use dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
      <span className="hidden sm:inline">
        {dark ? "Light theme" : "Dark theme"}
      </span>
    </Button>
  );
}
