type UpgradeCardProps = {
  onStartTrial: () => void;
  onOpenOptions: () => void;
  canStartTrial: boolean;
};

export const UpgradeCard = ({ onStartTrial, onOpenOptions, canStartTrial }: UpgradeCardProps) => (
  <section className="popup-section section">
    <h2 className="sectionHeading">Pro unlocks stricter control</h2>
    <p className="sectionCopy">
      Unlimited sites, schedules, budgets, session caps, weekly summaries, and temporary passes.
    </p>
    <div className="button-row">
      {canStartTrial ? <button className="button" onClick={onStartTrial}>Start local dev trial</button> : null}
      <button className="button" data-variant="ghost" onClick={onOpenOptions}>
        Compare plans
      </button>
    </div>
  </section>
);
