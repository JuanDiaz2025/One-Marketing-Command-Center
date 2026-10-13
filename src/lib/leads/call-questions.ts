// The quick answers picked right after a phone call (safe to load in the browser: no AI code).
export const callQuestions = {
  reason: {
    label: "Why selling",
    options: [
      ["", "Not asked"],
      ["foreclosure", "Behind on payments / foreclosure"],
      ["inherited", "Inherited / probate"],
      ["divorce", "Divorce or separation"],
      ["relocating", "Moving / job relocation"],
      ["landlord", "Tired landlord / bad tenants"],
      ["repairs", "Can't afford repairs"],
      ["downsizing", "Downsizing / retiring"],
      ["testing", "Just seeing what it's worth"],
      ["not_seller", "Not a seller (wrong number, agent, buyer…)"],
    ],
  },
  timeline: {
    label: "Wants to sell",
    options: [
      ["", "Not asked"],
      ["asap", "ASAP / under 30 days"],
      ["90", "Within 3 months"],
      ["6m", "3 to 6 months"],
      ["later", "6+ months / no rush"],
    ],
  },
  condition: {
    label: "House condition",
    options: [
      ["", "Not asked"],
      ["major", "Needs major repairs"],
      ["some", "Needs some work"],
      ["good", "Good / move-in ready"],
    ],
  },
  price: {
    label: "On price",
    options: [
      ["", "Not asked"],
      ["flexible", "Flexible, wants it done"],
      ["realistic", "Realistic, open to an offer"],
      ["retail", "Wants full retail price"],
    ],
  },
  occupancy: {
    label: "Who lives there",
    options: [
      ["", "Not asked"],
      ["vacant", "Vacant"],
      ["owner", "Owner lives there"],
      ["tenants", "Tenants"],
    ],
  },
} as const

export type CallAnswers = { [K in keyof typeof callQuestions]?: string } & { notes?: string }
