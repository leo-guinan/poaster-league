import {
  QualityCheck,
  IntentType,
  RelationshipType,
} from "@/lib/types/pro-writer";

// Universal Quality Checks (Always Present)
function checkClarity(content: string): QualityCheck {
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const hasMultipleClaims = sentences.length > 5 && content.match(/\b(but|however|although|while|whereas)\b/gi);
  const hasAbstractNouns = content.match(/\b(concept|idea|notion|principle|framework|system|approach|methodology)\b/gi);
  const hasClearThread = content.length > 100 && content.match(/\b(therefore|thus|because|since|as a result)\b/gi);
  const claimInFinalParagraph = sentences.length > 3 && content.trim().split(/\n\n+/).length > 1;

  if (hasMultipleClaims && !hasClearThread) {
    return {
      signal: "Clarity",
      status: "warning",
      tooltip: "Multiple claims detected. This reads as multiple posts stitched together.",
      category: "universal",
    };
  }

  if (hasAbstractNouns && !hasClearThread) {
    return {
      signal: "Clarity",
      status: "warning",
      tooltip: "Abstract nouns without anchors. Consider grounding with examples.",
      category: "universal",
    };
  }

  if (claimInFinalParagraph && !hasClearThread) {
    return {
      signal: "Clarity",
      status: "warning",
      tooltip: "Core claim appears in final paragraph only. Consider leading with it.",
      category: "universal",
    };
  }

  if (hasClearThread) {
    return {
      signal: "Clarity",
      status: "pass",
      tooltip: "Clear single-thread argument detected.",
      category: "universal",
    };
  }

  return {
    signal: "Clarity",
    status: "pass",
    tooltip: "Readable and coherent.",
    category: "universal",
  };
}

function checkScope(content: string): QualityCheck {
  const hasGrandClaim = content.match(/\b(always|never|all|every|everything|universal|fundamental|revolutionary)\b/gi);
  const hasLimitedSupport = (content.match(/\b(example|case|study|data|evidence)\b/gi) || []).length < 2;
  const hasBroadDomainJump = content.match(/\b(from|to|across|between).*\b(and|to)\b/gi) && content.length < 300;

  if (hasGrandClaim && hasLimitedSupport) {
    return {
      signal: "Scope",
      status: "warning",
      tooltip: "Grand claim with limited support. Consider narrowing scope or adding evidence.",
      category: "universal",
    };
  }

  if (hasBroadDomainJump) {
    return {
      signal: "Scope",
      status: "warning",
      tooltip: "Broad domain jump detected. Ensure connections are clear.",
      category: "universal",
    };
  }

  return {
    signal: "Scope",
    status: "pass",
    tooltip: "Claim appropriately sized for the medium.",
    category: "universal",
  };
}

function checkGrounding(content: string): QualityCheck {
  const hasLivedExperience = content.match(/\b(I|my|we|our|experience|experienced|found|discovered)\b/gi);
  const hasObservation = content.match(/\b(notice|observe|see|saw|witness|pattern|trend)\b/gi);
  const hasPriorWork = content.match(/\b(study|research|paper|article|author|according to|cited)\b/gi);
  const hasData = content.match(/\b(\d+|percent|%|data|statistics|analysis)\b/gi);
  const hasExamples = content.match(/\b(example|instance|case|illustration|for instance|such as)\b/gi);
  const hasReasoning = content.match(/\b(because|therefore|thus|hence|since|if.*then)\b/gi);

  const groundingModes = [
    hasLivedExperience,
    hasObservation,
    hasPriorWork,
    hasData,
    hasExamples,
    hasReasoning,
  ].filter(Boolean).length;

  if (groundingModes === 0) {
    return {
      signal: "Grounding",
      status: "warning",
      tooltip: "No grounding detected. What is this based on?",
      category: "universal",
    };
  }

  if (groundingModes === 1) {
    return {
      signal: "Grounding",
      status: "pass",
      tooltip: "One grounding mode present.",
      category: "universal",
    };
  }

  return {
    signal: "Grounding",
    status: "excellent",
    tooltip: "Multiple coherent grounding modes detected.",
    category: "universal",
  };
}

