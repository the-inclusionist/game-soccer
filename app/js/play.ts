// SPDX-License-Identifier: AGPL-3.0-or-later
// ONE TICK OF A MATCH. The seam between a simulation that knows no rules and a referee that moves nothing.
//
// ========================= WHY THE SEAM IS HERE AND NOT INSIDE `step` =========================
// `sim/step` integrates bodies and a ball and has no opinion about football. `rules/referee` reads a world
// and returns verdicts, and moves nothing. Neither knows about the other, which is what lets the referee
// be tested on hand-placed positions and the simulation be tested with no laws at all. This file is the
// only place that knows both, and it is twenty lines because that is all the seam is.
//
// ========================= THE ORDER, AND IT IS THE CONTRACT =========================
// move -> judge -> apply -> place. The restart is placed on the SAME tick the rule fires: otherwise there
// is one tick in which the phase says `throwIn` while the ball is still lying outside the pitch, and
// every consumer reading both would describe a world that is internally inconsistent.

import { evaluate, applyEvents, defenderOf } from './rules/referee.ts';
import { applyRestart, holdTheLine } from './rules/restart.ts';
import { judgeTackle, type Foul } from './rules/foul.ts';
import { judgeOffside, markOffside } from './rules/offside.ts';
import { book, cardFor, RED } from './rules/cards.ts';
import type { RuleEvent } from './rules/events.ts';
import { PHASES } from './rules/phase.ts';
import type { RulesProfile } from './rules/profile.ts';
import type { TickFrame } from './sim/command.ts';
import { SQUAD_SIZE, firstOf, teamOf, type TeamId } from './sim/ids.ts';
import { NOBODY } from './sim/possession.ts';
import { onPitch } from './sim/squads.ts';
import type { MatchState } from './sim/state.ts';
import { step } from './sim/step.ts';
import { applyStrike, strikeFor } from './sim/strike.ts';
import { nextControlled } from './sim/switching.ts';
import { challenger, decideKick, steerAll, think, type Skills } from './ai/brain.ts';
import { AVERAGE, capsBySide } from './ai/ratings.ts';
import { PITCH } from './sim/units.ts';

/**
 * A judged foul, as the event the rest of the game already knows how to read.
 *
 * ⚠️ `team` IS THE SIDE THAT WAS FOULED, not the offender. `rules/events` says the field is the side an
 * event is ABOUT, and it is what decides who takes the restart - about the offender, the kick would go to
 * the side that committed it.
 *
 * ⚠️ AND THE CARD IS APPLIED HERE rather than in `applyEvents`, because it is a fact about a PLAYER and
 * the event carries a team. Putting a player id on the event only for this would widen the type every
 * other consumer reads for the one that needs it.
 */
function foulEvents(state: MatchState, foul: Foul): RuleEvent[] {
  const offender = teamOf(foul.by);
  const fouled = (offender === 0 ? 1 : 0) as TeamId;

  const out: RuleEvent[] = [
    { kind: foul.inBox ? 'penaltyGiven' : 'foulGiven', team: fouled, at: foul.at },
  ];

  // ⚠️ THE WHISTLE FIRST AND THE CARD SECOND, because that is the order it happens in and therefore the
  //    order a child hears it. Reversed, she is told somebody was sent off before she is told there was a
  //    foul at all.
  const before = state.cards[foul.by] ?? 0;
  book(state, foul.by, cardFor(foul.severity));
  const after = state.cards[foul.by] ?? 0;

  // ⚠️ AND THE CARD NAMES THE OFFENDER'S SIDE - the OPPOSITE of the event above it. A kick is FOR
  //    somebody; a card is AGAINST somebody. Each event carries the side its own sentence needs, so
  //    neither reader has to remember which way round it goes.
  //
  // ⚠️ COMPARED BEFORE AND AFTER rather than derived from the severity, because a second booking is a
  //    RED: severity says 'reckless' and what actually happened was a sending-off. Asking the state what
  //    changed is the only version that gets that case right.
  if (after > before) {
    out.push({ kind: after >= RED ? 'sendingOff' : 'bookingGiven', team: offender, at: foul.at });
  }
  return out;
}


