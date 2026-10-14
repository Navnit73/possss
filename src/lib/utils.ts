import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Teach tailwind-merge the Apple type ramp from globals.css. Without this it reads
// `text-body`/`text-caption`/… as text *colors*, so `cn("text-on-dark", "text-body")`
// silently dropped the color (black text on blue buttons) and vice versa.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "hero",
        "display-lg",
        "display-md",
        "lead",
        "lead-airy",
        "tagline",
        "body",
        "dense-link",
        "caption",
        "button-large",
        "fine-print",
        "micro-legal",
        "nav-link",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
