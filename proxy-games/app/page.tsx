import Link from "next/link";
import {
  welcomeHeader,
  welcomeMessage,
  whatThisIs,
  whatThisIsHeader,
} from "@/public/copy";

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-24 text-center">
      <h1
        className="text-4xl font-bold tracking-tight"
        style={{ whiteSpace: "pre-line" }}
      >
        {welcomeHeader}
      </h1>
      {/* <p className="text-left whitespace-pre-wrap break-words max-w-xl">
        {welcomeMessage}
      </p> */}
      <Link
        href="/games"
        className="rounded-md bg-cyan-500 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400"
      >
        Play games
      </Link>
      <h4>{whatThisIsHeader}</h4>
      <p className="text-left whitespace-pre-wrap break-words max-w-xl">
        {whatThisIs}
      </p>
    </div>
  );
}
