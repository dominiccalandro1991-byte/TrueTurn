# Game rules (as implemented)

Underspecified variants are called out. Engines are in `packages/game-core`.

## 10,000 / Farkle

Spec scoring is implemented. Overlapping patterns use the **maximum-score partition**. Hot dice (all remaining dice score) **must** be rerolled; banking is refused. A player must bank ≥ 500 in one turn to open; later turns may bank any positive non-hot score. Goal: 10,000.

## Ship, Captain, Crew

5 dice, 3 rolls. 6 then 5 then 4, in that dependency. A 5 without a 6 is ignored. After 6-5-4, the other two dice are cargo. Cargo dice may be rerolled if rolls remain (**default**). Three exhausted rolls without 6-5-4 → cargo 0. Demo: one turn each, highest cargo wins.

## Craps

Pass Line only. Come-out 7/11 win, 2/3/12 loss, else point. Point hit wins; 7 loses. No odds bets.

## Texas Hold’em

52-card deck, 2 hole + 5 community. Streets: preflop, flop, turn, river, showdown. No-limit betting with 5/10 blinds and 500 starting stacks. Side pots are not fully generalized; all-in is supported as a stack cap. Hand evaluator covers the published hierarchy including the wheel and royal flush. Ties split the pot by integer division.

## Spades

4 players, partners across. Bid 0–13 (0 is nil ±100). Base = team bid × 10, bags +1, 10 bags −100. Left of dealer leads. Spades may not be led until broken unless the hand is all spades. Win: 500.

## Hearts

Pass 3 cards left/right/across/hold. 2♣ leads. Hearts cannot be led until broken. Hearts 1, Q♠ 13. Shooting the moon: shooter 0, others +26. Play continues until a player reaches 100; lowest score wins.

## Pitch / Setback

6 cards. Bid 2–4 (pass allowed). Highest bidder names trump and leads. Points: High, Low, Jack of trump, Game (10=10, A=4, K=3, Q=2, J=1). Fail the bid and subtract it. First team to 11.

## Pinochle (single deck classic)

48 cards, 12 each. Min bid 250. Trump run 150 includes the trump marriage (no extra 40). Pinochle 40, double 300, arounds and dix as specified. Trick-taking: follow; if void, trump; beat the current best if possible. Trick values A11 10=10 K4 Q3 J2 9=0 plus last trick 10. Demo scores one deal (meld + tricks), not a full  race to a table total.
