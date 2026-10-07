import { redirect } from "next/navigation";
import { currentPlayer } from "@/lib/auth";
import { getCharacter } from "@/lib/characters";
import { getEnergy } from "@/lib/energy";
import CharacterCreateForm from "./CharacterCreateForm";

// Placeholder system messages until there's a real news source.
const NEWS = [
  { title: "Welcome to Proxy Games", body: "Placeholder system message." },
  { title: "Patch notes", body: "Placeholder — what changed this week." },
  { title: "Maintenance", body: "Placeholder — scheduled downtime goes here." },
];

// Homepage body. Three states: signed out -> /login, signed in with no
// character yet -> creation form, otherwise the character homepage.
export default async function Welcome() {
  const player = await currentPlayer();
  if (!player) redirect("/login");

  const character = await getCharacter(player.id);

  if (!character?.setup_complete) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
        <h1 className="text-3xl font-bold">Create your character</h1>
        <p className="text-slate-400">
          Choose a name. You can&apos;t change it later (placeholder copy).
        </p>
        <CharacterCreateForm />
      </div>
    );
  }

  const energy = await getEnergy(character.id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h1 className="text-2xl font-bold">{character.name}</h1>
        <dl className="mt-3 grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">Balance</dt>
            <dd className="font-mono text-cyan-400">${player.balance}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Energy</dt>
            <dd className="font-mono text-cyan-400">
              {Math.floor(energy.current)} / {Math.floor(energy.cap)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Created</dt>
            <dd>{new Date(character.created_at).toLocaleDateString()}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">System news</h2>
        <ul className="space-y-3">
          {NEWS.map((n) => (
            <li
              key={n.title}
              className="rounded-lg border border-slate-800 bg-slate-900 p-4"
            >
              <div className="font-semibold">{n.title}</div>
              <p className="text-sm text-slate-400">{n.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
