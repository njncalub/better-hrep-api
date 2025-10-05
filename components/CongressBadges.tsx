interface CongressBadgesProps {
  congresses: number[];
}

export const CongressBadges = ({ congresses }: CongressBadgesProps) => {
  // Sort congresses from lowest to highest
  const sortedCongresses = [...congresses].sort((a, b) => a - b);

  return (
    <div class="person-congress-badges">
      {sortedCongresses.map((congress) => (
        <span class="congress-badge">{congress}th</span>
      ))}
    </div>
  );
};
