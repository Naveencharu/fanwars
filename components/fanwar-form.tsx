"use client";

import ImageUpload from "@/components/image-upload";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

type Tribe = {
    id: number;
    name: string;
};
type Clan = {
    id: number;
    tribe_id: number;
    name: string;
    created_by: string;
};

type FanWarType = "open" | "clan";
export default function FanWarForm({ kind = "open", tribeId }: { kind?: FanWarType; tribeId?: number }) {
    const fanWarType = kind;
    const returnHref = kind === "clan" && Number.isSafeInteger(tribeId) && (tribeId ?? 0) > 0 ? "/tribes/" + tribeId : "/home";
    const createHref = kind === "clan" ? returnHref + "/challenge" : "/create-fanwar";
    const router = useRouter();

    const [tribes, setTribes] = useState<Tribe[]>([]);
    const [tribeName, setTribeName] = useState("");
    const [title, setTitle] = useState("");
    const [tribeSuggestions, setTribeSuggestions] = useState<Tribe[]>([]);
    const [showTribeSuggestions, setShowTribeSuggestions] = useState(false);
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [optionA, setOptionA] = useState("");
    const [optionB, setOptionB] = useState("");

    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [userId, setUserId] = useState("");
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    const [availableClans, setAvailableClans] =
        useState<Clan[]>([]);

    const [myCaptainClans, setMyCaptainClans] =
        useState<Clan[]>([]);

    const [clanAId, setClanAId] = useState("");
    const [clanBId, setClanBId] = useState("");

    useEffect(() => {
        async function loadTribes() {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                    router.replace(`/login?redirect=${encodeURIComponent(createHref)}`);
                    return;
                }

                setUserId(user.id);

                const { data, error: tribeError } = await supabase
                    .from("tribes")
                    .select("id, name")
                    .order("name");

                if (tribeError) throw tribeError;

                setTribes((data || []) as Tribe[]);
                if (kind === "open") return;
                const parentTribe = (data ?? []).find(tribe => tribe.id === tribeId);
                if (!Number.isSafeInteger(tribeId) || !parentTribe) {
                    throw new Error("This Tribe could not be found. Open a Tribe to start a Clan challenge.");
                }
                setTribeName(parentTribe.name);
                const { data: clanRows, error: clanError } =
                    await supabase
                        .from("clans")
                        .select(`
            id,
            tribe_id,
            name,
            created_by
        `)
                        .eq("status", "active")
                        .eq("tribe_id", tribeId!)
                        .order("name");

                if (clanError) throw clanError;

                const allClans = (clanRows || []) as Clan[];

                setAvailableClans(allClans);

                const { data: captainMemberships, error: captainError } =
                    await supabase
                        .from("clan_members")
                        .select("clan_id")
                        .eq("user_id", user.id)
                        .eq("role", "captain");

                if (captainError) throw captainError;

                const captainClanIds = new Set(
                    (captainMemberships || []).map(
                        (membership) => membership.clan_id
                    )
                );

                setMyCaptainClans(
                    allClans.filter((clan) =>
                        captainClanIds.has(clan.id)
                    )
                );
            } catch (err) {
                console.error("Create FanWar tribe loading error:", err);
                setError(err instanceof Error ? err.message : "We couldn't load this form. Please try again.");
            } finally {
                setLoading(false);
            }
        }

        loadTribes();
    }, [router, kind, tribeId, createHref]);

    function handleTribeChange(value: string) {
        setTribeName(value);

        const search = value.trim().toLowerCase();

        if (!search) {
            setTribeSuggestions([]);
            setShowTribeSuggestions(false);
            return;
        }

        const matches = tribes
            .filter((tribe) =>
                tribe.name.toLowerCase().includes(search)
            )
            .slice(0, 5);

        setTribeSuggestions(matches);
        setShowTribeSuggestions(true);
    }

    async function handleCreate() {
        if (creating || loading || !userId) return;

        setError("");

        if (!title.trim()) {
            setError("Please enter a FanWar title.");
            return;
        }

        if (!category.trim()) {
            setError("Please enter a category.");
            return;
        }

        if (!tribeName.trim()) {
            setError("Please enter a Tribe.");
            return;
        }
        if (
            fanWarType === "clan" &&
            (!clanAId || !clanBId)
        ) {
            setError(
                "Please select both Clans for this FanWar."
            );
            return;
        }
        if (kind === "clan") {
            const own = myCaptainClans.find(clan => clan.id === Number(clanAId));
            const opponent = availableClans.find(clan => clan.id === Number(clanBId));
            if (!own || !opponent || own.id === opponent.id || own.tribe_id !== tribeId || opponent.tribe_id !== tribeId) {
                setError("Choose your Captain Clan and a different opponent from this Tribe.");
                return;
            }
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
            /*
             * Resolve the Tribe first.
             *
             * If the Tribe already exists, get_or_create_tribe()
             * returns its ID.
             *
             * If it does not exist, the function creates it and
             * returns the new ID.
             */
            let resolvedTribeId = tribeId;
            if (kind === "open") {
                const { data: resolved, error: tribeError } = await supabase.rpc("get_or_create_tribe", { p_name: tribeName.trim() });
                if (tribeError) throw tribeError;
                resolvedTribeId = Number(resolved);
            }
            if (!resolvedTribeId) throw new Error("Unable to find the Tribe.");

            /*
             * Create the FanWar in pending status.
             */
            const { data, error: createError } = await supabase.rpc(
                "create_fanwar",
                {
                    p_title: title.trim(),
                    p_description: description.trim(),
                    p_category: category.trim(),
                    p_tribe_id: Number(resolvedTribeId),
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
                throw new Error(
                    "FanWar was created but no battle ID was returned."
                );
            }
            // NEW CLAN LINK
            if (fanWarType === "clan") {
                const { error: clanLinkError } =
                    await supabase.rpc(
                        "set_fanwar_clans",
                        {
                            p_battle_id: Number(battleId),
                            p_clan_a_id: Number(clanAId),
                            p_clan_b_id: Number(clanBId),
                        }
                    );

                if (clanLinkError) {
                    console.error(
                        "Clan FanWar association failed:",
                        clanLinkError
                    );

                    throw clanLinkError;
                }
            }
            /*
             * Save the optional FanWar image.
             */
            if (imageUrl) {
                const { error: imageError } = await supabase.rpc(
                    "set_fanwar_image",
                    {
                        p_battle_id: Number(battleId),
                        p_image_url: imageUrl,
                    }
                );

                if (imageError) {
                    console.error(
                        "FanWar image save failed:",
                        imageError
                    );
                }
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
                <AppHeader />

                <section className="mx-auto flex min-h-[75vh] max-w-2xl items-center justify-center px-5 py-12 sm:px-8">
                    <div className="w-full rounded-[2rem] border border-black/[0.06] bg-white p-8 text-center shadow-sm sm:p-12">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-3xl">
                            ✓
                        </div>

                        <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-brand-600">
                            FanWar Submitted
                        </p>

                        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                            Your FanWar is under review
                        </h1>

                        <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-[#686577]">
                            Your FanWar has been submitted successfully. It
                            will be reviewed before it becomes visible to the
                            community.
                        </p>

                        <div className="mt-8 rounded-2xl bg-brand-50 p-5 text-left">
                            <p className="text-sm font-extrabold text-brand-700">
                                What happens next?
                            </p>

                            <p className="mt-2 text-sm leading-6 text-[#686577]">
                                Our moderation team will review your FanWar.
                                Once approved, it can go live and fans can
                                start voting.
                            </p>
                        </div>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                            <Link
                                href={returnHref}
                                className="rounded-full bg-[#171525] px-6 py-3 text-sm font-extrabold text-white transition hover:opacity-90"
                            >
                                {kind === "clan" ? "Back to Tribe" : "Back to Home"}
                            </Link>

                            <Link
                                href={createHref}
                                className="rounded-full border border-black/[0.08] bg-white px-6 py-3 text-sm font-extrabold"
                            >
                                {kind === "clan" ? "Challenge Another Clan" : "Create Another FanWar"}
                            </Link>
                        </div>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#fcfbf8] text-[#171525]">
            <AppHeader />

            <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
                {kind === "clan" && <Link href={returnHref} className="mb-6 inline-block text-sm font-bold text-brand-700 hover:underline">← Back to Tribe</Link>}
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-600">
                        Create
                    </p>

                    <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                        {kind === "clan" ? "Challenge a Clan" : "Start a FanWar"}
                    </h1>

                    <p className="mt-4 text-base leading-7 text-[#686577] sm:text-lg">
                        {kind === "clan" ? "Bring your Tribe together for a Clan vs Clan battle." : "Give fans something worth taking a side on."}
                    </p>
                </div>

                {error && (
                    <div className="mt-7 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
                        {error}
                    </div>
                )}

                <div className="mt-8 space-y-5 rounded-[2rem] border border-black/[0.06] bg-white p-6 shadow-sm sm:p-8">
                    <div className="rounded-2xl bg-brand-50 p-4">
                        <p className="text-sm font-extrabold">{kind === "clan" ? "Clan challenge in " + (tribeName || "your Tribe") : "Open FanWar"}</p>
                        <p className="mt-1 text-xs leading-5 text-[#777286]">{kind === "clan" ? "As Captain, challenge a different Clan in this Tribe." : "Create any two sides for fans to choose between."}</p>
                    </div>
                    <div>
                        <label className="text-sm font-extrabold">
                            FanWar Image
                        </label>

                        <p className="mt-1 text-xs text-[#777286]">
                            Give your FanWar a visual identity.
                        </p>

                        <div className="mt-3">
                            {userId && (
                                <ImageUpload
                                    userId={userId}
                                    folder="fanwars"
                                    currentUrl={imageUrl}
                                    aspect="cover"
                                    label="Choose FanWar image"
                                    className="aspect-[3/1] w-full rounded-[24px]"
                                    onUploaded={(url) => setImageUrl(url)}
                                />
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-extrabold">
                            FanWar Title
                        </label>

                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Chai vs Coffee"
                            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-extrabold">
                            Description
                        </label>

                        <textarea
                            value={description}
                            onChange={(e) =>
                                setDescription(e.target.value)
                            }
                            placeholder="Which one rules your morning?"
                            rows={3}
                            className="mt-2 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                        />
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label className="text-sm font-extrabold">
                                Category
                            </label>

                            <input
                                value={category}
                                onChange={(e) =>
                                    setCategory(e.target.value)
                                }
                                placeholder="Lifestyle"
                                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-extrabold">
                                Tribe
                            </label>

                            <div className="relative">
                                <input
                                    value={tribeName}
                                    readOnly={kind === "clan"}
                                    onChange={(e) =>
                                        kind === "open" && handleTribeChange(e.target.value)
                                    }
                                    onFocus={() => {
                                        if (tribeName.trim()) {
                                            setShowTribeSuggestions(true);
                                        }
                                    }}
                                    onBlur={() => {
                                        setTimeout(() => {
                                            setShowTribeSuggestions(false);
                                        }, 150);
                                    }}
                                    placeholder={
                                        loading
                                            ? "Loading Tribes..."
                                            : "e.g. Cricket Nation"
                                    }
                                    className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                                />

                                {kind === "open" && showTribeSuggestions &&
                                    tribeSuggestions.length > 0 && (
                                        <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lg">
                                            {tribeSuggestions.map((tribe) => (
                                                <button
                                                    key={tribe.id}
                                                    type="button"
                                                    onMouseDown={() => {
                                                        setTribeName(
                                                            tribe.name
                                                        );
                                                        setShowTribeSuggestions(
                                                            false
                                                        );
                                                    }}
                                                    className="block w-full px-4 py-3 text-left text-sm font-semibold transition hover:bg-brand-50"
                                                >
                                                    {tribe.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                {kind === "open" && tribeName.trim() &&
                                    tribeSuggestions.length === 0 && (
                                        <p className="mt-2 text-xs font-semibold text-[#777286]">
                                            New Tribe will be created:{" "}
                                            <span className="text-brand-600">
                                                {tribeName.trim()}
                                            </span>
                                        </p>
                                    )}
                            </div>
                        </div>
                    </div>

                    {fanWarType === "open" ? (
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div>
                                <label className="text-sm font-extrabold">
                                    Option A
                                </label>

                                <input
                                    value={optionA}
                                    onChange={(e) =>
                                        setOptionA(e.target.value)
                                    }
                                    placeholder="Chai"
                                    className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-extrabold">
                                    Option B
                                </label>

                                <input
                                    value={optionB}
                                    onChange={(e) =>
                                        setOptionB(e.target.value)
                                    }
                                    placeholder="Coffee"
                                    className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div>
                                <label className="text-sm font-extrabold">
                                    Your Clan
                                </label>

                                <select
                                    value={clanAId}
                                    onChange={(e) => {
                                        const value = e.target.value;

                                        setClanAId(value);
                                        setClanBId("");

                                        const selected =
                                            myCaptainClans.find(
                                                (clan) =>
                                                    clan.id === Number(value)
                                            );

                                        setOptionA(selected?.name || "");
                                        setOptionB("");

                                        if (selected) {
                                            const parentTribe =
                                                tribes.find(
                                                    (tribe) =>
                                                        tribe.id ===
                                                        selected.tribe_id
                                                );

                                            if (parentTribe) {
                                                setTribeName(parentTribe.name);
                                            }
                                        }
                                    }}
                                    className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold outline-none"
                                >
                                    <option value="">
                                        Select your Clan
                                    </option>

                                    {myCaptainClans.map((clan) => (
                                        <option
                                            key={clan.id}
                                            value={clan.id}
                                        >
                                            {clan.name}
                                        </option>
                                    ))}
                                </select>

                                {myCaptainClans.length === 0 && (
                                    <p className="mt-2 text-xs font-semibold text-amber-700">
                                        You need to be Captain of a Clan before creating a Clan FanWar.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="text-sm font-extrabold">
                                    Opponent Clan
                                </label>

                                <select
                                    value={clanBId}
                                    disabled={!clanAId}
                                    onChange={(e) => {
                                        const value = e.target.value;

                                        setClanBId(value);

                                        const selected =
                                            availableClans.find(
                                                (clan) =>
                                                    clan.id === Number(value)
                                            );

                                        setOptionB(selected?.name || "");
                                    }}
                                    className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="">
                                        Select opponent Clan
                                    </option>

                                    {availableClans
                                        .filter((clan) => {
                                            const ownClan =
                                                myCaptainClans.find(
                                                    (item) =>
                                                        item.id ===
                                                        Number(clanAId)
                                                );

                                            return (
                                                ownClan &&
                                                clan.tribe_id ===
                                                ownClan.tribe_id &&
                                                clan.id !== ownClan.id
                                            );
                                        })
                                        .map((clan) => (
                                            <option
                                                key={clan.id}
                                                value={clan.id}
                                            >
                                                {clan.name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="rounded-2xl bg-brand-50 p-4">
                        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-600">
                            FanWar format
                        </p>

                        <p className="mt-2 text-sm leading-6 text-[#686577]">
                            Fans will choose exactly one side. Each verified
                            fan gets one vote.
                        </p>
                    </div>

                    {kind === "clan" && !loading && availableClans.length < 2 && <p className="text-sm font-semibold text-amber-700">This Tribe needs at least two active Clans for a challenge. <Link href={returnHref} className="underline">Back to Tribe</Link></p>}
                    <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                        <Link
                            href={returnHref}
                            className="rounded-full border border-black/[0.08] bg-white px-6 py-3 text-center text-sm font-extrabold"
                        >
                            Cancel
                        </Link>

                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={creating || loading || !userId || (kind === "clan" && (!myCaptainClans.length || availableClans.length < 2))}
                            className="rounded-full bg-[#171525] px-7 py-3 text-sm font-extrabold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {creating
                                ? "Creating FanWar..."
                : kind === "clan" ? "Submit Clan Challenge →" : "Launch FanWar →"}
                        </button>
                    </div>
                </div>
            </section>
        </main>
    );
}
