import { buildWeeklySummary } from "../../lib/analytics";
import type { ExtensionState } from "../../lib/schema";

export const SummaryPage = ({ state }: { state: ExtensionState }) => {
  const summary = buildWeeklySummary(state);

  return (
    <section className="section stack">
      <div>
        <h2 className="sectionHeading">Weekly summary</h2>
        <p className="sectionCopy">A local rollup of how often PauseTab interrupted visits and how much browsing time it may have helped you avoid.</p>
      </div>
      <div className="metric-grid">
        <div className="rule-row">
          <span className="metricValue">{summary.avoided}</span>
          <span className="metricLabel">Avoided opens</span>
        </div>
        <div className="rule-row">
          <span className="metricValue">{summary.proceeded}</span>
          <span className="metricLabel">Proceeded opens</span>
        </div>
        <div className="rule-row">
          <span className="metricValue">{Math.round(summary.estimatedMinutesSaved)}</span>
          <span className="metricLabel">Estimated minutes saved</span>
        </div>
      </div>
      <div>
        <h3 className="sectionHeading">Top sites</h3>
        {summary.topSites.length === 0 ? <p className="empty">No weekly activity yet.</p> : null}
        {summary.topSites.map((item) => (
          <div className="row" key={item.domain}>
            <div className="rowLabel">
              <p className="rowTitle">{item.domain}</p>
              <p className="rowMeta">
                {item.avoided} avoided • {item.proceeded} proceeded
              </p>
            </div>
            <span className="pill">{Math.round(item.minutesSpent)}m spent</span>
          </div>
        ))}
      </div>
    </section>
  );
};
