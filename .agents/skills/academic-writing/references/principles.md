# Academic Writing Principles

Adapted from the MIT-licensed `andrehuang/academic-writing-agents` principle set by Haiwen Huang.

## A. Structure And Narrative

### A1. Recursive Consistency
Check consistency at every level: chapter, section, subsection, paragraph, experiment, table, figure, caption, and summary. If an introduction promises X, Y, and Z, the body must cover X, Y, and Z in the same order.

### A2. Logical Chaining
Each paragraph and section should motivate the next. Flag abrupt topic shifts, unsupported transitions, and endings that do not set up the following material.

### A3. Definition Order
Introduce definitions, notation, figures, and tables before or at the point where the reader needs them. LaTeX source order should not make floats appear out of the discussion order.

### A4. Close Every Paragraph
End paragraphs with synthesis, implication, or transition. Do not end with a dangling citation, a teaser such as "as discussed below", or a detail that leaves the paragraph unresolved.

### A5. Claim-First Exposition
State the goal or claim before equations, implementation details, or procedure. Readers should know what and why before how.

### A6. Goal-Problem-Solution Rhythm
Sections should establish the goal, explain the problem or gap, then present the solution. This applies from the paper level down to important subsections.

### A7. The Nugget
Every paper or chapter should orbit one key insight. If the nugget cannot be stated in one sentence, the draft likely lacks focus.

## B. Prose And Style

### B1. Avoid Exhaustive-Sounding Enumerations
Use "such as" for illustrative lists. Avoid phrasing that implies an incomplete list is exhaustive.

### B2. Avoid Negation-Contrast Structures
Rewrite "not X, but Y" and similar patterns into direct positive statements. These structures often add friction and can sound formulaic.

### B3. Avoid Colloquial Terms In Formal Claims
Use formal terminology in headings, claims, and definitions. Colorful shorthand can appear parenthetically after the formal term is established.

### B4. Match Analytical Thesis Voice
Prefer analytical prose: claim, evidence, mechanism, example, principle. Avoid flat lists of observations unless a list is the clearest structure.

### B5. One Idea Per Sentence
Split sentences that bundle separate claims, contrasts, methods, and results. One sentence should advance one idea.

### B6. Calibrated Confidence
Use assertive language for measured facts and hedged language for causal interpretation. Do not hedge numbers, and do not overstate mechanisms.

### B7. Ruthless Conciseness
Cut filler and replace inflated phrasing with direct wording. Academic prose should be precise, not ornate.

### B8. AI-Writing Tell Detection
Remove formulaic transitions, empty intensifiers, vague stock phrases, and repeated patterns such as "Moreover/Furthermore/Additionally" chains.

## C. Math And Equations

### C1. Math For Clarity
Use notation when it adds precision. Avoid symbols used only once, overloaded notation, and dense symbol introductions without explanatory spacing.

### C2. Triple Explanation
Central concepts should be explained through some combination of intuitive text, equation, and figure. The core idea often needs all three.

### C3. Equation-Code Correspondence
Equations, pseudocode, algorithms, and implementation descriptions should map cleanly. If names or dimensions differ, state the mapping.

## D. Figures And Tables

### D1. Active Figure Use
Use figures to explain hard concepts, not to decorate. Dense methods or central intuitions often need visual support.

### D2. Cross-Reference All Floats
Every figure and table must be explicitly referenced and discussed in the text.

### D3. Figure-Text-Caption Consistency
The visual, caption, and body text must describe the same thing with consistent terms and spatial descriptions.

### D4. One Figure, One Message
Avoid overloading one visualization with multiple stories. Split figures when one figure tries to answer multiple questions.

### D5. Interpret Figures
Tell the reader what to notice. Replace bare references like "see Figure 3" with the pattern or comparison the figure supports.

### D6. Figure Row Alignment
In multi-row subfigure layouts, check top alignment, image height normalization, caption alignment, and mixed raster/vector sizing.

### D7. Caption Self-Sufficiency
Captions should define symbols, explain axes or groups, and state the takeaway well enough for a reader scanning figures.

## E. Citations And Bibliography

### E1. Cite Named Models, Benchmarks, And Datasets
Cite named methods, datasets, systems, and benchmarks at first use in each section or chapter where readers may enter independently.

### E2. Citation Completeness At First Mention
Foundational methods and acronyms still need citations at first mention in a self-contained section.

### E3. Bibliography Hygiene
Check required fields, title capitalization braces, arXiv-to-published updates, author consistency, venue consistency, duplicates, and unresolved references.

## F. Process And Meta

### F1. Strategic Limitation Placement
Place limitations according to document type. Papers should be strategic and contextual; theses and internal documents can surface design tradeoffs earlier.

### F2. Final Negation-Contrast Audit
Before finalizing, search for patterns such as `not.*but`, `not only`, and `not because` and rewrite when the contrast is stylistic rather than necessary.
