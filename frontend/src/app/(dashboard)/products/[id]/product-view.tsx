"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ImageIcon, Pencil, X } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { ProductForm } from "@/components/product-form";
import { publicFileUrl } from "@/lib/supabase/env";
import type { Category, Product } from "@/lib/types";

// Photo gallery: badi tasveer, neeche thumbnails, click par full screen
export function ProductGallery({ paths, name }: { paths: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const urls = paths.map((p) => publicFileUrl(p)!);

  if (urls.length === 0) {
    return (
      <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 text-slate-400">
        <ImageIcon size={40} />
        <span className="text-sm">No photos yet</span>
      </div>
    );
  }

  const go = (d: number) => setIndex((i) => (i + d + urls.length) % urls.length);

  return (
    <div>
      <button onClick={() => setZoom(true)} className="block w-full overflow-hidden rounded-xl bg-white ring-1 ring-slate-200" title="View full size">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={urls[index]} alt={name} className="aspect-square w-full object-contain" />
      </button>
      {urls.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {urls.map((u, i) => (
            <button
              key={u}
              onClick={() => setIndex(i)}
              className={`overflow-hidden rounded-lg ring-2 ${i === index ? "ring-amber-500" : "ring-transparent hover:ring-slate-300"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setZoom(false)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Close">
            <X size={22} />
          </button>
          {urls.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Previous photo"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Next photo"
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[index]} alt={name} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          <span className="absolute bottom-4 text-sm text-white/80">
            {index + 1} / {urls.length}
          </span>
        </div>
      )}
    </div>
  );
}

export function EditProductButton({ product, categories }: { product: Product; categories: Category[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <>
      <Button icon={Pencil} onClick={() => setOpen(true)}>
        Edit product
      </Button>
      {message && (
        <div className="basis-full">
          <Alert tone="success">{message}</Alert>
        </div>
      )}
      {open && (
        <ProductForm
          product={product}
          categories={categories}
          onClose={() => setOpen(false)}
          onSaved={(text) => {
            setOpen(false);
            setMessage(text);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
