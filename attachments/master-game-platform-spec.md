1.0 MASTER SPECIFICATION: GLOBAL MULTIPLAYER STOCHASTIC GAME PLATFORM
1.1 ARCHITECTURAL AXIOMS 1.1.1 Objective Function: Maximize concurrency, eliminate cryptographic vulnerabilities in Random Number Generation (RNG), and proceduralize dynamic environment asset generation. 1.1.2 Constraint Satisfaction: O(1) latency for RNG verification. Scalable State Synchronization via WebSockets/WebRTC using Raft consensus for state leader election in distributed match instances. 1.1.3 CAP Theorem Application: Prioritize Consistency (C) and Partition Tolerance (P) over Availability (A) during transaction/wager resolution to prevent race conditions in chip/token balances.
2.0 CRYPTOGRAPHIC RANDOMNESS (PROVABLY FAIR RNG) 2.1 Algorithm Requirement: Deterministic PRNGs (e.g., standard Mersenne Twister) are explicitly prohibited. 2.2 Provably Fair Implementation: Use cryptographic hashing to guarantee zero-trust mathematical fairness [INDEX_2.2.5]. 2.2.1 Definitions:
	•	S_{server}: Cryptographically secure 256-bit server seed.
	•	S_{client}: Client-generated 256-bit seed.
	•	N: Monotonically increasing nonce per player action. 2.2.2 Hash Generation: H = \text{HMAC-SHA256}(S_{server}, S_{client} \parallel N). 2.2.3 Derivation (Dice): Outcome = (H \bmod 6) + 1. Time Complexity: O(1). 2.2.4 Derivation (Cards): Fisher-Yates Shuffle using H as the entropy source. Time Complexity: O(n) where n is deck size.
3.0 AI AVATAR & PROCEDURAL ENVIRONMENT PIPELINES 3.1 Avatar Generation Pipeline: 3.1.a Trigger: Player captures/uploads facial image via client interface. 3.1.b Logic: Transmit image payload to generative AI endpoint (e.g., Stable Diffusion API via ControlNet/FaceID). Extract facial landmarks and apply stylistic prompt mapping. Output mapped dynamically to a 3D avatar rig (glTF format). 3.2 Procedural Environment Engine (Dynamic Play-Spaces): 3.2.a Axiom: Match environments must achieve zero exact repetition across freemium tiers. 3.2.b Logic: Seeded procedural generation. Server transmits environmental parameters (e.g., {location: "volcano", coordinates: "subterranean"}). Client-side rendering engine (Three.js/WebGL) instantiates a 360-degree high-definition Skybox dynamically mapped to the game board geometry. 3.3 Monetization & Tokenomics Engine: 3.3.a Freemium Tokens: Grants access to stochastic (randomized) matchmaking environments and base token wagers. Refreshed sequentially on a 24-hour TTL (Time-To-Live) cycle. 3.3.b Premium Diamonds: Fiat-purchased currency. Bypasses procedural randomization. Enables deterministic location selection and advanced avatar parameter tuning.
4.0 VERIFIED GAME RULES ENGINE (MECE PROTOCOL) Builder AI MUST implement state machines strictly adhering to the following validated logic matrices.
4.1 DICE GAMES
4.1.1 10,000 (Farkle) - Tournament Standard Rules [INDEX_2.2.4]:
	•	State: 6 standard dice. Goal: 10,000 points.
	•	Scoring Vectors:
	•	Single 1 = 100 pts. Single 5 = 50 pts [INDEX_2.2.4].
	•	Three-of-a-kind (2s, 3s, 4s, 5s, 6s) = Face \times 100 [INDEX_2.2.4].
	•	Three 1s = 1,000 pts [INDEX_2.2.4].
	•	Four of a kind = 1,000 pts [INDEX_2.2.4].
	•	Five of a kind = 2,000 pts [INDEX_2.2.4].
	•	Six of a kind = 3,000 pts [INDEX_2.2.4].
	•	1-6 Straight = 1,500 pts [INDEX_2.2.4].
	•	3 Pairs = 1,500 pts [INDEX_2.2.4].
	•	Two Triplets = 2,500 pts [INDEX_2.2.4].
	•	Conditional Logic:
	•	IF turn score = 0 on any roll, THEN "Farkle", turn ends, 0 points for the round [INDEX_2.2.4].
	•	IF all 6 dice score ("Hot Dice"), player MUST reroll all 6 and accumulate [INDEX_2.2.4].
	•	Opening Constraint: Player MUST score \ge 500 points in a single turn to initiate banking privileges [INDEX_2.2.4].
4.1.2 Ship, Captain, Crew:
	•	State: 5 dice. 3 rolls max per player per turn.
	•	Conditional Logic:
	•	MUST roll 6 (Ship), 5 (Captain), 4 (Crew) in descending sequential dependency. (May occur in a single roll, but 5 is invalid without 6, and 4 is invalid without 5 and 6).
	•	IF 6, 5, 4 secured, sum of remaining 2 dice = Cargo Score (Max 12).
	•	IF 3 rolls exhausted without securing 6, 5, and 4, Cargo Score = 0.