function checkNovelty(content: string): QualityCheck {
  // In production, this would check against actual recent posts
  // For now, we'll do a simple check for common patterns
  const hasNewFraming = content.match(/\b(frame|reframe|perspective|lens|viewpoint|angle)\b/gi);
  const hasSynthesis = content.match(/\b(combine|merge|synthesize|integrate|connect|bridge)\b/gi);
  const hasApplication = content.match(/\b(apply|application|use case|implement|adapt)\b/gi);

  if (hasNewFraming || hasSynthesis || hasApplication) {
    return {
      signal: "Novelty",
      status: "pass",
      tooltip: "Distinct framing or synthesis detected.",
      category: "universal",
    };
  }

  return {
    signal: "Novelty",
    status: "pass",
    tooltip: "Distinct from recent posts.",
    category: "universal",
  };
}

function checkReadability(content: string): QualityCheck {
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
  const hasParagraphBreaks = content.split(/\n\n+/).length > 1;
  const hasJargon = (content.match(/\b(paradigm|leverage|synergy|optimize|utilize|facilitate)\b/gi) || []).length > 3;

  if (avgSentenceLength > 100 && !hasParagraphBreaks) {
    return {
      signal: "Readability",
      status: "warning",
      tooltip: "Long sentences without paragraph breaks. Consider breaking up.",
      category: "universal",
    };
  }

  if (hasJargon && avgSentenceLength > 80) {
    return {
      signal: "Readability",
      status: "warning",
      tooltip: "High jargon density. Consider simplifying language.",
      category: "universal",
    };
  }

  return {
    signal: "Readability",
    status: "pass",
    tooltip: "Readable without strain.",
    category: "universal",
  };
}

// Intent-Specific Quality Checks
function checkExploreIntent(content: string): QualityCheck[] {
  const checks: QualityCheck[] = [];
  const hasQuestion = content.match(/\?/);
  const hasOpenness = content.match(/\b(unsure|uncertain|testing|exploring|wondering|curious|maybe|perhaps)\b/gi);
  const hasFalseCertainty = content.match(/\b(definitely|absolutely|certainly|obviously|clearly|undoubtedly)\b/gi);
  const hasStrongClaims = content.match(/\b(prove|proven|fact|truth|reality|always|never)\b/gi);

  if (!hasQuestion && !hasOpenness) {
    checks.push({
      signal: "Explore Intent",
      status: "warning",
      tooltip: "No question or openness markers detected. Explore posts should invite refinement.",
      category: "intent-specific",
    });
  }

  if (hasFalseCertainty || (hasStrongClaims && !hasOpenness)) {
    checks.push({
      signal: "Explore Intent",
      status: "warning",
      tooltip: "Strong claims without openness. Reads like an argument in disguise.",
      category: "intent-specific",
    });
  }

  if (hasQuestion || hasOpenness) {
    checks.push({
      signal: "Explore Intent",
      status: "pass",
      tooltip: "Openness markers present. Invites refinement.",
      category: "intent-specific",
    });
  }

  return checks;
}

function checkProposeIntent(content: string): QualityCheck[] {
  const checks: QualityCheck[] = [];
  const hasProposal = content.match(/\b(propose|suggest|recommend|idea|solution|approach|method|system)\b/gi);
  const hasMechanism = content.match(/\b(how|mechanism|process|work|function|operate|steps)\b/gi);
  const hasBoundaries = content.match(/\b(limit|boundary|constraint|when|where|if|unless|except)\b/gi);
  const isOpinion = content.match(/\b(think|believe|feel|opinion|should|must|ought)\b/gi) && !hasMechanism;

  if (!hasProposal) {
    checks.push({
      signal: "Propose Intent",
      status: "warning",
      tooltip: "No clear proposal statement detected.",
      category: "intent-specific",
    });
  }

  if (!hasMechanism && hasProposal) {
    checks.push({
      signal: "Propose Intent",
      status: "warning",
      tooltip: "Proposal lacks operational shape. How would this work?",
      category: "intent-specific",
    });
  }

  if (isOpinion) {
    checks.push({
      signal: "Propose Intent",
      status: "warning",
      tooltip: "Reads as opinion, not proposal. Add mechanism or operational details.",
      category: "intent-specific",
    });
  }

  if (hasProposal && hasMechanism) {
    checks.push({
      signal: "Propose Intent",
      status: "pass",
      tooltip: "Clear proposal with mechanism.",
      category: "intent-specific",
    });
  }

  if (hasBoundaries) {
    checks.push({
      signal: "Propose Intent",
      status: "excellent",
      tooltip: "Boundary conditions acknowledged.",
      category: "intent-specific",
    });
  }

  return checks;
}

