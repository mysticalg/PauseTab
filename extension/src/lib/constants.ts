import type { Rule, RuleMode, SetupMode } from "./schema";

export const STORAGE_KEY = "pausetab-state";
export const STORAGE_SYNC_KEY = "pausetab-sync-state";
export const STORAGE_VERSION = 1;
export const MAX_FREE_RULES = 3;
export const HEARTBEAT_INTERVAL_MS = 15000;
export const DAY_IN_MS = 24 * 60 * 60 * 1000;
export const ESTIMATED_MINUTES_PER_AVOID = 7;

export const RULE_MODE_LABELS: Record<RuleMode, string> = {
  delay: "Delay",
  budget: "Time budget",
  session_cap: "Session cap",
  hard_block: "Hard block",
};

export const SETUP_MODES: Record<
  SetupMode,
  Pick<
    Rule,
    "delaySeconds" | "promptEnabled" | "promptText" | "mode" | "dailyMinuteBudget" | "cooldownMinutes"
  > & { description: string }
> = {
  gentle: {
    delaySeconds: 5,
    promptEnabled: false,
    promptText: "",
    mode: "delay",
    description: "A light pause with no prompt.",
  },
  balanced: {
    delaySeconds: 10,
    promptEnabled: true,
    promptText: "What are you here to do?",
    mode: "delay",
    description: "A short countdown with an intention check.",
  },
  strict: {
    delaySeconds: 20,
    promptEnabled: true,
    promptText: "What are you here to do?",
    mode: "budget",
    dailyMinuteBudget: 20,
    cooldownMinutes: 15,
    description: "A firmer pause with prompt, budget, and cooldown defaults.",
  },
};

type PresetDefinition = {
  id: string;
  title: string;
  description: string;
  domainPattern: string;
  pathPattern?: string;
  category: "video" | "social" | "reading";
};

export const PRESET_SITES: PresetDefinition[] = [
  {
    id: "youtube",
    title: "YouTube",
    description: "Slow down before home, Shorts, and autoplay spirals.",
    domainPattern: "youtube.com",
    category: "video",
  },
  {
    id: "reddit",
    title: "Reddit",
    description: "Interrupt front page browsing before it turns into a scroll loop.",
    domainPattern: "reddit.com",
    category: "reading",
  },
  {
    id: "x",
    title: "X",
    description: "Pause the timeline before it takes the rest of the hour.",
    domainPattern: "x.com",
    category: "social",
  },
  {
    id: "twitter",
    title: "Twitter",
    description: "Catch legacy twitter.com visits with the same friction.",
    domainPattern: "twitter.com",
    category: "social",
  },
  {
    id: "facebook",
    title: "Facebook",
    description: "Create distance before feeds, notifications, and infinite comments.",
    domainPattern: "facebook.com",
    category: "social",
  },
  {
    id: "instagram",
    title: "Instagram Web",
    description: "Slow down feed checks and explore loops on desktop.",
    domainPattern: "instagram.com",
    category: "social",
  },
  {
    id: "tiktok",
    title: "TikTok",
    description: "Add friction before short-form scroll sessions start.",
    domainPattern: "tiktok.com",
    category: "video",
  },
];

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const UNTIL_RESTART = "session";
