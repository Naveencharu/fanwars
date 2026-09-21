"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

type Tribe = {
    id: number;
    name: string;
    description: string | null;
};

export default function TribesPage() {
    const [tribes, setTribes] = useState<Tribe[]>([]);
    const [selectedTribes, setSelectedTribes] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadTribes() {
            try {
                setLoading(true);
                setError("");

                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                    window.location.href = "/login";
                    return;
                }

                const { data: tribeData, error: tribeError } =
                    await supabase
                        .from("tribes")
                        .select("id, name, description")
                        .order("id", { ascending: true });

                if (tribeError) {
                    throw tribeError;
                }

                setTribes((tribeData || []) as Tribe[]);

                const { data: membershipData, error: membershipError } =
                    await supabase
                        .from("tribe_members")
                        .select("tribe_id")
                        .eq("user_id", user.id);

                if (membershipError) {
                    throw membershipError;
                }

                setSelectedTribes(
                    (membershipData || []).map((item) => item.tribe_id)
                );
            } catch (err) {
                console.error("Tribes loading error:", err);
                setError("We couldn't load your tribes.");
            } finally {
                setLoading(false);
            }
        }

        loadTribes();
    }, []);

    function toggleTribe(tribeId: number) {
        setSelectedTribes((current) =>
            current.includes(tribeId)
                ? current.filter((id) => id !== tribeId)
                : [...current, tribeId]
        );
    }

    async function saveTribes() {
        try {
            setSaving(true);
            setError("");

            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                window.location.href = "/login";
                return;
            }

            const { data: existingMemberships, error: existingError } =
                await supabase
                    .from("tribe_members")
                    .select("tribe_id")
                    .eq("user_id", user.id);

            if (existingError) {
                throw existingError;
            }

            const existingIds = (existingMemberships || []).map(
                (item) => item.tribe_id
            );

            const tribesToAdd = selectedTribes.filter(
                (id) => !existingIds.includes(id)
            );

            const tribesToRemove = existingIds.filter(
                (id) => !selectedTribes.includes(id)
            );

            if (tribesToAdd.length > 0) {
                const { error: insertError } = await supabase
                    .from("tribe_members")
                    .insert(
                        tribesToAdd.map((tribeId) => ({
                            user_id: user.id,
                            tribe_id: tribeId,
                        }))
                    );

                if (insertError) {
                    throw insertError;
                }
            }

            if (tribesToRemove.length > 0) {
                const { error: deleteError } = await supabase
                    .from("tribe_members")
                    .delete()
                    .eq("user_id", user.id)
                    .in("tribe_id", tribesToRemove);

                if (deleteError) {
                    throw deleteError;
                }
            }

            window.location.href = "/home";
        } catch (err) {
            console.error("Saving tribes error:", err);
            setError("We couldn't save your tribe choices.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className="min-h-screen bg-[#fcfbf8] text-[#171525]">
            <AppHeader showBackToHome />

            <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
                <div className="max-w-3xl">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-purple-600">
                        Your Passions
                    </div>

                    <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                        Choose your Tribes
                    </h1>

                    <p className="mt-4 text-base leading-7 text-[#686577] sm:text-lg">
                        Join the communities that represent what you care about.
                        You can belong to multiple tribes.
                    </p>
                </div>

                {error && (
                    <div className="mt-7 rounded-3xl border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map((item) => (
                            <div
                                key={item}
                                className="h-36 animate-pulse rounded-[2rem] bg-white ring-1 ring-black/[0.05]"
                            />
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {tribes.map((tribe) => {
                                const selected = selectedTribes.includes(tribe.id);

                                return (
                                    <div
                                        key={tribe.id}
                                        className={`relative rounded-[2rem] border transition ${selected
                                                ? "border-purple-300 bg-purple-50 shadow-sm"
                                                : "border-black/[0.06] bg-white hover:-translate-y-0.5 hover:shadow-md"
                                            }`}
                                    >
                                        <Link
                                            href={`/tribes/${tribe.id}`}
                                            className="block p-6 text-left"
                                        >
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 text-2xl">
                                                🔥
                                            </div>

                                            <h2 className="mt-5 text-lg font-black">
                                                {tribe.name}
                                            </h2>

                                            {tribe.description && (
                                                <p className="mt-2 text-sm leading-6 text-[#777384]">
                                                    {tribe.description}
                                                </p>
                                            )}

                                            <div className="mt-5 text-xs font-extrabold text-purple-600">
                                                View Tribe →
                                            </div>
                                        </Link>

                                        <button
                                            type="button"
                                            onClick={() => toggleTribe(tribe.id)}
                                            aria-label={
                                                selected
                                                    ? `Remove ${tribe.name} from selected tribes`
                                                    : `Select ${tribe.name}`
                                            }
                                            className={`absolute right-5 top-5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-black transition ${selected
                                                    ? "bg-purple-600 text-white"
                                                    : "border border-black/10 bg-white text-transparent hover:border-purple-300"
                                                }`}
                                        >
                                            ✓
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="sticky bottom-0 mt-10 flex flex-col gap-4 rounded-[2rem] border border-black/[0.06] bg-white/95 p-5 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="text-sm font-black">
                                    {selectedTribes.length}{" "}
                                    {selectedTribes.length === 1 ? "Tribe" : "Tribes"} selected
                                </div>

                                <div className="mt-1 text-xs text-[#777384]">
                                    Choose as many as you like.
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Link
                                    href="/home"
                                    className="rounded-full border border-black/[0.08] bg-white px-5 py-3 text-sm font-extrabold text-[#171525]"
                                >
                                    Back
                                </Link>

                                <button
                                    type="button"
                                    onClick={saveTribes}
                                    disabled={saving}
                                    className="rounded-full bg-[#171525] px-6 py-3 text-sm font-extrabold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {saving ? "Saving..." : "Save Tribes →"}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </section>
        </main>
    );
}