/**
 * What each side's bodies are capable of, from their clubs.
 *
 * ⚠️ A MATCH WITH NO CLUBS IS A MATCH OF AVERAGE SIDES, not a match of nobody. Every gate that drives the
 * simulation without skills - and most of them do - would otherwise get a different world from the one the
 * game runs, and the difference would surface as a golden replay that quietly stopped matching.
 */
function capsOf(skills: Skills | undefined) {
  return capsBySide(skills?.[0] ?? AVERAGE, skills?.[1] ?? AVERAGE);
}

/**
 * One body's top speed, which is the scale a challenge by him is judged against.
 *
 * ⚠️ THE REFEREE NEEDS IT AND `rules/` MUST NOT LEARN ABOUT CLUBS, so the seam looks it up - the same
 * division of labour `sim/step` gets its caps by. `rules/foul` receives a number and never finds out that
 * there are six ratings behind it.
 */
function topOf(who: number, skills: Skills | undefined): number {
  return capsOf(skills)[teamOf(who)].body.maxSpeed;
}

/**
 * Phases in which the match is not being played at all.
 *
 * ⚠️ `fullTime` WAS MISSING AND THE WORLD KEPT RUNNING. The referee stops speaking once the phase leaves
 * `live`, so after the final whistle twenty-two bodies went on chasing a ball under no laws at all - the
 * clock counting, the AI deciding, nothing able to happen. A match that does not stop is not a match with
 * a quiet ending; it is a match with no ending.
 */
const OVER: ReadonlySet<string> = new Set(['preMatch', 'fullTime']);

/**
 * Phases in which the ball is on its spot and nothing happens until somebody takes it.
 *
 * ⚠️ DERIVED, AND IT USED TO BE A LIST WRITTEN BY HAND. That list said `throwIn, corner, goalKick,
 * freeKick, goal, halfTime, kickoff` - and `penalty`, the newest phase, was never added to it. So a
 * penalty fell through this seam into the LIVE path: the ball was placed on the spot and then the world
 * went on running under a referee who only speaks while the phase is `live`. Measured - the ball ended up
 * at x = 95.9 on a ninety-metre pitch, two bodies pinned against the goal line chasing it, and the match
 * never reached full time.
 *
 * ⚠️ AND THE SAFE DEFAULT IS STOPPED, which is why this is a subtraction and not an addition. A phase
 * nobody taught the seam about should freeze the world, not let it run lawless: the failure is then a
 * match that visibly waits, which somebody notices in the first minute, instead of a match that quietly
 * stops being football.
 */
const STOPPED: ReadonlySet<string> = new Set(
  PHASES.filter((phase) => phase !== 'live' && !OVER.has(phase)),
);

/** Who takes the restart this event awards. `-1` when the event awards none. */
function takerFor(event: RuleEvent, state: MatchState): TeamId | -1 {
  const end = (event.at?.x ?? 0) > PITCH.length / 2 ? 1 : 0;

  switch (event.kind) {
    case 'crossedTouchline': {
      // ⚠️ THE SIDE THAT DID NOT PUT IT OUT, and `lastTouch` is the only thing that knows. With nobody
      //    having touched it - the very first ball of a match - the throw goes home, which is arbitrary
      //    and written down rather than left to whatever `teamOf(-1)` happens to return.
      const toucher = state.possession.lastTouch;
      if (toucher === NOBODY) return 0;
      return (1 - teamOf(toucher)) as TeamId;
    }
    case 'crossedGoalLineByDefender':
      return (1 - defenderOf(end, state.period)) as TeamId;
    case 'crossedGoalLineByAttacker':
      return defenderOf(end, state.period);
    case 'offsideGiven':
      return (1 - (event.team ?? 0)) as TeamId;

    // ⚠️ READ STRAIGHT OFF THE EVENT, and NOT flipped like offside. An offside is given AGAINST the
    //    side named on it; a foul is given TO the side named on it, because `foulEvent` puts the fouled
    //    side there. Two events, two readings, and the difference is on the event rather than in a rule
    //    somebody has to remember.
    case 'foulGiven':
    case 'penaltyGiven':
      return (event.team ?? 0) as TeamId;
    case 'goalScored':
      // The side that conceded kicks off.
      return (1 - (event.team ?? 0)) as TeamId;

    // ⚠️ WITHOUT THIS THE MATCH STOPPED AT HALF TIME AND NEVER STARTED AGAIN. `periodExpired` fell to the
    //    default below, so no taker was named, `applyRestart` was never called, the ball was never put on
    //    the centre spot and nobody could touch it - and `halfTime` has exactly one way out, which is
    //    somebody taking the restart. Measured at sixty-two thousand ticks of a stopped match.
    //
    //    It took a WHOLE MATCH to find. Every other gate runs a few thousand ticks and half time is
    //    eighteen thousand in, so nothing had ever reached it.
    //
    //    The away side kicks off the second half, because the home side kicked off the first.
    case 'periodExpired':
      return 1 as TeamId;

    default:
      return -1;
  }
}

