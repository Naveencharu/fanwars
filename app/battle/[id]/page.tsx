"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import FanWarsLogo, {
    FanWarsMark,
} from "@/components/fanwars-logo";

import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/app-header";
import BattleBoost from "@/components/battle-boost";
import BattleCover, { SidePhoto } from "@/components/battle-cover";
import { getDisplayOptions, type BattleOption, type BattleResult } from "@/lib/battle-results";
import { buildBattleShareUrl, getBoostOptionId } from "@/lib/battle-share";


/* =========================================================
   TYPES
   ========================================================= */

type Battle = {
    id: number;
    title: string;
    description: string | null;
    category: string;
    status: string;
    tribe_id: number | null;
    image_url: string | null;
};




/* =========================================================
   PAGE
   ========================================================= */

export default function BattlePage() {
    return <Suspense fallback={<main className="min-h-screen bg-[#fcfbf8] p-12 text-center">Loading FanWar...</main>}>
        <BattleContent />
    </Suspense>;
}

function BattleContent() {

    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();

    const battleId = Number(params.id);

    const [battle, setBattle] = useState<Battle | null>(null);

    const [options, setOptions] = useState<BattleOption[]>([]);

    const [results, setResults] = useState<BattleResult[]>([]);

    const [myVote, setMyVote] = useState<number | null>(null);

    const [creator, setCreator] = useState<{
        handler: string;
        display_name: string;
    } | null>(null);

    const [loading, setLoading] = useState(true);

    const [voting, setVoting] = useState(false);

    const [message, setMessage] = useState("");

    const [messageType, setMessageType] = useState<
        "success" | "error" | ""
    >("");

    const [shareMessage, setShareMessage] = useState("");
    const isBoostLink = searchParams.has("boost");
    const boostOptionId = getBoostOptionId(searchParams.getAll("boost"), options.map(option => option.id));
    const boostSide = options.find(option => option.id === boostOptionId);
    const mySide = options.find(option => option.id === myVote);


    /* =======================================================
       INITIAL LOAD
       ======================================================= */

    useEffect(() => {


        /* =======================================================
           LOAD BATTLE
           ======================================================= */

        async function loadBattle() {
            // Reset state when navigating between battles without a full reload.
            setLoading(true);
            setBattle(null);
            setOptions([]);
            setResults([]);
            setMyVote(null);
            setCreator(null);
            setMessage("");
            setMessageType("");

            if (!Number.isSafeInteger(battleId) || battleId <= 0) {
                setMessage("Invalid FanWar.");
                setMessageType("error");
                setLoading(false);
                return;
            }

            try {

                /* -----------------------------------------------
                   Battle
                ----------------------------------------------- */

                const {
                    data: battleData,
                    error: battleError,
                } = await supabase
                    .from("battles")
                    .select(
                        "id, title, description, category, status, tribe_id, image_url"
                    )
                    .eq("id", battleId)
                    .maybeSingle();


                if (battleError) {
                    throw battleError;
                }
                // Missing records and records hidden by RLS are both unavailable.
                if (!battleData) {
                    setMessage("This FanWar is unavailable or you don't have access to it.");
                    setMessageType("error");
                    return;
                }
                if (
                    battleData.status !== "live" &&
                    battleData.status !== "closed"
                ) {
                    setBattle(null);
                    setOptions([]);
                    setResults([]);
                    setMyVote(null);
                    setCreator(null);

                    setMessage(
                        battleData.status === "pending"
                            ? "This FanWar is currently under review."
                            : battleData.status === "rejected"
                                ? "This FanWar was not approved."
                                : "This FanWar is not currently available."
                    );

                    setMessageType("error");
                    return;
                }

                /* -----------------------------------------------
                   Options
                ----------------------------------------------- */

                const {
                    data: optionData,
                    error: optionError,
                } = await supabase
                    .from("battle_options")
                    .select(
                        "id, battle_id, name, position"
                    )
                    .eq("battle_id", battleId)
                    .order("position", {
                        ascending: true,
                    });


                if (optionError) {
                    throw optionError;
                }


                /* -----------------------------------------------
                   Results
                ----------------------------------------------- */

                const {
                    data: resultData,
                    error: resultError,
                } = await supabase.rpc(
                    "get_battle_results",
                    {
                        p_battle_id: battleId,
                    }
                );


                if (resultError) {
                    throw resultError;
                }


                /* -----------------------------------------------
                   Current user
                ----------------------------------------------- */

                const {
                    data: {
                        user,
                    },
                } = await supabase.auth.getUser();


                let currentVote: number | null = null;


                if (user) {

                    const {
                        data: voteData,
                        error: voteError,
                    } = await supabase.rpc(
                        "get_my_vote",
                        {
                            p_battle_id: battleId,
                        }
                    );


                    if (!voteError && voteData) {

                        currentVote = Number(voteData);

                    }

                }


                setBattle(battleData);

                const { data: creatorData, error: creatorError } =
                    await supabase.rpc("get_battle_creator", {
                        p_battle_id: battleId,
                    });

                if (!creatorError && creatorData?.[0]) {
                    setCreator(creatorData[0]);
                } else {
                    setCreator(null);
                }

                setOptions(getDisplayOptions(
                    battleId, battleData.status, optionData ?? [], resultData ?? []
                ));

                setResults(resultData ?? []);

                setMyVote(currentVote);

            } catch (error) {

                console.error(
                    "Battle loading error:",
                    error
                );

                setMessage(
                    "We couldn't load this FanWar."
                );

                setMessageType("error");

            } finally {

                setLoading(false);

            }
        }


        void loadBattle();
    }, [battleId]);

    /* =======================================================
       REFRESH RESULTS
       ======================================================= */

    const refreshResults = useCallback(async () => {

        const {
            data,
            error,
        } = await supabase.rpc(
            "get_battle_results",
            {
                p_battle_id: battleId,
            }
        );


        if (!error) {

            setResults(data ?? []);

        }

    }, [battleId]);


    /* =======================================================
       LIVE RESULT REFRESH
       ======================================================= */

    useEffect(() => {

        if (!battle || battle.status !== "live") {
            return;
        }


        const interval = setInterval(() => {

            refreshResults();

        }, 5000);


        return () => {

            clearInterval(interval);

        };

    }, [battle, refreshResults]);


    /* =======================================================
       VOTE
       ======================================================= */

    async function handleVote(
        optionId: number
    ) {

        setMessage("");

        setMessageType("");

        if (voting || !battle || battle.status !== "live") return;
        if (!options.some(option => option.id === optionId) || (isBoostLink && optionId !== boostOptionId)) {
            setMessage(boostSide
                ? `This Boost invite only accepts votes for ${boostSide.name}.`
                : "This Boost invite is invalid. Ask your friend for a new link.");
            setMessageType("error");
            return;
        }


        /* -----------------------------------------------
           Authentication
        ----------------------------------------------- */

        const {
            data: {
                user,
            },
        } = await supabase.auth.getUser();


        if (!user) {
            const currentUrl = window.location.pathname + window.location.search;
            const referral = new URLSearchParams(window.location.search).get("ref");

            const loginUrl = referral
                ? `/login?redirect=${encodeURIComponent(currentUrl)}&ref=${encodeURIComponent(referral)}`
                : `/login?redirect=${encodeURIComponent(currentUrl)}`;

            router.push(loginUrl);

            return;

        }


        /* -----------------------------------------------
           Already voted
        ----------------------------------------------- */

        if (myVote !== null) {

            setMessage(
                "You've already voted in this FanWar."
            );

            setMessageType("error");

            return;

        }


        setVoting(true);


        try {

            /* ---------------------------------------------
               Secure database vote
            --------------------------------------------- */

            const {
                error,
            } = await supabase.rpc(
                "cast_vote",
                {
                    p_battle_id: battleId,
                    p_option_id: optionId,
                }
            );


            if (error) {

                throw error;

            }


            /* ---------------------------------------------
               Lock user's vote
            --------------------------------------------- */

            setMyVote(optionId);


            setMessage(
                "Your side is in. ⚔️"
            );

            setMessageType("success");


            /* ---------------------------------------------
               Immediately refresh results
            --------------------------------------------- */

            await refreshResults();


        } catch (error) {

            console.error(
                "Vote error:",
                error
            );


            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "We couldn't record your vote.";


            if (
                errorMessage
                    .toLowerCase()
                    .includes("already voted")
            ) {

                setMessage(
                    "You've already voted in this FanWar."
                );

            } else {

                setMessage(
                    "We couldn't record your vote. Please try again."
                );

            }


            setMessageType("error");

        } finally {

            setVoting(false);

        }
    }

    /* =======================================================
       SHARE
       ======================================================= */

    async function handleShare() {
        await shareBattle();
    }

    async function handleBoost() {
        if (!battle || battle.status !== "live" || !mySide) {
            setShareMessage("Vote for your side first to create a Boost invite.");
            return;
        }
        await shareBattle(mySide.id);
    }

    async function shareBattle(boostId?: number) {
        if (!battle) {
            return;
        }

        const url = buildBattleShareUrl(window.location.origin, battle.id, searchParams.get("ref"), boostId);
        let shareUrl = url.toString();
        const side = options.find(option => option.id === boostId);
        const copiedMessage = side ? `Boost link copied for ${side.name}.` : "Battle link copied.";

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("handler")
                    .eq("id", user.id)
                    .maybeSingle();

                if (profile?.handler) {
                    url.searchParams.set("ref", profile.handler);
                    shareUrl = url.toString();
                }
            }

            if (navigator.share) {
                await navigator.share({
                    title: `FanWars: ${battle.title}`,
                    text: side ? `Back ${side.name} with me in this FanWar: ${battle.title}`
                        : `Join me in this FanWar: ${battle.title}`,
                    url: shareUrl,
                });

                setShareMessage("Shared successfully.");
                setTimeout(() => setShareMessage(""), 2500);
                return;
            }

            await navigator.clipboard.writeText(shareUrl);

            setShareMessage(copiedMessage);
            setTimeout(() => setShareMessage(""), 2500);
        } catch (error) {
            console.error("Share error:", error);

            try {
                await navigator.clipboard.writeText(shareUrl);
                setShareMessage(copiedMessage);
                setTimeout(() => setShareMessage(""), 2500);
            } catch {
                setShareMessage("Unable to share this FanWar.");
                setTimeout(() => setShareMessage(""), 2500);
            }
        }
    }
    /* =======================================================
       LOADING
       ======================================================= */

    if (loading) {

        return (
            <main className="min-h-screen bg-[#fcfbf8]">

                <AppHeader />

                <div className="flex min-h-[70vh] items-center justify-center">

                    <div className="text-center">

                        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />

                        <p className="mt-4 text-sm font-bold text-[#81798e]">
                            Loading FanWar...
                        </p>

                    </div>

                </div>

            </main>
        );
    }


    /* =======================================================
       ERROR / NO BATTLE
       ======================================================= */

    if (!battle) {

        return (
            <main className="min-h-screen bg-[#fcfbf8]">

                <AppHeader />

                <div className="flex min-h-[70vh] items-center justify-center px-5">

                    <div className="rounded-[2rem] border border-brand-100 bg-white p-10 text-center shadow-lg">

                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">

                            <FanWarsMark className="h-8 w-8 text-brand-600" />

                        </div>

                        <h1 className="mt-6 text-2xl font-black">
                            FanWar unavailable
                        </h1>

                        <p className="mt-2 text-sm text-[#81798e]">
                            {message || "This FanWar could not be found."}
                        </p>

                        <Link
                            href="/"
                            className="mt-6 inline-flex rounded-full bg-[#171525] px-6 py-3 text-sm font-extrabold text-white"
                        >
                            Back to FanWars
                        </Link>

                    </div>

                </div>

            </main>
        );
    }


    /* =======================================================
       CALCULATE RESULTS
       ======================================================= */

    const totalVotes = results.reduce(
        (
            total,
            result
        ) =>
            total +
            Number(result.vote_count),
        0
    );


    function getResult(
        optionId: number
    ) {

        return results.find(
            result =>
                result.option_id === optionId
        );

    }
    const isClosed = battle.status === "closed";

    const optionAResult = getResult(options[0]?.id);
    const optionBResult = getResult(options[1]?.id);

    const optionAVotes = Number(optionAResult?.vote_count ?? 0);
    const optionBVotes = Number(optionBResult?.vote_count ?? 0);

    const winnerOption =
        isClosed && optionAVotes > optionBVotes
            ? options[0]
            : isClosed && optionBVotes > optionAVotes
                ? options[1]
                : null;

    const isDraw =
        isClosed && optionAVotes === optionBVotes;

    /* =======================================================
       MAIN
       ======================================================= */

    return (
        <main className="min-h-screen bg-[#fcfbf8] text-[#171525]">


            {/* =================================================
          HEADER
      ================================================= */}

            <AppHeader />


            {/* =================================================
          HERO
      ================================================= */}

            <section className="relative overflow-hidden bg-gradient-to-br from-[#fff5f7] via-[#fff5f7] to-[#eaf5ff]">

                <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-brand-200/35 blur-3xl" />

                <div className="pointer-events-none absolute -right-40 top-20 h-[500px] w-[500px] rounded-full bg-rose-200/35 blur-3xl" />


                <div className="relative mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-16 lg:px-8">


                    {/* BACK */}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Link
                            href="/home"
                            className="inline-flex items-center gap-2 text-sm font-bold text-[#766f82] transition hover:text-brand-600"
                        >
                            ← Back to Home
                        </Link>

                        <button
                            type="button"
                            onClick={handleShare}
                            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#171525] shadow-sm ring-1 ring-black/[0.06] transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            ↗ Share FanWar
                        </button>
                    </div>

                    <BattleBoost closed={isClosed} sideName={mySide?.name ?? null} onShare={handleBoost} />

                    {isBoostLink && (
                        <p role={boostSide ? "status" : "alert"} className="mt-4 rounded-2xl border border-brand-100 bg-white px-5 py-4 text-sm font-bold text-[#171525]">
                            {boostSide
                                ? `You've been invited to back ${boostSide.name}. This Boost invite lets you vote only for that side.`
                                : "This Boost invite is invalid. Ask your friend for a new link."}
                            {myVote !== null && " Your existing vote stays unchanged."}
                        </p>
                    )}

                    {shareMessage && (
                        <div className="mt-3 text-right text-xs font-bold text-brand-600">
                            {shareMessage}
                        </div>
                    )}
                    <div className="mx-auto mt-8 max-w-5xl overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_24px_70px_rgba(23,21,37,0.14)]">
                        <BattleCover title={battle.title} imageUrl={battle.image_url} optionNames={options.map(option => option.name)} />
                    </div>

                    {/* =================================================
              BATTLE TITLE
          ================================================= */}

                    <div className="mx-auto mt-10 max-w-5xl text-center">

                        <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-rose-600 shadow-sm">

                            <span className="h-2 w-2 rounded-full bg-rose-500" />

                            {battle.status === "live"
                                ? "LIVE"
                                : battle.status === "closed"
                                    ? "FINAL"
                                    : battle.status}

                        </span>


                        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-[#938b9f]">
                            {battle.category}
                        </p>
                        {battle.tribe_id && (
                            <Link
                                href={`/tribes/${battle.tribe_id}`}
                                className="mt-3 inline-flex items-center rounded-full bg-white/80 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-600 shadow-sm ring-1 ring-black/[0.05] transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                                View Tribe →
                            </Link>
                        )}

                        <h1 className="mt-3 text-5xl font-black tracking-[-0.06em] sm:text-6xl lg:text-7xl">
                            {battle.title}
                        </h1>


                        {battle.description && (
                            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#756e80]">
                                {battle.description}
                            </p>
                        )}

                        {creator && (
                            <Link
                                href={`/u/${creator.handler}`}
                                className="mt-4 inline-flex items-center rounded-full bg-white/80 px-4 py-2 text-xs font-extrabold text-brand-600 shadow-sm ring-1 ring-black/[0.05] transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                                Created by @{creator.handler}
                            </Link>
                        )}
                    </div>


                    {/* =================================================
              BATTLE CARD
          ================================================= */}

                    <div className="mx-auto mt-10 max-w-5xl rounded-[2rem] border border-white/90 bg-white/90 p-6 shadow-[0_30px_90px_rgba(55,35,100,0.15)] backdrop-blur-xl sm:p-10">
                        {isClosed && (
                            <div className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 px-6 py-6 text-center">
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                                    FanWar Ended
                                </p>

                                <h2 className="mt-2 text-2xl font-black text-[#171525]">
                                    {isDraw
                                        ? "🤝 Final Result — Draw"
                                        : `🏆 ${winnerOption?.name ?? "Winner"} Wins`}
                                </h2>

                                <p className="mt-2 text-sm font-bold text-[#686577]">
                                    Final • {totalVotes}{" "}
                                    {totalVotes === 1 ? "vote" : "votes"}
                                </p>
                            </div>
                        )}

                        {/* =================================================
                SIDES
            ================================================= */}

                        <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-center">


                            {/* LEFT */}

                            <BattleSide
                                option={options[0]}
                                result={getResult(options[0]?.id)}
                                totalVotes={totalVotes}
                                myVote={myVote}
                                voting={voting}
                                closed={isClosed}
                                voteRestricted={isBoostLink && options[0]?.id !== boostOptionId}
                                onVote={handleVote}
                            />


                            {/* VS */}

                            <div className="flex items-center justify-center">

                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-rose-500 text-xs font-black text-white shadow-lg shadow-brand-200">
                                    VS
                                </div>

                            </div>


                            {/* RIGHT */}

                            <BattleSide
                                option={options[1]}
                                result={getResult(options[1]?.id)}
                                totalVotes={totalVotes}
                                myVote={myVote}
                                voting={voting}
                                closed={isClosed}
                                voteRestricted={isBoostLink && options[1]?.id !== boostOptionId}
                                onVote={handleVote}
                            />

                        </div>


                        {/* =================================================
                VOTING MESSAGE
            ================================================= */}

                        <div className="mt-8 border-t border-brand-100 pt-7 text-center">


                            {message && (
                                <div
                                    className={`mx-auto mb-5 max-w-md rounded-2xl px-5 py-3 text-sm font-bold ${messageType === "success"
                                        ? "bg-green-50 text-green-700"
                                        : "bg-red-50 text-red-600"
                                        }`}
                                >
                                    {message}
                                </div>
                            )}


                            <div className="inline-flex items-center gap-2 rounded-full bg-[#fff5f7] px-5 py-2.5 text-xs font-bold text-[#81798e]">

                                <FanWarsMark className="h-4 w-4 text-brand-600" />

                                1 person = 1 verified vote

                            </div>


                            <p className="mt-4 text-xs font-semibold text-[#a099a9]">

                                {totalVotes === 0
                                    ? "Be the first to take a side."
                                    : `${totalVotes} ${totalVotes === 1
                                        ? "person has"
                                        : "people have"
                                    } voted so far.`}

                            </p>

                        </div>


                    </div>


                    {/* =================================================
              PARTICIPATION MESSAGE
          ================================================= */}

                    <div className="mx-auto mt-8 max-w-2xl text-center">

                        <p className="text-sm font-bold text-[#8d8597]">
                            Your vote counts. Your participation builds your influence.
                        </p>

                    </div>


                </div>

            </section>


            {/* =================================================
          FOOTER
      ================================================= */}

            <footer className="border-t border-brand-100/70 bg-white">

                <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">

                    <FanWarsLogo size="sm" />

                    <p className="text-xs font-medium text-[#8a8395]">
                        People. Passions. Battles.
                    </p>

                </div>

            </footer>

        </main>
    );
}


