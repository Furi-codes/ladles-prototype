"use client";

import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import styles from "../volunteer.module.css";

export default function CalendarPanel({ isLoading, tileClassName, onDayClick }: { isLoading: boolean; tileClassName: ({ date }: { date: Date }) => string | null; onDayClick: (date: Date) => void }) {
  return <section className={styles.card}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Event calendar</h2><p className={styles.cardHint}>Choose a highlighted date to view events and reserve a shift.</p></div></div><div className={styles.calendarBody}>{isLoading ? <div className={styles.emptySmall}>Loading calendar...</div> : <div className="calendar-wrapper"><Calendar value={new Date()} minDate={new Date()} locale="en-ZA" tileClassName={tileClassName} onClickDay={onDayClick} /></div>}<div className={styles.calendarLegend}><span className={styles.legendItem}><span className={styles.legendDot} aria-hidden="true" />Events available</span><span className={styles.legendItem}><span className={styles.legendBookedDot} aria-hidden="true" />Your booked event</span></div></div></section>;
}
