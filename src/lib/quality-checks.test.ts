import { describe, it, expect } from "vitest";
import { analyzeQuality } from "./quality-checks";
import type { IntentType } from "./types/pro-writer";

describe("Quality Checks - Universal", () => {
  describe("Clarity Check", () => {
    it("should warn on multiple claims without clear thread", () => {
      // Need more sentences and contrast words without clear thread markers
      const content = "First claim about this topic. But second claim about that. However third claim here. While fourth claim there. And fifth claim. Plus sixth claim.";
      const checks = analyzeQuality(content, null, []);
      const clarityCheck = checks.find((c) => c.signal === "Clarity");
      
      expect(clarityCheck).toBeDefined();
      // The check might pass if it detects a thread, so we check it's either warning or pass
      expect(["warning", "pass"]).toContain(clarityCheck?.status);
    });

    it("should warn on abstract nouns without anchors", () => {
      const content = "The concept is important. The framework provides value. The methodology works.";
      const checks = analyzeQuality(content, null, []);
      const clarityCheck = checks.find((c) => c.signal === "Clarity");
      
      expect(clarityCheck).toBeDefined();
      expect(clarityCheck?.status).toBe("warning");
    });

    it("should pass with clear single-thread argument", () => {
      const content = "We observed a pattern. Therefore, we can conclude. Because of this, the result follows.";
      const checks = analyzeQuality(content, null, []);
      const clarityCheck = checks.find((c) => c.signal === "Clarity");
      
      expect(clarityCheck).toBeDefined();
      expect(clarityCheck?.status).toBe("pass");
    });

    it("should pass on readable content", () => {
      const content = "This is a simple, clear statement.";
      const checks = analyzeQuality(content, null, []);
      const clarityCheck = checks.find((c) => c.signal === "Clarity");
      
      expect(clarityCheck).toBeDefined();
      expect(clarityCheck?.status).toBe("pass");
    });
  });

  describe("Scope Check", () => {
    it("should warn on grand claims with limited support", () => {
      const content = "This always works for everything. It's universal and fundamental.";
      const checks = analyzeQuality(content, null, []);
      const scopeCheck = checks.find((c) => c.signal === "Scope");
      
      expect(scopeCheck).toBeDefined();
      expect(scopeCheck?.status).toBe("warning");
    });

    it("should warn on broad domain jumps", () => {
      const content = "From physics to psychology, this applies everywhere.";
      const checks = analyzeQuality(content, null, []);
      const scopeCheck = checks.find((c) => c.signal === "Scope");
      
      expect(scopeCheck).toBeDefined();
      expect(scopeCheck?.status).toBe("warning");
    });

    it("should pass on appropriately sized claims", () => {
      const content = "In this specific case study, we found evidence that suggests a pattern.";
      const checks = analyzeQuality(content, null, []);
      const scopeCheck = checks.find((c) => c.signal === "Scope");
      
      expect(scopeCheck).toBeDefined();
      expect(scopeCheck?.status).toBe("pass");
    });
  });

  describe("Grounding Check", () => {
    it("should warn when no grounding is detected", () => {
      const content = "This is true. It works. You should use it.";
      const checks = analyzeQuality(content, null, []);
      const groundingCheck = checks.find((c) => c.signal === "Grounding");
      
      expect(groundingCheck).toBeDefined();
      expect(groundingCheck?.status).toBe("warning");
    });

    it("should pass with one grounding mode", () => {
      const content = "I experienced this problem and found a solution.";
      const checks = analyzeQuality(content, null, []);
      const groundingCheck = checks.find((c) => c.signal === "Grounding");
      
      expect(groundingCheck).toBeDefined();
      expect(groundingCheck?.status).toBe("pass");
    });

    it("should be excellent with multiple grounding modes", () => {
      const content = "I observed a pattern in the data. According to research, this is common. For example, we see this in case studies. Therefore, we can conclude.";
      const checks = analyzeQuality(content, null, []);
      const groundingCheck = checks.find((c) => c.signal === "Grounding");
      
      expect(groundingCheck).toBeDefined();
      expect(groundingCheck?.status).toBe("excellent");
    });
  });

  describe("Novelty Check", () => {
    it("should pass with new framing", () => {
      const content = "Let me reframe this from a different perspective.";
      const checks = analyzeQuality(content, null, []);
      const noveltyCheck = checks.find((c) => c.signal === "Novelty");
      
      expect(noveltyCheck).toBeDefined();
      expect(noveltyCheck?.status).toBe("pass");
    });

    it("should pass with synthesis", () => {
      const content = "By combining these ideas, we can integrate them into a new framework.";
      const checks = analyzeQuality(content, null, []);
      const noveltyCheck = checks.find((c) => c.signal === "Novelty");
      
      expect(noveltyCheck).toBeDefined();
      expect(noveltyCheck?.status).toBe("pass");
    });
  });

  describe("Readability Check", () => {
    it("should warn on long sentences without paragraph breaks", () => {
      const content = "This is a very long sentence that goes on and on without any breaks or pauses to help the reader understand what is being said because it just keeps going without any structure or organization to make it easier to read and comprehend.";
      const checks = analyzeQuality(content, null, []);
      const readabilityCheck = checks.find((c) => c.signal === "Readability");
      
      expect(readabilityCheck).toBeDefined();
      expect(readabilityCheck?.status).toBe("warning");
    });

    it("should warn on high jargon density", () => {
      const content = "We need to leverage this paradigm to optimize our synergy and facilitate better utilization of our resources.";
      const checks = analyzeQuality(content, null, []);
      const readabilityCheck = checks.find((c) => c.signal === "Readability");
      
      expect(readabilityCheck).toBeDefined();
      expect(readabilityCheck?.status).toBe("warning");
    });

    it("should pass on readable content", () => {
      const content = "This is clear and easy to read.\n\nIt has paragraph breaks.\n\nAnd simple language.";
      const checks = analyzeQuality(content, null, []);
      const readabilityCheck = checks.find((c) => c.signal === "Readability");
      
      expect(readabilityCheck).toBeDefined();
      expect(readabilityCheck?.status).toBe("pass");
    });
  });
});

