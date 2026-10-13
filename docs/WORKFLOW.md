# PotatoBrawl: how we work (v2)

## Where things live
- **Code:** GitHub repo `guspliffy/potatobrawl`. Layout: `game/` (sources + build.py, ui split into `game/ui/`), `tests/`, `deploy/`, server files and the built `index.html` at the root, `CLAUDE.md`, `docs/HANDOFF.md`, `check.sh`.
- **Plans, decisions, feedback:** the claude.ai Project "potato brawl" (WORKFLOW, HANDOFF, PLAN, FEEDBACK docs) and the plan doc "PotatoBrawl: Session Wrap-up and Next Plan" (decision table). Never put code in Project docs: they load into every chat and cost tokens.
- **Live:** https://potatobrawl.cloud. **Test copy:** beta.potatobrawl.cloud (to be set up in milestone 0).

## Roles
- **Opus (main session): conductor and reviewer.** Talks to Jonny, plans, writes briefs, reviews, decides what ships. Owns the simulation and online sync (`core.js`, lockstep code in `game/ui/online.js`): writes those changes itself or reviews them line by line.
- **Fable 5.1 (Agent, model "fable"): creative head and design analyst.** Concepts, game feel, balance, effect and finisher designs, mockups as SVG/HTML/three.js sketches, and deep "why does this happen" analysis. Only at decision points: top tier, likely the most expensive. Max 600 words or one mockup file. Never edits game files.
- **Sonnet 5.5 (Agent general-purpose, model "sonnet"): coders.** Screens, server endpoints, effects, setup files, refactors. One agent per task, each owning distinct files. Report max 200 words: files touched, what changed, command output tails, doubts. No code dumps.
- **Tester (Agent, model "haiku" or "sonnet").** Runs `check.sh` and the screenshot pass, reports only failures plus one contact sheet. Independent of whoever planned the work.
- **Explore agents (model "sonnet")** for "where is X / what calls Y" searches.

## Loop for every feature
1. **Plan (Opus):** read only relevant code (grep, line ranges). Creative features: Fable concept first. Goal, files, approach, risks, tests, acceptance criteria. Jonny approves before code changes.
2. **Brief (Opus):** self-contained briefs (agents can't see the chat): paths, functions, constraints, what not to touch, commands, definition of done, report format.
3. **Execute (Sonnet):** different files in parallel, same file in sequence. One branch per milestone, one commit per task.
4. **Test, then review:** the tester runs `check.sh` + screenshots; Opus reads its report and `git diff`, never whole files. Fixes go back to the same agent via SendMessage.
5. **Ship:** build; Claude merges its own PR once `check.sh` passes (Jonny's standing rule since 2026-10-13); Jonny pastes deploy/update.txt to put it live and checks on his phone. Publish the artifact copy if it's still used. Update HANDOFF, commit, push.

## Token rules
- One milestone per session. Every message carries the whole conversation, so long sessions get expensive and lose detail when summarized. Start fresh with the handoff.
- Never read a whole large file. Grep, then line ranges.
- Reuse agents via SendMessage; don't respawn. Ask Jonny all open questions at once, before expensive work.
- Run each check once per step. Keep CLAUDE.md and Project docs short; they load every time.
- Don't run parallel agents that all read the same big file.

## Quality rules (Jonny's standing preferences)
- Correctness over speed. Raw findings. Flag assumptions. No silent changes: every change appears in the report to Jonny. Stop and ask instead of guessing.
- **Simulation changes:** deterministic only. New fields go in the fighter defaults, FKEYS and checksum; bump PROTO. Done = `check.sh` passes: snap 0 mismatches, online test 0 desyncs, balance 44–56% per fighter.
- **UI changes:** screenshots at 667x320, 844x390 and 1280x760, with no page errors.
- **Server:** it shares the VPS with Jonny's real-money trading bot. Any new open port, stored data or dependency is Jonny's decision.

## Milestones
- **M0, setup:** sources from the zip into the repo; `CLAUDE.md`; split `ui.js` into modules (byte-identical build output); `check.sh` (one command, PASS/FAIL lines); beta subdomain on the server.
- **M1:** light-attack lock fix + fullscreen / home-screen app.
- **M2:** KO finisher Phase 1 (moved ahead of accounts by Jonny, 2026-10-13; shipped together with M1 in PR #2).
- **M3:** fight feel (moved ahead of accounts by Jonny, 2026-10-13): heavy looks, specials finish from 175%, 1 s charged heavies, KO decided at the hit so the finisher starts on it (PROTO 4).
- **M4:** 2D-only matches + red heart lives, then the KO finisher as a 2D manga page per fighter (3D films first, replaced by manga on Jonny's call), originally a live 3D film per fighter (Jonny, 2026-10-13; plan in Project files finisher-films/plan.md, Fable's design in finisher-films/fable-cinematics.md). The Potatalities move to a later finisher shop (alternates for chips).
- **M5:** accounts with sync codes + server housekeeping (close :8080, nightly backup).
- **M6:** hit-feel polish + KO finisher Phase 3.
- **Then** the backlog, in the order of Jonny's answer to decision 8 in the plan doc, plus the FEEDBACK doc.

## Session start and end
- **Start:** the cloud session clones the repo. Read CLAUDE.md, docs/HANDOFF.md, the Project FEEDBACK doc and the plan doc's decision table. Confirm the milestone with Jonny.
- **End:** update HANDOFF (state, decisions, next steps), commit, push and open a pull request, and give Jonny the deploy steps.
