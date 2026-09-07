// SPDX-License-Identifier: AGPL-3.0-or-later
// WHICH SHIRT EACH BODY WEARS. One function, so the renderer keeps no table of its own.
//
// ⚠️ A RENDERER WITH ITS OWN KIT COLOURS IS A SECOND SOURCE FOR ONE FACT. It is how a pitch ends up with
// a home side in one colour and its own crest in another, disagreeing from the first time either changes.

import { isKeeper, teamOf, type PlayerId } from '../sim/ids.ts';
import type { Fixture } from './clubs.ts';

export function kitFor(fixture: Fixture, id: PlayerId): number {
  const club = teamOf(id) === 0 ? fixture.home : fixture.away;
  return isKeeper(id) ? club.keeperKit : club.kit;
}
