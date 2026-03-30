import { PRESET_SITES } from "../../lib/constants";
import { canCreateAnotherRule } from "../../lib/licensing";
import { createRule } from "../../lib/rules";
import { updateState } from "../../lib/storage";
import type { ExtensionState } from "../../lib/schema";

type PresetsPageProps = {
  state: ExtensionState;
  refresh: () => Promise<void>;
};

export const PresetsPage = ({ state, refresh }: PresetsPageProps) => {
  const addPreset = async (presetId: string) => {
    const preset = PRESET_SITES.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    if (!canCreateAnotherRule(state)) {
      window.alert("PauseTab Free supports up to 3 protected sites. Open the Plan tab to activate Pro or start the local dev trial.");
      return;
    }

    await updateState((current) => ({
      ...current,
      rules: [
        ...current.rules,
        createRule(
          {
            domainPattern: preset.domainPattern,
            label: preset.title,
            pathPattern: preset.pathPattern,
          },
          current.preferences.defaultMode,
        ),
      ],
      onboarding: {
        ...current.onboarding,
        completed: true,
        selectedPresets: [...new Set([...current.onboarding.selectedPresets, preset.id])],
      },
    }));
    await refresh();
  };

  return (
    <section className="section">
      <h2 className="sectionHeading">Preset distractors</h2>
      <p className="sectionCopy">Start with common distraction patterns and then tune them per site.</p>
      <div className="rule-list">
        {PRESET_SITES.map((preset) => {
          const exists = state.rules.some((rule) => rule.domainPattern === preset.domainPattern);
          return (
            <article className="rule-row" key={preset.id}>
              <div className="rule-rowHeader">
                <div className="rowLabel">
                  <p className="rowTitle">{preset.title}</p>
                  <p className="rowMeta">{preset.description}</p>
                </div>
                <button className="button" onClick={() => void addPreset(preset.id)} disabled={exists}>
                  {exists ? "Added" : "Add preset"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