/**
 * Advance the match by one tick.
 *
 * Returns what the referee said, for the four consumers that need it: the narration, the sound layer, the
 * announcement channel and any test. The phase and the score have already been applied.
 */
export function playTick(
  state: MatchState,
  frame: TickFrame,
  dt: number,
  profile: RulesProfile,
  skills?: Skills,
): RuleEvent[] {
  if (OVER.has(state.phase)) return [];
  if (STOPPED.has(state.phase)) return awaitingRestart(state, frame, dt, profile, skills);

  // ⚠️ THINK, THEN MOVE, THEN STRIKE. The order is the contract: a kick decided BEFORE the bodies move
  //    would be aimed from where everybody used to be, and at 60Hz that is a metre of lie per tick.
  if (skills !== undefined) think(state, skills, profile.playable);

  step(state, frame, dt, steerAll(state), true, capsOf(skills));

  // ⚠️ JUDGED HERE, BETWEEN THE MOVE AND THE NEXT KICK, and the position in the tick is the rule. `step`
  //    is where a touch happens, so this is the first instant the flag can be read - and it has to be read
  //    BEFORE anybody plays the ball again, because the next kick overwrites the very fact it asks about.
  const flag = judgeOffside(state, profile);

  // ⚠️ A CHILD'S VERB BEATS THE AI'S, and the order is how that is enforced rather than hoped for. If the
  //    AI struck first, a seat's shot would be silently discarded on exactly the ticks where the two
  //    disagree - which is every tick that matters.
  // ⚠️ SWITCHING IS APPLIED BEFORE THE STRIKES, so a seat that switched and shot on the same tick shoots
  //    with the body it just took. The other order would fire the old body's shot and then hand her a new
  //    one, which is the single most confusing thing a control can do.
  for (const cmd of frame.cmds) {
    if (cmd.verb !== 'switch') continue;
    const next = nextControlled(state, cmd.seat);
    if (next !== null) state.controlled[cmd.seat] = next;
  }

  let struck = false;
  const fouls: RuleEvent[] = [];
  for (const cmd of frame.cmds) {
    const strike = strikeFor(state, cmd, state.controlled[cmd.seat]);
    if (strike === null) {
      // ⚠️ THIS BRANCH USED TO BE `continue`, AND THAT WAS THE WHOLE HOLE. A tackle out of reach of the
      //    ball produced nothing: the lunge cost the child nothing at all. A foul is not a fact about the
      //    world - the same two bodies in the same two places are a foul if she lunged and nothing if she
      //    did not - so `evaluate`, which reads the world a tick later, could never have found it. It is
      //    judged HERE, where the act is, and joins the referee's list as an event like any other.
      if (cmd.verb === 'tackle') {
        const who = state.controlled[cmd.seat];
        const foul = who === undefined ? null : judgeTackle(state, who, profile, topOf(who, skills));
        if (foul !== null) fouls.push(...foulEvents(state, foul));
      }
      continue;
    }
    applyStrike(state, strike);
    // ⚠️ EVERY KICK ARMS THE SNAPSHOT, not only a pass. A shot that rebounds to a team-mate who was behind
    //    the defence is offside exactly as a pass to him would be, and asking the verb here would make the
    //    law depend on what the child MEANT rather than on where the ball went.
    markOffside(state, strike.id, profile);
    state.lastStruck = strike.id;
    struck = true;
    break; // one ball
  }

  // ⚠️ AND THE MACHINE IS JUDGED BY THE SAME FUNCTION. Until this ran, a foul was only ever judged for
  //    a command from a SEAT - so a child could be booked and sent off, and the eleven players she was
  //    playing against could not. A law that applies to one side of the pitch, and the side it applied to
  //    was hers.
  if (skills !== undefined) {
    for (const team of [0, 1] as const) {
      const who = challenger(state, team, capsOf(skills)[team].body.maxSpeed);
      if (who === null) continue;
      const foul = judgeTackle(state, who, profile, topOf(who, skills));
      if (foul !== null) fouls.push(...foulEvents(state, foul));
    }
  }

  if (skills !== undefined && !struck) {
    const kick = decideKick(state, profile.playable, skills);
    if (kick !== null) {
      state.ball.v = { x: kick.vx, y: kick.vy, z: kick.vz };
      state.ball.grounded = false;
      state.possession.holder = NOBODY;
      state.possession.lastTouch = kick.id;
      markOffside(state, kick.id, profile);
      state.lastStruck = kick.id;
    }
  }

  // The foul comes FIRST: it stopped play, so nothing the referee would have said about the world after
  // it is true any more - a ball that went out on the same tick went out after the whistle.
  //
  // ⚠️ AND THE FLAG COMES BEFORE BOTH, for the same reason one step further back: it was raised at the
  //    touch, which happened before either the lunge or anything the ball did afterwards.
  const events = flag !== null ? [flag] : fouls.length > 0 ? fouls : evaluate(state, profile);
  if (events.length === 0) return events;

  applyEvents(state, events, profile);

  for (const event of events) {
    const taker = takerFor(event, state);
    if (taker === -1) continue;
    state.restartTaker = taker;
    // The passage of play is over, so the snapshot is too. Left armed, it would go up at the first touch
    // after the restart - an offence belonging to a passage of play that ended before it.
    state.offsidePasser = NOBODY;
    state.offsideMask = 0;
    applyRestart(state, event);
    break; // one ball, one placement: a tick that is both a throw-in and half time restarts once
  }

  return events;
}

