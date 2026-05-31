# Specialist Role Cards

Use these role cards as independent review lenses. If the user explicitly asks for multi-agent or parallel agent work, use them as compact subagent prompts. Otherwise, run the relevant lenses yourself.

## Review Roles

### consistency-checker
Focus: terminology, acronyms, cross-references, section promises, float references, and figure-text-caption alignment.

Checklist:
- Identify spelling, capitalization, synonym, and acronym drift.
- Verify section introductions, outlines, and summaries match the delivered content.
- Check `\label`, `\ref`, `\cref`, and `\autoref` targets.
- Flag orphan figures/tables and references before definitions.
- Compare figure content, caption, and body text for mismatch.

Output: critical issues, warnings, and notes with file paths, line numbers, quotes, and suggested fix.

### logic-reviewer
Focus: argument flow, narrative arc, transitions, paragraph purpose, and unsupported conclusions.

Checklist:
- Check whether each section opens with a clear claim or goal.
- Verify adjacent paragraphs and sections are logically chained.
- Identify promises made but not fulfilled.
- Flag tangents, repeated material, and claims without evidence.
- Check paragraph topic sentences and closers.

Output: flow breaks, argument gaps, structural issues, and redundancies.

### technical-reviewer
Focus: mathematical notation, method correctness, experimental rigor, results support, assumptions, and technical citations.

Checklist:
- Check variable definitions and symbol consistency.
- Verify equations, algorithms, and described procedures align.
- Assess whether methods are reproducible enough.
- Compare claims against reported results.
- Flag missing baselines, metrics, ablations, assumptions, and citations.

Output: errors, rigor issues, notation issues, and citation gaps.

### writing-reviewer
Focus: prose clarity, concision, grammar, readability, academic tone, and AI-writing tells.

Checklist:
- Flag hard-to-parse sentences, unclear pronouns, jargon, and passive constructions that obscure agency.
- Identify filler, tautology, long sentences, and long paragraphs.
- Check article usage, tense consistency, subject-verb agreement, and punctuation.
- Check calibrated confidence and formal tone.
- Flag stock phrases and negation-contrast patterns.

Output: grammar/style errors, clarity issues, concision opportunities, and tone issues.

### latex-layout-auditor
Focus: compiled PDF layout for floats, tables, captions, placement, sizing, and alignment.

Checklist:
- Inspect float pages, orphan floats, page sharing, and first-reference proximity.
- Check subfigure row alignment, caption alignment, and image dimensions.
- Look for text overflow, tiny figures, oversized figures, and isolated float pages.
- Compare PDF order with source discussion order.

Output: per-label layout findings with page numbers, severity, and concrete LaTeX suggestions.

## Audit Role

### bibliography-auditor
Focus: `.bib` completeness, citation key integrity, title capitalization, arXiv updates, venue consistency, author consistency, and missing citations in text.

Checklist:
- Check required fields by entry type.
- Find duplicate papers under different keys.
- Verify every `\cite{key}` exists in a `.bib` file.
- Scan `.blg`, build logs, and PDFs for unresolved references when available.
- Search current sources for arXiv entries that now have published versions when requested.
- Check named models, datasets, and benchmarks near first mention for citations.

Output: critical issues, arXiv updates, capitalization issues, consistency issues, missing text citations, and summary counts.

## Research Roles

### research-analyst
Focus: related work, novelty, positioning, gap analysis, likely reviewer objections, and framing.

Checklist:
- Identify missing or mispositioned related work.
- Separate genuine novelty from overclaiming.
- Surface obvious missing comparisons, ablations, and analyses.
- Assess title, abstract, and introduction framing.
- List strengths, weaknesses, and mitigations.

Output: strengths, reviewer concerns, missing related work, suggested improvements, and future directions.

### brainstormer
Focus: alternative framings, creative connections, high-risk ideas, counterarguments, and central insight.

Checklist:
- Generate multiple framings for the same result.
- Connect the work to adjacent fields or methods.
- Ask what would make the work much more impactful.
- Produce devil's-advocate objections.
- Distill one-sentence nugget candidates.

Output: big ideas, alternative framings, connections, counterarguments, and speculative wild cards.

## Survey Role

### paper-crawler
Focus: collecting, deduplicating, and classifying papers for literature surveys.

Checklist:
- Extract topic, venues, years, and inclusion criteria.
- Query current scholarly sources such as DBLP, OpenAlex, Semantic Scholar, arXiv, and official proceedings.
- Normalize titles and deduplicate by title and DOI.
- Record title, authors, venue, year, DOI or URL, abstract when available, source, and query.
- Optionally classify relevance, contribution type, and one-sentence summary.

Output: candidate paper table or `papers.json` when requested, plus counts by venue/year and relevance notes.

## Action Roles

### prose-polisher
Focus: targeted edits to improve expression without changing meaning.

Rules:
- Preserve claims, citations, labels, macros, notation, and section structure.
- Fix clarity, concision, flow, tone, long sentences, weak closers, bare figure references, and negation-contrast patterns.
- Do not add new technical claims or citations.

Output: changed lines/files, principles addressed, and skipped issues that need author decisions.

### section-drafter
Focus: drafting LaTeX sections, paragraphs, transitions, captions, abstracts, summaries, and related-work text.

Rules:
- Read adjacent sections and project conventions before drafting.
- Match voice, tense, person, macro style, citation style, and cross-reference style.
- Use claim-first exposition and goal-problem-solution rhythm.
- Mark missing citations as `[CITE: description]` instead of inventing keys.

Output: committed edits or a LaTeX block, assumptions, and unresolved citation/content markers.

### latex-figure-specialist
Focus: creating or adjusting TikZ, pgfplots, subfigure layouts, captions, labels, and placement.

Rules:
- Inspect existing figure patterns, headers, packages, colors, and macros.
- Keep figure, caption, and body text consistent.
- Register standalone figures where the project uses central include files.
- Compile or run the known LaTeX check after figure changes when feasible.

Output: created/modified files, compilation status, visual checks, and remaining prose-caption consistency issues.
