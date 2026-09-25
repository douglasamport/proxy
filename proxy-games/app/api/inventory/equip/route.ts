import { NextRequest, NextResponse } from 'next/server';
import { currentPlayer } from '@/lib/auth';
import { clearSlot, installInSlot } from '@/lib/mining-inventory';

// POST { slot_id, item_key } -> { ok: true } | error
// item_key omitted/null clears the slot. One slot, one action — replaces
// the old "set equipped count for this item" contract now that equip
// state is real chassis_slots rows, not a quantity (see lib/mining-
// inventory.ts and db/020_chassis_slots.sql). Validates ownership, slot
// type, and slot ownership server-side; never trusts the client's own
// idea of what it can afford to install.
export async function POST(req: NextRequest) {
  const player = await currentPlayer({ touch: false });
  if (!player) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const slotId = body.slot_id;
  const itemKey = body.item_key;

  if (typeof slotId !== 'string' || !slotId) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const result =
    itemKey == null
      ? await clearSlot(player.id, slotId)
      : typeof itemKey === 'string' && itemKey
        ? await installInSlot(player.id, slotId, itemKey)
        : ('invalid' as const);

  if (result === 'invalid') return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  if (result === 'slot_not_found') return NextResponse.json({ error: 'slot not found' }, { status: 404 });
  if (result === 'wrong_slot_type') return NextResponse.json({ error: 'item does not fit this slot' }, { status: 400 });
  if (result === 'not_owned') return NextResponse.json({ error: 'not enough owned' }, { status: 400 });

  return NextResponse.json({ ok: true });
}