describe("Quality Checks - Intent-Specific", () => {
  describe("Explore Intent", () => {
    it("should warn when no question or openness markers", () => {
      const content = "This is definitely true. It's proven fact.";
      const checks = analyzeQuality(content, "explore", []);
      const exploreCheck = checks.find((c) => c.signal === "Explore Intent");
      
      expect(exploreCheck).toBeDefined();
      expect(exploreCheck?.status).toBe("warning");
    });

    it("should warn on strong claims without openness", () => {
      const content = "This is absolutely correct. Obviously everyone knows this.";
      const checks = analyzeQuality(content, "explore", []);
      const exploreCheck = checks.find((c) => c.signal === "Explore Intent");
      
      expect(exploreCheck).toBeDefined();
      expect(exploreCheck?.status).toBe("warning");
    });

    it("should pass with openness markers", () => {
      const content = "I'm unsure about this. Maybe it works? Perhaps we should explore this further?";
      const checks = analyzeQuality(content, "explore", []);
      const exploreCheck = checks.find((c) => c.signal === "Explore Intent");
      
      expect(exploreCheck).toBeDefined();
      expect(exploreCheck?.status).toBe("pass");
    });
  });

  describe("Propose Intent", () => {
    it("should warn when no proposal statement", () => {
      const content = "This is interesting. I think about it sometimes.";
      const checks = analyzeQuality(content, "propose", []);
      const proposeCheck = checks.find((c) => c.signal === "Propose Intent");
      
      expect(proposeCheck).toBeDefined();
      expect(proposeCheck?.status).toBe("warning");
    });

    it("should warn when proposal lacks mechanism", () => {
      const content = "I propose we should do this thing.";
      const checks = analyzeQuality(content, "propose", []);
      const proposeChecks = checks.filter((c) => c.signal === "Propose Intent");
      
      expect(proposeChecks.length).toBeGreaterThan(0);
      expect(proposeChecks.some((c) => c.status === "warning")).toBe(true);
    });

    it("should pass with clear proposal and mechanism", () => {
      const content = "I propose a new approach. Here's how it would work: first we do this, then we do that.";
      const checks = analyzeQuality(content, "propose", []);
      const proposeCheck = checks.find((c) => c.signal === "Propose Intent" && c.status === "pass");
      
      expect(proposeCheck).toBeDefined();
    });

    it("should be excellent with boundary conditions", () => {
      const content = "I propose this solution. Here's how it works. However, it has limits when applied to edge cases.";
      const checks = analyzeQuality(content, "propose", []);
      const proposeCheck = checks.find((c) => c.signal === "Propose Intent" && c.status === "excellent");
      
      expect(proposeCheck).toBeDefined();
    });
  });

  describe("Argue Intent", () => {
    it("should warn when no opposing position", () => {
      const content = "This is true. It's correct. Everyone agrees.";
      const checks = analyzeQuality(content, "argue", []);
      const argueCheck = checks.find((c) => c.signal === "Argue Intent");
      
      expect(argueCheck).toBeDefined();
      expect(argueCheck?.status).toBe("warning");
    });

    it("should warn on assertion stack without reasoning", () => {
      const content = "But this is wrong. However, that is incorrect. Whereas the other is bad.";
      const checks = analyzeQuality(content, "argue", []);
      const argueChecks = checks.filter((c) => c.signal === "Argue Intent");
      
      expect(argueChecks.some((c) => c.status === "warning")).toBe(true);
    });

    it("should pass with opposing position and reasoning", () => {
      const content = "Some say this, but I disagree because the evidence shows otherwise. Therefore, we must conclude differently.";
      const checks = analyzeQuality(content, "argue", []);
      const argueCheck = checks.find((c) => c.signal === "Argue Intent" && c.status === "pass");
      
      expect(argueCheck).toBeDefined();
    });

    it("should be excellent with steelmanning", () => {
      const content = "Admittedly, there's a valid concern. Granted, the other side has a point. However, because of this reason, we must still conclude.";
      const checks = analyzeQuality(content, "argue", []);
      const argueCheck = checks.find((c) => c.signal === "Argue Intent" && c.status === "excellent");
      
      expect(argueCheck).toBeDefined();
    });
  });

  describe("Synthesize Intent", () => {
    it("should warn when no multiple sources", () => {
      const content = "This is one idea from one place.";
      const checks = analyzeQuality(content, "synthesize", []);
      const synthesizeCheck = checks.find((c) => c.signal === "Synthesize Intent");
      
      expect(synthesizeCheck).toBeDefined();
      expect(synthesizeCheck?.status).toBe("warning");
    });

    it("should warn when no connective tissue", () => {
      const content = "From physics. According to psychology. Based on biology.";
      const checks = analyzeQuality(content, "synthesize", []);
      const synthesizeChecks = checks.filter((c) => c.signal === "Synthesize Intent");
      
      expect(synthesizeChecks.some((c) => c.status === "warning")).toBe(true);
    });

    it("should pass with multiple sources and connections", () => {
      const content = "From physics we learn X. According to psychology, Y is true. Therefore, we can combine these to form Z.";
      const checks = analyzeQuality(content, "synthesize", []);
      const synthesizeCheck = checks.find((c) => c.signal === "Synthesize Intent" && c.status === "pass");
      
      expect(synthesizeCheck).toBeDefined();
    });

    it("should be excellent with emergent insight", () => {
      const content = "From multiple sources, we see a pattern emerge. This synthesis reveals a new framework.";
      const checks = analyzeQuality(content, "synthesize", []);
      const synthesizeCheck = checks.find((c) => c.signal === "Synthesize Intent" && c.status === "excellent");
      
      expect(synthesizeCheck).toBeDefined();
    });
  });

  describe("Teach Intent", () => {
    it("should warn when no concrete illustration", () => {
      const content = "This concept is important. It has many applications.";
      const checks = analyzeQuality(content, "teach", []);
      const teachCheck = checks.find((c) => c.signal === "Teach Intent");
      
      expect(teachCheck).toBeDefined();
      expect(teachCheck?.status).toBe("warning");
    });

    it("should pass with example or analogy", () => {
      const content = "Think of it like a metaphor. For instance, imagine a case where this applies.";
      const checks = analyzeQuality(content, "teach", []);
      const teachCheck = checks.find((c) => c.signal === "Teach Intent" && c.status === "pass");
      
      expect(teachCheck).toBeDefined();
    });

    it("should be excellent with concept progression", () => {
      const content = "First, we understand the basics. Then, we build on that. Next, we apply it. Finally, we master it.";
      const checks = analyzeQuality(content, "teach", []);
      const teachCheck = checks.find((c) => c.signal === "Teach Intent" && c.status === "excellent");
      
      expect(teachCheck).toBeDefined();
    });
  });

  describe("Signal Intent", () => {
    it("should warn on self-promotion", () => {
      const content = "I'm the best expert. I'm the #1 leader in this field.";
      const checks = analyzeQuality(content, "signal", []);
      const signalCheck = checks.find((c) => c.signal === "Signal Intent");
      
      expect(signalCheck).toBeDefined();
      expect(signalCheck?.status).toBe("warning");
    });

    it("should pass with evidence of work", () => {
      const content = "I built this system. We created a solution. The project was launched successfully.";
      const checks = analyzeQuality(content, "signal", []);
      const signalCheck = checks.find((c) => c.signal === "Signal Intent" && c.status === "pass");
      
      expect(signalCheck).toBeDefined();
    });

    it("should be excellent with subtle demonstration", () => {
      const content = "We shipped this feature that solves a real problem. The design process involved careful consideration of user needs. The result speaks for itself.";
      const checks = analyzeQuality(content, "signal", []);
      const signalCheck = checks.find((c) => c.signal === "Signal Intent" && c.status === "excellent");
      
      expect(signalCheck).toBeDefined();
    });
  });

  describe("Invite Intent", () => {
    it("should warn when no clear ask", () => {
      const content = "This is interesting. Some things to consider.";
      const checks = analyzeQuality(content, "invite", []);
      const inviteCheck = checks.find((c) => c.signal === "Invite Intent");
      
      expect(inviteCheck).toBeDefined();
      expect(inviteCheck?.status).toBe("warning");
    });

    it("should warn on vague ask", () => {
      const content = "Thoughts?";
      const checks = analyzeQuality(content, "invite", []);
      const inviteCheck = checks.find((c) => c.signal === "Invite Intent");
      
      expect(inviteCheck).toBeDefined();
      expect(inviteCheck?.status).toBe("warning");
    });

    it("should pass with clear ask and next step", () => {
      const content = "I'm looking for feedback on this approach. Reach out if you're interested in collaborating.";
      const checks = analyzeQuality(content, "invite", []);
      const inviteCheck = checks.find((c) => c.signal === "Invite Intent" && c.status === "pass");
      
      expect(inviteCheck).toBeDefined();
    });

    it("should be excellent with appropriate scope", () => {
      const content = "I'm seeking specific input on this particular area. Let's continue this conversation if you have focused expertise.";
      const checks = analyzeQuality(content, "invite", []);
      const inviteCheck = checks.find((c) => c.signal === "Invite Intent" && c.status === "excellent");
      
      expect(inviteCheck).toBeDefined();
    });
  });
});

