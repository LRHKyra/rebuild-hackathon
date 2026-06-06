// Traces to: spec/product.md §6B (private Vesper panel cards) + §10 (eval) + §11.
// Lane C owns this file. Pure presentational: given the current analysis state,
// render the six panel elements — detected question, suggested answer, sources,
// confidence, correction warning, and "ready to answer if summoned". This panel is
// PRIVATE to the rep; nothing here is spoken unless the rep summons Vesper.

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
        <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" aria-hidden />
        <h2 className="text-sm font-semibold tracking-wide text-gray-700 uppercase dark:text-gray-300">
          {agentName} — private panel
        </h2>
      </div>

      {empty && (
        <p className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-500 dark:border-gray-700">
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
    <section className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <CardLabel>Detected question</CardLabel>
      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
        “{question.question}”
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
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
    <section className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <CardLabel>Suggested answer</CardLabel>
        <ConfidenceBadge confidence={answer.confidence} />
      </div>

      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
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
                className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"
              >
                <span aria-hidden>📄</span>
                <span className="font-medium">{c.title}</span>
                <span className="text-gray-400">· {c.source}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* "Ready to answer if summoned" (§6B) / answered state. */}
      <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
        {spoken ? (
          <p className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span aria-hidden>🔊</span> Answered aloud by {agentName}.
          </p>
        ) : answer.canSpeak ? (
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
              <span aria-hidden>✋</span> Ready to answer if summoned.
            </p>
            <button
              type="button"
              onClick={onSummon}
              disabled={summoning}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              {summoning ? "Speaking…" : `Summon ${agentName}`}
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
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
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">
          <span aria-hidden>⚠️</span> Careful — private correction
        </span>
        <SeverityBadge severity={correction.severity} />
      </div>
      <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">
        {correction.issue}
      </p>
      <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">
        <span className="font-semibold">Suggested correction: </span>
        {correction.suggestedCorrection}
      </p>
      {sources.length > 0 && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          Source: {sources.map((c) => c.title).join(", ")}
        </p>
      )}
    </section>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
      {children}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const styles: Record<Confidence, string> = {
    high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    low: "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[confidence]}`}>
      {confidence} confidence
    </span>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    high: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    medium: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    low: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[severity]}`}>
      {severity}
    </span>
  );
}
