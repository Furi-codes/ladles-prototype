"use client";

import { useCallback, useState } from "react";
import { loadReportData, searchReportEvents, searchReportLocations } from "@/lib/actions/corporate";
import { logAdminAction } from "@/lib/actions/audit";
import { corporateImpact, selectedReportRows, reportCsv, reportPresets, presetFilter, type ReportPreset, type ReportFilter } from "@/lib/reporting";
import { Field, FeatureState, useFeatureData } from "./FeatureShared";
import SearchSelector from "./SearchSelector";
import { AnalyticsOverview, AttendanceHeatmap } from "./AnalyticsVisuals";
import CommunityParticipation from "../../volunteer/components/CommunityParticipation";
import styles from "../admin.module.css";

type AnalyticsView = "overview" | "attendance" | "events" | "exports";

const analyticsLabels: Record<AnalyticsView, string> = {
  overview: "Overview",
  attendance: "Attendance heatmap",
  events: "Event performance",
  exports: "Exports",
};

export default function ReportsManager() {
  const [filter, setFilter] = useState<ReportFilter>(() => presetFilter("Recent Activity"));
  const [preset, setPreset] = useState<ReportPreset>("Recent Activity");
  const loader = useCallback(() => loadReportData(filter), [filter]);
  const { data, loading, error, reload } = useFeatureData(loader);
  const [eventLabel, setEventLabel] = useState("");
  const [eventQuery, setEventQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [corporateOnly, setCorporateOnly] = useState(false);
  const [company, setCompany] = useState("");
  const [view, setView] = useState<AnalyticsView>("overview");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const invalid = Boolean(filter.from && filter.to && filter.from > filter.to);
  const rows = data && !loading ? selectedReportRows(data, filter, corporateOnly, company) : [];
  const impact = data ? corporateImpact(data.corporate, data.events, company, filter) : null;
  const total = (key: "bookings" | "attendance" | "individualHours" | "corporateHours") => rows.reduce((sum, row) => sum + row[key], 0);
  const filterSummary = [preset, filter.from && filter.to ? `${filter.from} to ${filter.to}` : "All dates", filter.location || null, eventLabel || null, corporateOnly ? "Corporate only" : null].filter(Boolean).join(" · ");

  function update(key: keyof ReportFilter, value: string) {
    setPreset("Custom Report");
    setFilter((current) => ({ ...current, [key]: value }));
  }

  async function exportCsv() {
    const csv = reportCsv(rows);
    if (!csv) return;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `ladles-report-${filter.from || "all"}-${filter.to || "all"}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    await logAdminAction({ action: "REPORT_EXPORTED", entityType: "REPORT", entityLabel: preset, details: { from: filter.from || null, to: filter.to || null, event_id: filter.event || null, location: filter.location || null, corporate_only: corporateOnly, rows: rows.length } });
  }

  const metrics = [
    ["Reserved volunteer places", total("bookings")],
    ["Verified individual hours", total("individualHours").toFixed(2)],
    ["Recorded corporate hours", total("corporateHours").toFixed(2)],
    ["Recorded attendance rate", total("bookings") ? `${(100 * total("attendance") / total("bookings")).toFixed(1)}%` : "—"],
  ];

  return <div className={styles.featureStack}>
    <FeatureState error={error} loading={loading} retry={reload} />
    <section className={styles.card}>
      <div className={styles.analyticsTabs} role="tablist" aria-label="Analytics views">
        {(Object.keys(analyticsLabels) as AnalyticsView[]).map((key) => <button key={key} type="button" role="tab" aria-selected={view === key} className={`${styles.analyticsTab} ${view === key ? styles.analyticsTabActive : ""}`} onClick={() => setView(key)}>{analyticsLabels[key]}</button>)}
      </div>
    </section>

    {view === "overview" && <CommunityParticipation analytics />}

    {data && !loading && <>
      {view === "overview" && <>
        <section className={styles.stats} aria-label="Overview metrics">{metrics.map(([label, value]) => <div key={label} className={`${styles.card} ${styles.stat}`}><div className={styles.statLabel}>{label}</div><div className={styles.statValue}>{value}</div></div>)}</section>
        <AnalyticsOverview data={data} />
      </>}

      {view === "attendance" && <AttendanceHeatmap data={data} />}

      {view === "events" && <div className={styles.analyticsStack}>
        <section className={styles.card}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>{corporateOnly ? "Corporate event participation" : "Event performance"}</h2><p className={styles.cardHint}>Attendance, capacity and verified-hours results for the filtered events.</p></div></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Event</th><th>Date</th><th>Capacity</th><th>Reserved places</th><th>Attendance</th><th>Attendance rate</th><th>Individual hours</th><th>Corporate hours</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.event}</td><td>{row.date}</td><td>{row.capacity}</td><td>{row.bookings}</td><td>{row.attendance}</td><td>{row.rate === null ? "—" : `${row.rate.toFixed(1)}%`}</td><td>{row.individualHours.toFixed(2)}</td><td>{row.corporateHours.toFixed(2)}</td></tr>)}</tbody></table></div>{!rows.length && <p className={styles.empty}>No events match these filters.</p>}</section>
        <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Corporate impact</h2></div><div className={styles.featureBody}><Field label="Company"><select className={styles.select} value={company} onChange={(event) => { setCompany(event.target.value); setCorporateOnly(true); setPreset("Custom Report"); }}><option value="">All companies</option>{data.companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>{impact && !invalid && <p className={styles.helper}>Employee places reserved: <strong>{impact.participating}</strong> · Events supported: <strong>{impact.events}</strong> · Recorded attendance: <strong>{impact.attendance}</strong> · Recorded corporate hours: <strong>{impact.hours.toFixed(2)}</strong></p>}<p className={styles.helper}>Employee places are participation instances, not unique employees. Cancelled group bookings are excluded.</p></div></section>
      </div>}

      {view === "exports" && <section className={styles.card}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Power BI and spreadsheet export</h2><p className={styles.cardHint}>Download exactly the filtered event-performance data currently shown in this workspace.</p></div><button className={styles.primaryButton} disabled={!rows.length} onClick={() => void exportCsv()}>Download CSV</button></div><div className={styles.featureBody}><p className={styles.helper}>The CSV includes event, date, capacity, reserved places, recorded attendance, attendance rate, verified individual hours, recorded corporate hours, corporate groups and confirmed booking records. It can be imported directly into Excel or Power BI.</p><p className={styles.helper}>The export contains aggregate event data only; it does not include volunteer names, email addresses or other contact details.</p>{!rows.length && <p className={styles.empty}>Choose filters that return at least one event before exporting.</p>}</div></section>}
    </>}

    <section className={styles.card}>
      <div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Report filters</h2><p className={styles.cardHint}>{filterSummary}</p></div><button type="button" className={styles.secondaryButton} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>{filtersOpen ? "Hide filters" : "Show filters"}</button></div>
      {filtersOpen && <div className={`${styles.featureBody} ${styles.formGrid}`}>
        <Field label="Report preset"><select className={styles.select} value={preset} onChange={(event) => { const next = event.target.value as ReportPreset; setPreset(next); setFilter(presetFilter(next)); setCompany(""); setCorporateOnly(next === "Corporate Participation"); setEventQuery(""); setLocationQuery(""); setEventLabel(""); }}>{reportPresets.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Participation"><select className={styles.select} value={corporateOnly ? "corporate" : "all"} onChange={(event) => { setCorporateOnly(event.target.value === "corporate"); setCompany(""); setPreset("Custom Report"); }}><option value="all">Individual and corporate</option><option value="corporate">Corporate only</option></select></Field>
        <Field label="Date From"><input type="date" className={styles.input} value={filter.from} onChange={(event) => update("from", event.target.value)} /></Field>
        <Field label="Date To"><input type="date" className={styles.input} value={filter.to} onChange={(event) => update("to", event.target.value)} /></Field>
        <SearchSelector label="Location" value={filter.location} selectedLabel={filter.location} query={locationQuery} onQuery={setLocationQuery} loadOptions={searchReportLocations} onChange={(value) => update("location", value)} />
        <SearchSelector label="Event" value={filter.event} selectedLabel={eventLabel} query={eventQuery} onQuery={setEventQuery} loadOptions={searchReportEvents} onChange={(value, label) => { update("event", value); setEventLabel(label); }} />
        {corporateOnly && <Field label="Company"><select className={styles.select} value={company} onChange={(event) => { setCompany(event.target.value); setPreset("Custom Report"); }}><option value="">All companies</option>{(data?.companies ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
        <p className={`${styles.helper} ${styles.fieldFull}`}>Dates use Africa/Johannesburg and refer to event dates. Recent Activity covers 30 days; Event Attendance covers 90 days. Adjust any field to create a Custom Report.</p>
      </div>}
      {invalid && <p className={styles.error} role="alert">Date From must be on or before Date To.</p>}
    </section>
    <p className={styles.helper}>Individual hours = recorded worked minutes ÷ 60; missing minutes contribute no verified hours. Corporate hours are manually recorded for completed groups. Attendance includes individual clock-ins and completed corporate attendance.</p>
    <button className={styles.secondaryButton} onClick={reload} disabled={loading}>Refresh analytics</button>
  </div>;
}
