type QuickActionsProps = {
  pausedUntil?: string;
  onPause: (minutes: number | "tomorrow") => void;
  onClearPause: () => void;
};

export const QuickActions = ({ pausedUntil, onPause, onClearPause }: QuickActionsProps) => (
  <section className="popup-section section">
    <h2 className="sectionHeading">Pause controls</h2>
    <p className="sectionCopy">
      Pause all protections briefly when you need a deliberate exception.
    </p>
    <div className="button-row">
      <button className="button" data-variant="ghost" onClick={() => onPause(15)}>
        15 minutes
      </button>
      <button className="button" data-variant="ghost" onClick={() => onPause(60)}>
        1 hour
      </button>
      <button className="button" data-variant="ghost" onClick={() => onPause("tomorrow")}>
        Until tomorrow
      </button>
      {pausedUntil ? (
        <button className="button" data-variant="soft" onClick={onClearPause}>
          Resume protections
        </button>
      ) : null}
    </div>
  </section>
);
