---
name: academic-writing
description: Academic writing assistant for research papers, theses, and LaTeX projects. Use when the user asks to review, draft, polish, or prepare academic writing; check logic, prose, consistency, citations, bibliography, math, figures, tables, or LaTeX layout; survey literature; assess research positioning; preserve authorial voice; handle AI-detector false-positive concerns ethically; or adapt Claude academic-writing-agents workflows for Codex.
---

# Academic Writing

Use this skill as a Codex-native version of `andrehuang/academic-writing-agents`: a review-then-act academic writing workflow with specialist review lenses, persistent findings, and careful human control over edits.

Adapted from Haiwen Huang's MIT-licensed `academic-writing-agents` Claude plugin: https://github.com/andrehuang/academic-writing-agents

## Codex Compatibility Rules

- Treat the Claude `/academic <task>` command as: `Use $academic-writing to <task>`.
- Do not rely on Claude-only frontmatter such as `allowed-tools`, `argument-hint`, or named Claude subagents.
- Respect Codex's delegation policy. If the user explicitly asks for parallel agents, multi-agent review, or delegated specialist passes, use Codex subagents with the role briefs in `references/role-cards.md`. Otherwise, run the selected specialist lenses yourself and use tool parallelism only for independent file reads/searches.
- Review before editing for any broad polish, submission-readiness, or revision task. Diagnose the issues, prioritize them, then edit only the changes the request authorizes.
- Preserve authorial intent, technical claims, citations, labels, macros, and notation unless the task is explicitly to change them.
- Never invent citations or bibliography entries. Mark unresolved citation needs with a clear placeholder such as `[CITE: description]`.
- Do not optimize text to evade AI detectors, bypass academic integrity checks, or misrepresent authorship. Redirect those requests to writing quality, authorial voice, permitted AI-use disclosure, process evidence, and false-positive resilience using `references/writing-integrity.md`.

## First Move

