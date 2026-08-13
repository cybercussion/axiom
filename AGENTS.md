<!-- ratchet:start — paste this block into your AGENTS.md (Codex / Cursor / Gemini / Antigravity / any runtime that reads AGENTS.md) -->
## Friction telemetry — ratchet

This machine runs **ratchet**, a local observer of agent work (transcripts →
SQLite → friction signatures, hotspots, trends, portable findings). It
answers two questions you should not re-derive: *"has this shape cost time
before?"* and *"did the fix hold?"*

1. **At the start of substantive work**, orient:
   `~/.ratchet/bin/ratchet query hotspots --json` and
   `~/.ratchet/bin/ratchet findings --json`
   (MCP runtimes: call the `ratchet` server's `ratchet_context` tool
   instead — one call, same data).
2. **Let standing findings shape your defaults**: the measured sins are
   REPEAT (re-reading a region you already read — batch and remember),
   SERIAL (single-call read-only turns — batch independent calls), and
   PAGING (a file too large to read in one call — that one indicts the
   FILE; the fix is an index or a split, never "remember harder").
   **Rank by occurrences, not seconds.** Those three time nothing at all,
   so they cannot appear in a by-time ranking however large they are.
3. **"Slow tools" is usually approval latency, not execution.** Most
   harnesses state a duration for almost nothing, so a WAIT figure is an
   elapsed call→result gap that includes however long a permission prompt
   sat unanswered — an upper bound on machine time. If you carry a rule
   like "grep is expensive, prefer targeted lookups", check where it came
   from: measured here, the median grep is 197 ms.
4. **Caveats are fields, not decoration**: `confidence: "unverified"` means
   verify before citing, `derived_upper_bound` means the seconds are a
   ceiling and not a cost; a trends delta is meaningless unless
   `comparable: true`; `meta.floor` says what was dropped; a null cost is
   ABSENT, never zero. A caveat's `severity` is a rule — **`warning` means
   an action exists, `info` means the claim is bounded and there is nothing
   to do** — so read the warnings and don't act on the infos. JSON refusals
   exit non-zero — branch on the exit code.
5. **If you disprove a finding**, contest it:
   `~/.ratchet/bin/ratchet findings contest <id> --reason "..."` — never
   just ignore it.
6. Time is machine-local; only occurrences and ranks are portable. Never
   quote a finding's hours to another machine.
7. **If a `<ratchet-orient>` block appears at the top of your session**, it
   is this project's measured working set, paged files, real median command
   times and import hubs — computed from the store, never authored, so it
   cannot drift from what happened. Treat it as the answer to "what will I
   probably need", not as a map of the code: it is deliberately bounded, it
   names what it could NOT derive rather than printing an empty list, and
   `ratchet brief <project>` is the unabridged version. It is absent when
   there is nothing measured to say — silence there means no data, not no
   friction.

Full reference: `https://ratchet.daystra.com/RATCHET.md` (curl it into the
project if missing). Install: `curl -fsSL https://ratchet.daystra.com/install.sh | sh`
<!-- ratchet:end -->

<!-- atlas:start — paste this block into your AGENTS.md (Codex / Cursor / Gemini / Antigravity / any runtime that reads AGENTS.md) -->
## Code lookup — atlas

This machine has **atlas**, a manifest of pointers for the tree you are in:
declarations, name substrings, file paths, path routes, endpoints, config
keys, module registry. It ships beside ratchet and installs with it. It exists
to change the KIND of answer a lookup gives you — one you can open, and one
whose emptiness you can trust.

1. **One door, and it takes any word.** `~/.ratchet/bin/atlas <word>` — a
   symbol, a topic, an endpoint, a config key, a path, a CSS literal. There is
   no verb to choose first and nothing to aim: the project root is walked up
   from the cwd, the manifest lives out of tree, and it is built (or rebuilt,
   when the tree has moved on) as a side effect of asking. The verbs
   (`where`, `refs`, `file`, `config`, `wire`, `stale`, `stats`) are for when
   you already know the SHAPE of the answer you want. (MCP runtimes: call the
   `atlas` server's one tool, `atlas_lookup(query, path?)` — same door.)
2. **Every answer carries `file:line`. Open it.** A pointer is a claim about
   the manifest; the file is the fact. An answer you did not open is a rumour,
   and the one failure mode that costs more than no answer is a confident
   wrong line.
3. **An empty result means EMPTY — not "this tool did not find it."** When
   every index comes back empty atlas also greps the live tree, and only then
   says so. `NOT-INDEXED` is its own separate verdict and means *absence here
   is not absence in the code*. The two are not interchangeable.
4. **Read the footer; it is half the answer.** Every result ends with
   `SEARCHED …` / `NOT SEARCHED …` / `NOT MODELLED …`, naming what was
   consulted, what was skipped and why, and what this build does not model at
   all (SQL predicates, localStorage keys, dynamic dispatch). A negative is
   only worth acting on with the footer read — that is what bounds it.
   `NOT SEARCHED code bodies` is the common one, and it names its own fix:
   `atlas refs <name>` greps the tree live.
5. **The manifest maintains itself, and says when it hasn't.** Staleness is
   disclosed on stderr, never guessed at; `atlas stale` names the files that
   changed since the build. stdout is always the answer alone, so piping is
   safe.
6. **CLI quirk — a query starting with `-` cannot be passed bare**: argparse
   claims it as a flag and you get a usage error, not a result. Use
   `atlas lookup -- -webkit-mask` (the `--` must follow the verb; `atlas --
   -webkit-mask` does not work), or use the MCP tool, where the query is a
   string field and no quoting rule applies.
7. **MCP runtimes: the working directory is not yours.** A user-scope server
   inherits the directory the CLIENT was launched from, not the project you
   are editing — measured live, a session started from `$HOME` answered
   `NO_ROOT` to every call, correctly reporting that it had searched nothing.
   Pass `atlas_lookup(query, path)` — any absolute path inside the project you
   mean — whenever those could differ, and ALWAYS after a `NO_ROOT` notice.

Full reference: `https://ratchet.daystra.com/ATLAS.md` (curl it into the
project if missing).
Install (both tools): `curl -fsSL https://ratchet.daystra.com/install.sh | sh`
<!-- atlas:end -->
