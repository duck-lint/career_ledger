export const SLICE_ID = 'PS-01';

export const SUPPORTED_NODE_KINDS = Object.freeze([
  'Experience',
  'Evidence',
  'Tag',
  'Requirement',
]);

export const SUPPORTED_EDGE_KINDS = Object.freeze([
  'demonstrates',
  'uses',
  'supports',
]);

const SEMANTIC_POSITION_BY_KIND = Object.freeze({
  Experience: 'source-experience',
  Evidence: 'source-evidence',
  Tag: 'semantic-tag',
  Requirement: 'target-requirement',
});

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

function assertAllowedKind(kind, allowedKinds, label) {
  assertNonEmptyString(kind, label);
  if (!allowedKinds.includes(kind)) {
    throw new Error(`${label} must be one of ${allowedKinds.join(', ')}.`);
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

function createNodeId(kind, id) {
  return `${kind}:${id}`;
}

function createEdgeId(fromNodeId, kind, toNodeId) {
  return `${fromNodeId}|${kind}|${toNodeId}`;
}

function validateWeightedLink(link, label, expectedKind, targetKey) {
  if (!link || typeof link !== 'object') {
    throw new Error(`${label} must be an object.`);
  }

  assertAllowedKind(link.kind, SUPPORTED_EDGE_KINDS, `${label}.kind`);
  if (link.kind !== expectedKind) {
    throw new Error(`${label}.kind must be ${expectedKind}.`);
  }

  assertNonEmptyString(link[targetKey], `${label}.${targetKey}`);
  assertFiniteNumber(link.weight, `${label}.weight`);
}

function normalizeExperienceRecord(record, index) {
  const label = `sourceSlice.experienceRecords[${index}]`;
  if (!record || typeof record !== 'object') {
    throw new Error(`${label} must be an object.`);
  }

  assertAllowedKind(record.kind, SUPPORTED_NODE_KINDS, `${label}.kind`);
  if (record.kind !== 'Experience') {
    throw new Error(`${label}.kind must be Experience.`);
  }

  assertNonEmptyString(record.id, `${label}.id`);
  assertNonEmptyString(record.label, `${label}.label`);

  const tagLinks = record.tagLinks ?? [];
  assertArray(tagLinks, `${label}.tagLinks`);
  tagLinks.forEach((link, tagIndex) => {
    validateWeightedLink(link, `${label}.tagLinks[${tagIndex}]`, 'uses', 'tagId');
  });

  return {
    kind: record.kind,
    id: record.id,
    label: record.label,
    tagLinks: sortByStableKey(tagLinks, (link) => `${link.tagId}|${link.kind}|${link.weight}`),
  };
}

function normalizeEvidenceItem(item, index) {
  const label = `sourceSlice.evidenceItems[${index}]`;
  if (!item || typeof item !== 'object') {
    throw new Error(`${label} must be an object.`);
  }

  assertAllowedKind(item.kind, SUPPORTED_NODE_KINDS, `${label}.kind`);
  if (item.kind !== 'Evidence') {
    throw new Error(`${label}.kind must be Evidence.`);
  }

  assertNonEmptyString(item.id, `${label}.id`);
  assertNonEmptyString(item.label, `${label}.label`);
  assertNonEmptyString(item.experienceRecordId, `${label}.experienceRecordId`);

  validateWeightedLink(item.experienceLink, `${label}.experienceLink`, 'demonstrates', 'experienceRecordId');
  if (item.experienceLink.experienceRecordId !== item.experienceRecordId) {
    throw new Error(`${label}.experienceLink.experienceRecordId must match ${label}.experienceRecordId.`);
  }

  const tagLinks = item.tagLinks ?? [];
  assertArray(tagLinks, `${label}.tagLinks`);
  tagLinks.forEach((link, tagIndex) => {
    validateWeightedLink(link, `${label}.tagLinks[${tagIndex}]`, 'uses', 'tagId');
  });

  return {
    kind: item.kind,
    id: item.id,
    label: item.label,
    experienceRecordId: item.experienceRecordId,
    experienceLink: {
      kind: item.experienceLink.kind,
      experienceRecordId: item.experienceLink.experienceRecordId,
      weight: item.experienceLink.weight,
    },
    tagLinks: sortByStableKey(tagLinks, (link) => `${link.tagId}|${link.kind}|${link.weight}`),
  };
}

function normalizeTag(tag, index) {
  const label = `sourceSlice.taxonomy.tags[${index}]`;
  if (!tag || typeof tag !== 'object') {
    throw new Error(`${label} must be an object.`);
  }

  assertAllowedKind(tag.kind, SUPPORTED_NODE_KINDS, `${label}.kind`);
  if (tag.kind !== 'Tag') {
    throw new Error(`${label}.kind must be Tag.`);
  }

  assertNonEmptyString(tag.id, `${label}.id`);
  assertNonEmptyString(tag.label, `${label}.label`);

  return {
    kind: tag.kind,
    id: tag.id,
    label: tag.label,
  };
}

function normalizeTagRequirementLink(link, index) {
  const label = `sourceSlice.taxonomy.tagRequirementLinks[${index}]`;
  validateWeightedLink(link, label, 'supports', 'requirementId');
  assertNonEmptyString(link.tagId, `${label}.tagId`);

  return {
    kind: link.kind,
    tagId: link.tagId,
    requirementId: link.requirementId,
    weight: link.weight,
  };
}

function normalizeRequirement(requirement, index) {
  const label = `targetRegion.requirements[${index}]`;
  if (!requirement || typeof requirement !== 'object') {
    throw new Error(`${label} must be an object.`);
  }

  assertAllowedKind(requirement.kind, SUPPORTED_NODE_KINDS, `${label}.kind`);
  if (requirement.kind !== 'Requirement') {
    throw new Error(`${label}.kind must be Requirement.`);
  }

  assertNonEmptyString(requirement.id, `${label}.id`);
  assertNonEmptyString(requirement.label, `${label}.label`);
  assertFiniteNumber(requirement.weight, `${label}.weight`);

  return {
    kind: requirement.kind,
    id: requirement.id,
    label: requirement.label,
    weight: requirement.weight,
  };
}

export function normalizeSourceSlice(sourceSlice) {
  if (!sourceSlice || typeof sourceSlice !== 'object') {
    throw new Error('sourceSlice must be an object.');
  }

  assertArray(sourceSlice.experienceRecords, 'sourceSlice.experienceRecords');
  assertArray(sourceSlice.evidenceItems, 'sourceSlice.evidenceItems');

  if (!sourceSlice.taxonomy || typeof sourceSlice.taxonomy !== 'object') {
    throw new Error('sourceSlice.taxonomy must be an object.');
  }

  assertArray(sourceSlice.taxonomy.tags, 'sourceSlice.taxonomy.tags');
  assertArray(sourceSlice.taxonomy.tagRequirementLinks, 'sourceSlice.taxonomy.tagRequirementLinks');

  const experienceRecords = sortByStableKey(
    sourceSlice.experienceRecords.map(normalizeExperienceRecord),
    (record) => record.id,
  );
  const evidenceItems = sortByStableKey(
    sourceSlice.evidenceItems.map(normalizeEvidenceItem),
    (item) => item.id,
  );
  const tags = sortByStableKey(sourceSlice.taxonomy.tags.map(normalizeTag), (tag) => tag.id);
  const tagRequirementLinks = sortByStableKey(
    sourceSlice.taxonomy.tagRequirementLinks.map(normalizeTagRequirementLink),
    (link) => `${link.tagId}|${link.requirementId}|${link.weight}`,
  );

  return {
    experienceRecords,
    evidenceItems,
    taxonomy: {
      tags,
      tagRequirementLinks,
    },
  };
}

export function normalizeTargetRegion(targetRegion) {
  if (!targetRegion || typeof targetRegion !== 'object') {
    throw new Error('targetRegion must be an object.');
  }

  assertNonEmptyString(targetRegion.id, 'targetRegion.id');
  assertNonEmptyString(targetRegion.label, 'targetRegion.label');
  assertArray(targetRegion.requirements, 'targetRegion.requirements');

  return {
    id: targetRegion.id,
    label: targetRegion.label,
    requirements: sortByStableKey(
      targetRegion.requirements.map(normalizeRequirement),
      (requirement) => `${requirement.id}|${requirement.weight}`,
    ),
  };
}

function ensureKnownReferences(sourceSlice, targetRegion) {
  const experienceIds = new Set(sourceSlice.experienceRecords.map((record) => record.id));
  const tagIds = new Set(sourceSlice.taxonomy.tags.map((tag) => tag.id));
  const requirementIds = new Set(targetRegion.requirements.map((requirement) => requirement.id));

  sourceSlice.experienceRecords.forEach((record) => {
    record.tagLinks.forEach((link) => {
      if (!tagIds.has(link.tagId)) {
        throw new Error(`Experience ${record.id} references unknown tag ${link.tagId}.`);
      }
    });
  });

  sourceSlice.evidenceItems.forEach((item) => {
    if (!experienceIds.has(item.experienceRecordId)) {
      throw new Error(`Evidence ${item.id} references unknown experience ${item.experienceRecordId}.`);
    }

    item.tagLinks.forEach((link) => {
      if (!tagIds.has(link.tagId)) {
        throw new Error(`Evidence ${item.id} references unknown tag ${link.tagId}.`);
      }
    });
  });

  sourceSlice.taxonomy.tagRequirementLinks.forEach((link) => {
    if (!tagIds.has(link.tagId)) {
      throw new Error(`Taxonomy link references unknown tag ${link.tagId}.`);
    }
    if (!requirementIds.has(link.requirementId)) {
      throw new Error(`Taxonomy link references unknown requirement ${link.requirementId}.`);
    }
  });
}

export function buildSemanticGraph({ sourceSlice, targetRegion }) {
  const normalizedSourceSlice = normalizeSourceSlice(sourceSlice);
  const normalizedTargetRegion = normalizeTargetRegion(targetRegion);
  ensureKnownReferences(normalizedSourceSlice, normalizedTargetRegion);

  const nodes = new Map();
  const edges = [];
  const adjacency = new Map();

  function addNode(node) {
    const nodeId = createNodeId(node.kind, node.id);
    if (!nodes.has(nodeId)) {
      nodes.set(nodeId, {
        ...node,
        nodeId,
      });
    }
    return nodes.get(nodeId);
  }

  function addEdge(fromNodeId, toNodeId, kind, weight) {
    assertAllowedKind(kind, SUPPORTED_EDGE_KINDS, 'edge.kind');
    assertFiniteNumber(weight, 'edge.weight');

    const edge = {
      edgeId: createEdgeId(fromNodeId, kind, toNodeId),
      fromNodeId,
      toNodeId,
      kind,
      weight,
    };

    edges.push(edge);
    if (!adjacency.has(fromNodeId)) {
      adjacency.set(fromNodeId, []);
    }
    adjacency.get(fromNodeId).push(edge);
  }

  normalizedSourceSlice.experienceRecords.forEach((record) => {
    const experienceNode = addNode(record);
    record.tagLinks.forEach((link) => {
      const tag = normalizedSourceSlice.taxonomy.tags.find((entry) => entry.id === link.tagId);
      const tagNode = addNode(tag);
      addEdge(experienceNode.nodeId, tagNode.nodeId, link.kind, link.weight);
    });
  });

  normalizedSourceSlice.evidenceItems.forEach((item) => {
    const evidenceNode = addNode(item);
    const experienceNode = addNode(
      normalizedSourceSlice.experienceRecords.find((record) => record.id === item.experienceRecordId),
    );
    addEdge(
      experienceNode.nodeId,
      evidenceNode.nodeId,
      item.experienceLink.kind,
      item.experienceLink.weight,
    );
    item.tagLinks.forEach((link) => {
      const tag = normalizedSourceSlice.taxonomy.tags.find((entry) => entry.id === link.tagId);
      const tagNode = addNode(tag);
      addEdge(evidenceNode.nodeId, tagNode.nodeId, link.kind, link.weight);
    });
  });

  normalizedTargetRegion.requirements.forEach((requirement) => {
    addNode(requirement);
  });

  normalizedSourceSlice.taxonomy.tagRequirementLinks.forEach((link) => {
    const tagNode = addNode(
      normalizedSourceSlice.taxonomy.tags.find((entry) => entry.id === link.tagId),
    );
    const requirementNode = addNode(
      normalizedTargetRegion.requirements.find((entry) => entry.id === link.requirementId),
    );
    addEdge(tagNode.nodeId, requirementNode.nodeId, link.kind, link.weight);
  });

  const sortedEdges = sortByStableKey(edges, (edge) => edge.edgeId);
  const sortedAdjacency = new Map();
  adjacency.forEach((nodeEdges, nodeId) => {
    sortedAdjacency.set(nodeId, sortByStableKey(nodeEdges, (edge) => edge.edgeId));
  });

  const evidenceByExperienceId = new Map();
  normalizedSourceSlice.evidenceItems.forEach((item) => {
    if (!evidenceByExperienceId.has(item.experienceRecordId)) {
      evidenceByExperienceId.set(item.experienceRecordId, []);
    }
    evidenceByExperienceId.get(item.experienceRecordId).push(item);
  });
  evidenceByExperienceId.forEach((items, experienceRecordId) => {
    evidenceByExperienceId.set(
      experienceRecordId,
      sortByStableKey(items, (item) => item.id),
    );
  });

  return {
    sliceId: SLICE_ID,
    sourceSlice: normalizedSourceSlice,
    targetRegion: normalizedTargetRegion,
    nodes,
    edges: sortedEdges,
    adjacency: sortedAdjacency,
    experienceNodeIds: normalizedSourceSlice.experienceRecords.map((record) => createNodeId(record.kind, record.id)),
    evidenceByExperienceId,
  };
}

function createStablePathKey(nodeIds, edges) {
  const parts = [nodeIds[0]];
  for (let index = 0; index < edges.length; index += 1) {
    parts.push(edges[index].kind, nodeIds[index + 1]);
  }
  return parts.join('|');
}

function findSupportingEvidenceIds(graph, experienceRecordId, tagIds) {
  const evidenceItems = graph.evidenceByExperienceId.get(experienceRecordId) ?? [];
  return evidenceItems
    .filter((item) => item.tagLinks.some((link) => tagIds.includes(link.tagId)))
    .map((item) => item.id)
    .sort(compareStableStrings);
}

function createSemanticPositions(pathNodes) {
  return pathNodes.map((node, index) => ({
    index,
    nodeId: node.nodeId,
    nodeKind: node.kind,
    semanticPosition: SEMANTIC_POSITION_BY_KIND[node.kind],
    label: node.label,
  }));
}

function createOrderedSequence(pathNodes, pathEdges) {
  const sequence = [];

  for (let index = 0; index < pathNodes.length; index += 1) {
    const node = pathNodes[index];
    sequence.push({
      type: 'node',
      nodeId: node.nodeId,
      sourceId: node.id,
      nodeKind: node.kind,
      label: node.label,
    });

    if (index < pathEdges.length) {
      const edge = pathEdges[index];
      sequence.push({
        type: 'edge',
        edgeId: edge.edgeId,
        edgeKind: edge.kind,
        weight: edge.weight,
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
      });
    }
  }

  return sequence;
}

function materializePath(graph, nodeIds, pathEdges) {
  const pathNodes = nodeIds.map((nodeId) => graph.nodes.get(nodeId));
  const experienceNode = pathNodes.find((node) => node.kind === 'Experience');
  const requirementNode = pathNodes.find((node) => node.kind === 'Requirement');
  const tagIds = pathNodes.filter((node) => node.kind === 'Tag').map((node) => node.id);
  const supportingEvidenceIds = experienceNode
    ? findSupportingEvidenceIds(graph, experienceNode.id, tagIds)
    : [];
  const explicitRelationWeightSum = pathEdges.reduce((sum, edge) => sum + edge.weight, 0);
  const stablePathKey = createStablePathKey(nodeIds, pathEdges);

  return {
    requirementId: requirementNode?.id ?? null,
    pathKey: stablePathKey,
    nodeIds,
    nodes: pathNodes,
    edges: pathEdges,
    orderedSequence: createOrderedSequence(pathNodes, pathEdges),
    semanticPositions: createSemanticPositions(pathNodes),
    supportingExperienceRecordIds: experienceNode ? [experienceNode.id] : [],
    supportingEvidenceItemIds: supportingEvidenceIds,
    score: {
      evidenceSupportCount: supportingEvidenceIds.length,
      explicitRelationWeightSum,
      hopCount: pathEdges.length,
      stablePathKey,
    },
    explanation: {
      experienceRecordId: experienceNode?.id ?? null,
      requirementId: requirementNode?.id ?? null,
      traversedTagIds: tagIds,
      evidenceSupportCount: supportingEvidenceIds.length,
      explicitRelationWeightSum,
      rationale: experienceNode && requirementNode
        ? `${experienceNode.label} reaches ${requirementNode.label} through ${supportingEvidenceIds.length} evidence-backed support link(s).`
        : 'Path could not be explained.',
    },
  };
}

export function enumerateRequirementPaths(graph, requirementId) {
  const requirementNodeId = createNodeId('Requirement', requirementId);
  if (!graph.nodes.has(requirementNodeId)) {
    throw new Error(`Unknown requirement ${requirementId}.`);
  }

  const paths = [];

  function walk(currentNodeId, targetNodeId, visitedNodeIds, currentEdges) {
    if (currentNodeId === targetNodeId) {
      paths.push(materializePath(graph, [...visitedNodeIds], [...currentEdges]));
      return;
    }

    const nextEdges = graph.adjacency.get(currentNodeId) ?? [];
    nextEdges.forEach((edge) => {
      if (visitedNodeIds.includes(edge.toNodeId)) {
        return;
      }
      visitedNodeIds.push(edge.toNodeId);
      currentEdges.push(edge);
      walk(edge.toNodeId, targetNodeId, visitedNodeIds, currentEdges);
      currentEdges.pop();
      visitedNodeIds.pop();
    });
  }

  graph.experienceNodeIds.forEach((experienceNodeId) => {
    walk(experienceNodeId, requirementNodeId, [experienceNodeId], []);
  });

  return sortByStableKey(paths, (path) => path.pathKey);
}

export function isEvidenceBackedPath(path) {
  const includesEvidenceNode = path.nodes.some((node) => node.kind === 'Evidence');
  return includesEvidenceNode && path.score.evidenceSupportCount > 0;
}

export function rankPaths(paths) {
  return [...paths].sort((left, right) => {
    if (left.score.evidenceSupportCount !== right.score.evidenceSupportCount) {
      return right.score.evidenceSupportCount - left.score.evidenceSupportCount;
    }
    if (left.score.explicitRelationWeightSum !== right.score.explicitRelationWeightSum) {
      return right.score.explicitRelationWeightSum - left.score.explicitRelationWeightSum;
    }
    if (left.score.hopCount !== right.score.hopCount) {
      return left.score.hopCount - right.score.hopCount;
    }
    return compareStableStrings(left.score.stablePathKey, right.score.stablePathKey);
  });
}

export function enumerateValidRequirementPaths(graph, requirementId) {
  return rankPaths(
    enumerateRequirementPaths(graph, requirementId).filter((path) => isEvidenceBackedPath(path)),
  );
}

function createSupportedResult(requirement, selectedPath) {
  return {
    requirementId: requirement.id,
    requirementLabel: requirement.label,
    status: 'supported',
    rationale: selectedPath.explanation.rationale,
    supportingExperienceRecordIds: selectedPath.supportingExperienceRecordIds,
    supportingEvidenceItemIds: selectedPath.supportingEvidenceItemIds,
    selectedPath: {
      pathKey: selectedPath.pathKey,
      orderedSequence: selectedPath.orderedSequence,
      semanticPositions: selectedPath.semanticPositions,
      score: selectedPath.score,
      explanation: selectedPath.explanation,
    },
  };
}

function createUnsupportedResult(requirement) {
  return {
    requirementId: requirement.id,
    requirementLabel: requirement.label,
    status: 'unsupported',
    rationale: `No valid evidence-backed path qualifies for ${requirement.label}.`,
    supportingExperienceRecordIds: [],
    supportingEvidenceItemIds: [],
    selectedPath: null,
  };
}

export function assembleRequirementRegionProof({ sourceSlice, targetRegion }) {
  const graph = buildSemanticGraph({ sourceSlice, targetRegion });
  const results = graph.targetRegion.requirements.map((requirement) => {
    const rankedPaths = enumerateValidRequirementPaths(graph, requirement.id);
    return rankedPaths.length > 0
      ? createSupportedResult(requirement, rankedPaths[0])
      : createUnsupportedResult(requirement);
  });

  return {
    sliceId: SLICE_ID,
    targetRegion: {
      id: graph.targetRegion.id,
      label: graph.targetRegion.label,
      requirements: graph.targetRegion.requirements.map((requirement) => ({
        id: requirement.id,
        label: requirement.label,
        weight: requirement.weight,
      })),
    },
    results,
  };
}