1. Classify the request: review, polish, draft, bibliography audit, figure/layout work, research positioning, literature survey, writing integrity, or submission readiness.
2. Load `references/principles.md` for non-trivial writing or review work.
3. Load `references/writing-integrity.md` when the request mentions AI detectors, AI flags, human-sounding prose, authorial voice, style calibration, false positives, permitted AI use, or process evidence.
4. Load `references/role-cards.md` when selecting specialist lenses or preparing subagent prompts.
5. Read project conventions when present: `AGENTS.md`, `.claude/CLAUDE.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, LaTeX headers, makefiles, and nearby sections.
6. Discover relevant files with `rg --files`, especially `.tex`, `.bib`, `.cls`, `.sty`, figures, tables, PDFs, and build logs.
7. For broad work, state a compact deployment plan and proceed unless the user objects. For narrow edits, act directly.

## Role Selection

Use the smallest set of roles that covers the request.

- Full section/chapter review: consistency-checker, logic-reviewer, technical-reviewer, writing-reviewer, bibliography-auditor.
- Prose quality review: writing-reviewer.
- Polish or improve text: writing-reviewer first, then prose-polisher.
- Flow, transitions, and argument structure: logic-reviewer.
- Technical correctness, math, methods, results, or claims: technical-reviewer.
- Bibliography or citation hygiene: bibliography-auditor.
- Figure/table source consistency: consistency-checker plus latex-figure-specialist when edits are needed.
- Compiled PDF layout: latex-layout-auditor.
- Draft a section, paragraph, abstract, caption, or transition: section-drafter.
- Research positioning or novelty: research-analyst plus brainstormer when useful.
- Literature survey or paper collection: paper-crawler, then research-analyst.
- AI-detector flag, false-positive risk, "humanize" phrasing, or authorial voice: authorship-integrity-advisor plus writing-reviewer and prose-polisher. Use style calibration and scientific clarity passes; do not target detector scores.
- Submission readiness: all review roles, bibliography-auditor, latex-layout-auditor, then targeted action roles and verification.

## Review Workflow

1. Scope the target files and expected audience.
2. Run the selected specialist lenses. For each finding, capture file path, line number when available, quoted text when useful, severity, principle, and concrete fix.
3. Deduplicate overlapping findings. Merge issues flagged by multiple lenses instead of repeating them.
4. Prioritize as:
   - Critical: correctness, unsupported claims, unresolved references, broken compilation, severe logical gaps.
   - Important: unclear structure, missing citations, inconsistent terminology, weak figure interpretation, substantial prose friction.
   - Minor: style cleanup, local wording, optional tightening.
5. Provide a synthesis, not raw pass-through output.
6. For full reviews, write the synthesis to `.review/YYYY-MM-DD-<scope>.md` so later edit passes can address specific findings.

## Editing Workflow

Before editing academic text:

1. Identify which findings the edit pass will address.
2. Read adjacent sections to preserve voice, tense, depth, and notation.
3. If authorial voice matters, calibrate from the user's own prior writing samples using `references/writing-integrity.md`.
4. Make targeted edits. Avoid broad rewrites that change meaning.
5. Do not change LaTeX labels, macro names, bibliography keys, math symbols, or figure paths unless required.
6. Re-run relevant checks after edits: `rg` for labels/citations, LaTeX build if available, and a focused review of changed text.
7. Summarize changed files, principles addressed, and remaining author decisions.

## Drafting Workflow

When drafting from scratch or filling a gap:

1. If context is insufficient, ask only the missing high-impact questions: nugget, audience, surrounding sections, required citations, and figures/tables.
2. Match existing project style and LaTeX conventions.
3. Use claim-first exposition and goal-problem-solution rhythm.
4. Use existing bibliography keys only. If a required citation is absent, insert `[CITE: description]`.
5. Prefer placing a draft directly in the target file when the user asks for implementation; otherwise present a LaTeX block with placement guidance.

## Bibliography Workflow

For `.bib` and citation audits:

1. Parse `.bib` files structurally where possible.
2. Check required fields by entry type, duplicate entries, author name consistency, venue consistency, title capitalization braces, and unresolved citation keys.
3. Grep `.tex` files for `\cite`, `\ref`, `\label`, named datasets, benchmarks, methods, and models.
4. Use up-to-date web verification for arXiv-to-published updates and current paper metadata when the task depends on it.
5. Report fixes separately from edits unless the user asks to update the bibliography.

## Figures And Layout

- For source-level figure work, inspect surrounding prose, caption, labels, included files, and project macros before editing.
- For layout audits, prefer compiled PDFs and build logs when available. Check float placement, orphan floats, subfigure alignment, caption quality, sizing, and reference order.
- Every figure/table should be referenced and interpreted in the text. A bare "see Figure X" is not enough for important floats.
- Compile after figure/layout changes when the project has a known LaTeX build command.

## Literature Survey Workflow

For literature surveys or paper crawling:

1. Clarify topic, venues, years, and inclusion criteria.
2. Use current sources such as DBLP, OpenAlex, Semantic Scholar, arXiv, publisher pages, or official proceedings as appropriate.
3. Deduplicate by normalized title and DOI.
4. Separate collection from analysis: raw candidate papers first, then relevance classification and research synthesis.
5. Cite or link sources in the final answer when web research is used.

## Writing Integrity Workflow

Use this when the user worries about AI-detector flags, asks for authorial voice, or wants text that reflects their genuine writing process.

1. State the boundary: improve writing quality and authorship evidence; do not bypass detectors or hide prohibited AI use.
2. Check the applicable policy when available: course, journal, conference, supervisor, institution, or funder rules.
3. Collect legitimate inputs: the user's draft, notes, outline, source annotations, earlier revisions, and optional prior writing samples.
4. Build a style profile only from writing the user authored. Use it as a soft guide beneath discipline and journal conventions.
5. Run scientific clarity passes: clutter, voice/verbs, sentence architecture, terminology consistency, numerical consistency, and citation integrity.
6. Remove formulaic prose because it is weak writing, not because a detector might flag it.
7. If needed, create a process-evidence summary: sources used, drafts reviewed, AI assistance disclosed, edits made, and remaining author decisions.

## Synthesis Format

Use this shape for review outputs, adapting it when the task calls for something lighter:

```markdown
## Academic Review

### Overview
[1-2 sentences on readiness and main risk]

### Critical Issues
- [FILE:LINE] [category] Finding. Suggested fix.

### Important Issues
- [FILE:LINE] [category] Finding. Suggested fix.

### Minor Issues
- [FILE:LINE] [category] Finding. Suggested fix.

### Patterns
- [recurring issue across the draft]

### Recommended Next Steps
1. [highest leverage action]
2. [next action]
```

For editing outputs, keep the final response short: files changed, checks run, and remaining risks or author decisions.
