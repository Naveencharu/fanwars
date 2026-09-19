"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Tribe = {
    id: number;
    name: string;
    description: string | null;
};

const tribeIcons: Record<string, string> = {
    "Chai Gang": "☕",
    "Coffee Crew": "☕",
    "Cricket Nation": "🏏",
    "Football Tribe": "⚽",
    "Biryani Believers": "🍛",
    "Pizza People": "🍕",
    "Marvel Universe": "🦸",
    "DC Universe": "🦇",
    "Apple Squad": "🍎",
    "Android Army": "📱",
    "Mountain Tribe": "⛰️",
    "Beach Tribe": "🏖️",
};

export default function TribesPage() {
    const router = useRouter();

    const [tribes, setTribes] = useState<Tribe[]>([]);
    const [selected, setSelected] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadTribes() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.replace("/login");
                return;
            }

            const { data, error } = await supabase
                .from("tribes")
                .select("id, name, description")
                .order("name");

            if (error) {
                setError(error.message);
                setLoading(false);
                return;
            }

            setTribes(data ?? []);
            setLoading(false);
        }

        loadTribes();
    }, [router]);

    function toggleTribe(tribeId: number) {
        setSelected((current) =>
            current.includes(tribeId)
                ? current.filter((id) => id !== tribeId)
                : [...current, tribeId]
        );
    }

    async function handleContinue() {
        setError("");

        if (selected.length === 0) {
            setError("Choose at least one tribe to continue.");
            return;
        }

        setSaving(true);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setSaving(false);
            setError("Your session has expired. Please log in again.");
            return;
        }

        const memberships = selected.map((tribeId) => ({
            user_id: user.id,
            tribe_id: tribeId,
        }));

        const { error: membershipError } = await supabase
            .from("tribe_members")
            .upsert(memberships, {
                onConflict: "user_id,tribe_id",
            });

        setSaving(false);

        if (membershipError) {
            setError(membershipError.message);
            return;
        }

        router.push("/home");
    }

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#faf9ff]">
                <div className="text-sm font-semibold text-slate-500">
                    Finding your tribes...
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#faf9ff] text-slate-950">
            <section className="mx-auto min-h-screen max-w-5xl px-6 py-12">
                <div className="mx-auto max-w-3xl text-center">
                    <div className="mb-4 inline-flex rounded-full bg-violet-100 px-4 py-2 text-sm font-bold text-violet-700">
                        🔥 Step 2 of 2
                    </div>

                    <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                        Find your tribes
                    </h1>

                    <p className="mx-auto mt-4 max-w-xl text-slate-500">
                        Pick the passions that define you. You can join more tribes later.
                    </p>
                </div>

                {error && (
                    <div className="mx-auto mt-8 max-w-2xl rounded-2xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {tribes.map((tribe) => {
                        const isSelected = selected.includes(tribe.id);

                        return (
                            <button
                                key={tribe.id}
                                type="button"
                                onClick={() => toggleTribe(tribe.id)}
                                className={`group relative rounded-3xl border p-6 text-left transition ${isSelected
                                        ? "border-violet-500 bg-violet-50 shadow-md shadow-violet-100"
                                        : "border-slate-200 bg-white hover:-translate-y-1 hover:border-violet-300 hover:shadow-sm"
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div
                                        className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${isSelected ? "bg-violet-200" : "bg-slate-100"
                                            }`}
                                    >
                                        {tribeIcons[tribe.name] ?? "🔥"}
                                    </div>

                                    <div
                                        className={`flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold ${isSelected
                                                ? "border-violet-600 bg-violet-600 text-white"
                                                : "border-slate-300 text-transparent"
                                            }`}
                                    >
                                        ✓
                                    </div>
                                </div>

                                <h2 className="mt-5 text-lg font-black">{tribe.name}</h2>

                                <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">
                                    {tribe.description ?? "Join fans who share this passion."}
                                </p>

                                <div
                                    className={`mt-5 text-xs font-bold ${isSelected ? "text-violet-600" : "text-slate-400"
                                        }`}
                                >
                                    {isSelected ? "SELECTED ✓" : "JOIN TRIBE →"}
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="sticky bottom-5 mt-10 flex justify-center">
                    <div className="flex items-center gap-4 rounded-full border border-slate-200 bg-white p-2 pl-5 shadow-lg">
                        <span className="text-sm font-semibold text-slate-600">
                            {selected.length}{" "}
                            {selected.length === 1 ? "tribe" : "tribes"} selected
                        </span>

                        <button
                            type="button"
                            onClick={handleContinue}
                            disabled={saving}
                            className="rounded-full bg-violet-600 px-7 py-3 text-sm font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving ? "Saving..." : "ENTER FANWARS →"}
                        </button>
                    </div>
                </div>

                <div className="mt-8 flex justify-center gap-2">
                    <div className="h-2 w-10 rounded-full bg-violet-600" />
                    <div className="h-2 w-10 rounded-full bg-violet-600" />
                </div>
            </section>
        </main>
    );
}