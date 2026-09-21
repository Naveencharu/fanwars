"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function OnboardingPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const ref = searchParams.get("ref");
    const [username, setUsername] = useState("");
    const [handler, setHandler] = useState("");
    const [displayName, setDisplayName] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        async function checkUser() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.replace("/login");
                return;
            }

            setLoading(false);
        }

        checkUser();
    }, [router]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError("");

        const cleanUsername = username.trim();
        const cleanHandler = handler.trim().replace(/^@/, "").toLowerCase();
        const cleanDisplayName = displayName.trim();

        if (cleanUsername.length < 3) {
            setError("Username must be at least 3 characters.");
            return;
        }

        if (cleanHandler.length < 3) {
            setError("Handler must be at least 3 characters.");
            return;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(cleanHandler)) {
            setError(
                "Handler can contain only letters, numbers, underscores and hyphens."
            );
            return;
        }

        if (!cleanDisplayName) {
            setError("Please enter your display name.");
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

        const { error: profileError } = await supabase
            .from("profiles")
            .insert({
                id: user.id,
                username: cleanUsername,
                handler: cleanHandler,
                display_name: cleanDisplayName,
            });

        setSaving(false);

        if (profileError) {
            if (profileError.code === "23505") {
                setError(
                    "That username or handler is already taken. Please choose another."
                );
            } else {
                setError(profileError.message);
            }

            return;
        }

        if (ref) {
            const { error: referralError } = await supabase.rpc(
                "claim_referral",
                {
                    p_referral_handler: ref,
                    p_source_type: "onboarding",
                    p_source_id: null,
                }
            );

            if (referralError) {
                console.error("Referral attribution failed:", referralError);
                setError(`Referral attribution failed: ${referralError.message}`);
                setSaving(false);
                return;
            }
        }

        router.push("/tribes");
    };


    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#faf9ff]">
                <div className="text-sm font-semibold text-slate-500">
                    Loading your FanWars identity...
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#faf9ff] text-slate-950">
            <section className="flex min-h-screen items-center justify-center px-6 py-12">
                <div className="w-full max-w-lg">
                    <div className="mb-8 text-center">
                        <div className="mb-4 inline-flex rounded-full bg-violet-100 px-4 py-2 text-sm font-bold text-violet-700">
                            ⚔️ Step 1 of 2
                        </div>

                        <h1 className="text-4xl font-black tracking-tight">
                            Create your Fan Identity
                        </h1>

                        <p className="mt-3 text-slate-500">
                            This is how the FanWars community will know you.
                        </p>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label
                                    htmlFor="username"
                                    className="mb-2 block text-sm font-semibold"
                                >
                                    Username
                                </label>

                                <input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(event) => setUsername(event.target.value)}
                                    placeholder="NaveenC"
                                    maxLength={30}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-500 focus:bg-white"
                                    required
                                />

                                <p className="mt-2 text-xs text-slate-400">
                                    Your unique FanWars username.
                                </p>
                            </div>

                            <div>
                                <label
                                    htmlFor="handler"
                                    className="mb-2 block text-sm font-semibold"
                                >
                                    FanWars Handler
                                </label>

                                <div className="flex overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 focus-within:border-violet-500 focus-within:bg-white">
                                    <span className="flex items-center pl-4 text-slate-400">
                                        @
                                    </span>

                                    <input
                                        id="handler"
                                        type="text"
                                        value={handler}
                                        onChange={(event) =>
                                            setHandler(event.target.value.replace(/^@/, ""))
                                        }
                                        placeholder="naveen"
                                        maxLength={30}
                                        className="w-full bg-transparent px-2 py-3 outline-none"
                                        required
                                    />
                                </div>

                                <p className="mt-2 text-xs text-slate-400">
                                    Your public @handle. It must be unique.
                                </p>
                            </div>

                            <div>
                                <label
                                    htmlFor="displayName"
                                    className="mb-2 block text-sm font-semibold"
                                >
                                    Display Name
                                </label>

                                <input
                                    id="displayName"
                                    type="text"
                                    value={displayName}
                                    onChange={(event) => setDisplayName(event.target.value)}
                                    placeholder="Naveen Charugundla"
                                    maxLength={60}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-500 focus:bg-white"
                                    required
                                />

                                <p className="mt-2 text-xs text-slate-400">
                                    The name people will see on your FanPage.
                                </p>
                            </div>

                            {error && (
                                <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full rounded-2xl bg-violet-600 px-5 py-3.5 font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saving ? "Creating your identity..." : "CONTINUE →"}
                            </button>
                        </form>
                    </div>

                    <div className="mt-6 flex justify-center gap-2">
                        <div className="h-2 w-10 rounded-full bg-violet-600" />
                        <div className="h-2 w-10 rounded-full bg-slate-200" />
                    </div>
                </div>
            </section>
        </main>
    );
}