"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import FanWarsLogo, {
    FanWarsMark,
} from "@/components/fanwars-logo";

import { supabase } from "@/lib/supabase";


/* =========================================================
   TYPES
   ========================================================= */

type Battle = {
    id: number;
    title: string;
    description: string | null;
    category: string;
    status: string;
};

type BattleOption = {
    id: number;
    battle_id: number;
    name: string;
    position: number;
};

type BattleResult = {
    option_id: number;
    option_name: string;
    vote_count: number;
};


/* =========================================================
   PAGE
   ========================================================= */

export default function BattlePage() {

    const params = useParams();
    const router = useRouter();

    const battleId = Number(params.id);

    const [battle, setBattle] = useState<Battle | null>(null);

    const [options, setOptions] = useState<BattleOption[]>([]);

    const [results, setResults] = useState<BattleResult[]>([]);

    const [myVote, setMyVote] = useState<number | null>(null);

    const [loading, setLoading] = useState(true);

    const [voting, setVoting] = useState(false);

    const [message, setMessage] = useState("");

    const [messageType, setMessageType] = useState<
        "success" | "error" | ""
    >("");

    const [shareMessage, setShareMessage] = useState("");


    /* =======================================================
       INITIAL LOAD
       ======================================================= */

    useEffect(() => {

        if (!battleId || Number.isNaN(battleId)) {

            setMessage("Invalid FanWar.");

            setMessageType("error");

            setLoading(false);

            return;
        }

        loadBattle();

    }, [battleId]);


    /* =======================================================
       LOAD BATTLE
       ======================================================= */

    async function loadBattle() {

        setLoading(true);

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
                    "id, title, description, category, status"
                )
                .eq("id", battleId)
                .single();


            if (battleError) {
                throw battleError;
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

            setOptions(optionData ?? []);

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


    /* =======================================================
       REFRESH RESULTS
       ======================================================= */

    async function refreshResults() {

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

    }


    /* =======================================================
       LIVE RESULT REFRESH
       ======================================================= */

    useEffect(() => {

        if (!battle) {
            return;
        }


        const interval = setInterval(() => {

            refreshResults();

        }, 5000);


        return () => {

            clearInterval(interval);

        };

    }, [battleId, battle]);


    /* =======================================================
       VOTE
       ======================================================= */

    async function handleVote(
        optionId: number
    ) {

        setMessage("");

        setMessageType("");


        /* -----------------------------------------------
           Authentication
        ----------------------------------------------- */

        const {
            data: {
                user,
            },
        } = await supabase.auth.getUser();


        if (!user) {

            router.push(
                `/login?redirect=/battle/${battleId}`
            );

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
        if (!battle) {
            return;
        }

        const shareUrl = window.location.href;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: `FanWars: ${battle.title}`,
                    text: `Join me in this FanWar: ${battle.title}`,
                    url: shareUrl,
                });

                setShareMessage("Shared successfully.");
                setTimeout(() => setShareMessage(""), 2500);
                return;
            }

            await navigator.clipboard.writeText(shareUrl);

            setShareMessage("Battle link copied.");
            setTimeout(() => setShareMessage(""), 2500);
        } catch (error) {
            console.error("Share error:", error);

            try {
                await navigator.clipboard.writeText(shareUrl);
                setShareMessage("Battle link copied.");
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

                <Header />

                <div className="flex min-h-[70vh] items-center justify-center">

                    <div className="text-center">

                        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-purple-100 border-t-purple-600" />

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

                <Header />

                <div className="flex min-h-[70vh] items-center justify-center px-5">

                    <div className="rounded-[2rem] border border-purple-100 bg-white p-10 text-center shadow-lg">

                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-50">

                            <FanWarsMark className="h-8 w-8 text-purple-600" />

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


    /* =======================================================
       MAIN
       ======================================================= */

    return (
        <main className="min-h-screen bg-[#fcfbf8] text-[#171525]">


            {/* =================================================
          HEADER
      ================================================= */}

            <Header />


            {/* =================================================
          HERO
      ================================================= */}

            <section className="relative overflow-hidden bg-gradient-to-br from-[#fff0f8] via-[#f7efff] to-[#eaf5ff]">

                <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-purple-200/35 blur-3xl" />

                <div className="pointer-events-none absolute -right-40 top-20 h-[500px] w-[500px] rounded-full bg-pink-200/35 blur-3xl" />


                <div className="relative mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-16 lg:px-8">


                    {/* BACK */}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Link
                            href="/home"
                            className="inline-flex items-center gap-2 text-sm font-bold text-[#766f82] transition hover:text-purple-600"
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

                    {shareMessage && (
                        <div className="mt-3 text-right text-xs font-bold text-purple-600">
                            {shareMessage}
                        </div>
                    )}


                    {/* =================================================
              BATTLE TITLE
          ================================================= */}

                    <div className="mx-auto mt-10 max-w-5xl text-center">

                        <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-pink-600 shadow-sm">

                            <span className="h-2 w-2 rounded-full bg-pink-500" />

                            {battle.status === "live"
                                ? "LIVE"
                                : battle.status}

                        </span>


                        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-[#938b9f]">
                            {battle.category}
                        </p>


                        <h1 className="mt-3 text-5xl font-black tracking-[-0.06em] sm:text-6xl lg:text-7xl">
                            {battle.title}
                        </h1>


                        {battle.description && (
                            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#756e80]">
                                {battle.description}
                            </p>
                        )}

                    </div>


                    {/* =================================================
              BATTLE CARD
          ================================================= */}

                    <div className="mx-auto mt-10 max-w-5xl rounded-[2rem] border border-white/90 bg-white/90 p-6 shadow-[0_30px_90px_rgba(55,35,100,0.15)] backdrop-blur-xl sm:p-10">


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
                                onVote={handleVote}
                            />


                            {/* VS */}

                            <div className="flex items-center justify-center">

                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-500 text-xs font-black text-white shadow-lg shadow-purple-200">
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
                                onVote={handleVote}
                            />

                        </div>


                        {/* =================================================
                VOTING MESSAGE
            ================================================= */}

                        <div className="mt-8 border-t border-purple-100 pt-7 text-center">


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


                            <div className="inline-flex items-center gap-2 rounded-full bg-[#f8f6fb] px-5 py-2.5 text-xs font-bold text-[#81798e]">

                                <FanWarsMark className="h-4 w-4 text-purple-600" />

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

            <footer className="border-t border-purple-100/70 bg-white">

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

function Header() {

    return (
        <header className="sticky top-0 z-50 border-b border-purple-100/60 bg-white/90 backdrop-blur-xl">

            <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">

                <FanWarsLogo />

                <nav className="hidden items-center gap-8 text-sm font-bold text-[#676174] md:flex">

                    <Link
                        href="/home"
                        className="transition hover:text-purple-600"
                    >
                        Home
                    </Link>

                    <Link
                        href="/tribes"
                        className="transition hover:text-purple-600"
                    >
                        Tribes
                    </Link>

                </nav>


                <Link
                    href="/home"
                    className="rounded-full border border-purple-100 bg-white px-4 py-2 text-xs font-extrabold shadow-sm"
                >
                    My FanWars
                </Link>

            </div>

        </header>
    );
}


/* =========================================================
   BATTLE SIDE
   ========================================================= */

function BattleSide({
    option,
    result,
    totalVotes,
    myVote,
    voting,
    onVote,
}: {
    option: BattleOption;
    result?: BattleResult;
    totalVotes: number;
    myVote: number | null;
    voting: boolean;
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
                ? "border-purple-300 bg-purple-50/70 shadow-md"
                : "border-purple-100/70 bg-[#fcfbff]"
                }`}
        >


            {/* =================================================
          LOGO
      ================================================= */}

            <div className="flex h-28 items-center justify-center">

                {getTribeLogo(option.name)}

            </div>


            {/* =================================================
          NAME
      ================================================= */}

            <h2 className="mt-4 text-center text-2xl font-black tracking-[-0.035em]">
                {option.name}
            </h2>


            {/* =================================================
          VOTE / LOCKED STATE
      ================================================= */}

            {myVote === null ? (

                <button
                    type="button"
                    onClick={() => onVote(option.id)}
                    disabled={voting}
                    className="mt-7 w-full rounded-full bg-[#171525] px-5 py-4 text-sm font-extrabold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >

                    {voting
                        ? "Recording..."
                        : `Choose ${option.name}`}

                </button>

            ) : (

                <div
                    className={`mt-7 w-full rounded-full px-5 py-4 text-center text-sm font-extrabold ${selected
                        ? "bg-purple-600 text-white"
                        : "bg-purple-50 text-purple-700"
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


                    {myVote !== null && (
                        <span className="text-sm font-black text-purple-700">
                            {percentage}%
                        </span>
                    )}

                </div>


                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-purple-100">

                    {myVote !== null && (
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-700"
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

function getTribeLogo(
    name: string
) {

    switch (name) {

        case "Chai Gang":
            return <ChaiGangLogo />;

        case "Coffee Crew":
            return <CoffeeCrewLogo />;

        case "Cricket Nation":
            return <CricketLogo />;

        case "Football Tribe":
            return <FootballLogo />;

        case "Biryani Believers":
            return <BiryaniLogo />;

        case "Pizza People":
            return <PizzaLogo />;

        case "Marvel Universe":
            return <MarvelLogo />;

        case "DC Universe":
            return <DCLogo />;

        case "Beach Tribe":
            return <BeachLogo />;

        default:
            return <DefaultTribeLogo />;
    }
}


/* =========================================================
   CHAI GANG LOGO
   ========================================================= */

function ChaiGangLogo() {

    return (
        <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#fff4e8] shadow-sm">

            <svg
                viewBox="0 0 80 80"
                className="h-20 w-20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >

                <ellipse
                    cx="40"
                    cy="61"
                    rx="22"
                    ry="5"
                    fill="#D7B99A"
                />

                <path
                    d="M23 35H57V51C57 57.627 51.627 63 45 63H35C28.373 63 23 57.627 23 51V35Z"
                    fill="#FFFDF9"
                    stroke="#2C2533"
                    strokeWidth="2.5"
                />

                <ellipse
                    cx="40"
                    cy="35"
                    rx="17"
                    ry="6"
                    fill="#F6EEE6"
                    stroke="#2C2533"
                    strokeWidth="2.5"
                />

                <ellipse
                    cx="40"
                    cy="35"
                    rx="12"
                    ry="4"
                    fill="#9B5B32"
                />

                <path
                    d="M57 39C67 37 69 42 66 48C64 52 60 52 56 51"
                    stroke="#2C2533"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />

                <path
                    d="M33 26C29 21 36 19 33 14"
                    stroke="#C08A65"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />

                <path
                    d="M42 26C38 21 45 19 42 14"
                    stroke="#C08A65"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />

                <path
                    d="M51 26C47 21 54 19 51 14"
                    stroke="#C08A65"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />

            </svg>

        </div>
    );
}


/* =========================================================
   COFFEE CREW LOGO
   ========================================================= */

function CoffeeCrewLogo() {

    return (
        <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#f4eee8] shadow-sm">

            <svg
                viewBox="0 0 80 80"
                className="h-20 w-20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >

                <ellipse
                    cx="40"
                    cy="61"
                    rx="23"
                    ry="5"
                    fill="#C8B5A3"
                />

                <path
                    d="M22 35H58V51C58 57.627 52.627 63 46 63H34C27.373 63 22 57.627 22 51V35Z"
                    fill="#FFFDF9"
                    stroke="#2C2533"
                    strokeWidth="2.5"
                />

                <ellipse
                    cx="40"
                    cy="35"
                    rx="18"
                    ry="7"
                    fill="#F1E5DA"
                    stroke="#2C2533"
                    strokeWidth="2.5"
                />

                <ellipse
                    cx="40"
                    cy="35"
                    rx="13"
                    ry="4.5"
                    fill="#68432F"
                />

                <path
                    d="M58 39C68 37 70 42 67 48C65 52 61 52 57 51"
                    stroke="#2C2533"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />

                <path
                    d="M32 26C28 21 35 19 32 14"
                    stroke="#9D8575"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />

                <path
                    d="M41 26C37 21 44 19 41 14"
                    stroke="#9D8575"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />

                <path
                    d="M50 26C46 21 53 19 50 14"
                    stroke="#9D8575"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />

            </svg>

        </div>
    );
}


/* =========================================================
   OTHER TRIBE LOGOS
   ========================================================= */

function CricketLogo() {
    return (
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#edf7ee] text-4xl shadow-sm">
            🏏
        </div>
    );
}


function FootballLogo() {
    return (
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#eef4ff] text-4xl shadow-sm">
            ⚽
        </div>
    );
}


function BiryaniLogo() {
    return (
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#fff4df] text-4xl shadow-sm">
            🍛
        </div>
    );
}


function PizzaLogo() {
    return (
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#fff0ec] text-4xl shadow-sm">
            🍕
        </div>
    );
}


function MarvelLogo() {
    return (
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#f4efff] text-4xl shadow-sm">
            🦸
        </div>
    );
}


function DCLogo() {
    return (
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#edf4ff] text-4xl shadow-sm">
            🦇
        </div>
    );
}


function BeachLogo() {
    return (
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#eef9ff] text-4xl shadow-sm">
            🏖️
        </div>
    );
}


function DefaultTribeLogo() {
    return (
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-purple-50 text-4xl shadow-sm">
            ⚔️
        </div>
    );
}