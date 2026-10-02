"use client";

import { useState } from "react";

export default function BattleBoost({ closed, sideName, onShare }: {
    closed: boolean;
    sideName: string | null;
    onShare: () => Promise<void>;
}) {
    const [open, setOpen] = useState(false);
    const [sharing, setSharing] = useState(false);

    async function inviteFans() {
        if (sharing || closed || !sideName) return;
        setSharing(true);
        try {
            await onShare();
        } finally {
            setSharing(false);
        }
    }

    return <div className="mt-6">
        <button type="button" disabled={closed} aria-expanded={open}
            aria-controls="battle-boost-panel" onClick={() => setOpen(value => !value)}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-700 to-brand-500 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-brand-600/20 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m13 2-9 12h7l-1 8 10-13h-7z" /></svg>
            {closed ? "Boost closed" : "Boost your side"}
        </button>
        {open && !closed && <section id="battle-boost-panel" aria-labelledby="battle-boost-title"
            className="mt-4 rounded-3xl border border-brand-100 bg-white/95 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
                <h2 id="battle-boost-title" className="text-xl font-black text-[#171525]">Rally more fans</h2>
                <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-2 text-sm font-bold hover:bg-brand-50">Close</button>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#686577]">
                {sideName
                    ? `Invite friends to back ${sideName}. This Boost link lets them vote only for your side. Each person gets one vote.`
                    : "Vote for your side first to create a Boost invite."}
            </p>
            <button type="button" onClick={inviteFans} disabled={sharing || !sideName}
                className="mt-4 rounded-full bg-[#171525] px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50">
                {sharing ? "Opening share..." : "Invite fans / copy link"}
            </button>
            <p className="mt-4 border-t border-brand-100 pt-4 text-xs leading-5 text-[#686577]">Paid boosts are being planned. Pricing and how they affect scores are still to be decided.</p>
        </section>}
    </div>;
}
