import { assembleRequirementRegionProof } from './runtime-core.mjs';

export const SOURCE_AUTHORITY_ADAPTER_ID = 'PS-01-SOURCE-AUTHORITY-ADAPTER';

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function assertFiniteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
}

function compareStableStrings(left, right) {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function sortByStableKey(values, getKey) {
  return [...values].sort((left, right) => compareStableStrings(getKey(left), getKey(right)));
}

function countCueTermMatches(normalizedText, cueTerm) {
  let matches = 0;
  let offset = 0;

  while (offset < normalizedText.length) {
    const matchIndex = normalizedText.indexOf(cueTerm, offset);
    if (matchIndex === -1) {
      break;
    }
    matches += 1;
    offset = matchIndex + cueTerm.length;
  }

  return matches;
}

function normalizeTagLink(link, label) {
  if (!link || typeof link !== 'object') {
    throw new Error(`${label} must be an object.`);
  }

  assertNonEmptyString(link.tag_id, `${label}.tag_id`);
  assertFiniteNumber(link.weight, `${label}.weight`);

  return {
    kind: 'uses',
    tagId: link.tag_id,
    weight: link.weight,
  };
}

function normalizeExperienceRecord(record, index) {
  const label = `experience_records[${index}]`;
  if (!record || typeof record !== 'object') {
    throw new Error(`${label} must be an object.`);
  }

  assertNonEmptyString(record.id, `${label}.id`);
  assertNonEmptyString(record.label, `${label}.label`);

  const tagLinks = record.tag_links ?? [];
  assertArray(tagLinks, `${label}.tag_links`);

  return {
    kind: 'Experience',
    id: record.id,
    label: record.label,
    tagLinks: sortByStableKey(
      tagLinks.map((link, tagIndex) => normalizeTagLink(link, `${label}.tag_links[${tagIndex}]`)),
      (link) => `${link.tagId}|${link.weight}`,
    ),
  };
}

function normalizeEvidenceItem(item, index) {
  const label = `evidence_items[${index}]`;
  if (!item || typeof item !== 'object') {
    throw new Error(`${label} must be an object.`);
  }

  assertNonEmptyString(item.id, `${label}.id`);
  assertNonEmptyString(item.label, `${label}.label`);
  assertNonEmptyString(item.experience_record_id, `${label}.experience_record_id`);

  if (!item.experience_link || typeof item.experience_link !== 'object') {
    throw new Error(`${label}.experience_link must be an object.`);
  }
  assertFiniteNumber(item.experience_link.weight, `${label}.experience_link.weight`);

  const tagLinks = item.tag_links ?? [];
  assertArray(tagLinks, `${label}.tag_links`);

  return {
    kind: 'Evidence',
    id: item.id,
    label: item.label,
    experienceRecordId: item.experience_record_id,
    experienceLink: {
      kind: 'demonstrates',
      experienceRecordId: item.experience_record_id,
      weight: item.experience_link.weight,
    },
    tagLinks: sortByStableKey(
      tagLinks.map((link, tagIndex) => normalizeTagLink(link, `${label}.tag_links[${tagIndex}]`)),
      (link) => `${link.tagId}|${link.weight}`,
    ),
  };
}

function normalizeTag(tag, index) {
  const label = `taxonomy.tags[${index}]`;
  if (!tag || typeof tag !== 'object') {
    throw new Error(`${label} must be an object.`);
  }

  assertNonEmptyString(tag.id, `${label}.id`);
  assertNonEmptyString(tag.label, `${label}.label`);

  return {
    kind: 'Tag',
    id: tag.id,
    label: tag.label,
  };
}

function normalizeTagRequirementLink(link, index) {
  const label = `taxonomy.tag_requirement_links[${index}]`;
  if (!link || typeof link !== 'object') {
    throw new Error(`${label} must be an object.`);
  }

  assertNonEmptyString(link.tag_id, `${label}.tag_id`);
  assertNonEmptyString(link.requirement_id, `${label}.requirement_id`);
  assertFiniteNumber(link.weight, `${label}.weight`);

  return {
    kind: 'supports',
    tagId: link.tag_id,
    requirementId: link.requirement_id,
    weight: link.weight,
  };
}

function normalizeRequirementDefinition(requirement, index) {
  const label = `taxonomy.requirements[${index}]`;
  if (!requirement || typeof requirement !== 'object') {
    throw new Error(`${label} must be an object.`);
  }

  assertNonEmptyString(requirement.id, `${label}.id`);
  assertNonEmptyString(requirement.label, `${label}.label`);
  assertFiniteNumber(requirement.default_weight, `${label}.default_weight`);

  const cueTerms = requirement.cue_terms ?? [];
  assertArray(cueTerms, `${label}.cue_terms`);

  return {
    id: requirement.id,
    label: requirement.label,
    defaultWeight: requirement.default_weight,
    cueTerms: sortByStableKey(
      cueTerms.map((cueTerm, cueIndex) => {
        assertNonEmptyString(cueTerm, `${label}.cue_terms[${cueIndex}]`);
        return cueTerm.trim().toLowerCase();
      }),
      (cueTerm) => cueTerm,
    ),
  };
}

function normalizeTargetRegionDefinition(region, index) {
  const label = `taxonomy.target_regions[${index}]`;
  if (!region || typeof region !== 'object') {
    throw new Error(`${label} must be an object.`);
  }

  assertNonEmptyString(region.id, `${label}.id`);
  assertNonEmptyString(region.label, `${label}.label`);
  assertArray(region.requirement_ids, `${label}.requirement_ids`);

  return {
    id: region.id,
    label: region.label,
    requirementIds: sortByStableKey(
      region.requirement_ids.map((requirementId, requirementIndex) => {
        assertNonEmptyString(requirementId, `${label}.requirement_ids[${requirementIndex}]`);
        return requirementId;
      }),
      (requirementId) => requirementId,
    ),
  };
}

function normalizeTaxonomy(taxonomy) {
  if (!taxonomy || typeof taxonomy !== 'object') {
    throw new Error('taxonomy must be an object.');
  }

  assertArray(taxonomy.tags, 'taxonomy.tags');
  assertArray(taxonomy.tag_requirement_links, 'taxonomy.tag_requirement_links');
  assertArray(taxonomy.requirements, 'taxonomy.requirements');
  assertArray(taxonomy.target_regions, 'taxonomy.target_regions');

  const tags = sortByStableKey(taxonomy.tags.map(normalizeTag), (tag) => tag.id);
  const tagRequirementLinks = sortByStableKey(
    taxonomy.tag_requirement_links.map(normalizeTagRequirementLink),
    (link) => `${link.tagId}|${link.requirementId}|${link.weight}`,
  );
  const requirements = sortByStableKey(
    taxonomy.requirements.map(normalizeRequirementDefinition),
    (requirement) => requirement.id,
  );
  const targetRegions = sortByStableKey(
    taxonomy.target_regions.map(normalizeTargetRegionDefinition),
    (region) => region.id,
  );

  const tagIds = new Set(tags.map((tag) => tag.id));
  const requirementIds = new Set(requirements.map((requirement) => requirement.id));

  tagRequirementLinks.forEach((link) => {
    if (!tagIds.has(link.tagId)) {
      throw new Error(`taxonomy.tag_requirement_links references unknown tag ${link.tagId}.`);
    }
    if (!requirementIds.has(link.requirementId)) {
      throw new Error(`taxonomy.tag_requirement_links references unknown requirement ${link.requirementId}.`);
    }
  });

  targetRegions.forEach((region) => {
    region.requirementIds.forEach((requirementId) => {
      if (!requirementIds.has(requirementId)) {
        throw new Error(`taxonomy.target_regions references unknown requirement ${requirementId}.`);
      }
    });
  });

  return {
    tags,
    tagRequirementLinks,
    requirements,
    targetRegions,
  };
}

function normalizeJobPostingInput(jobPostingInput) {
  if (!jobPostingInput || typeof jobPostingInput !== 'object') {
    throw new Error('jobPostingInput must be an object.');
  }

  const textSegments = ['title', 'summary', 'text', 'description']
    .map((field) => jobPostingInput[field])
    .filter((value) => typeof value === 'string' && value.trim() !== '')
    .map((value) => value.trim());

  if (textSegments.length === 0) {
    throw new Error('jobPostingInput must include at least one non-empty text field.');
  }

  const combinedText = textSegments.join('\n\n');

  return {
    title: typeof jobPostingInput.title === 'string' ? jobPostingInput.title.trim() : '',
    combinedText,
    normalizedText: combinedText.toLowerCase(),
  };
}

function deriveRequirementCueScores(requirements, normalizedPosting) {
  return requirements.map((requirement) => {
    const cueMatches = requirement.cueTerms.map((cueTerm) => ({
      cueTerm,
      matchCount: countCueTermMatches(normalizedPosting.normalizedText, cueTerm),
    }));
    const cueMatchCount = cueMatches.reduce((sum, entry) => sum + entry.matchCount, 0);

    return {
      requirementId: requirement.id,
      label: requirement.label,
      defaultWeight: requirement.defaultWeight,
      cueMatches: cueMatches.filter((entry) => entry.matchCount > 0),
      cueMatchCount,
      derivedWeight: requirement.defaultWeight + cueMatchCount,
    };
  });
}

export function deriveWeightedTargetRegion({ taxonomy, jobPostingInput }) {
  const normalizedTaxonomy = normalizeTaxonomy(taxonomy);
  const normalizedPosting = normalizeJobPostingInput(jobPostingInput);
  const cueScores = sortByStableKey(
    deriveRequirementCueScores(normalizedTaxonomy.requirements, normalizedPosting),
    (score) => score.requirementId,
  );
  const cueScoresByRequirementId = new Map(
    cueScores.map((score) => [score.requirementId, score]),
  );

  const rankedRegions = [...normalizedTaxonomy.targetRegions].map((region) => {
    const requirementWeights = region.requirementIds.map((requirementId) => cueScoresByRequirementId.get(requirementId));
    const totalCueMatchCount = requirementWeights.reduce((sum, requirement) => sum + requirement.cueMatchCount, 0);
    const matchedRequirementCount = requirementWeights.filter((requirement) => requirement.cueMatchCount > 0).length;
    const weightedRequirementSum = requirementWeights.reduce((sum, requirement) => sum + requirement.derivedWeight, 0);

    return {
      region,
      requirementWeights,
      selectionScore: {
        totalCueMatchCount,
        matchedRequirementCount,
        weightedRequirementSum,
        stableRegionKey: region.id,
      },
    };
  }).sort((left, right) => {
    if (left.selectionScore.totalCueMatchCount !== right.selectionScore.totalCueMatchCount) {
      return right.selectionScore.totalCueMatchCount - left.selectionScore.totalCueMatchCount;
    }
    if (left.selectionScore.matchedRequirementCount !== right.selectionScore.matchedRequirementCount) {
      return right.selectionScore.matchedRequirementCount - left.selectionScore.matchedRequirementCount;
    }
    if (left.selectionScore.weightedRequirementSum !== right.selectionScore.weightedRequirementSum) {
      return right.selectionScore.weightedRequirementSum - left.selectionScore.weightedRequirementSum;
    }
    return compareStableStrings(left.region.id, right.region.id);
  });

  const selectedRegion = rankedRegions[0];

  return {
    jobPostingAnalysis: {
      title: normalizedPosting.title,
      combinedText: normalizedPosting.combinedText,
      requirementCueScores: cueScores,
    },
    targetRegion: {
      id: selectedRegion.region.id,
      label: selectedRegion.region.label,
      requirements: selectedRegion.requirementWeights.map((requirement) => ({
        kind: 'Requirement',
        id: requirement.requirementId,
        label: requirement.label,
        weight: requirement.derivedWeight,
      })),
    },
    selectionMetadata: {
      rankedRegionIds: rankedRegions.map((entry) => entry.region.id),
      selectionScore: selectedRegion.selectionScore,
      requirementWeights: selectedRegion.requirementWeights,
    },
  };
}

export function adaptApprovedSourceFactsToProofInput(sourceAuthority) {
  if (!sourceAuthority || typeof sourceAuthority !== 'object') {
    throw new Error('sourceAuthority must be an object.');
  }

  assertArray(sourceAuthority.experience_records, 'experience_records');
  assertArray(sourceAuthority.evidence_items, 'evidence_items');

  const normalizedTaxonomy = normalizeTaxonomy(sourceAuthority.taxonomy);
  const derivedTargetRegion = deriveWeightedTargetRegion({
    taxonomy: sourceAuthority.taxonomy,
    jobPostingInput: sourceAuthority.jobPostingInput,
  });
  const selectedRequirementIds = new Set(
    derivedTargetRegion.targetRegion.requirements.map((requirement) => requirement.id),
  );
  const sourceSlice = {
    experienceRecords: sortByStableKey(
      sourceAuthority.experience_records.map(normalizeExperienceRecord),
      (record) => record.id,
    ),
    evidenceItems: sortByStableKey(
      sourceAuthority.evidence_items.map(normalizeEvidenceItem),
      (item) => item.id,
    ),
    taxonomy: {
      tags: normalizedTaxonomy.tags,
      tagRequirementLinks: normalizedTaxonomy.tagRequirementLinks.filter(
        (link) => selectedRequirementIds.has(link.requirementId),
      ),
    },
  };

  return {
    adapterMetadata: {
      adapterId: SOURCE_AUTHORITY_ADAPTER_ID,
      sourceAuthorityUsage: {
        experience_records: sourceAuthority.experience_records.length,
        evidence_items: sourceAuthority.evidence_items.length,
        taxonomy: 'used',
        profiles: 'unused',
        settings: 'unused',
      },
      unusedSourceAuthorities: ['profiles', 'settings'],
      targetRegionSelection: {
        id: derivedTargetRegion.targetRegion.id,
        label: derivedTargetRegion.targetRegion.label,
        rankedRegionIds: derivedTargetRegion.selectionMetadata.rankedRegionIds,
        selectionScore: derivedTargetRegion.selectionMetadata.selectionScore,
        requirementWeights: derivedTargetRegion.selectionMetadata.requirementWeights,
      },
      jobPostingAnalysis: derivedTargetRegion.jobPostingAnalysis,
    },
    proofInput: {
      sourceSlice,
      targetRegion: derivedTargetRegion.targetRegion,
    },
  };
}

export function assembleApprovedSourceFactsProof(sourceAuthority) {
  const adapted = adaptApprovedSourceFactsToProofInput(sourceAuthority);

  return {
    adapterMetadata: adapted.adapterMetadata,
    proof: assembleRequirementRegionProof(adapted.proofInput),
  };
}