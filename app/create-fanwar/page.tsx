"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

type Tribe = {
    id: number;
    name: string;
};

export default function CreateFanWarPage() {
    const router = useRouter();

    const [tribes, setTribes] = useState<Tribe[]>([]);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [tribeId, setTribeId] = useState("");
    const [optionA, setOptionA] = useState("");
    const [optionB, setOptionB] = useState("");

    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        async function loadTribes() {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                    router.replace("/login");
                    return;
                }

                const { data, error: tribeError } = await supabase
                    .from("tribes")
                    .select("id, name")
                    .order("name");

                if (tribeError) throw tribeError;

                setTribes((data || []) as Tribe[]);
            } catch (err) {
                console.error("Create FanWar tribe loading error:", err);
                setError("We couldn't load the Tribes.");
            } finally {
                setLoading(false);
            }
        }

        loadTribes();
    }, [router]);

    async function handleCreate() {
        if (creating) return;

        setError("");

        if (!title.trim()) {
            setError("Please enter a FanWar title.");
            return;
        }

        if (!category.trim()) {
            setError("Please enter a category.");
            return;
        }

        if (!tribeId) {
            setError("Please choose a Tribe.");
            return;
        }

        if (!optionA.trim() || !optionB.trim()) {
            setError("Both FanWar options are required.");
            return;
        }

        if (
            optionA.trim().toLowerCase() ===
            optionB.trim().toLowerCase()
        ) {
            setError("The two FanWar options must be different.");
            return;
        }

        setCreating(true);

        try {
            const { data, error: createError } = await supabase.rpc(
                "create_fanwar",
                {
                    p_title: title.trim(),
                    p_description: description.trim(),
                    p_category: category.trim(),
                    p_tribe_id: Number(tribeId),
                    p_option_a: optionA.trim(),
                    p_option_b: optionB.trim(),
                }
            );

            if (createError) {
                console.error("Create FanWar error:", createError);
                throw createError;
            }

            const battleId = data;

            if (!battleId) {
                throw new Error("FanWar was created but no battle ID was returned.");
            }

            setSubmitted(true);
        } catch (err) {
            console.error("FanWar creation failed:", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to create this FanWar."
            );
        } finally {
            setCreating(false);
        }
    }
    if (submitted) {
        return (
            <main className="min-h-screen bg-[#fcfbf8] text-[#171525]">
                <AppHeader showBackToHome />

                <section className="mx-auto flex min-h-[75vh] max-w-2xl items-center justify-center px-5 py-12 sm:px-8">
                    <div className="w-full rounded-[2rem] border border-black/[0.06] bg-white p-8 text-center shadow-sm sm:p-12">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-3xl">
                            ✓
                        </div>

                        <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-purple-600">
                            FanWar Submitted
                        </p>

                        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                            Your FanWar is under review
                        </h1>

                        <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-[#686577]">
                            Your FanWar has been submitted successfully. It will be
                            reviewed before it becomes visible to the community.
                        </p>

                        <div className="mt-8 rounded-2xl bg-purple-50 p-5 text-left">
                            <p className="text-sm font-extrabold text-purple-700">
                                What happens next?
                            </p>

                            <p className="mt-2 text-sm leading-6 text-[#686577]">
                                Our moderation team will review your FanWar. Once
                                approved, it can go live and fans can start voting.
                            </p>
                        </div>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                            <Link
                                href="/home"
                                className="rounded-full bg-[#171525] px-6 py-3 text-sm font-extrabold text-white transition hover:opacity-90"
                            >
                                Back to Home
                            </Link>

                            <Link
                                href="/create-fanwar"
                                className="rounded-full border border-black/[0.08] bg-white px-6 py-3 text-sm font-extrabold"
                            >
                                Create Another FanWar
                            </Link>
                        </div>
                    </div>
                </section>
            </main>
        );
    }
    return (
        <main className="min-h-screen bg-[#fcfbf8] text-[#171525]">
            <AppHeader showBackToHome />

            <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-600">
                        Create
                    </p>

                    <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                        Start a FanWar
                    </h1>

                    <p className="mt-4 text-base leading-7 text-[#686577] sm:text-lg">
                        Give fans something worth taking a side on.
                    </p>
                </div>

                {error && (
                    <div className="mt-7 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
                        {error}
                    </div>
                )}

                <div className="mt-8 space-y-5 rounded-[2rem] border border-black/[0.06] bg-white p-6 shadow-sm sm:p-8">

                    <div>
                        <label className="text-sm font-extrabold">
                            FanWar Title
                        </label>

                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Chai vs Coffee"
                            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-extrabold">
                            Description
                        </label>

                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Which one rules your morning?"
                            rows={3}
                            className="mt-2 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
                        />
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label className="text-sm font-extrabold">
                                Category
                            </label>

                            <input
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="Lifestyle"
                                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-extrabold">
                                Tribe
                            </label>

                            <select
                                value={tribeId}
                                onChange={(e) => setTribeId(e.target.value)}
                                disabled={loading}
                                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
                            >
                                <option value="">
                                    {loading
                                        ? "Loading Tribes..."
                                        : "Choose a Tribe"}
                                </option>

                                {tribes.map((tribe) => (
                                    <option
                                        key={tribe.id}
                                        value={tribe.id}
                                    >
                                        {tribe.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label className="text-sm font-extrabold">
                                Option A
                            </label>

                            <input
                                value={optionA}
                                onChange={(e) => setOptionA(e.target.value)}
                                placeholder="Chai"
                                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-extrabold">
                                Option B
                            </label>

                            <input
                                value={optionB}
                                onChange={(e) => setOptionB(e.target.value)}
                                placeholder="Coffee"
                                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
                            />
                        </div>
                    </div>

                    <div className="rounded-2xl bg-purple-50 p-4">
                        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-purple-600">
                            FanWar format
                        </p>

                        <p className="mt-2 text-sm leading-6 text-[#686577]">
                            Fans will choose exactly one side. Each verified
                            fan gets one vote.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                        <Link
                            href="/home"
                            className="rounded-full border border-black/[0.08] bg-white px-6 py-3 text-center text-sm font-extrabold"
                        >
                            Cancel
                        </Link>

                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={creating || loading}
                            className="rounded-full bg-[#171525] px-7 py-3 text-sm font-extrabold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {creating
                                ? "Creating FanWar..."
                                : "Launch FanWar →"}
                        </button>
                    </div>
                </div>
            </section>
        </main>
    );
}