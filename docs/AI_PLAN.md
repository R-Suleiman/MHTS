# Small AI additions for MHTS

No AI calls, chatbot, generated questions, or API keys are implemented yet.

## Keep the assessment scoring stable

Keep WHO-5 and PHQ-4 wording and scoring unchanged. Generated prompts belong in a separate, optional reflection activity, not in scored assessments. An example reflection prompt is “What helped you feel a little more settled today?” Generated questions are not validated screeners.

## Minimal integration

- One AI provider account, a small text model, billing/budget limits, and a server-only API key.
- Three authenticated server endpoints: reflection prompts, a weekly insight, and chat. They can all use the same model and configuration.
- Send a small summary of the signed-in user's recent check-ins and deterministic scores, only with that user's explicit consent. Do not send email, password, or unrelated records. Written reflections and chat history need separate, explicit inclusion choices.
- A small Chat panel with streamed responses, cancellation, error/retry states, and clear AI labeling. Start with session-only chat history; add PostgreSQL `conversations` and `messages` tables only if users want saved chats.
- Validate structured model output for prompts/insights. Render responses as escaped text or sanitized Markdown, never raw HTML.
- Per-account request/message limits, context and output length limits, timeouts, and a monthly budget. Cache a weekly insight until the underlying records change.

## Intended behavior

Insights should describe observed patterns with dates and missing-data caveats: “You logged less sleep on three of your higher-stress days.” They should not infer causation, diagnose disorders, make recovery guarantees, or determine that someone is safe.

Chat should support reflection, explain app measurements, and offer optional general self-care activities. It should not prescribe treatment, modify medication, or impersonate a clinician. It needs a visible support route and a reviewed response for messages indicating immediate danger; do not rely solely on a model or keyword matching to assess crisis risk.

Treat user text and generated text as untrusted. The model should have no direct database access and no tools that can change records or contact others. Account ownership stays enforced in normal server code.

## Suggested delivery order

1. Optional weekly insight from a deterministic summary.
2. One optional reflection prompt after a check-in.
3. A small chatbot with explicit consent, limited context, and no tools.

Before enabling the features, test misleading scores, sparse histories, crisis language, hallucinations, prompt injection, cross-account access, and service failures. Review the provider's retention settings and explain what leaves the app. A clinician should review mental-health-specific behavior before users rely on it.

An email service is separate from AI: it is needed for account email verification and self-service password recovery.
