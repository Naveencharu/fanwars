"use client";

import Image from "next/image";
import { useState } from "react";
import { battleCoverSides, communityCoverPath } from "@/lib/battle-cover";

export function SidePhoto({ name, description = "", parentTopic = "", image, showLabel = true, sizes = "(max-width: 768px) 50vw, 25vw" }: { name: string; description?: string | null; parentTopic?: string; image?: string | null; showLabel?: boolean; sizes?: string }) {
    const [failedImages, setFailedImages] = useState<string[]>([]);
    const preferred = image && !failedImages.includes(image) ? image : communityCoverPath(name, description ?? "", parentTopic);
    const src = preferred && !failedImages.includes(preferred) ? preferred : null;
    return <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600">
        {src ? <Image src={src} alt={name} fill
            sizes={sizes} unoptimized={/^https?:\/\//i.test(src)} onError={() => setFailedImages(previous => [...previous, src])}
            className="object-cover saturate-[1.1] transition duration-500 group-hover:scale-105" />
            : <div aria-hidden="true" className="flex h-full items-center justify-center px-4 text-4xl font-black text-white/70">{name.split(/\s+/).slice(0, 2).map(word => word[0]).join("")}</div>}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.16),transparent_55%)]" />
        {showLabel && <span className="absolute inset-x-0 bottom-4 px-3 text-center text-sm font-extrabold text-white drop-shadow-md sm:text-base">{name}</span>}
    </div>;
}

export default function BattleCover({ title, imageUrl, optionNames = [], parentTopic = "", compact = false }: {
    title: string; category?: string; imageUrl: string | null; optionNames?: string[]; parentTopic?: string; compact?: boolean;
}) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const sides = battleCoverSides(title, optionNames);
    const uploaded = imageUrl && imageUrl !== failedUrl;
    return <div className={`relative isolate overflow-hidden bg-[#171525] ${compact ? "h-36 sm:h-40" : "h-52 sm:h-56"}`}>
        {uploaded ? <Image src={imageUrl} alt={`${title} FanWar cover`} fill unoptimized
            onError={() => setFailedUrl(imageUrl)} sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition duration-500 group-hover:scale-[1.04]" />
            : <div className={`grid h-full ${sides.length > 1 ? "grid-cols-2 gap-0.5" : "grid-cols-1"}`}>
                {sides.map((side, index) => <SidePhoto key={`${index}-${side.name}`} {...side} parentTopic={parentTopic} />)}
            </div>}
        {!uploaded && sides.length > 1 && <span aria-hidden="true" className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/80 bg-brand-600 text-sm font-black text-white shadow-[0_8px_28px_rgba(0,0,0,0.35)]">VS</span>}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(255,255,255,0.15)_0%,transparent_45%)] ring-1 ring-inset ring-white/20" />
    </div>;
}
