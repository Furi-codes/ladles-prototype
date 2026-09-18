import type { LeaderboardEntry } from "./leaderboard-preview";
import styles from "../volunteer.module.css";

type Props = {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  isLoading?: boolean;
  isPreview?: boolean;
};

export default function VolunteerLeaderboard({ entries, currentUserId, isLoading = false, isPreview = false }: Props) {
  // Entries arrive pre-ranked and ordered by the data source.
  const topTen = entries.slice(0, 10);

  function medal(rank: number) {
    const label = rank === 1 ? "Gold" : rank === 2 ? "Silver" : "Bronze";

    return (
      <span
        className={`${styles.leaderboardMedal} ${styles[`leaderboardMedal${label}`]}`}
        role="img"
        aria-label={`${label} medal`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 3h4l1 6-4 3-3-7h2Z" />
          <path d="M13 3h4l2 2-3 7-4-3 1-6Z" />
          <circle cx="12" cy="15" r="5" />
          <path d="m9.75 15 1.45 1.4 3.05-3" />
        </svg>
      </span>
    );
  }

  function row(entry: LeaderboardEntry) {
    const isYou = entry.id === currentUserId;
    return <tr key={entry.id} className={isYou ? styles.leaderboardHighlight : undefined}>
      <td>{entry.rank <= 3 ? medal(entry.rank) : <span className={styles.leaderboardRank}>{entry.rank}</span>}</td>
      <td><span className={styles.leaderboardName}>{entry.name}</span>{isYou && <span className={styles.leaderboardYou}>You</span>}</td>
      <td className={styles.leaderboardHours}>{entry.total_hours.toLocaleString("en-ZA", { maximumFractionDigits: 1 })}</td>
    </tr>;
  }

  return <section className={`${styles.card} ${styles.progressCard}`} aria-labelledby="leaderboard-title" aria-busy={isLoading}>
    <div className={styles.cardHeader}>
      <div><h2 id="leaderboard-title" className={styles.cardTitle}>Volunteer leaderboard</h2><p className={styles.cardHint}>Celebrating the time our community gives.</p></div>
      {isPreview && <span className={styles.leaderboardPreview}>Sample data</span>}
    </div>
    {isLoading ? <div className={styles.leaderboardLoading} role="status"><span className={styles.leaderboardSpinner} aria-hidden="true" />Loading volunteer rankings...</div>
      : entries.length === 0 ? <div className={styles.leaderboardLoading}><strong>No volunteers yet</strong><span>Volunteer rankings will appear here.</span></div>
      : <div className={styles.progressTableRegion} tabIndex={0} role="region" aria-label="Volunteer rankings, scroll to see all ten">
        <table className={`${styles.table} ${styles.leaderboardTable}`} aria-labelledby="leaderboard-title">
          <thead><tr><th scope="col">Rank</th><th scope="col">Name</th><th scope="col">Total hours</th></tr></thead>
          <tbody>{topTen.map((entry) => row(entry))}</tbody>

        </table>
      </div>}
    <div className={styles.progressFooter}><span className={styles.progressNote}>{isPreview ? "Sample hours and ranks only. Your actual hours remain in My progression." : "Ranked by total hours, then alphabetically by name."}</span></div>
  </section>;
}