/**
 * Play is stopped. The ball is already on its spot; nothing moves until the taker touches it.
 *
 * ⚠️ AND THAT WAIT IS THE ACCESSIBILITY AFFORDANCE, not a missing feature. A dead ball gives a child
 * using switch scanning all the time in the world to decide, which is WCAG 2.2.1 met by the shape of the
 * game rather than by a setting somebody has to find in a menu.
 */
function awaitingRestart(
  state: MatchState,
  frame: TickFrame,
  dt: number,
  profile: RulesProfile,
  skills?: Skills,
): RuleEvent[] {
  // ⚠️ THE BODIES STILL MOVE, AND THAT WAS A DEADLOCK BEFORE THEY DID. With play stopped nothing ran at
  //    all, so nobody ever walked to the spot, so the restart was never taken - a goal was scored and the
  //    match sat on the celebration for the remaining ninety seconds. Football does the same thing: at a
  //    dead ball the ball waits and the players reposition.
  if (skills !== undefined) {
    think(state, skills, profile.playable);
    step(state, frame, dt, steerAll(state), false, capsOf(skills));
  }

  // `restartTaker` is stored as a plain number because `-1` means nobody. Narrowing it once here means
  // every use below is a `TeamId` and no consumer needs a cast of its own.
  const taker = state.restartTaker as TeamId | -1;
  if (taker === -1) return [];

  // The ten yards are held until it is taken, not only when the ball is put down. See `holdTheLine`.
  holdTheLine(state, taker);

  // ⚠️ IT USED TO ASK WHETHER THE GLOBALLY NEAREST PLAYER WAS ON THE TAKING SIDE, and that hands any
  //    opponent a veto: stand on the ball and the match never restarts. Measured across six whole
  //    fixtures - one of them ran out of ticks stopped at a throw-in, with the side owed it reduced to two
  //    men, and everything after that minute simply never happened.
  //
  //    The rule football uses is the other one: a restart is taken when somebody FROM THE TAKING SIDE
  //    reaches the ball. Whoever else is standing there is not taking it, and their being there is not a
  //    reason for the match to stop.
  const near = nearestOfTeamToBall(state, taker);
  if (near === NOBODY) return [];
  const dx = state.players[near].p.x - state.ball.p.x;
  const dy = state.players[near].p.y - state.ball.p.y;
  if (dx * dx + dy * dy > TAKE_RADIUS * TAKE_RADIUS) return [];

  // ⚠️ A KICKOFF ANSWERS A DIFFERENT EVENT FROM EVERY OTHER RESTART, and missing that wedged the match:
  //    after a goal the phase walked `goal -> kickoff` on `restartTaken`, and then sat there forever
  //    because `kickoff` only leaves on `ballMoved`. One restart, two names, and the phase table is where
  //    that fact lives rather than in anybody's head.
  const kind = state.phase === 'kickoff' ? 'ballMoved' : 'restartTaken';
  const events: RuleEvent[] = [{ kind, team: taker }];
  applyEvents(state, events, profile);
  state.possession.lastTouch = near;
  playItIn(state, taker);

  // The owner survives a `goal -> kickoff` step, because the side that conceded is also the side that
  // kicks off. It is released only when the ball is actually in play again.
  if (state.phase === 'live') state.restartTaker = -1;
  return events;
}

