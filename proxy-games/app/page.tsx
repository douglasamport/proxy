import Link from "next/link";

export default function GamesPage() {
  return (
    <div className="welcome-container">
      <h1> Welcome message</h1>
      <Link href={"/games"}>Play games</Link>
    </div>
  );
}
