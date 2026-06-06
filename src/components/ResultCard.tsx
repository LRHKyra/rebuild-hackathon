// TODO(spec): product.md §Core Flow / §Wow moment — this card renders the demo's
// result. It currently shows placeholder fixture data. Once product.md is filled,
// pass in the real DemoResult produced by the core flow.

import type { DemoResult } from "@/types";

type ResultCardProps = {
  result: DemoResult;
};

export function ResultCard({ result }: ResultCardProps) {
  return (
    <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <h2 className="text-lg font-semibold">{result.title}</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        {result.summary}
      </p>
      {result.details.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-sm text-gray-600 dark:text-gray-300">
          {result.details.map((detail, index) => (
            <li key={index}>{detail}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