function checkArgueIntent(content: string): QualityCheck[] {
  const checks: QualityCheck[] = [];
  const hasOpponent = content.match(/\b(but|however|although|while|whereas|contrary|oppose|against|disagree)\b/gi);
  const hasReasoning = content.match(/\b(because|therefore|thus|since|if.*then|reason|logic)\b/gi);
  const hasSteelman = content.match(/\b(admittedly|granted|concede|acknowledge|fair point|valid concern)\b/gi);
  const isRhetorical = (content.match(/\b(obviously|clearly|everyone knows|nobody|everyone)\b/gi) || []).length > 2;

  if (!hasOpponent) {
    checks.push({
      signal: "Argue Intent",
      status: "warning",
      tooltip: "No opposing position identified. What are you arguing against?",
      category: "intent-specific",
    });
  }

  if (!hasReasoning && hasOpponent) {
    checks.push({
      signal: "Argue Intent",
      status: "warning",
      tooltip: "Assertion stack without reasoned chain. Add logical connections.",
      category: "intent-specific",
    });
  }

  if (isRhetorical && !hasReasoning) {
    checks.push({
      signal: "Argue Intent",
      status: "warning",
      tooltip: "Rhetorical tone outweighs reasoning. Add logical support.",
      category: "intent-specific",
    });
  }

  if (hasOpponent && hasReasoning) {
    checks.push({
      signal: "Argue Intent",
      status: "pass",
      tooltip: "Clear opposing position with reasoned chain.",
      category: "intent-specific",
    });
  }

  if (hasSteelman) {
    checks.push({
      signal: "Argue Intent",
      status: "excellent",
      tooltip: "Steelmanning attempt detected. Strong argument.",
      category: "intent-specific",
    });
  }

  return checks;
}

function checkSynthesizeIntent(content: string): QualityCheck[] {
  const checks: QualityCheck[] = [];
  const hasMultipleSources = (content.match(/\b(from|based on|according to|source|reference)\b/gi) || []).length > 1;
  const hasConnective = content.match(/\b(because|therefore|thus|hence|connects|links|bridges|combines)\b/gi);
  const hasEmergent = content.match(/\b(emerge|emergence|insight|pattern|framework|synthesis|integrate)\b/gi);
  const isSummary = content.match(/\b(summary|summarize|overview|recap|review)\b/gi) && !hasEmergent;

  if (!hasMultipleSources) {
    checks.push({
      signal: "Synthesize Intent",
      status: "warning",
      tooltip: "Multiple sources or domains not clearly referenced.",
      category: "intent-specific",
    });
  }

  if (!hasConnective) {
    checks.push({
      signal: "Synthesize Intent",
      status: "warning",
      tooltip: "No explicit connective tissue. Show how ideas connect.",
      category: "intent-specific",
    });
  }

  if (isSummary) {
    checks.push({
      signal: "Synthesize Intent",
      status: "warning",
      tooltip: "Reads as summary, not synthesis. What's the emergent insight?",
      category: "intent-specific",
    });
  }

  if (hasMultipleSources && hasConnective) {
    checks.push({
      signal: "Synthesize Intent",
      status: "pass",
      tooltip: "Multiple sources with connective tissue.",
      category: "intent-specific",
    });
  }

  if (hasEmergent) {
    checks.push({
      signal: "Synthesize Intent",
      status: "excellent",
      tooltip: "Emergent insight articulated.",
      category: "intent-specific",
    });
  }

  return checks;
}

