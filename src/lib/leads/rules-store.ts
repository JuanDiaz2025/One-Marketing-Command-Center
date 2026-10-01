// The lead rules, saved in .data/lead-rules.json. Until you change them, they're the defaults
// (Hot → Interested, Junk → Not interested).
import { jsonFileStore } from "@/lib/json-file-store"
import { defaultRules, type LeadRule } from "@/lib/leads/rules"

const file = jsonFileStore<{ rules: LeadRule[] }>("lead-rules.json", () => ({ rules: defaultRules() }))

export const getRules = async () => (await file.read()).rules
export const saveRules = (rules: LeadRule[]) =>
  file.update((db) => {
    db.rules = rules
  })
