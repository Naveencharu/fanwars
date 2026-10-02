"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

type Tribe = {
    id: number;
    name: string;
    description: string | null;
};

function CreateClanContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const tribeId = Number(searchParams.get("tribe"));

    const [tribe, setTribe] = useState<Tribe | null>(null);
    const [isMember, setIsMember] = useState(false);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadPage() {
            setLoading(true);
            setError("");

            try {
                if (!tribeId || Number.isNaN(tribeId)) {
                    setError("A valid Tribe is required.");
                    return;
                }

                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                    const redirect = encodeURIComponent(
                        `/create-clan?tribe=${tribeId}`
                    );

                    router.replace(`/login?redirect=${redirect}`);
                    return;
                }

                const { data: tribeData, error: tribeError } =
                    await supabase
                        .from("tribes")
                        .select("id, name, description")
                        .eq("id", tribeId)
                        .maybeSingle();

                if (tribeError) throw tribeError;

                if (!tribeData) {
                    setError("Tribe not found.");
                    return;
                }

                setTribe(tribeData);

                const { data: membership, error: membershipError } =
                    await supabase
                        .from("tribe_members")
                        .select("tribe_id")
                        .eq("tribe_id", tribeId)
                        .eq("user_id", user.id)
                        .maybeSingle();

                if (membershipError) throw membershipError;

                setIsMember(!!membership);
            } catch (err) {
                console.error("Create Clan page error:", err);

                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load Create Clan."
                );
            } finally {
                setLoading(false);
            }
        }

        loadPage();
    }, [router, tribeId]);

    async function handleCreateClan(
        event: React.FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (!tribe || submitting) return;

        const cleanName = name.trim();
        const cleanDescription = description.trim();

        if (cleanName.length < 2) {
            setError("Clan name must contain at least 2 characters.");
            return;
        }

        if (cleanName.length > 80) {
            setError("Clan name must not exceed 80 characters.");
            return;
        }

        if (cleanDescription.length > 500) {
            setError("Clan description must not exceed 500 characters.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            const { data, error: createError } = await supabase.rpc(
                "create_clan",
                {
                    p_tribe_id: tribe.id,
                    p_name: cleanName,
                    p_description: cleanDescription || null,
                }
            );

            if (createError) throw createError;

            const clanId = Number(data);

            if (!clanId || Number.isNaN(clanId)) {
                throw new Error(
                    "Clan was created but no Clan ID was returned."
                );
            }

            router.push(`/clans/${clanId}`);
        } catch (err) {
            console.error("Create Clan error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to create Clan."
            );
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-[#fcfbf8]">
                <AppHeader />

                <div className="mx-auto max-w-3xl px-5 py-12">
                    <div className="h-8 w-44 animate-pulse rounded-xl bg-black/5" />
                    <div className="mt-5 h-72 animate-pulse rounded-3xl bg-black/5" />
                </div>
            </main>
        );
    }

    if (error && !tribe) {
        return (
            <main className="min-h-screen bg-[#fcfbf8]">
                <AppHeader />

                <div className="mx-auto max-w-3xl px-5 py-16 text-center">
                    <h1 className="text-2xl font-black text-[#171525]">
                        Unable to Create Clan
                    </h1>

                    <p className="mt-3 text-sm text-[#686577]">
                        {error}
                    </p>

                    <Link
                        href="/tribes"
                        className="mt-6 inline-flex rounded-full bg-[#171525] px-5 py-3 text-sm font-extrabold text-white"
                    >
                        Back to Tribes
                    </Link>
                </div>
            </main>
        );
    }

    if (!tribe) return null;

    if (!isMember) {
        return (
            <main className="min-h-screen bg-[#fcfbf8]">
                <AppHeader />

                <div className="mx-auto max-w-3xl px-5 py-12">
                    <Link
                        href={`/tribes/${tribe.id}`}
                        className="text-sm font-bold text-[#686577]"
                    >
                        ← Back to {tribe.name}
                    </Link>

                    <div className="mt-6 rounded-[2rem] border border-black/[0.06] bg-white p-8 text-center shadow-sm sm:p-12">
                        <div className="text-4xl">🛡️</div>

                        <h1 className="mt-5 text-2xl font-black text-[#171525]">
                            Join the Tribe First
                        </h1>

                        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#686577]">
                            You need to be a member of {tribe.name} before
                            creating a Clan inside it.
                        </p>

                        <Link
                            href={`/tribes/${tribe.id}`}
                            className="mt-6 inline-flex rounded-full bg-[#171525] px-6 py-3 text-sm font-extrabold text-white"
                        >
                            Go to {tribe.name}
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#fcfbf8]">
            <AppHeader />

            <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
                <Link
                    href={`/tribes/${tribe.id}`}
                    className="text-sm font-bold text-[#686577] transition hover:text-[#171525]"
                >
                    ← Back to {tribe.name}
                </Link>

                <div className="mt-6 rounded-[2rem] border border-black/[0.06] bg-white p-6 shadow-sm sm:p-10">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-2xl">
                            🛡️
                        </div>

                        <div>
                            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-600">
                                {tribe.name}
                            </p>

                            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#171525]">
                                Create a Clan
                            </h1>
                        </div>
                    </div>

                    <p className="mt-5 max-w-xl text-sm leading-6 text-[#686577]">
                        Create a community inside {tribe.name} and become
                        its founding Captain.
                    </p>

                    <form
                        onSubmit={handleCreateClan}
                        className="mt-8 space-y-6"
                    >
                        <div>
                            <label
                                htmlFor="clan-name"
                                className="text-sm font-extrabold text-[#171525]"
                            >
                                Clan Name
                            </label>

                            <input
                                id="clan-name"
                                type="text"
                                value={name}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                                maxLength={80}
                                placeholder="Example: RCB Bengaluru Fans"
                                className="mt-2 w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm font-semibold text-[#171525] outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                            />

                            <div className="mt-2 flex justify-between text-xs font-semibold text-[#888393]">
                                <span>Make it recognizable and specific.</span>
                                <span>{name.length}/80</span>
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="clan-description"
                                className="text-sm font-extrabold text-[#171525]"
                            >
                                What does your Clan stand for?
                            </label>

                            <textarea
                                id="clan-description"
                                value={description}
                                onChange={(event) =>
                                    setDescription(event.target.value)
                                }
                                maxLength={500}
                                rows={5}
                                placeholder="Tell fans what brings this Clan together..."
                                className="mt-2 w-full resize-none rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm font-semibold leading-6 text-[#171525] outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                            />

                            <div className="mt-2 flex justify-between text-xs font-semibold text-[#888393]">
                                <span>Optional</span>
                                <span>{description.length}/500</span>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-brand-50 p-4">
                            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-600">
                                Parent Tribe
                            </p>

                            <p className="mt-1 font-black text-[#171525]">
                                {tribe.name}
                            </p>

                            <p className="mt-1 text-xs leading-5 text-[#686577]">
                                Your Clan will live inside this Tribe.
                            </p>
                        </div>

                        {error && (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={
                                submitting ||
                                name.trim().length < 2
                            }
                            className="w-full rounded-full bg-[#171525] px-6 py-4 text-sm font-extrabold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {submitting
                                ? "Creating Clan..."
                                : "Create Clan"}
                        </button>

                        <p className="text-center text-xs font-semibold text-[#888393]">
                            You will become the founding Captain of this Clan.
                        </p>
                    </form>
                </div>
            </div>
        </main>
    );
}

export default function CreateClanPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen bg-[#fcfbf8]">
                    <AppHeader />

                    <div className="mx-auto max-w-3xl px-5 py-12">
                        <div className="h-8 w-44 animate-pulse rounded-xl bg-black/5" />
                        <div className="mt-5 h-72 animate-pulse rounded-3xl bg-black/5" />
                    </div>
                </main>
            }
        >
            <CreateClanContent />
        </Suspense>
    );
}