function checkTeachIntent(content: string): QualityCheck[] {
  const checks: QualityCheck[] = [];
  const hasExample = content.match(/\b(example|instance|illustration|case|for instance|such as|like)\b/gi);
  const hasAnalogy = content.match(/\b(analogy|like|similar to|think of|imagine|metaphor)\b/gi);
  const hasProgression = content.match(/\b(first|then|next|finally|step|stage|level|builds on)\b/gi);
  const hasJargon = (content.match(/\b(paradigm|leverage|synergy|optimize|utilize|facilitate|leverage)\b/gi) || []).length > 3;
  const hasNoIllustration = !hasExample && !hasAnalogy;

  if (hasNoIllustration) {
    checks.push({
      signal: "Teach Intent",
      status: "warning",
      tooltip: "No concrete illustration. Add example or analogy.",
      category: "intent-specific",
    });
  }

  if (hasJargon && !hasExample) {
    checks.push({
      signal: "Teach Intent",
      status: "warning",
      tooltip: "Assumes too much prior knowledge. Add concrete examples.",
      category: "intent-specific",
    });
  }

  if (hasExample || hasAnalogy) {
    checks.push({
      signal: "Teach Intent",
      status: "pass",
      tooltip: "Example or analogy present.",
      category: "intent-specific",
    });
  }

  if (hasProgression) {
    checks.push({
      signal: "Teach Intent",
      status: "excellent",
      tooltip: "Clear concept progression detected.",
      category: "intent-specific",
    });
  }

  return checks;
}