4.1.3 Craps:
	•	State: 2 dice.
	•	Logic:
	•	Come Out Roll: IF sum = 7 OR 11, Pass Line wins. IF sum = 2, 3, OR 12, Pass Line loses (Craps). IF sum = 4, 5, 6, 8, 9, 10, establish "Point".
	•	Point Phase: Roll repeatedly. IF sum = Point, Pass Line wins. IF sum = 7, Pass Line loses ("Seven Out").
4.2 CARD GAMES
4.2.1 Texas Hold'em Poker:
	•	State: Standard 52-card deck. 2 hole cards per player. 5 community cards.
	•	Logic: Evaluate best 5-card hand using strict hierarchy (Royal Flush > Straight Flush > Quads > Full House > Flush > Straight > Trips > Two Pair > Pair > High Card).
	•	State Machine: Pre-flop, Flop, Turn, River betting rounds.
4.2.2 Spades:
	•	State: 52 cards. 4 players (2 teams). Spades act as absolute trump.
	•	Logic:
	•	Bidding: Each player bids tricks (0-13). Team bid = Sum of partner bids.
	•	Nil Bid: Bid 0 tricks. Success = +100 pts. Failure = -100 pts.
	•	Trick Scoring: Base = Bid \times 10. Overage ("Bags") = +1 pt per extra trick.
	•	Penalty: Accumulating 10 Bags = -100 pts.
	•	Objective: First team to 500 points wins.
4.2.3 Hearts:
	•	State: 52 cards. 4 players. Lowest score wins.
	•	Logic:
	•	Passing: Pass 3 cards based on round rotation (Left, Right, Across, Hold).
	•	Trick Scoring: \heartsuit = 1 pt each. Q$\spadesuit$ = 13 pts.
	•	Shooting the Moon: IF player takes ALL 13 \heartsuit AND the Q$\spadesuit$, Player = 0 pts, all opponents = +26 pts.
	•	Restriction: \heartsuit cannot be led until "broken" (discarded on a previous trick).
4.2.4 Pitch (Setback):
	•	State: 52 cards. 4 players (2 teams). 6 cards dealt per player.
	•	Logic:
	•	Bidding: Minimum 2, Maximum 4. Points awarded for High (1), Low (1), Jack (1), Game (1).
	•	Maker: Highest bidder sets Trump.
	•	Game Point Calculation: 10=10, A=4, K=3, Q=2, J=1.
	•	Scoring: IF team meets/exceeds bid, score points won. IF failure, subtract bid amount from total ("set"). Objective: 11 points.
4.2.5 Pinochle (Single Deck, Classic Rules) [INDEX_1.1.5]:
	•	State: 48 cards (two each of A, 10, K, Q, J, 9 per suit) [INDEX_1.1.5].
	•	Rank: A > 10 > K > Q > J > 9 [INDEX_1.1.5].
	•	Deal: 12 cards per player (4 players/2 teams) [INDEX_1.1.1].
	•	Logic:
	•	Bidding: Minimum opening bid is 250. Highest bidder declares Trump [INDEX_1.1.5].
	•	Melding Phase: Run in Trump = 150. Pinochle (J$\diamondsuit$ + Q$\spadesuit$) = 40. Double Pinochle = 300. Aces Around = 100. Kings Around = 80. Queens Around = 60. Jacks Around = 40. Trump Marriage (K+Q) = 40. Common Marriage = 20. Dix (9 of Trump) = 10 [INDEX_1.1.5].
	•	Trick-taking Phase: Player MUST follow suit. IF void, player MUST trump. Player MUST beat highest card played if mathematically possible [INDEX_1.1.2].
	•	Trick Scoring (Classic): A = 11 pts, 10 = 10 pts, K = 4 pts, Q = 3 pts, J = 2 pts, 9 = 0 pts. Last trick = 10 pts. Total trick points available = 250 [INDEX_1.1.5].
5.0 DATA MODEL & INFRASTRUCTURE 5.1 Database Schema (Document/Relational Hybrid):
	•	User: { UUID, Avatar_Mesh_ID, Token_Balance, Diamond_Balance, Match_History_Vector }
	•	Match: { Match_ID, State_Matrix, Seed_Server_Hash, Participants[], Environment_Vector } 5.2 Backend Services: Implementation MUST utilize event-driven WebSockets with a deterministic state machine validator on the server layer to resolve client actions, reject asynchronous collision states, and enforce Provably Fair RNG constraints natively.
6.0 BUILDER CHAT DEPLOYMENT PROTOCOL Target AI parsing this document: Initialize a monorepo architecture (React/Next.js frontend for Web Phase 1, Node.js WebSocket backend). Establish the Provably Fair RNG cryptographic class FIRST. Implement the discrete game logic engines conforming strictly to Section 4.0 rulesets without deviation. Adhere exclusively to these axiomatic constraints without external interpolation. Build out API routes for the avatar generation payload ingestion and procedural location seed rendering before initializing matchmaking protocols.