/* =========================================================
   HEADER
   ========================================================= */

function BattleSide({
    option,
    result,
    totalVotes,
    myVote,
    voting,
    closed,
    voteRestricted,
    onVote,
}: {
    option: BattleOption;
    result?: BattleResult;
    totalVotes: number;
    myVote: number | null;
    voting: boolean;
    closed: boolean;
    voteRestricted: boolean;
    onVote: (
        optionId: number
    ) => void;
}) {

    if (!option) {
        return null;
    }


    const voteCount = Number(
        result?.vote_count ?? 0
    );


    const percentage =
        totalVotes > 0
            ? Math.round(
                (voteCount / totalVotes) * 100
            )
            : 0;


    const selected =
        myVote === option.id;


    return (
        <div
            className={`rounded-3xl border p-6 transition-all ${selected
                ? "border-brand-300 bg-brand-50/70 shadow-md"
                : "border-brand-100/70 bg-[#fff5f7]"
                }`}
        >


            {/* =================================================
          LOGO
      ================================================= */}

            <div className="h-40 overflow-hidden rounded-2xl sm:h-48"><SidePhoto name={option.name} showLabel={false} /></div>


            {/* =================================================
          NAME
      ================================================= */}

            <h2 className="mt-4 text-center text-2xl font-black tracking-[-0.035em]">
                {option.name}
            </h2>


            {/* =================================================
          VOTE / LOCKED STATE
      ================================================= */}

            {closed ? (

                <div className="mt-7 w-full rounded-full bg-[#f3f1f5] px-5 py-4 text-center text-sm font-extrabold text-[#686577]">
                    Voting Closed
                </div>

            ) : myVote === null ? (

                <button
                    type="button"
                    onClick={() => onVote(option.id)}
                    disabled={voting || voteRestricted}
                    className="mt-7 w-full rounded-full bg-[#171525] px-5 py-4 text-sm font-extrabold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {voteRestricted
                        ? "Unavailable through this Boost invite"
                        : voting
                        ? "Recording..."
                        : `Choose ${option.name}`}
                </button>

            ) : (

                <div
                    className={`mt-7 w-full rounded-full px-5 py-4 text-center text-sm font-extrabold ${selected
                            ? "bg-brand-600 text-white"
                            : "bg-brand-50 text-brand-700"
                        }`}
                >
                    {selected
                        ? "✓ Your side"
                        : "Other side"}
                </div>

            )}


            {/* =================================================
    RESULTS
================================================= */}

            <div className="mt-7">

                <div className="flex items-center justify-between">

                    <span className="text-xs font-bold text-[#81798e]">
                        {voteCount}{" "}
                        {voteCount === 1
                            ? "vote"
                            : "votes"}
                    </span>

                    {(myVote !== null || closed) && (
                        <span className="text-sm font-black text-brand-700">
                            {percentage}%
                        </span>
                    )}

                </div>

                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-brand-100">

                    {(myVote !== null || closed) && (
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-rose-500 transition-all duration-700"
                            style={{
                                width: `${percentage}%`,
                            }}
                        />
                    )}

                </div>

            </div>
        </div>
    );
}

/* =========================================================
   TRIBE LOGO ROUTER
   ========================================================= */
