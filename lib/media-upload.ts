// Matches the captured fanwars-media bucket configuration.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const UPLOAD_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function imageFileError(file: { type: string; size: number }): string {
    if (!file.type.startsWith("image/")) return "Please select an image file.";
    if (file.size === 0) return "This image is empty. Please choose another photo.";
    if (file.size > MAX_IMAGE_BYTES) return "Choose an image of 5 MB or smaller.";
    return "";
}

export function croppedImageError(blob: { type: string; size: number }): string {
    const sizeError = imageFileError(blob);
    if (sizeError) return sizeError;
    if (!UPLOAD_IMAGE_TYPES.includes(blob.type)) {
        return "Could not save this image in a supported format. Please try another photo.";
    }
    return "";
}

export function imageExtension(type: string): string {
    if (type === "image/jpeg") return "jpg";
    if (type === "image/png") return "png";
    if (type === "image/webp") return "webp";
    throw new Error("Unsupported image format.");
}
