"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, ImagePlus, Star, Upload, X } from "lucide-react";
import { Alert, Button, Field, fieldClass, Modal } from "@/components/ui";
import { createClient, errorMessage } from "@/lib/supabase/client";
import { PRODUCT_FILES_BUCKET, publicFileUrl } from "@/lib/supabase/env";
import { qtyWithUnit, unitShort, UNITS } from "@/lib/units";
import { num, type Category, type Product } from "@/lib/types";

export const MAX_IMAGES = 8;

// Saved image (storage path) ya abhi chuni hui nayi file
type ImageItem = { key: string; path?: string; file?: File; url: string };

const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

export function ProductForm({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState({
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    brand: product?.brand ?? "",
    model: product?.model ?? "",
    category_id: product?.category_id ? String(product.category_id) : "",
    specifications: product?.specifications ?? "",
    purchase_price: product ? String(num(product.purchase_price)) : "",
    selling_price: product ? String(num(product.selling_price)) : "",
    min_price: product ? String(num(product.min_price)) : "",
    reorder_level: product ? String(product.reorder_level) : "",
    unit: product?.unit ?? "pcs",
    active: product?.active ?? true,
  });
  const savedPaths = product ? (product.images?.length ? product.images : product.image_path ? [product.image_path] : []) : [];
  const [images, setImages] = useState<ImageItem[]>(() => savedPaths.map((path) => ({ key: path, path, url: publicFileUrl(path)! })));
  const [openingStock, setOpeningStock] = useState("");
  const [datasheet, setDatasheet] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const sheetInput = useRef<HTMLInputElement>(null);

  // Preview URLs (blob:) band karo jab form band ho
  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(() => () => imagesRef.current.forEach((i) => i.file && URL.revokeObjectURL(i.url)), []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const addFiles = (files: FileList | File[]) => {
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const room = MAX_IMAGES - images.length;
    if (picked.length > room) setError(`A product can have at most ${MAX_IMAGES} photos. ${room > 0 ? `Only the first ${room} were added.` : ""}`);
    else setError("");
    setImages((list) => [
      ...list,
      ...picked.slice(0, Math.max(0, room)).map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, file, url: URL.createObjectURL(file) })),
    ]);
  };

  const removeImage = (key: string) =>
    setImages((list) => {
      const item = list.find((i) => i.key === key);
      if (item?.file) URL.revokeObjectURL(item.url);
      return list.filter((i) => i.key !== key);
    });

  const makeCover = (key: string) => setImages((list) => [...list.filter((i) => i.key === key), ...list.filter((i) => i.key !== key)]);

  const upload = async (productId: number, file: File, kind: string) => {
    const path = `products/${productId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeName(file.name)}`;
    const { error } = await createClient().storage.from(PRODUCT_FILES_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw new Error(`${kind} upload failed: ${error.message}`);
    return path;
  };

  // Tasveerein upload karke product_images ko nayi tarteeb se likho; pehli tasveer cover hai
  const syncImages = async (productId: number) => {
    const supabase = createClient();
    const finalPaths: string[] = [];
    for (const item of images) finalPaths.push(item.path ?? (await upload(productId, item.file!, "image")));

    const { error: delErr } = await supabase.from("product_images").delete().eq("product_id", productId);
    if (delErr) throw new Error(`Photos not saved: ${errorMessage(delErr)}`);
    if (finalPaths.length) {
      const { error: insErr } = await supabase
        .from("product_images")
        .insert(finalPaths.map((path, position) => ({ product_id: productId, path, position })));
      if (insErr) throw new Error(`Photos not saved: ${errorMessage(insErr)}`);
    }
    const { error: coverErr } = await supabase.from("products").update({ image_path: finalPaths[0] ?? null }).eq("id", productId);
    if (coverErr) throw new Error(errorMessage(coverErr));

    // Hatayi hui purani files storage se bhi saaf karo
    const removed = savedPaths.filter((p) => !finalPaths.includes(p));
    if (removed.length) await supabase.storage.from(PRODUCT_FILES_BUCKET).remove(removed);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const selling = Number(form.selling_price);
    const min = Number(form.min_price);
    if (min > selling) return setError("Minimum price cannot be higher than the selling price.");
    if (Number(form.purchase_price) > min) {
      if (!confirm("Purchase price is higher than the minimum selling price (sale at a loss). Save anyway?")) return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const row: Record<string, unknown> = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        category_id: form.category_id ? Number(form.category_id) : null,
        specifications: form.specifications.trim() || null,
        purchase_price: Number(form.purchase_price) || 0,
        selling_price: selling,
        min_price: min,
        reorder_level: Number(form.reorder_level) || 0,
        unit: form.unit,
        active: form.active,
      };

      let productId = product?.id;
      if (product) {
        const { error } = await supabase.from("products").update(row).eq("id", product.id);
        if (error) throw new Error(errorMessage(error));
      } else {
        const { data, error } = await supabase.from("products").insert(row).select("id").single();
        if (error) throw new Error(errorMessage(error));
        productId = data.id as number;
        const qty = Number(openingStock);
        if (qty > 0) {
          // Opening stock bhi movement ke zariye, taake history mein record rahe
          const { error: mErr } = await supabase.from("stock_movements").insert({ product_id: productId, type: "IN", qty, reference: "Opening stock" });
          if (mErr) throw new Error(`Product created, but the opening stock was not saved: ${errorMessage(mErr)}`);
        }
      }

      await syncImages(productId!);
      if (datasheet) {
        const path = await upload(productId!, datasheet, "datasheet");
        const { error } = await supabase.from("products").update({ datasheet_path: path }).eq("id", productId!);
        if (error) throw new Error(errorMessage(error));
      }

      const qty = Number(openingStock);
      onSaved(
        product
          ? `${row.name} updated.`
          : `${row.name} added${qty > 0 ? ` (opening stock ${qtyWithUnit(qty, form.unit)})` : ""}${images.length ? ` with ${images.length} photo${images.length > 1 ? "s" : ""}` : ""}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const currentSheet = publicFileUrl(product?.datasheet_path ?? null);

  return (
    <Modal title={product ? `Edit: ${product.name}` : "Add product"} onClose={onClose}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        {error && (
          <div className="sm:col-span-2">
            <Alert tone="error">{error}</Alert>
          </div>
        )}

        {/* Photos */}
        <div className="sm:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Product photos</span>
            <span className="text-xs text-slate-500">
              {images.length} / {MAX_IMAGES} · first photo is the cover
            </span>
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`grid grid-cols-3 gap-3 rounded-xl border-2 border-dashed p-3 sm:grid-cols-4 ${dragging ? "border-amber-500 bg-amber-50" : "border-slate-200"}`}
          >
            {images.map((img, i) => (
              <div key={img.key} className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="size-full object-cover" />
                {i === 0 ? (
                  <span className="absolute left-1.5 top-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-slate-950">Cover</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => makeCover(img.key)}
                    className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 opacity-0 shadow transition group-hover:opacity-100"
                  >
                    <Star size={10} /> Make cover
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(img.key)}
                  className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-slate-700 shadow hover:text-red-600"
                  aria-label="Remove photo"
                >
                  <X size={12} />
                </button>
                {img.file && <span className="absolute bottom-1.5 left-1.5 rounded bg-teal-700 px-1.5 py-0.5 text-[10px] font-medium text-white">New</span>}
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => imageInput.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white text-slate-500 transition hover:border-amber-500 hover:text-amber-600"
              >
                <ImagePlus size={24} />
                <span className="text-xs font-medium">Add photos</span>
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">Click Add photos or drag images here. Add at least 4 so the AI assistant can send them to customers.</p>
          <input
            ref={imageInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <Field label="SKU *">
          <input required value={form.sku} onChange={set("sku")} className={fieldClass} placeholder="INV-HYB-6K" />
        </Field>
        <Field label="Product name *">
          <input required value={form.name} onChange={set("name")} className={fieldClass} placeholder="Hybrid Inverter 6kW" />
        </Field>
        <Field label="Brand">
          <input value={form.brand} onChange={set("brand")} className={fieldClass} />
        </Field>
        <Field label="Model">
          <input value={form.model} onChange={set("model")} className={fieldClass} />
        </Field>
        <Field label="Category">
          <select value={form.category_id} onChange={set("category_id")} className={fieldClass}>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reorder level (alert at or below this)">
          <input type="number" min={0} value={form.reorder_level} onChange={set("reorder_level")} className={fieldClass} placeholder="0" />
        </Field>
        <Field label="Unit of measure">
          <select value={form.unit} onChange={set("unit")} className={fieldClass}>
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Purchase price per ${unitShort(form.unit)} (Rs) *`}>
          <input required type="number" min={0} step="0.01" value={form.purchase_price} onChange={set("purchase_price")} className={fieldClass} />
        </Field>
        <Field label={`Selling price per ${unitShort(form.unit)} (Rs) *`}>
          <input required type="number" min={0} step="0.01" value={form.selling_price} onChange={set("selling_price")} className={fieldClass} />
        </Field>
        <Field label={`Minimum price per ${unitShort(form.unit)} (Rs) *`}>
          <input required type="number" min={0} step="0.01" value={form.min_price} onChange={set("min_price")} className={fieldClass} />
        </Field>
        {product ? (
          <Field label="Current stock">
            <input disabled value={`${qtyWithUnit(product.stock, product.unit)} (change on Inventory page)`} className={fieldClass} />
          </Field>
        ) : (
          <Field label={`Opening stock (${unitShort(form.unit)})`}>
            <input type="number" min={0} value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} className={fieldClass} placeholder="How many pieces you have now" />
          </Field>
        )}
        <Field label="Technical specifications" className="sm:col-span-2">
          <textarea
            rows={4}
            value={form.specifications}
            onChange={set("specifications")}
            className={fieldClass}
            placeholder={"Rated power: 6kW\nBattery voltage: 48V\nInput: 1-phase 220V"}
          />
        </Field>

        {/* Datasheet */}
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">Datasheet (PDF)</span>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => sheetInput.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Upload size={16} /> {currentSheet || datasheet ? "Replace PDF" : "Upload PDF"}
            </button>
            {datasheet ? (
              <span className="inline-flex items-center gap-1 text-sm text-slate-700">
                <FileText size={14} /> {datasheet.name}
                <button type="button" onClick={() => setDatasheet(null)} className="text-slate-400 hover:text-red-600" aria-label="Remove PDF">
                  <X size={14} />
                </button>
              </span>
            ) : currentSheet ? (
              <a href={currentSheet} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-teal-700 hover:underline">
                <FileText size={14} /> Current datasheet
              </a>
            ) : (
              <span className="text-sm text-slate-400">No datasheet yet</span>
            )}
          </div>
          <input ref={sheetInput} type="file" accept="application/pdf" className="hidden" onChange={(e) => setDatasheet(e.target.files?.[0] ?? null)} />
        </div>

        {product && (
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Active (available for sale)
          </label>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : product ? "Save changes" : "Add product"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