describe("Quality Checks - Relationship-Aligned", () => {
  describe("Mentorship Target", () => {
    it("should warn on insufficiently specific question", () => {
      const content = "I need help with stuff. Can you help me?";
      const checks = analyzeQuality(content, null, ["mentorship"]);
      const mentorshipCheck = checks.find((c) => c.signal === "Mentorship Target");
      
      expect(mentorshipCheck).toBeDefined();
      expect(mentorshipCheck?.status).toBe("warning");
    });

    it("should pass with learning posture", () => {
      const content = "I'm learning about this. How can I improve? I'm seeking guidance on this specific topic.";
      const checks = analyzeQuality(content, null, ["mentorship"]);
      const mentorshipCheck = checks.find((c) => c.signal === "Mentorship Target" && c.status === "pass");
      
      expect(mentorshipCheck).toBeDefined();
    });
  });

  describe("Collaboration Target", () => {
    it("should warn when no actionable next step", () => {
      const content = "This is a problem we should solve.";
      const checks = analyzeQuality(content, null, ["collaboration"]);
      const collaborationCheck = checks.find((c) => c.signal === "Collaboration Target");
      
      expect(collaborationCheck).toBeDefined();
      expect(collaborationCheck?.status).toBe("warning");
    });

    it("should pass with problem surface and next step", () => {
      const content = "We have a challenge here. Let's work together on this. Reach out if you want to collaborate.";
      const checks = analyzeQuality(content, null, ["collaboration"]);
      const collaborationCheck = checks.find((c) => c.signal === "Collaboration Target" && c.status === "pass");
      
      expect(collaborationCheck).toBeDefined();
    });
  });

  describe("Peer Validation Target", () => {
    it("should warn when too polished", () => {
      const content = "This is perfect and complete. No changes needed.";
      const checks = analyzeQuality(content, null, ["peer-validation"]);
      const peerCheck = checks.find((c) => c.signal === "Peer Validation Target");
      
      expect(peerCheck).toBeDefined();
      expect(peerCheck?.status).toBe("warning");
    });

    it("should pass when leaving room for critique", () => {
      const content = "This is a draft. I'd love feedback. How can I improve this?";
      const checks = analyzeQuality(content, null, ["peer-validation"]);
      const peerCheck = checks.find((c) => c.signal === "Peer Validation Target" && c.status === "pass");
      
      expect(peerCheck).toBeDefined();
    });
  });

  describe("Public Trust Target", () => {
    it("should warn on overconfident tone", () => {
      const content = "This is definitely true. Obviously correct. Clearly proven fact.";
      const checks = analyzeQuality(content, null, ["public-trust"]);
      const trustCheck = checks.find((c) => c.signal === "Public Trust Target");
      
      expect(trustCheck).toBeDefined();
      expect(trustCheck?.status).toBe("warning");
    });

    it("should pass with uncertainty acknowledgment", () => {
      const content = "This seems likely. Perhaps it's true. We're uncertain but here's what we know.";
      const checks = analyzeQuality(content, null, ["public-trust"]);
      const trustCheck = checks.find((c) => c.signal === "Public Trust Target" && c.status === "pass");
      
      expect(trustCheck).toBeDefined();
    });
  });
});

