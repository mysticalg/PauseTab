import { useMemo, useRef, useState } from "react";

import { RULE_MODE_LABELS, WEEKDAY_LABELS } from "../../lib/constants";
import { canCreateAnotherRule, hasFeature } from "../../lib/licensing";
import { createRule, exportSettingsJson, importSettingsJson, updateRuleWithPatch } from "../../lib/rules";
import { updateState } from "../../lib/storage";
import type { ExtensionState, Rule, RuleMode, ScheduleDay, ScheduleWindow } from "../../lib/schema";

type RulesPageProps = {
  state: ExtensionState;
  refresh: () => Promise<void>;
};

type RuleFormState = {
  id?: string;
  label: string;
  domainPattern: string;
  pathPattern: string;
  enabled: boolean;
  mode: RuleMode;
  delaySeconds: string;
  promptEnabled: boolean;
  promptText: string;
  allowlistPatterns: string;
  dailyMinuteBudget: string;
  dailySessionLimit: string;
  cooldownMinutes: string;
  tier: Rule["tier"];
  schedule: ScheduleWindow[];
};

const DAY_MAP: Array<{ key: ScheduleDay; label: string }> = [
  { key: "sun", label: "Sun" },
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
];

const minutesToClock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const clockToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0;
  }
  return hours * 60 + minutes;
};

const toFormState = (rule?: Rule): RuleFormState =>
  rule
    ? {
        id: rule.id,
        label: rule.label,
        domainPattern: rule.domainPattern,
        pathPattern: rule.pathPattern ?? "",
        enabled: rule.enabled,
        mode: rule.mode,
        delaySeconds: String(rule.delaySeconds),
        promptEnabled: rule.promptEnabled,
        promptText: rule.promptText ?? "",
        allowlistPatterns: rule.allowlistPatterns.join("\n"),
        dailyMinuteBudget: rule.dailyMinuteBudget ? String(rule.dailyMinuteBudget) : "",
        dailySessionLimit: rule.dailySessionLimit ? String(rule.dailySessionLimit) : "",
        cooldownMinutes: rule.cooldownMinutes ? String(rule.cooldownMinutes) : "",
        tier: rule.tier,
        schedule: rule.schedule,
      }
    : {
        label: "",
        domainPattern: "",
        pathPattern: "",
        enabled: true,
        mode: "delay",
        delaySeconds: "10",
        promptEnabled: true,
        promptText: "What are you here to do?",
        allowlistPatterns: "",
        dailyMinuteBudget: "",
        dailySessionLimit: "",
        cooldownMinutes: "",
        tier: "free",
        schedule: [],
      };

