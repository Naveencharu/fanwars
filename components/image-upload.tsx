"use client";

import { useRef, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { supabase } from "@/lib/supabase";
import { croppedImageError, imageExtension, imageFileError } from "@/lib/media-upload";

type ImageUploadProps = {
    userId: string;
    folder: string;
    currentUrl?: string | null;
    onUploaded: (url: string) => void;
    aspect?: "square" | "cover";
    label?: string;
    className?: string;
};

function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve(image);
        image.onerror = reject;

        image.src = url;
    });
}

async function getCroppedBlob(
    imageSrc: string,
    crop: Area
): Promise<Blob> {
    const image = await createImage(imageSrc);

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
        throw new Error("Could not create image canvas.");
    }

    canvas.width = crop.width;
    canvas.height = crop.height;

    context.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error("Could not create image."));
                    return;
                }

                resolve(blob);
            },
            "image/webp",
            0.88
        );
    });
}

export default function ImageUpload({
    userId,
    folder,
    currentUrl,
    onUploaded,
    aspect = "square",
    label = "Change image",
    className = "",
}: ImageUploadProps) {
    const chooseInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(
        currentUrl ?? null
    );

    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] =
        useState<Area | null>(null);

    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    const cropAspect = aspect === "square" ? 1 : 3 / 1;

    function openEditor(file: File) {
        setError("");

        const validationError = imageFileError(file);
        if (validationError) {
            setError(validationError);
            return;
        }

        const url = URL.createObjectURL(file);

        setImageSrc(url);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedAreaPixels(null);
    }

    function handleFileChange(
        event: React.ChangeEvent<HTMLInputElement>
    ) {
        const file = event.target.files?.[0];

        if (!file) return;

        openEditor(file);

        event.target.value = "";
    }

    function handleCropComplete(
        _croppedArea: Area,
        croppedArea: Area
    ) {
        setCroppedAreaPixels(croppedArea);
    }

    async function handleSave() {
        if (!imageSrc || !croppedAreaPixels || uploading) {
            return;
        }

        setUploading(true);
        setError("");

        try {
            const blob = await getCroppedBlob(
                imageSrc,
                croppedAreaPixels
            );

            const validationError = croppedImageError(blob);
            if (validationError) {
                setError(validationError);
                return;
            }
            const filePath = `${userId}/${folder}/${crypto.randomUUID()}.${imageExtension(blob.type)}`;

            const { error: uploadError } = await supabase.storage
                .from("fanwars-media")
                .upload(filePath, blob, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: blob.type,
                });

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage
                .from("fanwars-media")
                .getPublicUrl(filePath);

            const publicUrl = data.publicUrl;

            setPreview(publicUrl);
            onUploaded(publicUrl);

            URL.revokeObjectURL(imageSrc);
            setImageSrc(null);
        } catch (uploadError) {
            console.error("Image upload failed:", uploadError);
            setError("Image upload failed. Please try again.");
        } finally {
            setUploading(false);
        }
    }

    function handleCancel() {
        if (uploading) return;
        if (imageSrc) {
            URL.revokeObjectURL(imageSrc);
        }

        setImageSrc(null);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
        setCroppedAreaPixels(null);
        setError("");
    }

    return (
        <>
            <button
                type="button"
                onClick={() => chooseInputRef.current?.click()}
                className={`group relative overflow-hidden ${className}`}
            >
                {preview ? (
                    <img
                        src={preview}
                        alt={label}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-[#f7f5f1] text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-lg shadow-sm">
                            📷
                        </div>

                        <span className="mt-2 text-xs font-extrabold text-[#171525]">
                            {label}
                        </span>
                    </div>
                )}

                <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover:opacity-100">
                    <span className="rounded-full bg-white px-4 py-2 text-xs font-extrabold text-[#171525]">
                        📷 Change
                    </span>
                </div>
            </button>

            <input
                ref={chooseInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
            />

            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleFileChange}
                className="hidden"
            />

            {error && !imageSrc && (
                <p role="alert" className="mt-2 text-xs font-semibold text-red-600">
                    {error}
                </p>
            )}

            {imageSrc && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
                    <div className="w-full max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
                            <div>
                                <p className="text-base font-black">
                                    Adjust your photo
                                </p>

                                <p className="mt-0.5 text-xs text-[#777286]">
                                    Drag to position and use the slider to zoom.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleCancel}
                                disabled={uploading}
                                className="rounded-full px-3 py-2 text-sm font-bold text-[#686577] hover:bg-black/[0.04]"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="relative h-[55vh] min-h-[320px] bg-[#171525]">
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={cropAspect}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={handleCropComplete}
                                showGrid
                            />
                        </div>

                        <div className="px-5 py-5">
                            {error && (
                                <p role="alert" className="mb-3 text-sm font-semibold text-red-600">
                                    {error}
                                </p>
                            )}
                            <div className="flex items-center gap-3">
                                <span className="text-sm">
                                    🔍
                                </span>

                                <input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.05}
                                    value={zoom}
                                    onChange={(event) =>
                                        setZoom(
                                            Number(event.target.value)
                                        )
                                    }
                                    className="w-full accent-brand-600"
                                />

                                <span className="text-sm">
                                    🔎
                                </span>
                            </div>

                            <div className="mt-5 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    disabled={uploading}
                                    className="rounded-full border border-black/[0.08] px-5 py-2.5 text-sm font-extrabold text-[#171525]"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={uploading}
                                    className="rounded-full bg-[#171525] px-6 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
                                >
                                    {uploading
                                        ? "Saving..."
                                        : "Save Photo"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
