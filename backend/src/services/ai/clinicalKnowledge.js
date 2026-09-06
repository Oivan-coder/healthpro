const registry = require("./clinical-sources.json");

const SOURCE_CATALOG = Object.fromEntries(
  Object.entries(registry.sources || {}).map(([key, source], index) => [key, {
    id: key,
    label: source.label,
    url: source.url,
    role: source.role,
    priority: index + 1
  }])
);

const GROUPS = (registry.scenarios || []).map((scenario) => ({ ...scenario }));

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasMatches(haystack, alias) {
  const normalizedAlias = normalize(alias);
  if (!normalizedAlias) return false;

  if (/^[a-z0-9-]{1,4}$/i.test(normalizedAlias)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedAlias)}([^a-z0-9]|$)`, "i").test(haystack);
  }

  return haystack.includes(normalizedAlias);
}

function findGroup(context = {}) {
  const haystack = normalize(`${context.test_code || ""} ${context.test_name || ""}`);
  const candidates = GROUPS.map(group => ({group, score:Math.max(0,...(group.aliases || [])
    .filter(alias => aliasMatches(haystack,alias)).map(alias => normalize(alias).length))}))
    .filter(item => item.score>0).sort((a,b) => b.score-a.score);
  if(!candidates.length || candidates[0].score === candidates[1]?.score) return null;
  return candidates[0].group;
}

function documentList(group) {
  return (group.documents || [])
    .map(key => {
      const document = registry.documents?.[key];
      if (!document) return null;
      return {
        key,
        title: document.title,
        year: document.year || null,
        id: document.catalog_id || null,
        url: document.url || SOURCE_CATALOG[document.source]?.url || null,
        source: document.source || null,
        status: document.status || null
      };
    })
    .filter(Boolean);
}

function sourceList(group) {
  const result = [];
  const documents = documentList(group);

  if (documents.length) {
    const primary = SOURCE_CATALOG.minzdrav;
    if (primary) result.push({ ...primary });
  }

  if (group.secondary_source && SOURCE_CATALOG[group.secondary_source]) {
    result.push({ ...SOURCE_CATALOG[group.secondary_source] });
  } else if (SOURCE_CATALOG.helix) {
    result.push({ ...SOURCE_CATALOG.helix });
  }

  if (SOURCE_CATALOG.loinc) result.push({ ...SOURCE_CATALOG.loinc });
  return result;
}

function referenceText(context = {}) {
  const low = context.reference_low ?? context.low ?? context.referenceLow ?? context.ref_low ?? null;
  const high = context.reference_high ?? context.high ?? context.referenceHigh ?? context.ref_high ?? null;
  const unit = context.unit ? ` ${context.unit}` : "";
  if (low !== null && high !== null) return `${low}–${high}${unit}`;
  if (low !== null) return `от ${low}${unit}`;
  if (high !== null) return `до ${high}${unit}`;
  return context.reference || context.referenceLabel || context.reference_text || context.referenceText || "";
}

function knowledgeFor(context = {}) {
  const group = findGroup(context);
  if (!group) return null;

  const direction = context.flag === "low" ? "low" : context.flag === "high" ? "high" : null;
  return {
    groupId: group.id,
    groupTitle: group.title,
    interpretation: direction
      ? group[direction]
      : "",
    related: [...(group.related || [])],
    documents: documentList(group),
    sources: sourceList(group),
    reference: referenceText(context),
    registryVersion: registry.version || 1,
    lastReviewed: registry.policy?.last_reviewed || null
  };
}

function missingRelated(knowledge, patientLabs = []) {
  if (!knowledge) return [];
  const available = normalize(patientLabs.map(lab => `${lab.name || ""} ${lab.code || ""}`).join(" | "));
  return knowledge.related.filter(name => {
    const variants = String(name).split("/").map(item => normalize(item)).filter(Boolean);
    return !variants.some(variant => available.includes(variant));
  });
}

module.exports = {
  SOURCE_CATALOG,
  GROUPS,
  findGroup,
  knowledgeFor,
  missingRelated,
  referenceText
};
