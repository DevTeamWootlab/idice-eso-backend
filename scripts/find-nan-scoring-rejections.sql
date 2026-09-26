SELECT
  a."id",
  a."applicationRef",
  a."organisationLegalName",
  a."status",
  a."finalScorePercent"::text AS stored_final_score,
  c1."compositePercentage" AS reviewer1_score,
  c2."compositePercentage" AS reviewer2_score,
  ROUND((c1."compositePercentage" + c2."compositePercentage") / 2, 2) AS recomputed_average,
  ABS(c1."compositePercentage" - c2."compositePercentage") AS variance,
  l."created_at" AS rejected_at
FROM "applications" a
JOIN "audit_logs" l
  ON l."entityType" = 'Application'
 AND l."entityId" = a."id"::text
 AND l."action" = 'SCORE_FINALIZED_REJECTED'
LEFT JOIN LATERAL (
  SELECT "compositePercentage" FROM "score_cards"
  WHERE "applicationId" = a."id" AND "submitted" = true
  ORDER BY "reviewerSlot" ASC LIMIT 1
) c1 ON true
LEFT JOIN LATERAL (
  SELECT "compositePercentage" FROM "score_cards"
  WHERE "applicationId" = a."id" AND "submitted" = true
  ORDER BY "reviewerSlot" ASC OFFSET 1 LIMIT 1
) c2 ON true
WHERE a."status"::text = 'REJECTED'
ORDER BY l."created_at" DESC;
