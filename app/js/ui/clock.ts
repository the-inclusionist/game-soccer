// SPDX-License-Identifier: AGPL-3.0-or-later
// TICKS INTO A CLOCK FACE.
//
// ⚠️ FROM TICKS, NEVER FROM A WALL CLOCK. The simulation's time is ticks; reading elapsed milliseconds
// here would create a second notion of how long the match has lasted, and in the assisted mode - where
// the world deliberately receives less wall time per tick - the two would disagree by design.
//
// ⚠️ AND IT DOES NOT WRAP AT AN HOUR. A match clock that returned to zero would be a lie a child could
// see; football counts minutes upward and so does this.

const TICKS_PER_SECOND = 60;

const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));

export function clockText(ticks: number): string {
  const seconds = Math.floor(ticks / TICKS_PER_SECOND);
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}
