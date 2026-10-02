"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

type FanWar = {
    id: number;
    title: string;
    description: string | null;
    category: string;
    created_at: string;
    created_by: string | null;
    tribe_id: number | null;
    creator?: {
        display_name: string;
        handler: string;
    } | null;
    tribe?: {
        name: string;
    } | null;
    options?: {
        name: string;
        position: number;
    }[];
};

export default function AdminFanWarsPage() {
    const router = useRouter();

    const [fanWars, setFanWars] = useState<FanWar[]>([]);
    const [liveFanWars, setLiveFanWars] = useState<FanWar[]>([]);
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [error, setError] = useState("");
    const [actionId, setActionId] = useState<number | null>(null);
    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");

    async function loadFanWars() {
        setLoading(true);
        setError("");

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session?.user) {
                router.replace("/login?redirect=/admin/fanwars");
                return;
            }

            const { data: moderator, error: moderatorError } =
                await supabase.rpc("is_fanwar_moderator");

            if (moderatorError) {
                throw moderatorError;
            }

            if (!moderator) {
                setAuthorized(false);
                return;
            }

            setAuthorized(true);

            const { data: battles, error: battlesError } = await supabase
                .from("battles")
                .select(
                    "id,title,description,category,created_at,created_by,tribe_id"
                )
                .eq("status", "pending")
                .order("created_at", { ascending: true });

            if (battlesError) {
                throw battlesError;
            }
            const { data: liveBattles, error: liveBattlesError } = await supabase
                .from("battles")
                .select(
                    "id,title,description,category,created_at,created_by,tribe_id"
                )
                .eq("status", "live")
                .order("created_at", { ascending: false });

            if (liveBattlesError) {
                throw liveBattlesError;
            }

            setLiveFanWars((liveBattles ?? []) as FanWar[]);

            if (!battles || battles.length === 0) {
                setFanWars([]);
                return;
            }

            const creatorIds = [
                ...new Set(
                    battles
                        .map((battle) => battle.created_by)
                        .filter(Boolean)
                ),
            ] as string[];

            const tribeIds = [
                ...new Set(
                    battles
                        .map((battle) => battle.tribe_id)
                        .filter((id): id is number => id !== null)
                ),
            ];

            const battleIds = battles.map((battle) => battle.id);

            const [profilesResult, tribesResult, optionsResult] =
                await Promise.all([
                    creatorIds.length
                        ? supabase
                            .from("profiles")
                            .select("id,display_name,handler")
                            .in("id", creatorIds)
                        : Promise.resolve({ data: [], error: null }),

                    tribeIds.length
                        ? supabase
                            .from("tribes")
                            .select("id,name")
                            .in("id", tribeIds)
                        : Promise.resolve({ data: [], error: null }),

                    supabase
                        .from("battle_options")
                        .select("battle_id,name,position")
                        .in("battle_id", battleIds)
                        .order("position", { ascending: true }),
                ]);

            if (profilesResult.error) throw profilesResult.error;
            if (tribesResult.error) throw tribesResult.error;
            if (optionsResult.error) throw optionsResult.error;

            const profiles = profilesResult.data ?? [];
            const tribes = tribesResult.data ?? [];
            const options = optionsResult.data ?? [];

            const enrichedFanWars: FanWar[] = battles.map((battle) => ({
                ...battle,
                creator:
                    profiles.find(
                        (profile) => profile.id === battle.created_by
                    ) ?? null,
                tribe:
                    tribes.find(
                        (tribe) => tribe.id === battle.tribe_id
                    ) ?? null,
                options: options.filter(
                    (option) => option.battle_id === battle.id
                ),
            }));

            setFanWars(enrichedFanWars);
        } catch (err) {
            console.error("Admin FanWars load error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load pending FanWars."
            );
        } finally {
            setLoading(false);
        }
    }
    async function handleComplete(id: number) {
        const confirmed = window.confirm(
            "End this FanWar? Voting will close and the current vote totals will become final."
        );

        if (!confirmed) return;

        setActionId(id);
        setError("");

        try {
            const { error: completeError } = await supabase.rpc(
                "complete_fanwar",
                {
                    p_battle_id: id,
                }
            );

            if (completeError) throw completeError;

            setLiveFanWars((current) =>
                current.filter((fanWar) => fanWar.id !== id)
            );

            window.dispatchEvent(
                new Event("fanwars:moderation-updated")
            );
        } catch (err) {
            console.error("Complete FanWar error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to end this FanWar."
            );
        } finally {
            setActionId(null);
        }
    }
    async function handleApprove(id: number) {
        setActionId(id);
        setError("");

        try {
            const { error: approveError } = await supabase.rpc(
                "approve_fanwar",
                {
                    p_battle_id: id,
                }
            );

            if (approveError) {
                throw approveError;
            }

            setFanWars((current) =>
                current.filter((fanWar) => fanWar.id !== id)
            );
            window.dispatchEvent(
                new Event("fanwars:moderation-updated")
            );
        } catch (err) {
            console.error("Approve FanWar error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to approve this FanWar."
            );
        } finally {
            setActionId(null);
        }
    }

    async function handleReject(id: number) {
        if (!rejectionReason.trim()) {
            setError("Please enter a rejection reason.");
            return;
        }

        setActionId(id);
        setError("");

        try {
            const { error: rejectError } = await supabase.rpc(
                "reject_fanwar",
                {
                    p_battle_id: id,
                    p_reason: rejectionReason.trim(),
                }
            );

            if (rejectError) {
                throw rejectError;
            }

            setFanWars((current) =>
                current.filter((fanWar) => fanWar.id !== id)
            );
            window.dispatchEvent(
                new Event("fanwars:moderation-updated")
            );
            setRejectingId(null);
            setRejectionReason("");
        } catch (err) {
            console.error("Reject FanWar error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to reject this FanWar."
            );
        } finally {
            setActionId(null);
        }
    }

    useEffect(() => {
        let cancelled = false;

        async function initialize() {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (cancelled) return;

            if (!session?.user) {
                router.replace("/login?redirect=/admin/fanwars");
                return;
            }

            await loadFanWars();
        }

        initialize();

        return () => {
            cancelled = true;
        };
    }, [router]);

    if (loading) {
        return (
            <main className="min-h-screen bg-[#fcfbf8] text-[#171525]">
                <AppHeader />

                <div className="mx-auto max-w-5xl px-5 py-16 text-center">
                    <p className="text-sm font-semibold text-[#686577]">
                        Loading moderation queue...
                    </p>
                </div>
            </main>
        );
    }

    if (!authorized) {
        return (
            <main className="min-h-screen bg-[#fcfbf8] text-[#171525]">
                <AppHeader />

                <section className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center px-5 py-12">
                    <div className="w-full rounded-[2rem] border border-black/[0.06] bg-white p-8 text-center shadow-sm sm:p-12">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-2xl">
                            🔒
                        </div>

                        <h1 className="mt-6 text-3xl font-black tracking-[-0.04em]">
                            Access restricted
                        </h1>

                        <p className="mt-3 text-sm leading-6 text-[#686577]">
                            You do not have permission to access the FanWar
                            moderation queue.
                        </p>

                        <Link
                            href="/home"
                            className="mt-7 inline-flex rounded-full bg-[#171525] px-6 py-3 text-sm font-extrabold text-white"
                        >
                            Back to Home
                        </Link>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#fcfbf8] text-[#171525]">
            <AppHeader />

            <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-600">
                            FanWars Moderation
                        </p>

                        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                            Pending FanWars
                        </h1>

                        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#686577]">
                            Review user-created FanWars before they become
                            visible to the community.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={loadFanWars}
                        disabled={loading}
                        className="rounded-full border border-black/[0.08] bg-white px-5 py-3 text-sm font-extrabold transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Refresh Queue
                    </button>
                </div>

                {error && (
                    <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
                        {error}
                    </div>
                )}

                {fanWars.length === 0 ? (
                    <div className="mt-8 rounded-[2rem] border border-black/[0.06] bg-white p-10 text-center shadow-sm">
                        <div className="text-4xl">✓</div>

                        <h2 className="mt-4 text-xl font-black">
                            No FanWars awaiting review
                        </h2>

                        <p className="mt-2 text-sm text-[#686577]">
                            The moderation queue is currently clear.
                        </p>
                    </div>
                ) : (
                    <div className="mt-8 space-y-6">
                        {fanWars.map((fanWar) => (
                            <article
                                key={fanWar.id}
                                className="rounded-[2rem] border border-black/[0.06] bg-white p-6 shadow-sm sm:p-8"
                            >
                                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap gap-2">
                                            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-extrabold text-brand-700">
                                                {fanWar.category}
                                            </span>

                                            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700">
                                                Pending Review
                                            </span>
                                        </div>

                                        <h2 className="mt-4 text-2xl font-black tracking-[-0.03em]">
                                            {fanWar.title}
                                        </h2>

                                        {fanWar.description && (
                                            <p className="mt-3 text-sm leading-6 text-[#686577]">
                                                {fanWar.description}
                                            </p>
                                        )}

                                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-2xl bg-[#f7f5f2] p-4">
                                                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8a8793]">
                                                    Creator
                                                </p>

                                                <p className="mt-1 text-sm font-extrabold">
                                                    {fanWar.creator
                                                        ?.display_name ??
                                                        "Unknown"}
                                                </p>

                                                {fanWar.creator?.handler && (
                                                    <p className="text-xs text-[#686577]">
                                                        @
                                                        {
                                                            fanWar.creator
                                                                .handler
                                                        }
                                                    </p>
                                                )}
                                            </div>

                                            <div className="rounded-2xl bg-[#f7f5f2] p-4">
                                                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8a8793]">
                                                    Tribe
                                                </p>

                                                <p className="mt-1 text-sm font-extrabold">
                                                    {fanWar.tribe?.name ??
                                                        "No Tribe"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                            {fanWar.options?.map((option) => (
                                                <div
                                                    key={`${fanWar.id}-${option.position}`}
                                                    className="rounded-2xl border border-black/[0.06] bg-white p-4"
                                                >
                                                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8a8793]">
                                                        Option{" "}
                                                        {option.position === 1
                                                            ? "A"
                                                            : "B"}
                                                    </p>

                                                    <p className="mt-1 font-extrabold">
                                                        {option.name}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        <p className="mt-5 text-xs text-[#8a8793]">
                                            Submitted{" "}
                                            {new Date(
                                                fanWar.created_at
                                            ).toLocaleString()}
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 flex-col gap-3 lg:w-40">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleApprove(fanWar.id)
                                            }
                                            disabled={actionId === fanWar.id}
                                            className="rounded-full bg-[#171525] px-5 py-3 text-sm font-extrabold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {actionId === fanWar.id
                                                ? "Working..."
                                                : "Approve"}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRejectingId(fanWar.id);
                                                setRejectionReason("");
                                                setError("");
                                            }}
                                            disabled={actionId === fanWar.id}
                                            className="rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-extrabold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Reject
                                        </button>
                                    </div>

                                    {rejectingId === fanWar.id && (
                                        <div className="mt-4 w-full rounded-2xl border border-red-100 bg-red-50 p-4 lg:max-w-sm">
                                            <p className="text-sm font-extrabold text-red-700">
                                                Rejection reason
                                            </p>

                                            <textarea
                                                value={rejectionReason}
                                                onChange={(event) =>
                                                    setRejectionReason(
                                                        event.target.value
                                                    )
                                                }
                                                rows={3}
                                                placeholder="Why should this FanWar be rejected?"
                                                className="mt-3 w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-[#171525] outline-none focus:border-red-400"
                                            />

                                            <div className="mt-3 flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleReject(fanWar.id)
                                                    }
                                                    disabled={
                                                        actionId === fanWar.id
                                                    }
                                                    className="rounded-full bg-red-600 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"
                                                >
                                                    Confirm Reject
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setRejectingId(null);
                                                        setRejectionReason("");
                                                        setError("");
                                                    }}
                                                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-extrabold"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
            <section className="mt-12 border-t border-black/[0.06] pt-10">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-green-700">
                        Battle Control
                    </p>

                    <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
                        Live FanWars
                    </h2>

                    <p className="mt-2 text-sm text-[#686577]">
                        End a live FanWar to close voting and finalize its result.
                    </p>
                </div>

                {liveFanWars.length === 0 ? (
                    <div className="mt-6 rounded-[2rem] border border-black/[0.06] bg-white p-8 text-center">
                        <p className="font-extrabold text-[#686577]">
                            No live FanWars.
                        </p>
                    </div>
                ) : (
                    <div className="mt-6 space-y-4">
                        {liveFanWars.map((fanWar) => (
                            <article
                                key={fanWar.id}
                                className="flex flex-col gap-5 rounded-[2rem] border border-black/[0.06] bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="rounded-full bg-green-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-green-700">
                                            Live
                                        </span>

                                        <span className="text-xs font-bold text-[#888393]">
                                            {fanWar.category}
                                        </span>
                                    </div>

                                    <h3 className="mt-3 text-xl font-black text-[#171525]">
                                        {fanWar.title}
                                    </h3>

                                    {fanWar.description && (
                                        <p className="mt-2 max-w-2xl text-sm text-[#686577]">
                                            {fanWar.description}
                                        </p>
                                    )}

                                    <Link
                                        href={`/battle/${fanWar.id}`}
                                        className="mt-3 inline-flex text-sm font-extrabold text-brand-600"
                                    >
                                        View FanWar →
                                    </Link>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        handleComplete(fanWar.id)
                                    }
                                    disabled={actionId === fanWar.id}
                                    className="shrink-0 rounded-full bg-red-600 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {actionId === fanWar.id
                                        ? "Ending..."
                                        : "End FanWar"}
                                </button>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}