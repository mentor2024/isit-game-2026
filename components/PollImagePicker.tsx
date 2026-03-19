"use client";

import { useState } from "react";
import AssetPickerModal from "@/components/AssetPickerModal";

/**
 * Replaces a bare <input type="file"> for poll object images.
 * Submits two hidden fields:
 *   - `{name}_asset_url` — URL from repository (preferred)
 *   - `{name}` — file upload fallback (only used if no asset_url)
 *
 * The server action checks _asset_url first; if present it skips the upload.
 */
export default function PollImagePicker({
    name,
    currentUrl,
    required = false,
}: {
    name: string;           // e.g. "obj1_image"
    currentUrl?: string;    // existing image_url for edit forms
    required?: boolean;
}) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [assetUrl, setAssetUrl] = useState<string>(currentUrl ?? "");
    const [useUpload, setUseUpload] = useState(false);

    const hasImage = !!assetUrl;

    return (
        <div className="flex flex-col gap-2">
            {/* Hidden URL field — submitted to server action */}
            <input type="hidden" name={`${name}_asset_url`} value={assetUrl} />

            {/* Preview */}
            {hasImage && !useUpload && (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 border-2 border-gray-200 group">
                    <img src={assetUrl} alt="Selected" className="w-full h-full object-cover" />
                    <button
                        type="button"
                        onClick={() => { setAssetUrl(""); setUseUpload(false); }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white text-xs font-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >✕</button>
                </div>
            )}

            {/* Choose / change buttons */}
            {!useUpload && (
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setPickerOpen(true)}
                        className="flex-1 py-2.5 text-sm font-bold bg-black text-white rounded-xl hover:bg-gray-800 transition-colors"
                    >
                        {hasImage ? "🔄 Change Image" : "📂 Choose from Repository"}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setAssetUrl(""); setUseUpload(true); }}
                        className="px-3 py-2.5 text-xs font-bold border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-500"
                        title="Upload a new file instead"
                    >
                        ⬆ Upload
                    </button>
                </div>
            )}

            {/* File upload fallback */}
            {useUpload && (
                <div className="flex flex-col gap-2">
                    <input
                        type="file"
                        name={name}
                        accept="image/*"
                        required={required && !hasImage}
                        className="border-2 border-dashed border-gray-300 p-4 rounded-xl bg-white text-sm"
                    />
                    <button
                        type="button"
                        onClick={() => setUseUpload(false)}
                        className="text-xs text-gray-400 hover:text-black underline text-left"
                    >
                        ← Back to repository picker
                    </button>
                </div>
            )}

            {/* Require hint */}
            {required && !hasImage && !useUpload && (
                <p className="text-[11px] text-red-500 font-medium">Image required — choose from repository or upload</p>
            )}

            {/* Asset picker modal */}
            {pickerOpen && (
                <AssetPickerModal
                    typeFilter="image"
                    onSelect={url => { setAssetUrl(url); setUseUpload(false); setPickerOpen(false); }}
                    onClose={() => setPickerOpen(false)}
                />
            )}
        </div>
    );
}