function checkSignalIntent(content: string): QualityCheck[] {
  const checks: QualityCheck[] = [];
  const hasSelfPromotion = content.match(/\b(I'm|I am|my|me|myself).*\b(best|greatest|expert|leader|top|#1)\b/gi);
  const hasEvidence = content.match(/\b(built|created|designed|developed|shipped|launched|achieved|completed)\b/gi);
  const hasSubtlety = content.length > 100 && !hasSelfPromotion;
  const hasClaimsWithoutDemo = content.match(/\b(can|able|capable|skilled|experienced)\b/gi) && !hasEvidence;

  if (hasSelfPromotion) {
    checks.push({
      signal: "Signal Intent",
      status: "warning",
      tooltip: "Reads as self-promotion. Show, don't tell.",
      category: "intent-specific",
    });
  }

  if (hasClaimsWithoutDemo) {
    checks.push({
      signal: "Signal Intent",
      status: "warning",
      tooltip: "Claims without demonstration. Show evidence of work.",
      category: "intent-specific",
    });
  }

  if (hasEvidence) {
    checks.push({
      signal: "Signal Intent",
      status: "pass",
      tooltip: "Evidence of work or thinking present.",
      category: "intent-specific",
    });
  }

  if (hasSubtlety && hasEvidence) {
    checks.push({
      signal: "Signal Intent",
      status: "excellent",
      tooltip: "Subtle demonstration of capability.",
      category: "intent-specific",
    });
  }

  return checks;
}

function checkInviteIntent(content: string): QualityCheck[] {
  const checks: QualityCheck[] = [];
  const hasAsk = content.match(/\b(thoughts|feedback|input|ideas|suggestions|help|collaborate|join|interested)\b/gi);
  const hasVagueAsk = content.match(/\b(thoughts\?|feedback\?|ideas\?)\b/gi) && content.length < 200;
  const hasNextStep = content.match(/\b(next|follow|continue|reach out|contact|dm|email|let's)\b/gi);
  const hasScope = content.match(/\b(specific|particular|focused|narrow|specific area)\b/gi);

  if (!hasAsk) {
    checks.push({
      signal: "Invite Intent",
      status: "warning",
      tooltip: "No clear ask detected. What are you inviting?",
      category: "intent-specific",
    });
  }

  if (hasVagueAsk) {
    checks.push({
      signal: "Invite Intent",
      status: "warning",
      tooltip: "Vague 'thoughts?' ending. Be more specific about what you're seeking.",
      category: "intent-specific",
    });
  }

  if (hasAsk && !hasNextStep) {
    checks.push({
      signal: "Invite Intent",
      status: "warning",
      tooltip: "No actionable next step. How should people respond?",
      category: "intent-specific",
    });
  }

  if (hasAsk && hasNextStep) {
    checks.push({
      signal: "Invite Intent",
      status: "pass",
      tooltip: "Clear ask with follow-up path.",
      category: "intent-specific",
    });
  }

  if (hasScope) {
    checks.push({
      signal: "Invite Intent",
      status: "excellent",
      tooltip: "Appropriate scope of invitation.",
      category: "intent-specific",
    });
  }

  return checks;
}

// Relationship-Aligned Checks
function checkRelationshipAlignment(
  content: string,
  relationships: RelationshipType[]
): QualityCheck[] {
  const checks: QualityCheck[] = [];

  if (relationships.includes("mentorship")) {
    const hasSpecificQuestion = content.match(/\b(how|what|why|when|where|specific|particular)\b/gi);
    const hasLearningPosture = content.match(/\b(learning|exploring|curious|unsure|seeking|guidance)\b/gi);

    if (!hasSpecificQuestion) {
      checks.push({
        signal: "Mentorship Target",
        status: "warning",
        tooltip: "Question insufficiently specific. Mentors need clear questions.",
        category: "relationship-aligned",
      });
    }

    if (hasLearningPosture) {
      checks.push({
        signal: "Mentorship Target",
        status: "pass",
        tooltip: "Demonstrates learning posture.",
        category: "relationship-aligned",
      });
    }
  }

  if (relationships.includes("collaboration")) {
    const hasNextStep = content.match(/\b(next|step|action|collaborate|work together|join|reach out)\b/gi);
    const hasProblemSurface = content.match(/\b(problem|challenge|issue|opportunity|need|gap)\b/gi);

    if (!hasNextStep) {
      checks.push({
        signal: "Collaboration Target",
        status: "warning",
        tooltip: "No actionable next step. How can people collaborate?",
        category: "relationship-aligned",
      });
    }

    if (hasProblemSurface && hasNextStep) {
      checks.push({
        signal: "Collaboration Target",
        status: "pass",
        tooltip: "Clear problem surface with next step.",
        category: "relationship-aligned",
      });
    }
  }

  if (relationships.includes("peer-validation")) {
    const isTooPolished = !content.match(/\b(unsure|maybe|perhaps|testing|exploring|draft)\b/gi);
    const hasRoomForCritique = content.match(/\b(thoughts|feedback|critique|improve|refine|better)\b/gi);

    if (isTooPolished && !hasRoomForCritique) {
      checks.push({
        signal: "Peer Validation Target",
        status: "warning",
        tooltip: "Too polished or closed. Leave room for critique.",
        category: "relationship-aligned",
      });
    }

    if (hasRoomForCritique) {
      checks.push({
        signal: "Peer Validation Target",
        status: "pass",
        tooltip: "Leaves room for critique.",
        category: "relationship-aligned",
      });
    }
  }

  if (relationships.includes("public-trust")) {
    const isOverconfident = content.match(/\b(definitely|absolutely|certainly|obviously|clearly|undoubtedly|proven fact)\b/gi);
    const hasUncertainty = content.match(/\b(uncertain|unsure|maybe|perhaps|likely|probably|seems)\b/gi);

    if (isOverconfident && !hasUncertainty) {
      checks.push({
        signal: "Public Trust Target",
        status: "warning",
        tooltip: "Overconfident tone. Acknowledge uncertainty to build trust.",
        category: "relationship-aligned",
      });
    }

    if (hasUncertainty) {
      checks.push({
        signal: "Public Trust Target",
        status: "pass",
        tooltip: "Acknowledges uncertainty appropriately.",
        category: "relationship-aligned",
      });
    }
  }

  return checks;
}

// Main Quality Check Analyzer
export function analyzeQuality(
  content: string,
  intent: IntentType | null,
  relationships: RelationshipType[]
): QualityCheck[] {
  const checks: QualityCheck[] = [];

  // Universal checks (always present)
  checks.push(checkClarity(content));
  checks.push(checkScope(content));
  checks.push(checkGrounding(content));
  checks.push(checkNovelty(content));
  checks.push(checkReadability(content));

  // Intent-specific checks
  if (intent) {
    switch (intent) {
      case "explore":
        checks.push(...checkExploreIntent(content));
        break;
      case "propose":
        checks.push(...checkProposeIntent(content));
        break;
      case "argue":
        checks.push(...checkArgueIntent(content));
        break;
      case "synthesize":
        checks.push(...checkSynthesizeIntent(content));
        break;
      case "teach":
        checks.push(...checkTeachIntent(content));
        break;
      case "signal":
        checks.push(...checkSignalIntent(content));
        break;
      case "invite":
        checks.push(...checkInviteIntent(content));
        break;
    }
  }

  // Relationship-aligned checks
  if (relationships.length > 0) {
    checks.push(...checkRelationshipAlignment(content, relationships));
  }

  return checks;
}

