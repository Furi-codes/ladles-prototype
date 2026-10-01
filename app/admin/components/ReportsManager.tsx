"use client";

import { useCallback, useState } from "react";
import { loadReportData, searchReportEvents, searchReportLocations } from "@/lib/actions/corporate";
import { logAdminAction } from "@/lib/actions/audit";
import { corporateImpact, selectedReportData, selectedReportRows, participationSummary, reportCsv, reportPresets, presetFilter, type ReportPreset, type ReportFilter } from "@/lib/reporting";
import { Field, FeatureState, useFeatureData } from "./FeatureShared";
import SearchSelector from "./SearchSelector";
import { AnalyticsOverview, AttendanceHeatmap, EventPerformanceChart } from "./AnalyticsVisuals";
import ParticipationTrend from "./ParticipationTrend";
import visual from "./analytics.module.css";
import styles from "../admin.module.css";

type AnalyticsView = "overview" | "events" | "attendance";

const analyticsLabels: Record<AnalyticsView, string> = {
  overview: "Overview",
  events: "Event performance",
  attendance: "Attendance heatmap",
};

export default function ReportsManager() {
  const [filter, setFilter] = useState<ReportFilter>(() => presetFilter("Latest 6 months"));
  const [preset, setPreset] = useState<ReportPreset>("Latest 6 months");
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
  const scoped = data && !loading ? selectedReportData(data, filter, corporateOnly, company) : null;
  const summary = scoped ? participationSummary(scoped, filter) : null;
  const impact = data ? corporateImpact(data.corporate, data.events, company, filter) : null;
  const total = (key: "bookings" | "attendance" | "individualHours" | "corporateHours") => rows.reduce((sum, row) => sum + row[key], 0);
  const selectedFilters = [
    ["Period", filter.from && filter.to ? `${filter.from} to ${filter.to}` : "All dates"],
    ["Event type", filter.category || "All event types"],
    ["Location", filter.location || "All locations"],
    ["Event", eventLabel || "All events"],
    ["Participation", corporateOnly ? "Corporate only" : "Individual + corporate"],
    ...(corporateOnly ? [["Company", data?.companies.find(item => String(item.id) === company)?.name || "All companies"]] : []),
  ];

  function changePreset(next: ReportPreset) {
    setPreset(next); setFilter(presetFilter(next)); setCompany(""); setCorporateOnly(next === "Corporate Participation"); setEventQuery(""); setLocationQuery(""); setEventLabel("");
  }

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
    await logAdminAction({ action: "REPORT_EXPORTED", entityType: "REPORT", entityLabel: preset, details: { from: filter.from || null, to: filter.to || null, event_id: filter.event || null, category: filter.category || null, location: filter.location || null, corporate_only: corporateOnly, rows: rows.length } });
  }

  const metrics = [
    [corporateOnly ? "Reserved corporate places" : "Unique volunteers", corporateOnly ? total("bookings") : summary?.uniqueVolunteers ?? 0, corporateOnly ? "Participation instances, not unique people" : "Individuals with a recorded clock-in"],
    [corporateOnly ? "Recorded corporate hours" : "Verified individual hours", total(corporateOnly ? "corporateHours" : "individualHours").toFixed(1), corporateOnly ? "Manually recorded for completed groups" : "Calculated from recorded worked minutes"],
    ["Recorded attendance", total("attendance"), "Instances across selected events"],
    ["Events in selection", rows.length, "Cancelled events excluded"],
  ];

  return <div className={visual.workspace}>
    <div className={visual.toolbar}>
      <div className={visual.toolbarActions}>
        <select aria-label="Reporting period preset" className={styles.select} value={preset} onChange={e => changePreset(e.target.value as ReportPreset)}>{reportPresets.map(p => <option key={p}>{p}</option>)}</select>
        <button type="button" className={styles.secondaryButton} aria-expanded={filtersOpen} aria-controls="analytics-filters" onClick={() => setFiltersOpen(open => !open)}>{filtersOpen ? "Hide filters" : "Filters"}</button>
        <button type="button" className={styles.secondaryButton} onClick={reload} disabled={loading}>Refresh</button>
        <button type="button" className={styles.primaryButton} onClick={() => void exportCsv()} disabled={!rows.length}>Export CSV</button>
      </div>
    </div>
    <section className={visual.filterSummary} aria-label="Current report filters"><span className={visual.filterSummaryTitle}>Current selection</span><div className={visual.filterBlocks}>{selectedFilters.map(([label, value]) => <div className={visual.filterBlock} key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><p>Dates refer to event dates in Africa/Johannesburg.</p></section>
    <section id="analytics-filters" className={styles.card} hidden={!filtersOpen && !invalid}>
      {filtersOpen && <div className={`${styles.featureBody} ${styles.formGrid}`}>
        <Field label="Report preset"><select className={styles.select} value={preset} onChange={(event) => { const next = event.target.value as ReportPreset; setPreset(next); setFilter(presetFilter(next)); setCompany(""); setCorporateOnly(next === "Corporate Participation"); setEventQuery(""); setLocationQuery(""); setEventLabel(""); }}>{reportPresets.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Participation"><select className={styles.select} value={corporateOnly ? "corporate" : "all"} onChange={(event) => { setCorporateOnly(event.target.value === "corporate"); setCompany(""); setPreset("Custom Report"); }}><option value="all">Individual and corporate</option><option value="corporate">Corporate only</option></select></Field>
        <Field label="Date From"><input type="date" className={styles.input} value={filter.from} onChange={(event) => update("from", event.target.value)} /></Field>
        <Field label="Event type"><select className={styles.select} value={filter.category || ""} onChange={event => update("category", event.target.value)}><option value="">All event types</option>{["Dignity Kitchen", "Warehouse HQ", "Feed The Soil", "Campaign / Special Event", "Other"].map(category => <option key={category}>{category}</option>)}</select></Field>
        <Field label="Date To"><input type="date" className={styles.input} value={filter.to} onChange={(event) => update("to", event.target.value)} /></Field>
        <SearchSelector label="Location" value={filter.location} selectedLabel={filter.location} query={locationQuery} onQuery={setLocationQuery} loadOptions={searchReportLocations} onChange={(value) => update("location", value)} />
        <SearchSelector label="Event" value={filter.event} selectedLabel={eventLabel} query={eventQuery} onQuery={setEventQuery} loadOptions={searchReportEvents} onChange={(value, label) => { update("event", value); setEventLabel(label); }} />
        {corporateOnly && <Field label="Company"><select className={styles.select} value={company} onChange={(event) => { setCompany(event.target.value); setPreset("Custom Report"); }}><option value="">All companies</option>{(data?.companies ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
        <p className={`${styles.helper} ${styles.fieldFull}`}>Filters apply to every chart, total and export. Latest 6 months includes the current partial month; Recent Activity covers 30 days. Cancelled events and groups are excluded. <button type="button" className={styles.secondaryButton} onClick={() => changePreset("Latest 6 months")}>Reset filters</button></p>
      </div>}
      {invalid && <p className={styles.error} role="alert">Date From must be on or before Date To.</p>}
    </section>
    <div className={visual.tabs} role="tablist" aria-label="Analytics views">
        {(Object.keys(analyticsLabels) as AnalyticsView[]).map((key, index, keys) => <button key={key} id={`tab-${key}`} type="button" role="tab" aria-controls="analytics-panel" tabIndex={view === key ? 0 : -1} aria-selected={view === key} onClick={() => setView(key)} onKeyDown={e => {
          const next = e.key === "ArrowRight" ? keys[(index + 1) % keys.length] : e.key === "ArrowLeft" ? keys[(index - 1 + keys.length) % keys.length] : e.key === "Home" ? keys[0] : e.key === "End" ? keys.at(-1) : null;
          if (next) { e.preventDefault(); setView(next); document.getElementById(`tab-${next}`)?.focus(); }
        }}>{analyticsLabels[key]}</button>)}
      </div>
    <FeatureState error={error} loading={loading} retry={reload} />
    {data && scoped && !loading && !invalid && <div id="analytics-panel" role="tabpanel" aria-labelledby={`tab-${view}`} className={visual.workspace}>
      {view === "overview" && <>
        <section className={visual.metrics} aria-label="Overview metrics">{metrics.map(([label, value, note]) => <div key={label} className={visual.metric}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}</section>
        <div className={visual.chartGrid}><ParticipationTrend data={scoped} filter={filter} corporateOnly={corporateOnly} /><AnalyticsOverview data={scoped} /></div>
        <div className={visual.chartGrid}>
          <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Recent event results</h2><button className={styles.secondaryButton} onClick={() => setView("events")}>View all</button></div><div className={styles.tableWrap}><table className={visual.summaryTable}><thead><tr><th>Event</th><th>Attendance</th><th>Individual hours</th></tr></thead><tbody>{[...rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map(row => <tr key={row.id}><td>{row.event}<br /><small>{row.date}</small></td><td>{row.attendance}</td><td>{row.individualHours.toFixed(1)}</td></tr>)}</tbody></table></div>{!rows.length && <p className={styles.empty}>No events match this selection.</p>}</section>
          <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>About these results</h2></div><div className={visual.insights}><p><strong>{total("corporateHours").toFixed(1)} corporate hours</strong> recorded separately from individual clocked hours.</p><p><strong>{scoped.attendance.filter(a => a.clocked_in_at && !a.clocked_out_at).length} open attendance records</strong> still have no clock-out. Their final hours may not yet be available.</p><p>Totals describe recorded activity, not predictions. Monthly unique counts should not be added together.</p></div></section>
        </div>
      </>}

      {view === "events" && <div className={styles.analyticsStack}>
        <EventPerformanceChart rows={rows} />
        <section className={styles.card}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>{corporateOnly ? "Corporate event participation" : "Event performance"}</h2><p className={styles.cardHint}>Attendance, capacity and verified-hours results for the filtered events.</p></div></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Event</th><th>Date</th><th>Capacity</th><th>Reserved places</th><th>Attendance</th><th>Attendance rate</th><th>Individual hours</th><th>Corporate hours</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.event}</td><td>{row.date}</td><td>{row.capacity}</td><td>{row.bookings}</td><td>{row.attendance}</td><td>{row.rate === null ? "—" : `${row.rate.toFixed(1)}%`}</td><td>{row.individualHours.toFixed(2)}</td><td>{row.corporateHours.toFixed(2)}</td></tr>)}</tbody></table></div>{!rows.length && <p className={styles.empty}>No events match these filters.</p>}</section>
        <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Corporate impact</h2></div><div className={styles.featureBody}><Field label="Company"><select className={styles.select} value={company} onChange={(event) => { setCompany(event.target.value); setCorporateOnly(true); setPreset("Custom Report"); }}><option value="">All companies</option>{data.companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>{impact && !invalid && <p className={styles.helper}>Employee places reserved: <strong>{impact.participating}</strong> · Events supported: <strong>{impact.events}</strong> · Recorded attendance: <strong>{impact.attendance}</strong> · Recorded corporate hours: <strong>{impact.hours.toFixed(2)}</strong></p>}<p className={styles.helper}>Employee places are participation instances, not unique employees. Cancelled group bookings are excluded.</p></div></section>
      </div>}

      {view === "attendance" && <AttendanceHeatmap data={scoped} />}
    </div>}

    <p className={styles.helper}>Individual hours = recorded worked minutes ÷ 60; missing minutes contribute no verified hours. Corporate hours are manually recorded for completed groups. Attendance includes individual clock-ins and completed corporate attendance.</p>
  </div>;
}
