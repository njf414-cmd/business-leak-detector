import {
  getAliasesForField,
  normalizeFieldName,
} from "./field-aliases";

export type FieldMatch = {
  sourceField: string;
  targetField: string;
  confidence: number;
  reason: string;
};

export type FieldMappingResult = {
  matches: FieldMatch[];
  unmappedSourceFields: string[];
  unmappedTargetFields: string[];
};

function tokenize(value: string) {
  return normalizeFieldName(value)
    .split(" ")
    .filter(Boolean);
}

function exactMatchScore(
  source: string,
  target: string
) {
  return normalizeFieldName(source) ===
    normalizeFieldName(target)
    ? 1
    : 0;
}

function aliasMatchScore(
  source: string,
  target: string
) {
  const normalizedSource =
    normalizeFieldName(source);

  const aliases =
    getAliasesForField(target);

  for (const alias of aliases) {
    if (
      normalizeFieldName(alias) ===
      normalizedSource
    ) {
      return 0.98;
    }
  }

  return 0;
}

function containmentScore(
  source: string,
  target: string
) {
  const a =
    normalizeFieldName(source);

  const aliases =
    getAliasesForField(target)
      .map(normalizeFieldName);

  for (const alias of aliases) {
    if (
      a.length > 0 && alias.length > 0 && (
        ` ${a} `.includes(` ${alias} `) ||
        ` ${alias} `.includes(` ${a} `)
      )
    ) {
      return 0.88;
    }
  }

  return 0;
}

function tokenOverlapScore(
  source: string,
  target: string
) {
  const sourceTokens =
    tokenize(source);

  const aliases =
    getAliasesForField(target);

  let best = 0;

  for (const alias of aliases) {
    const aliasTokens =
      tokenize(alias);

    if (
      sourceTokens.length === 0 ||
      aliasTokens.length === 0
    ) {
      continue;
    }

    const sourceSet =
      new Set(sourceTokens);

    const aliasSet =
      new Set(aliasTokens);

    let overlap = 0;

    for (const token of sourceSet) {
      if (aliasSet.has(token)) {
        overlap += 1;
      }
    }

    const denominator =
      Math.max(
        sourceSet.size,
        aliasSet.size
      );

    const score =
      overlap / denominator;

    best =
      Math.max(
        best,
        score * 0.82
      );
  }

  return best;
}

function scoreField(
  source: string,
  target: string
) {
  const scores = [
    {
      score:
        exactMatchScore(
          source,
          target
        ),
      reason:
        "exact canonical match",
    },
    {
      score:
        aliasMatchScore(
          source,
          target
        ),
      reason:
        "exact alias match",
    },
    {
      score:
        containmentScore(
          source,
          target
        ),
      reason:
        "partial name match",
    },
    {
      score:
        tokenOverlapScore(
          source,
          target
        ),
      reason:
        "token similarity",
    },
  ];

  return scores.sort(
    (a, b) =>
      b.score - a.score
  )[0];
}

export function mapFields(
  sourceFields: string[],
  targetFields: string[],
  minimumConfidence = 0.55
): FieldMappingResult {
  const candidates: FieldMatch[] = [];

  for (const sourceField of sourceFields) {
    for (const targetField of targetFields) {
      const result =
        scoreField(
          sourceField,
          targetField
        );

      if (
        result.score >=
        minimumConfidence
      ) {
        candidates.push({
          sourceField,
          targetField,
          confidence:
            Number(
              result.score.toFixed(3)
            ),
          reason:
            result.reason,
        });
      }
    }
  }

  // A customer alias should name the customer when that target exists,
  // while legacy consumers requesting only Record retain their existing mapping.
  const genericRank = (field: string) => field === "Record" || field === "Revenue Impact" ? 1 : 0;
  candidates.sort((a, b) =>
    b.confidence - a.confidence || genericRank(a.targetField) - genericRank(b.targetField)
  );

  const usedSources =
    new Set<string>();

  const usedTargets =
    new Set<string>();

  const matches:
    FieldMatch[] = [];

  for (const candidate of candidates) {
    if (
      usedSources.has(
        candidate.sourceField
      ) ||
      usedTargets.has(
        candidate.targetField
      )
    ) {
      continue;
    }

    matches.push(candidate);

    usedSources.add(
      candidate.sourceField
    );

    usedTargets.add(
      candidate.targetField
    );
  }

  return {
    matches,

    unmappedSourceFields:
      sourceFields.filter(
        (field) =>
          !usedSources.has(field)
      ),

    unmappedTargetFields:
      targetFields.filter(
        (field) =>
          !usedTargets.has(field)
      ),
  };
}
