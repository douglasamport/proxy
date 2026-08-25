import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Welcome message</h1>
      <Link
        href="/games"
        className="rounded-md bg-cyan-500 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400"
      >
        Play games
      </Link>
    </div>
  );
}