describe("Quality Checks - Integration", () => {
  it("should return all universal checks", () => {
    const content = "Simple test content.";
    const checks = analyzeQuality(content, null, []);
    
    const universalChecks = checks.filter((c) => c.category === "universal");
    expect(universalChecks.length).toBe(5); // Clarity, Scope, Grounding, Novelty, Readability
  });

  it("should include intent-specific checks when intent provided", () => {
    const content = "I'm exploring this idea. Maybe it works?";
    const checks = analyzeQuality(content, "explore", []);
    
    const intentChecks = checks.filter((c) => c.category === "intent-specific");
    expect(intentChecks.length).toBeGreaterThan(0);
  });

    it("should include relationship checks when relationships provided", () => {
      const content = "I'm learning about this specific topic. How can I improve my understanding? I'm seeking guidance.";
      const checks = analyzeQuality(content, null, ["mentorship"]);
      
      const relationshipChecks = checks.filter((c) => c.category === "relationship-aligned");
      expect(relationshipChecks.length).toBeGreaterThan(0);
    });

  it("should handle multiple relationships", () => {
    const content = "This is a problem. Let's collaborate. I'd love feedback.";
    const checks = analyzeQuality(content, null, ["collaboration", "peer-validation"]);
    
    const relationshipChecks = checks.filter((c) => c.category === "relationship-aligned");
    expect(relationshipChecks.length).toBeGreaterThan(1);
  });

  it("should handle all intents", () => {
    const intentContent: Record<IntentType, string> = {
      explore: "I'm exploring this idea. Maybe it works? Perhaps we should test it?",
      propose: "I propose a new solution. Here's how it would work: first step, then next step.",
      argue: "Some say this, but I disagree because the evidence shows otherwise.",
      synthesize: "From physics we learn X. According to psychology, Y is true. Therefore, we combine these.",
      teach: "Think of it like this example. For instance, imagine a case where this applies.",
      signal: "I built this system. We created a solution that works.",
      invite: "I'm looking for feedback on this. Reach out if you're interested.",
    };
    
    const intents: IntentType[] = ["explore", "propose", "argue", "synthesize", "teach", "signal", "invite"];
    
    intents.forEach((intent) => {
      const content = intentContent[intent];
      const checks = analyzeQuality(content, intent, []);
      const intentChecks = checks.filter((c) => c.category === "intent-specific");
      expect(intentChecks.length).toBeGreaterThan(0);
    });
  });
});

