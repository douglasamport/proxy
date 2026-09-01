import { CFG } from "@/lib/mining-engine";
import { GAME, PALETTE, ATOMS, SURFACE } from "@/lib/mining-theme";
import { Swatch, KeyRow } from "@/components/Swatch";

// The reference panel — how a run works, plus the full terrain/hazard/grade
// key. Split out from FittingPanel so it can take the wide half of the
// fitting-phase layout instead of being squeezed under a narrow control column.
export function InfoPanel({ claim }: { claim: number }) {
  const claimCost = CFG.CLAIM_COST[claim] ?? 0;
  const allInPerUnit = (CFG.LAUNCH_COST + claimCost) / claim;

  return (
    <div className={`rounded-lg ${SURFACE.card} p-5`}>
      <div className={SURFACE.label}>How a run works</div>

      <div className={`mt-3 space-y-3 text-[12px] leading-relaxed ${ATOMS.textDim}`}>
        <p>
          You will head out into the field with a limited amount of fuel. Your
          mission is to extract as much ore as you can.
        </p>
        <p>
          <b className={ATOMS.textPrimary}>Ore is only yours once it&rsquo;s banked.</b> Drive back to BASE to
          unload, then go out again if fuel remains. Run dry in the field and
          everything you&rsquo;re carrying is lost, along with the energy spent
          lifting it.
        </p>

        <h4 className={`pt-1 text-[10px] font-bold uppercase tracking-wider ${ATOMS.textPrimary}`}>Fuel costs</h4>
        <p>
          <b className={ATOMS.textPrimary}>Turning costs fuel.</b> Straight lines are cheap; weaving is not.
          Steering is what makes weaving affordable.
        </p>
        <p>
          <b className={ATOMS.textPrimary}>Extracting costs fuel.</b> Make sure you have enough to get back to
          base.
        </p>
        <p>Drilling new tunnels cost more than driving through old ones.</p>
        <p>
          Cutting fresh rock costs full price plus a dig surcharge. Re-crossing a
          tunnel you already cut costs {Math.round(CFG.TUNNEL_MULT * 100)}% — so
          early trips pay for later ones, and the network compounds all day.
        </p>
        <p>
          Your hold only carries so much per trip, so you&rsquo;ll drive back to
          base to unload and head out again — <i>on the same tank</i>. Those
          return trips are what tunnels pay for.
        </p>

        <h4 className={`pt-1 text-[10px] font-bold uppercase tracking-wider ${ATOMS.textPrimary}`}>Finding ore</h4>
        <p>
          <b className={ATOMS.textPrimary}>Sensors detect metal, not terrain.</b> A ping costs fuel and shows
          ore pockets as fuzzy contacts — mass reads true, position is a guess,
          and grade comes back only as a range. Ping the same pocket again from a
          different angle and the fix tightens. The analyser is what narrows the
          grade estimate.
        </p>
        <p>
          Beyond ping range you get a single <b className={ATOMS.textPrimary}>bearing</b> to the strongest
          return. Direction only. No distance.
        </p>
        <KeyRow>
          <Swatch bg="rgba(84,198,220,.2)" border="rgba(84,198,220,.6)" />
          sensor contact — fuzzy until triangulated
        </KeyRow>

        <h4 className={`pt-1 text-[10px] font-bold uppercase tracking-wider ${ATOMS.textPrimary}`}>Not all ore is equal</h4>
        <p>Grade four ore is worth 20x as much as grade 1. Being selective pays.</p>
        <KeyRow><Swatch bg={GAME.grade[1] ?? PALETTE.grade1} />grade 1 · {CFG.GRADE_VALUE[1]}/u</KeyRow>
        <KeyRow><Swatch bg={GAME.grade[2] ?? PALETTE.grade2} />grade 2 · {CFG.GRADE_VALUE[2]}/u</KeyRow>
        <KeyRow><Swatch bg={GAME.grade[3] ?? PALETTE.grade3} />grade 3 · {CFG.GRADE_VALUE[3]}/u</KeyRow>
        <KeyRow><Swatch bg={GAME.grade[4] ?? PALETTE.grade4} />grade 4 · {CFG.GRADE_VALUE[4]}/u</KeyRow>

        <p>
          A <b className={ATOMS.textPrimary}>survey</b> filed before launch reports on the feild you are about
          to mine. It will provide — how much ore the face holds, roughly how deep
          it sits, how much of it is high grade. It exists so you can decide how
          much to claim for that field, and what to strap on before you go. You
          still fly blind.
        </p>
        <p>
          A <b className={ATOMS.textPrimary}>claim</b> is decided before you launch and determines how much ore
          you can bring home. It&rsquo;s the number of extractions you can make. In a
          weak field claming 50 extractions is a waste and will just burn fuel to
          complete.
        </p>
        <p>
          Claiming big is cheaper per unit even though it costs more up front —
          launch plus claim together work out to <b className={ATOMS.textPrimary}>{allInPerUnit.toFixed(1)}</b>{" "}
          a unit at {claim}u. Claiming small is cheap to buy and expensive per
          unit. That&rsquo;s the bet.
        </p>

        <h4 className={`pt-1 text-[10px] font-bold uppercase tracking-wider ${ATOMS.textPrimary}`}>Hazards</h4>
        <p>
          <b className={ATOMS.textPrimary}>You cannot see the ground.</b> Rock, hard seams, gas and caverns are
          only ever learned by cutting into them, or by standing next to them.
        </p>
        <p>
          <b className={ATOMS.textPrimary}>Hard seams cannot be dug.</b> Route around them. <b className={ATOMS.textPrimary}>Gas pockets</b>{" "}
          hit far harder than ordinary ground. <b className={ATOMS.textPrimary}>Caverns</b> are already open —
          free to enter and cheap to cross, and finding one mid-shaft is the best
          thing that can happen to a run.
        </p>
        <p>
          <b className={ATOMS.textPrimary}>Hazards</b> bite once, when you first cut the cell, and take sink. At
          zero sink the proxy is wrecked. Rich ore tends to sit near bad ground.
        </p>
        <KeyRow><Swatch bg={PALETTE.panel} border={PALETTE.line} />unbroken rock</KeyRow>
        <KeyRow><Swatch bg={GAME.tunnel} border={GAME.tunnelEdge} />tunnel — cheap to re-cross</KeyRow>
        <KeyRow><Swatch bg={GAME.cavern} border={GAME.cavernEdge} />cavern — open ground, free to enter</KeyRow>
        <KeyRow><Swatch bg={GAME.seam} border={GAME.seamEdge} />hard seam — cannot be cut</KeyRow>
        <KeyRow><Swatch bg={PALETTE.panel} border={PALETTE.line} color={PALETTE.danger} glyph="3" />hazard, sink cost on first cut</KeyRow>
        <KeyRow><Swatch bg={PALETTE.panel} border={PALETTE.line} color={PALETTE.gas} glyph="8" />gas pocket, far worse</KeyRow>
      </div>
    </div>
  );
}
