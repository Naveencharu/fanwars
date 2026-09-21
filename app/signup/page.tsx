"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const ref = searchParams.get("ref");
    const redirect = searchParams.get("redirect");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    async function handleSignup(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError("");
        setMessage("");

        if (!email || !password) {
            setError("Please enter your email and password.");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        setLoading(false);

        if (error) {
            setError(error.message);
            return;
        }

        if (data.session) {
            const onboardingUrl = ref
                ? `/onboarding?ref=${encodeURIComponent(ref)}${redirect
                    ? `&redirect=${encodeURIComponent(redirect)}`
                    : ""
                }`
                : redirect
                    ? `/onboarding?redirect=${encodeURIComponent(redirect)}`
                    : "/onboarding";

            router.push(onboardingUrl);
            return;
        }

        setMessage(
            "Account created. Check your email to confirm your account, then log in."
        );
    }

    return (
        <main className="min-h-screen bg-[#faf9ff] text-slate-950">
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
                <Link href="/" className="text-2xl font-black tracking-tight">
                    FAN<span className="text-violet-600">WARS</span>
                </Link>

                <Link
                    href={
                        ref
                            ? `/login?ref=${encodeURIComponent(ref)}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ""
                            }`
                            : "/login"
                    }
                    className="text-sm font-semibold text-slate-600 hover:text-slate-950"
                >
                    Already have an account? Log in
                </Link>
            </nav>

            <section className="flex min-h-[calc(100vh-100px)] items-center justify-center px-6 py-12">
                <div className="w-full max-w-md">
                    <div className="mb-8 text-center">
                        <div className="mb-4 inline-flex rounded-full bg-violet-100 px-4 py-2 text-sm font-bold text-violet-700">
                            🔥 Join the movement
                        </div>

                        <h1 className="text-4xl font-black tracking-tight">
                            Create your FanWars account
                        </h1>

                        <p className="mt-3 text-slate-500">
                            Find your tribe. Take your side. Make your voice count.
                        </p>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                        <form onSubmit={handleSignup} className="space-y-5">
                            <div>
                                <label
                                    htmlFor="email"
                                    className="mb-2 block text-sm font-semibold"
                                >
                                    Email
                                </label>

                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="you@example.com"
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-500 focus:bg-white"
                                    required
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="password"
                                    className="mb-2 block text-sm font-semibold"
                                >
                                    Password
                                </label>

                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    placeholder="At least 6 characters"
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-500 focus:bg-white"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {error}
                                </div>
                            )}

                            {message && (
                                <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
                                    {message}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full rounded-2xl bg-violet-600 px-5 py-3.5 font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? "Creating account..." : "CREATE ACCOUNT →"}
                            </button>
                        </form>

                        <div className="mt-6 text-center text-sm text-slate-500">
                            Already a FanWars member?{" "}
                            <Link
                                href={
                                    ref
                                        ? `/login?ref=${encodeURIComponent(ref)}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ""
                                        }`
                                        : "/login"
                                }
                                className="font-bold text-violet-600 hover:text-violet-500"
                            >
                                Log in
                            </Link>
                        </div>
                    </div>

                    <p className="mt-6 text-center text-xs text-slate-400">
                        By joining FanWars, you agree to our terms and community guidelines.
                    </p>
                </div>
            </section>
        </main>
    );
}