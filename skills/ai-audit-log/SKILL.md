---
name: ai-audit-log
description: >-
  Keep and then export the mandatory AI Audit Report for a coursework submission - tool, timestamp,
  prompt, output, and what the human changed afterwards - plus the AI Critique paragraph. Use when
  someone says "log this AI session", "write the AI audit report", "I need the prompt log for my
  homework", or at the end of any assignment whose brief requires an AI declaration. Records the
  human correction alongside the AI output, because the correction is the part being graded.
---

# AI audit log and critique

Produces: `docs/prompt-log.md` (append-as-you-go), `ai-audit-report.md` (the graded appendix), and
`ai-critique.md` (200–300 words).

## The rule that makes this work

**Log at the moment, not at the end.** Reconstructing a prompt log after the fact produces a tidy
document that is also fiction: the prompts get smoothed, the dead ends disappear, and the dead ends
are where the interesting failures live. One entry per interaction, appended while the answer is
still on screen.

## Entry format

```markdown
### [YYYY-MM-DD HH:MM] <tool + model> - <what this was for>

**Prompt**
> the prompt, verbatim, including any file that was attached (name it)

**Output (summary + verbatim where it matters)**
> what came back; quote exactly the parts a later claim depends on

**Human review**
- what was wrong or missing
- what I changed, and why
- what I kept, and why I trust it
```

Never paraphrase your own prompt into something more competent than it was. A weak prompt that
produced a weak answer is evidence for the critique, and the brief asks for exactly that analysis.

## What must appear in every entry

- **Tool and model** — the specific one ("Claude Code, Claude Opus 5"), not "AI".
- **Date and time** — local, to the minute.
- **The prompt, verbatim** — including attached filenames.
- **The output** — verbatim where a later claim rests on it; summarised where it does not.
- **The human review** — the accepted / corrected / rejected verdict and the reason. This is the
  column that distinguishes using AI as an assistant from using it as a black box.

## Assembling the audit report

1. Open with the declaration the brief prescribes, exactly as worded ("I use AI tools for the
   following tasks," — or the no-AI declaration if none was used).
2. A summary table: interaction #, timestamp, tool, purpose, verdict (accepted / corrected /
   rejected), and where the artefact it produced now lives.
3. The full entries, in chronological order.
4. A short section on the *pattern* of corrections — which kinds of task needed heavy correction and
   which did not. This is what the critique will draw on.

## The critique (200–300 words)

Three questions, in this order, each answered with a concrete instance from the log:

1. **Where was the AI wrong, biased or incomplete?** Name one specific claim and the correct value.
   Prefer an error whose cause is interesting (a metric conflated, a system property the model could
   not have known) over a typo.
2. **Why did it fail to catch it?** Distinguish the causes honestly: information the prompt never
   carried; a plausible-sounding pattern from training data applied to a system where the mechanism
   does not hold; over-confidence in a summary statistic; or a genuine reasoning error.
3. **What principle about collaborating with AI does this establish?** Something operational you
   would do again next time — not "always verify AI output", which is a slogan, but the specific
   check that would have caught this class of error earlier.

Count the words. A 320-word paragraph is out of range and the range is a requirement.

## Checklist

- [ ] Entries written at the time, dead ends included.
- [ ] Every entry: tool + model, timestamp, verbatim prompt, output, human verdict with reason.
- [ ] Declaration worded exactly as the brief prescribes.
- [ ] Summary table maps each interaction to the artefact it produced.
- [ ] Critique is 200–300 words, cites a specific error, and ends with an operational principle.
