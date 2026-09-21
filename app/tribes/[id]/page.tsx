"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

type MemberPreview = {
    id: string;
    username: string;
    handler: string;
    display_name: string;
    avatar_url: string | null;
};

type LiveBattle = {
    id: number;
    title: string;
    description: string | null;
    category: string;
    status: string;
    starts_at: string | null;
    ends_at: string | null;
};

type TribePage = {
    id: number;
    name: string;
    description: string | null;
    image_url: string | null;
    member_count: number;
    member_preview: MemberPreview[];
    live_battles: LiveBattle[];
};

export default function TribeDetailPage() {
    const params = useParams<{ id: string }>();
    const tribeId = Number(params.id);

    const [tribe, setTribe] = useState<TribePage | null>(null);
    const [isMember, setIsMember] = useState(false);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!tribeId) return;

        async function loadTribe() {
            setLoading(true);
            setError("");

            try {
                const { data, error: tribeError } = await supabase.rpc(
                    "get_tribe_page",
                    {
                        p_tribe_id: tribeId,
                    }
                );

                if (tribeError) throw tribeError;

                const row = Array.isArray(data) ? data[0] : data;

                if (!row) {
                    setError("Tribe not found.");
                    return;
                }

                setTribe(row as TribePage);

                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (user) {
                    const { data: membership, error: membershipError } =
                        await supabase
                            .from("tribe_members")
                            .select("tribe_id")
                            .eq("tribe_id", tribeId)
                            .eq("user_id", user.id)
                            .maybeSingle();

                    if (membershipError) throw membershipError;

                    setIsMember(!!membership);
                }
            } catch (err) {
                console.error("Tribe page error:", err);
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load this tribe."
                );
            } finally {
                setLoading(false);
            }
        }

        loadTribe();
    }, [tribeId]);

    async function handleJoin() {
        if (joining || !tribe) return;

        setJoining(true);
        setError("");

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                window.location.href = "/login";
                return;
            }

            const { error: joinError } = await supabase
                .from("tribe_members")
                .insert({
                    user_id: user.id,
                    tribe_id: tribe.id,
                });

            if (joinError) {
                if (joinError.code === "23505") {
                    setIsMember(true);
                } else {
                    throw joinError;
                }
            } else {
                setIsMember(true);

                setTribe((current) =>
                    current
                        ? {
                            ...current,
                            member_count: current.member_count + 1,
                        }
                        : current
                );
            }
        } catch (err) {
            console.error("Join tribe error:", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to join this tribe."
            );
        } finally {
            setJoining(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-[#fcfbf8]">
                <AppHeader />
                <div className="mx-auto max-w-5xl px-5 py-12">
                    <div className="h-10 w-48 animate-pulse rounded-xl bg-black/5" />
                    <div className="mt-4 h-5 w-80 animate-pulse rounded bg-black/5" />
                    <div className="mt-10 h-48 animate-pulse rounded-3xl bg-black/5" />
                </div>
            </main>
        );
    }

    if (error || !tribe) {
        return (
            <main className="min-h-screen bg-[#fcfbf8]">
                <AppHeader />
                <div className="mx-auto max-w-5xl px-5 py-16 text-center">
                    <h1 className="text-2xl font-black text-[#171525]">
                        Tribe not found
                    </h1>

                    <p className="mt-2 text-sm text-[#686577]">
                        {error || "This tribe does not exist."}
                    </p>

                    <Link
                        href="/tribes"
                        className="mt-6 inline-flex rounded-full bg-[#171525] px-5 py-3 text-sm font-extrabold text-white"
                    >
                        ← Back to Tribes
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#fcfbf8]">
            <AppHeader />

            <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
                <Link
                    href="/tribes"
                    className="text-sm font-bold text-[#686577] transition hover:text-[#171525]"
                >
                    ← Back to Tribes
                </Link>

                {/* Tribe Hero */}
                <section className="mt-5 overflow-hidden rounded-[2rem] border border-black/[0.06] bg-white shadow-sm">
                    <div className="bg-gradient-to-br from-purple-100 via-white to-pink-100 px-6 py-10 sm:px-10 sm:py-12">
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-5">
                                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white text-4xl shadow-sm">
                                    🔥
                                </div>

                                <div>
                                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-purple-600">
                                        FanWars Tribe
                                    </p>

                                    <h1 className="mt-1 text-3xl font-black tracking-tight text-[#171525] sm:text-4xl">
                                        {tribe.name}
                                    </h1>

                                    <p className="mt-2 max-w-xl text-sm leading-6 text-[#686577]">
                                        {tribe.description ||
                                            `A community for fans of ${tribe.name}.`}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleJoin}
                                disabled={joining || isMember}
                                className={`rounded-full px-6 py-3 text-sm font-extrabold transition ${isMember
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-[#171525] text-white hover:opacity-90"
                                    }`}
                            >
                                {joining
                                    ? "Joining..."
                                    : isMember
                                        ? "✓ Joined"
                                        : "Join Tribe"}
                            </button>
                        </div>
                    </div>

                    {/* Tribe Stats */}
                    <div className="grid grid-cols-2 border-t border-black/[0.06] sm:grid-cols-3">
                        <div className="px-5 py-5 text-center">
                            <p className="text-2xl font-black text-[#171525]">
                                {tribe.member_count}
                            </p>
                            <p className="mt-1 text-xs font-bold text-[#888393]">
                                Members
                            </p>
                        </div>

                        <div className="border-l border-black/[0.06] px-5 py-5 text-center">
                            <p className="text-2xl font-black text-[#171525]">
                                {tribe.live_battles?.length ?? 0}
                            </p>
                            <p className="mt-1 text-xs font-bold text-[#888393]">
                                Live FanWars
                            </p>
                        </div>

                        <div className="col-span-2 border-t border-black/[0.06] px-5 py-5 text-center sm:col-span-1 sm:border-l sm:border-t-0">
                            <p className="text-2xl font-black text-purple-600">
                                Active
                            </p>
                            <p className="mt-1 text-xs font-bold text-[#888393]">
                                Community
                            </p>
                        </div>
                    </div>
                </section>

                {/* Members */}
                <section className="mt-8">
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-purple-600">
                                Community
                            </p>
                            <h2 className="mt-1 text-2xl font-black text-[#171525]">
                                Tribe Members
                            </h2>
                        </div>

                        <span className="text-sm font-bold text-[#888393]">
                            {tribe.member_count} total
                        </span>
                    </div>

                    {tribe.member_preview.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white p-8 text-center">
                            <p className="font-bold text-[#686577]">
                                Be the first fan in this tribe.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {tribe.member_preview.map((member) => (
                                <Link
                                    key={member.id}
                                    href={`/u/${member.handler}`}
                                    className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-sm"
                                >
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-purple-100 text-sm font-black text-purple-700">
                                        {member.avatar_url ? (
                                            <img
                                                src={member.avatar_url}
                                                alt=""
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            member.display_name?.charAt(0)?.toUpperCase() ||
                                            "F"
                                        )}
                                    </div>

                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-extrabold text-[#171525]">
                                            {member.display_name}
                                        </p>
                                        <p className="truncate text-xs font-semibold text-[#888393]">
                                            @{member.handler}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                {/* FanWars */}
                <section className="mt-8">
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-purple-600">
                        Competition
                    </p>

                    <h2 className="mt-1 text-2xl font-black text-[#171525]">
                        Live FanWars
                    </h2>

                    {tribe.live_battles.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white p-8 text-center">
                            <p className="font-bold text-[#686577]">
                                No live FanWars for this tribe yet.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            {tribe.live_battles.map((battle) => (
                                <Link
                                    key={battle.id}
                                    href={`/battle/${battle.id}`}
                                    className="rounded-2xl border border-black/[0.06] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                                >
                                    <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-purple-600">
                                        {battle.category}
                                    </p>

                                    <h3 className="mt-2 text-lg font-black text-[#171525]">
                                        {battle.title}
                                    </h3>

                                    {battle.description && (
                                        <p className="mt-2 text-sm leading-6 text-[#686577]">
                                            {battle.description}
                                        </p>
                                    )}

                                    <div className="mt-4 text-sm font-extrabold text-purple-600">
                                        Enter FanWar →
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}