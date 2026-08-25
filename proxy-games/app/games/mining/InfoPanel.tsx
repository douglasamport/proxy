import { CFG } from "./engine";

// The reference panel — how a run works, plus the full terrain/hazard/grade
// key. Split out from FittingPanel so it can take the wide half of the
// fitting-phase layout instead of being squeezed under a narrow control column.
export function InfoPanel({ claim }: { claim: number }) {
  const claimCost = CFG.CLAIM_COST[claim] ?? 0;
  const allInPerUnit = (CFG.LAUNCH_COST + claimCost) / claim;

  return (
    <div className="sect key">
      <div className="lbl">How a run works</div>
      <p>
        You will head out into the field with a limited amount of fuel. Your
        mission is to extract as much ore as you can.
      </p>
      <p>
        <b>Ore is only yours once it&rsquo;s banked.</b> Drive back to BASE to
        unload, then go out again if fuel remains. Run dry in the field and
        everything you&rsquo;re carrying is lost, along with the energy spent
        lifting it.
      </p>
      <h4>Fuel costs</h4>
      <p>
        <b>Turning costs fuel.</b> Straight lines are cheap; weaving is not.
        Steering is what makes weaving affordable.
      </p>
      <p>
        <b>Extracting costs fuel.</b> Make sure you have enough to get back to
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
      <h4>Finding Ore</h4>
      <p>
        <b>Sensors detect metal, not terrain.</b> A ping costs fuel and shows
        ore pockets as fuzzy contacts — mass reads true, position is a guess,
        and grade comes back only as a range. Ping the same pocket again from a
        different angle and the fix tightens. The analyser is what narrows the
        grade estimate.
      </p>
      <p>
        Beyond ping range you get a single <b>bearing</b> to the strongest
        return. Direction only. No distance.
      </p>
      <div className="keyrow">
        <span className="sw con"></span>sensor contact — fuzzy until
        triangulated
      </div>
      <h4>Not all Ore is Equal</h4>
      <p>
        Grade four ore is worth 20x as much as grade 1. Being selective pays
      </p>
      <div className="keyrow">
        <span className="sw t1"></span>grade 1 · {CFG.GRADE_VALUE[1]}/u
      </div>
      <div className="keyrow">
        <span className="sw t2"></span>grade 2 · {CFG.GRADE_VALUE[2]}/u
      </div>
      <div className="keyrow">
        <span className="sw t3"></span>grade 3 · {CFG.GRADE_VALUE[3]}/u
      </div>
      <div className="keyrow">
        <span className="sw t4"></span>grade 4 · {CFG.GRADE_VALUE[4]}/u
      </div>
      <p>
        A <b>survey</b> filed before launch reports on the feild you are about
        to mine. It will provide — how much ore the face holds, roughly how deep
        it sits, how much of it is high grade. It exists so you can decide how
        much to claim for that field, and what to strap on before you go. You
        still fly blind.
      </p>
      <p>
        {" "}
        A <b>claim</b> is decided before you launch and determines how much ore
        you can bring home. It&rsquo;s the number of extractions you can make. In a
        weak field claming 50 extractions is a waste and will just burn fuel to
        complete.
      </p>
      <p>
        Claiming big is cheaper per unit even though it costs more up front —
        launch plus claim together work out to <b>{allInPerUnit.toFixed(1)}</b>{" "}
        a unit at {claim}u. Claiming small is cheap to buy and expensive per
        unit. That&rsquo;s the bet.
      </p>
      <h4>Hazards </h4>

      <p>
        <b>You cannot see the ground.</b> Rock, hard seams, gas and caverns are
        only ever learned by cutting into them, or by standing next to them.
      </p>
      <p>
        <b>Hard seams cannot be dug.</b> Route around them. <b>Gas pockets</b>{" "}
        hit far harder than ordinary ground. <b>Caverns</b> are already open —
        free to enter and cheap to cross, and finding one mid-shaft is the best
        thing that can happen to a run.
      </p>
      <p>
        <b>Hazards</b> bite once, when you first cut the cell, and take sink. At
        zero sink the proxy is wrecked. Rich ore tends to sit near bad ground.
      </p>
      <div className="keyrow">
        <span className="sw rock"></span>unbroken rock
      </div>
      <div className="keyrow">
        <span className="sw tun"></span>tunnel — cheap to re-cross
      </div>
      <div className="keyrow">
        <span className="sw cav"></span>cavern — open ground, free to enter
      </div>
      <div className="keyrow">
        <span className="sw sem"></span>hard seam — cannot be cut
      </div>
      <div className="keyrow">
        <span className="sw haz">3</span>hazard, sink cost on first cut
      </div>
      <div className="keyrow">
        <span className="sw haz gas2">8</span>gas pocket, far worse
      </div>
    </div>
  );
}
