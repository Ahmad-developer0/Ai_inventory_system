"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

// Internet toot jaye to upar warning; wapas aaye to khud chali jati hai.
export function ConnectionBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-medium text-white">
      <WifiOff size={16} />
      No internet connection. Nothing will be saved right now. Refresh the page once you are back online.
    </div>
  );
}
