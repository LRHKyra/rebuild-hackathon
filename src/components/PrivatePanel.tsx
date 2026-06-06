// Traces to: spec/product.md §6B (private Vesper panel cards) + §10 (eval) + §11.
// Lane C owns this file. Pure presentational: given the current analysis state,
// render the six panel elements — detected question, suggested answer, sources,
// confidence, correction warning, and "ready to answer if summoned". This panel is
// PRIVATE to the rep; nothing here is spoken unless the rep summons Vesper.
// Styled on the shared light palette tokens (globals.css / vesper-workspace-ui-spec §11).

import type {
  AnswerCard,
  CorrectionCard,
  Confidence,
  DetectedQuestion,
  KnowledgeCard,
  Severity,
} from "@/types";

type SourceCard = Pick<KnowledgeCard, "id" | "title" | "source">;

type PrivatePanelProps = {
  agentName: string;
  question: DetectedQuestion | null;
  answer: AnswerCard | null;
  correction: CorrectionCard | null;
  // Resolves sourceCardIds -> readable cards (mock or live).
  sourcesById: Map<string, SourceCard>;
  // Whether Vesper has already spoken this answer aloud (after a summon).
  spoken: boolean;
  // Summon affordance — enabled only when the current answer is speakable.
  onSummon: () => void;
  summoning: boolean;
};

export function PrivatePanel({
  agentName,
  question,
  answer,
  correction,
  sourcesById,
  spoken,
  onSummon,
  summoning,
}: PrivatePanelProps) {
  const empty = !question && !answer && !correction;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-accent" aria-hidden />
        <h2 className="text-sm font-medium tracking-wide text-ink-muted">
          {agentName} — private panel
        </h2>
      </div>

      {empty && (
        <p className="rounded-lg border border-dashed border-hairline px-3 py-6 text-center text-sm text-ink-muted">
          Listening silently. Detected questions, suggested answers, and private
          warnings appear here — {agentName} only speaks when summoned by name.
        </p>
      )}

      {correction && (
        <CorrectionWarning correction={correction} sourcesById={sourcesById} />
      )}

      {question && (
        <DetectedQuestionCard question={question} />
      )}

      {answer && (
        <SuggestedAnswerCard
          agentName={agentName}
          answer={answer}
          sourcesById={sourcesById}
          spoken={spoken}
          onSummon={onSummon}
          summoning={summoning}
        />
      )}
    </div>
  );
}

function DetectedQuestionCard({ question }: { question: DetectedQuestion }) {
  return (
    <section className="rounded-lg border border-hairline bg-panel p-3">
      <CardLabel>Detected question</CardLabel>
      <p className="mt-1 text-sm font-medium text-ink">
        “{question.question}”
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        <span className="capitalize">{question.speaker}</span>
        {question.category && (
          <>
            <span aria-hidden>·</span>
            <span className="capitalize">{question.category}</span>
          </>
        )}
      </div>
    </section>
  );
}

function SuggestedAnswerCard({
  agentName,
  answer,
  sourcesById,
  spoken,
  onSummon,
  summoning,
}: {
  agentName: string;
  answer: AnswerCard;
  sourcesById: Map<string, SourceCard>;
  spoken: boolean;
  onSummon: () => void;
  summoning: boolean;
}) {
  const sources = answer.sourceCardIds
    .map((id) => sourcesById.get(id))
    .filter((c): c is SourceCard => Boolean(c));
  const refused = answer.sourceCardIds.length === 0 || answer.confidence === "low";

  return (
    <section className="rounded-lg border border-hairline bg-panel p-3">
      <div className="flex items-center justify-between">
        <CardLabel>Suggested answer</CardLabel>
        <ConfidenceBadge confidence={answer.confidence} />
      </div>

      <p className="mt-1 text-sm text-ink">
        {answer.answer}
      </p>

      {/* Sources (§6B) — never read aloud, but shown privately for trust. */}
      {sources.length > 0 && (
        <div className="mt-3">
          <CardLabel>Sources</CardLabel>
          <ul className="mt-1 flex flex-col gap-1">
            {sources.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-1.5 text-xs text-ink-soft"
              >
                <span aria-hidden>📄</span>
                <span className="font-medium">{c.title}</span>
                <span className="text-ink-muted">· {c.source}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* "Ready to answer if summoned" (§6B) / answered state. */}
      <div className="mt-3 border-t border-hairline pt-3">
        {spoken ? (
          <p className="flex items-center gap-2 text-xs font-medium text-accent">
            <span aria-hidden>🔊</span> Answered aloud by {agentName}.
          </p>
        ) : answer.canSpeak ? (
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-medium text-accent">
              <span aria-hidden>✋</span> Ready to answer if summoned.
            </p>
            <button
              type="button"
              onClick={onSummon}
              disabled={summoning}
              className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-panel disabled:opacity-40"
            >
              {summoning ? "Speaking…" : `Summon ${agentName}`}
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-xs text-warn">
            <span aria-hidden>🤐</span>
            {refused
              ? `Not confirmed in the knowledge base — ${agentName} would not guess aloud.`
              : `${agentName} will stay silent on this one.`}
          </p>
        )}
      </div>
    </section>
  );
}

function CorrectionWarning({
  correction,
  sourcesById,
}: {
  correction: CorrectionCard;
  sourcesById: Map<string, SourceCard>;
}) {
  const sources = correction.sourceCardIds
    .map((id) => sourcesById.get(id))
    .filter((c): c is SourceCard => Boolean(c));

  return (
    <section className="rounded-lg border border-warn-border bg-warn-soft p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-warn">
          <span aria-hidden>⚠️</span> Careful — private correction
        </span>
        <SeverityBadge severity={correction.severity} />
      </div>
      <p className="mt-2 text-sm text-ink">
        {correction.issue}
      </p>
      <p className="mt-2 text-sm text-ink">
        <span className="font-medium">Suggested correction: </span>
        {correction.suggestedCorrection}
      </p>
      {sources.length > 0 && (
        <p className="mt-2 text-xs text-warn">
          Source: {sources.map((c) => c.title).join(", ")}
        </p>
      )}
    </section>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium tracking-wide text-ink-muted">
      {children}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const styles: Record<Confidence, string> = {
    high: "bg-accent-soft text-accent",
    medium: "bg-warn-soft text-warn",
    low: "border border-hairline text-ink-muted",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[confidence]}`}>
      {confidence} confidence
    </span>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    high: "border border-warn-border bg-warn-soft text-warn",
    medium: "bg-warn-soft text-warn",
    low: "border border-hairline text-ink-muted",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[severity]}`}>
      {severity}
    </span>
  );
}
