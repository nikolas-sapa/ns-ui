"use client";

import { ShelfCant, type ShelfCantItem } from "./component";

const ITEMS: ShelfCantItem[] = [
  { id: "finder", label: "Finder", icon: "Fi" },
  { id: "mail", label: "Mail", icon: "Ma" },
  { id: "notes", label: "Notes", icon: "No" },
  { id: "calendar", label: "Calendar", icon: "Ca" },
  { id: "terminal", label: "Terminal", icon: "Te" },
  { id: "music", label: "Music", icon: "Mu" },
  { id: "photos", label: "Photos", icon: "Ph" },
];

export default function ShelfCantDemo() {
  return (
    <div className="flex min-h-[420px] items-center justify-center p-8">
      <ShelfCant items={ITEMS} label="Favorites" />
    </div>
  );
}