/**
 * Metres per second. How hard a restart is put back into play.
 *
 * A throw or a short free kick, not a clearance: enough to reach a team-mate a few metres away and to be
 * unmistakably back in the game, and gentle enough that the taker himself can run onto it.
 */
const TAKEN_SPEED = 12;

/**
 * Play the ball INTO the pitch, which is the whole of what taking a restart is.
 *
 * ⚠️ WITHOUT THIS THE TAKER KNOCKED IT STRAIGHT BACK OUT, and it is the single biggest thing wrong with
 * the shape of a match. The ball sits ON the touchline; the taker walks out to it from inside; and the
 * dribbling touch in `sim/possession` uses HIS OWN VELOCITY - which points at the line he has just walked
 * to. So the first thing he did with it was put it back over.
 *
 * Measured across three whole matches: the median gap between a restart being taken and the ball going out
 * again was FOUR TICKS, sixty-seven milliseconds, and 201 of 220 were inside two seconds. It is why this
 * game had 364 throw-ins per ninety minutes where football has about forty - and it survived because every
 * gate asked whether play RESUMED, which it did, perfectly, hundreds of times a match.
 *
 * ⚠️ AIMED AT THE MIDDLE OF THE PITCH AND FORWARD, which covers all four restarts with one rule: a throw-in
 * goes infield, a corner goes into the box, a goal kick goes upfield, a free kick goes towards the goal
 * being attacked. Nothing here needs to know which of them it is.
 */
function playItIn(state: MatchState, taker: TeamId): void {
  // The ends swap at half time, so the direction a side attacks is a fact about the PERIOD - the same rule
  // `rules/foul` and `sim/save` use, and it must not disagree with either.
  const defendsFar = (taker === 0) === (state.period === 2);
  const dir = defendsFar ? -1 : 1;

  const dx = dir * INFIELD_LEAD;
  const dy = PITCH.width / 2 - state.ball.p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  // On the centre spot with nothing to aim at - a kickoff - it goes straight forward.
  const nx = d === 0 ? dir : dx / d;
  const ny = d === 0 ? 0 : dy / d;

  state.ball.v = { x: nx * TAKEN_SPEED, y: ny * TAKEN_SPEED, z: 0 };
  state.ball.grounded = true;
  state.possession.holder = NOBODY;
  // Law 15, and the reason the ball stays in play: he cannot fetch his own throw and knock it back out.
  state.tookRestart = state.possession.lastTouch;
}

/** Metres up the pitch a restart is aimed, against the distance it is aimed infield. */
const INFIELD_LEAD = 10;

/**
 * Metres. How close somebody from the taking side has to get before the ball is in play again.
 *
 * A little wider than a body, because the taker has to be able to STAND at the ball rather than inside
 * it - the contact step pushes two bodies apart, and a radius of exactly nothing would be a spot nobody
 * can occupy.
 */
const TAKE_RADIUS = 1.2;

/**
 * The nearest player of one side to the ball, or `NOBODY`.
 *
 * Ties break on the smallest index, which is the rule possession uses - so two modules can never disagree
 * about who got there first.
 */
function nearestOfTeamToBall(state: MatchState, team: TeamId): number {
  let best = NOBODY;
  let bestD2 = Infinity;
  for (let k = 0; k < SQUAD_SIZE; k++) {
    const id = firstOf(team) + k;
    if (!onPitch(state, id)) continue;
    const dx = state.players[id].p.x - state.ball.p.x;
    const dy = state.players[id].p.y - state.ball.p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = id;
    }
  }
  return best;
}