export const RulesPage = ({ state, refresh }: RulesPageProps) => {
  const [form, setForm] = useState<RuleFormState>(() => toFormState());
  const [editingId, setEditingId] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sortedRules = useMemo(() => [...state.rules].sort((left, right) => left.label.localeCompare(right.label)), [state.rules]);

  const resetForm = () => {
    setEditingId(undefined);
    setForm(toFormState());
  };

  const loadRule = (rule: Rule) => {
    setEditingId(rule.id);
    setForm(toFormState(rule));
  };

  const saveRule = async () => {
    if (!form.domainPattern.trim()) {
      return;
    }

    if (!editingId && !canCreateAnotherRule(state)) {
      window.alert("PauseTab Free supports up to 3 protected sites. Start the local Pro trial to add more.");
      return;
    }

    await updateState((current) => {
      const patch = {
        label: form.label,
        domainPattern: form.domainPattern,
        pathPattern: form.pathPattern || undefined,
        enabled: form.enabled,
        mode: form.mode,
        delaySeconds: Number(form.delaySeconds) || 0,
        promptEnabled: form.promptEnabled,
        promptText: form.promptText || undefined,
        allowlistPatterns: form.allowlistPatterns
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean),
        dailyMinuteBudget: hasFeature(current.license, "budgets") && form.dailyMinuteBudget ? Number(form.dailyMinuteBudget) : undefined,
        dailySessionLimit:
          hasFeature(current.license, "session_caps") && form.dailySessionLimit ? Number(form.dailySessionLimit) : undefined,
        cooldownMinutes:
          hasFeature(current.license, "cooldowns") && form.cooldownMinutes ? Number(form.cooldownMinutes) : undefined,
        tier: form.tier,
        schedule: hasFeature(current.license, "schedules") ? form.schedule.filter((window) => window.days.length > 0) : [],
      } satisfies Partial<Rule>;

      if (editingId) {
        return {
          ...current,
          rules: current.rules.map((rule) => (rule.id === editingId ? updateRuleWithPatch(rule, patch) : rule)),
        };
      }

      const nextRule = createRule(
        {
          label: form.label,
          domainPattern: form.domainPattern,
          pathPattern: form.pathPattern || undefined,
          tier: form.tier,
        },
        current.preferences.defaultMode,
      );

      return {
        ...current,
        rules: [...current.rules, updateRuleWithPatch(nextRule, patch)],
      };
    });

    resetForm();
    await refresh();
  };

  const deleteRule = async (ruleId: string) => {
    await updateState((current) => ({
      ...current,
      rules: current.rules.filter((rule) => rule.id !== ruleId),
    }));
    if (editingId === ruleId) {
      resetForm();
    }
    await refresh();
  };

  const exportJson = () => {
    const blob = new Blob([exportSettingsJson(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pausetab-settings.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    const raw = await file.text();
    const result = importSettingsJson(raw);
    if (!result.success) {
      return;
    }

    await updateState(() => result.data);
    await refresh();
  };

  const upsertSchedule = (scheduleId: string, patch: Partial<ScheduleWindow>) => {
    setForm((current) => ({
      ...current,
      schedule: current.schedule.map((window) => (window.id === scheduleId ? { ...window, ...patch } : window)),
    }));
  };

  return (
    <section className="section stack">
      <div className="row" style={{ paddingBottom: 0 }}>
        <div className="rowLabel">
          <p className="rowTitle">Rule editor</p>
          <p className="rowMeta">Build domain, path, delay, budget, session-cap, and schedule rules.</p>
        </div>
        <div className="options-actions">
          <button className="button" data-variant="ghost" onClick={exportJson}>
            Export
          </button>
          <button className="button" data-variant="ghost" onClick={() => fileInputRef.current?.click()}>
            Import
          </button>
          <button className="button" data-variant="ghost" onClick={resetForm}>
            New rule
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void importJson(file);
          }
        }}
      />

      <div className="field-grid">
        <div className="field">
          <label htmlFor="rule-label">Label</label>
          <input id="rule-label" value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} />
        </div>
        <div className="field">
          <label htmlFor="rule-domain">Domain pattern</label>
          <input
            id="rule-domain"
            placeholder="youtube.com"
            value={form.domainPattern}
            onChange={(event) => setForm((current) => ({ ...current, domainPattern: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="rule-path">Optional path</label>
          <input
            id="rule-path"
            placeholder="/shorts"
            value={form.pathPattern}
            onChange={(event) => setForm((current) => ({ ...current, pathPattern: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="rule-mode">Mode</label>
          <select id="rule-mode" value={form.mode} onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value as RuleMode }))}>
            {Object.entries(RULE_MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rule-delay">Delay seconds</label>
          <input
            id="rule-delay"
            type="number"
            min="0"
            value={form.delaySeconds}
            onChange={(event) => setForm((current) => ({ ...current, delaySeconds: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="rule-tier">Tier</label>
          <select id="rule-tier" value={form.tier} onChange={(event) => setForm((current) => ({ ...current, tier: event.target.value as Rule["tier"] }))}>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
          </select>
        </div>
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="rule-prompt-text">Prompt text</label>
          <input
            id="rule-prompt-text"
            value={form.promptText}
            onChange={(event) => setForm((current) => ({ ...current, promptText: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="rule-budget">Daily minute budget {hasFeature(state.license, "budgets") ? "" : "(Pro)"}</label>
          <input
            id="rule-budget"
            type="number"
            min="0"
            disabled={!hasFeature(state.license, "budgets")}
            value={form.dailyMinuteBudget}
            onChange={(event) => setForm((current) => ({ ...current, dailyMinuteBudget: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="rule-session-cap">Daily session cap {hasFeature(state.license, "session_caps") ? "" : "(Pro)"}</label>
          <input
            id="rule-session-cap"
            type="number"
            min="0"
            disabled={!hasFeature(state.license, "session_caps")}
            value={form.dailySessionLimit}
            onChange={(event) => setForm((current) => ({ ...current, dailySessionLimit: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="rule-cooldown">Cooldown minutes {hasFeature(state.license, "cooldowns") ? "" : "(Pro)"}</label>
          <input
            id="rule-cooldown"
            type="number"
            min="0"
            disabled={!hasFeature(state.license, "cooldowns")}
            value={form.cooldownMinutes}
            onChange={(event) => setForm((current) => ({ ...current, cooldownMinutes: event.target.value }))}
          />
        </div>
      </div>

      <div className="toggle">
        <input id="rule-enabled" type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
        <label htmlFor="rule-enabled">Rule enabled</label>
      </div>
      <div className="toggle">
        <input id="rule-prompt" type="checkbox" checked={form.promptEnabled} onChange={(event) => setForm((current) => ({ ...current, promptEnabled: event.target.checked }))} />
        <label htmlFor="rule-prompt">Ask for intention prompt</label>
      </div>

      <div className="field">
        <label htmlFor="rule-allowlist">Allowlist patterns</label>
        <textarea
          id="rule-allowlist"
          placeholder="https://www.youtube.com/watch*"
          value={form.allowlistPatterns}
          onChange={(event) => setForm((current) => ({ ...current, allowlistPatterns: event.target.value }))}
        />
      </div>

      <div className="stack">
        <div className="row" style={{ paddingBottom: 0 }}>
          <div className="rowLabel">
            <p className="rowTitle">Schedules</p>
            <p className="rowMeta">Apply rules only during certain windows. Empty means “always active.”</p>
          </div>
          <button
            className="button"
            data-variant="ghost"
            disabled={!hasFeature(state.license, "schedules")}
            onClick={() =>
              setForm((current) => ({
                ...current,
                schedule: [
                  ...current.schedule,
                  {
                    id: crypto.randomUUID(),
                    days: ["mon", "tue", "wed", "thu", "fri"],
                    startMinute: 9 * 60,
                    endMinute: 17 * 60,
                  },
                ],
              }))
            }
          >
            Add window
          </button>
        </div>
        {form.schedule.length === 0 ? <p className="empty">No schedule windows.</p> : null}
        {form.schedule.map((window) => (
          <div className="schedule-card" key={window.id}>
            <div className="day-grid">
              {DAY_MAP.map((day) => {
                const selected = window.days.includes(day.key);
                return (
                  <button
                    key={day.key}
                    className="button"
                    data-variant={selected ? undefined : "ghost"}
                    type="button"
                    onClick={() =>
                      upsertSchedule(window.id, {
                        days: selected ? window.days.filter((entry) => entry !== day.key) : [...window.days, day.key],
                      })
                    }
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            <div className="field-grid">
              <div className="field">
                <label>Start</label>
                <input type="time" value={minutesToClock(window.startMinute)} onChange={(event) => upsertSchedule(window.id, { startMinute: clockToMinutes(event.target.value) })} />
              </div>
              <div className="field">
                <label>End</label>
                <input type="time" value={minutesToClock(window.endMinute)} onChange={(event) => upsertSchedule(window.id, { endMinute: clockToMinutes(event.target.value) })} />
              </div>
            </div>
            <div className="button-row">
              <button className="button" data-variant="ghost" onClick={() => setForm((current) => ({ ...current, schedule: current.schedule.filter((entry) => entry.id !== window.id) }))}>
                Remove window
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="button-row">
        <button className="button" onClick={() => void saveRule()}>
          {editingId ? "Save rule" : "Create rule"}
        </button>
        {editingId ? (
          <button className="button" data-variant="ghost" onClick={resetForm}>
            Cancel editing
          </button>
        ) : null}
      </div>

      <div>
        <h2 className="sectionHeading">Saved rules</h2>
        <div className="rule-list">
          {sortedRules.length === 0 ? <p className="empty">No rules yet. Add a preset or create one manually.</p> : null}
          {sortedRules.map((rule) => (
            <article className="rule-row" key={rule.id}>
              <div className="rule-rowHeader">
                <div className="rowLabel">
                  <p className="rowTitle">{rule.label}</p>
                  <p className="rowMeta">
                    {rule.domainPattern}
                    {rule.pathPattern ? ` • ${rule.pathPattern}` : ""}
                  </p>
                </div>
                <div className="options-actions">
                  <button className="button" data-variant="ghost" onClick={() => loadRule(rule)}>
                    Edit
                  </button>
                  <button className="button" data-variant="ghost" onClick={() => void deleteRule(rule.id)}>
                    Delete
                  </button>
                </div>
              </div>
              <div className="rule-meta">
                <span className="tag">{RULE_MODE_LABELS[rule.mode]}</span>
                <span className="tag">{rule.delaySeconds}s</span>
                <span className="tag">{rule.enabled ? "Enabled" : "Disabled"}</span>
                <span className="tag">{rule.tier.toUpperCase()}</span>
                {rule.schedule.length > 0 ? (
                  <span className="tag">
                    {rule.schedule
                      .map(
                        (window) =>
                          `${window.days
                            .map((day) => WEEKDAY_LABELS[DAY_MAP.findIndex((entry) => entry.key === day)])
                            .join(", ")} ${minutesToClock(window.startMinute)}-${minutesToClock(window.endMinute)}`,
                      )
                      .join(" • ")}
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
