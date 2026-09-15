"use client";

import { useState } from "react";
import {
  cancelEvent,
  deleteEvent,
  saveEventWithSlots,
  updateEventMetadata,
  type EventSlotInput,
} from "@/lib/actions/admin";
import { getLocalDateString, hasEventFinished } from "@/lib/date-utils";
import type { AttendanceCheckpoint, Event, EventCategory, EventSlot } from "@/lib/types";
import styles from "../admin.module.css";
import AttendanceQrDialog from "./AttendanceQrDialog";
import Icon from "./Icon";

const LOCATION_PRESETS = [
  "Unit 4, Hewett Park, 17 Hewett Avenue, Epping 2, Cape Town",
  "14A Roeland Street, Cape Town",
  "Feed The Soil pop-up location",
];

type EventTemplate = {
  id: string;
  label: string;
  category: EventCategory;
  title: string;
  description: string;
  location: string;
  locationDetail?: string;
  locationUrl?: string;
  lockLocation?: boolean;
  start: string;
  end: string;
  capacity: string;
};

const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: "dignity-kitchen",
    label: "Dignity Kitchen shift",
    category: "Dignity Kitchen",
    title: "Dignity Kitchen volunteer shift",
    description: "Help prepare and serve nourishing meals for people experiencing homelessness.",
    location: "Dignity Kitchen",
    locationDetail: "14A Roeland Street, Cape Town",
    locationUrl: "https://maps.app.goo.gl/QFd9MzHkUB2xdS6i6",
    lockLocation: true,
    start: "09:00",
    end: "12:00",
    capacity: "10",
  },
  {
    id: "warehouse",
    label: "Warehouse packing shift",
    category: "Warehouse HQ",
    title: "Warehouse packing shift",
    description: "Sort, pack, and prepare food supplies for Ladles of Love programmes.",
    location: "Ladles of Love Warehouse HQ",
    locationDetail: "Unit 4, Hewett Park, 17 Hewett Avenue, Epping 2, Cape Town",
    locationUrl: "https://maps.app.goo.gl/7idQKZsoAkZ7WGNDA",
    lockLocation: true,
    start: "09:00",
    end: "12:00",
    capacity: "15",
  },
  {
    id: "feed-the-soil",
    label: "Feed The Soil pop-up",
    category: "Feed The Soil",
    title: "Feed The Soil pop-up",
    description: "Support a community food-growing and nutrition initiative.",
    location: "Feed The Soil pop-up location",
    start: "09:00",
    end: "12:00",
    capacity: "10",
  },
  {
    id: "campaign",
    label: "Campaign / special event",
    category: "Campaign / Special Event",
    title: "",
    description: "",
    location: "",
    start: "09:00",
    end: "12:00",
    capacity: "10",
  },
];

const TIME_OPTIONS = Array.from({ length: 33 }, (_, index) => {
  const total = 6 * 60 + index * 30;
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
});

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};
const formatTime = (value: string) => value.slice(0, 5);
const formatSlot = (slot: EventSlot) => `${formatTime(slot.start_time)}-${formatTime(slot.end_time)} · ${slot.capacity} spots`;

type EventsManagerProps = {
  events: Event[];
  eventSlots: EventSlot[];
  attendanceCheckpoints: AttendanceCheckpoint[];
  isLoading: boolean;
  fetchData: () => void;
};

type LocationSearchResult = { label: string; mapUrl: string };

export default function EventsManager({
  events,
  eventSlots,
  attendanceCheckpoints,
  isLoading,
  fetchData,
}: EventsManagerProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [locationSearchQuery, setLocationSearchQuery] = useState("");
  const [locationResults, setLocationResults] = useState<LocationSearchResult[]>([]);
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
  const [isSearchingLocations, setIsSearchingLocations] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<EventCategory>("Other");
  const [templateId, setTemplateId] = useState("custom");
  const [ranges, setRanges] = useState<EventSlotInput[]>([]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [capacity, setCapacity] = useState("1");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; action: () => void } | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [eventToCancel, setEventToCancel] = useState<Event | null>(null);
  const [cancellationMessage, setCancellationMessage] = useState("");
  const [qrEvent, setQrEvent] = useState<Event | null>(null);

  const today = getLocalDateString();
  const slotsForEvent = (eventId: number) => eventSlots.filter((slot) => slot.event_id === eventId);
  const upcomingEvents = events
    .filter((event) => event.status !== "Cancelled" && !hasEventFinished(event, eventSlots))
    .sort((a, b) => a.date.localeCompare(b.date));
  const pastEvents = events
    .filter((event) => event.status !== "Cancelled" && hasEventFinished(event, eventSlots))
    .sort((a, b) => b.date.localeCompare(a.date));
  const cancelledEvents = events
    .filter((event) => event.status === "Cancelled")
    .sort((a, b) => (b.cancelled_at ?? "").localeCompare(a.cancelled_at ?? ""));
  const displayedEvents = showCancelled ? cancelledEvents : showPast ? pastEvents : upcomingEvents;
  const selectedTemplate = EVENT_TEMPLATES.find((item) => item.id === templateId);
  const locationIsLocked = Boolean(selectedTemplate?.lockLocation);

  function resetForm() {
    setTitle("");
    setDate("");
    setLocation("");
    setLocationUrl("");
    setLocationSearchQuery("");
    setLocationResults([]);
    setLocationSearchError(null);
    setDescription("");
    setCategory("Other");
    setTemplateId("custom");
    setRanges([]);
    setStart("09:00");
    setEnd("10:00");
    setCapacity("1");
    setEditingId(null);
    setDrawerOpen(false);
    setError(null);
  }

  function openCreate() {
    resetForm();
    setDrawerOpen(true);
  }

  function openEdit(event: Event) {
    const existingSlots = slotsForEvent(event.id);
    setEditingId(event.id);
    setTitle(event.title);
    setDate(event.date);
    setLocation(event.location);
    setLocationUrl(event.location_url ?? "");
    setLocationSearchQuery(event.location);
    setLocationResults([]);
    setLocationSearchError(null);
    setDescription(event.description ?? "");
    setCategory(event.category ?? "Other");
    setTemplateId("custom");
    setRanges(existingSlots.map(({ start_time, end_time, capacity: slotCapacity }) => ({
      start_time: formatTime(start_time),
      end_time: formatTime(end_time),
      capacity: slotCapacity,
    })));
    setError(existingSlots.length === 0 ? "This historical event has no proper slot records. Add its real ranges before saving." : null);
    setDrawerOpen(true);
  }

  function applyTemplate(selectedId: string) {
    setTemplateId(selectedId);
    const template = EVENT_TEMPLATES.find((item) => item.id === selectedId);
    if (!template) return;

    setCategory(template.category);
    setTitle(template.title);
    setDescription(template.description);
    setLocation(template.location);
    setLocationUrl(template.locationUrl ?? "");
    setLocationSearchQuery("");
    setLocationResults([]);
    setLocationSearchError(null);
    setStart(template.start);
    setEnd(template.end);
    setCapacity(template.capacity);
    setRanges([]);
    setError(null);
  }

  function addRange() {
    const rangeCapacity = Number(capacity);
    if (toMinutes(end) <= toMinutes(start)) {
      setError("Each time range must end after it starts.");
      return;
    }
    if (!Number.isInteger(rangeCapacity) || rangeCapacity < 1) {
      setError("Each time range needs a capacity of at least one.");
      return;
    }
    if (ranges.some((range) => toMinutes(start) < toMinutes(range.end_time) && toMinutes(end) > toMinutes(range.start_time))) {
      setError("Time ranges cannot overlap.");
      return;
    }
    setRanges((current) => [...current, { start_time: start, end_time: end, capacity: rangeCapacity }]
      .sort((first, second) => toMinutes(first.start_time) - toMinutes(second.start_time)));
    setError(null);
  }

  async function searchLocations() {
    const query = locationSearchQuery.trim();
    if (query.length < 3) {
      setLocationSearchError("Enter at least three characters to search.");
      return;
    }
    setIsSearchingLocations(true);
    setLocationSearchError(null);
    setLocationResults([]);
    try {
      const response = await fetch(`/api/location-search?q=${encodeURIComponent(query)}`);
      const payload = await response.json() as { results?: LocationSearchResult[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Location search is unavailable.");
      setLocationResults(payload.results ?? []);
      if ((payload.results ?? []).length === 0) setLocationSearchError("No South African addresses matched that search. Try a street, suburb, or city.");
    } catch (searchError) {
      setLocationSearchError(searchError instanceof Error ? searchError.message : "Location search is unavailable.");
    } finally {
      setIsSearchingLocations(false);
    }
  }

  function chooseLocation(result: LocationSearchResult) {
    setLocation(result.label);
    setLocationUrl(result.mapUrl);
    setLocationSearchQuery(result.label);
    setLocationResults([]);
    setLocationSearchError(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !date || !location.trim() || ranges.length === 0) {
      setError("Complete all fields and add at least one time range.");
      return;
    }

    const action = async () => {
      try {
        const mapUrl = locationUrl.trim();
        if (mapUrl && !/^https?:\/\//i.test(mapUrl)) throw new Error("Map link must start with https:// or http://.");
        const { data: rawSavedEvent, error: saveError } = await saveEventWithSlots(
          editingId,
          { title: title.trim(), date, location: location.trim() },
          ranges,
        );
        const savedEvent = rawSavedEvent as Event | null;
        if (saveError || !savedEvent) throw saveError ?? new Error("The event could not be saved.");
        const { error: metadataError } = await updateEventMetadata(savedEvent.id, {
          category,
          location_url: mapUrl || null,
          description: description.trim() || null,
        });
        if (metadataError) throw metadataError;
        resetForm();
        fetchData();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "The event could not be saved. Please try again.");
      }
    };

    setConfirm({
      title: editingId ? "Save event changes?" : "Create this event?",
      message: editingId
        ? "Updated details and slot capacities will be visible to volunteers immediately."
        : "This event and its bookable time ranges will be published for volunteers.",
      action: () => {
        void action();
        setConfirm(null);
      },
    });
  }

  function removeEvent(id: number) {
    setConfirm({
      title: "Delete event?",
      message: "This cannot be undone. Events with bookings are protected and cannot be deleted.",
      action: () => {
        void (async () => {
          try {
            const { error: deleteError } = await deleteEvent(id);
            if (deleteError) throw deleteError;
            fetchData();
          } catch {
            setNotice("This event cannot be deleted because volunteers have bookings. Use Cancel event instead.");
          }
          setConfirm(null);
        })();
      },
    });
  }

  async function confirmCancellation() {
    if (!eventToCancel) return;
    const { error: cancelError } = await cancelEvent(eventToCancel.id, cancellationMessage.trim());
    if (cancelError) {
      setEventToCancel(null);
      setNotice(cancelError.message || "The event could not be cancelled. Please try again.");
      return;
    }
    setEventToCancel(null);
    setCancellationMessage("");
    fetchData();
  }

  return <>
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>{showCancelled ? "Cancelled events" : showPast ? "Past events" : "Upcoming and current events"}</h2>
          <p className={styles.cardHint}>{showCancelled ? "Cancelled events are retained for your records" : showPast ? "Previously published events, newest first" : "Events that have not ended yet"}</p>
        </div>
        <div className={styles.eventFilters}>
          <div className={styles.filterGroup} role="tablist" aria-label="Event date filter">
            <button type="button" role="tab" aria-selected={!showPast && !showCancelled} className={`${styles.filterButton} ${!showPast && !showCancelled ? styles.filterButtonActive : ""}`} onClick={() => { setShowPast(false); setShowCancelled(false); }}>Upcoming & current ({upcomingEvents.length})</button>
            <button type="button" role="tab" aria-selected={showPast} className={`${styles.filterButton} ${showPast ? styles.filterButtonActive : ""}`} onClick={() => { setShowPast(true); setShowCancelled(false); }}>Past events ({pastEvents.length})</button>
            <button type="button" role="tab" aria-selected={showCancelled} className={`${styles.filterButton} ${showCancelled ? styles.filterButtonActive : ""}`} onClick={() => { setShowPast(false); setShowCancelled(true); }}>Cancelled events ({cancelledEvents.length})</button>
          </div>
          <button type="button" className={styles.primaryButton} onClick={openCreate}><Icon name="plus" size={15} /> New event</button>
        </div>
      </div>
      {isLoading ? <div className={styles.empty}>Loading events...</div> : <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>{["Event", "Category", "Date", "Location", "Bookable ranges", "Total capacity", "Status", "Actions"].map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>
            {displayedEvents.map((item) => {
              const slots = slotsForEvent(item.id);
              const isCancelled = item.status === "Cancelled";
              const isPast = hasEventFinished(item, slots);
              const statusLabel = isCancelled ? "Cancelled" : isPast ? "Completed" : "Scheduled";
              return <tr key={item.id}>
                <td>{item.title}</td>
                <td><span className={styles.status}>{item.category ?? "Other"}</span></td>
                <td>{item.date}{item.date === today && !isPast && <span className={`${styles.status} ${styles.statusPresent}`} style={{ marginLeft: 7 }}>Today</span>}</td>
                <td>{item.location}{item.location_url && <><br /><a className={styles.mapLink} href={item.location_url} target="_blank" rel="noreferrer">View map</a></>}</td>
                <td>{slots.length > 0 ? slots.map(formatSlot).join(", ") : <span className={styles.helperWarning}>Legacy schedule: {item.time_slots}</span>}</td>
                <td>{slots.length > 0 ? slots.reduce((total, slot) => total + slot.capacity, 0) : item.total_slots}</td>
                <td><span className={`${styles.status} ${isCancelled ? styles.statusCancelled : statusLabel === "Completed" ? styles.statusCompleted : styles.statusConfirmed}`}>{statusLabel}</span></td>
                <td><div className={styles.tableActions}>
                  {!isCancelled && !isPast && <button type="button" className={styles.secondaryButton} onClick={() => openEdit(item)}><Icon name="edit" size={14} /> Edit</button>}
                  {!isCancelled && !isPast && <button type="button" className={styles.secondaryButton} onClick={() => setQrEvent(item)}>Attendance QR</button>}
                  {!isCancelled && !isPast && <button type="button" className={styles.dangerButton} onClick={() => { setEventToCancel(item); setCancellationMessage(""); }}>Cancel event</button>}
                  <button type="button" className={styles.dangerButton} onClick={() => removeEvent(item.id)} aria-label={`Delete ${item.title}`}><Icon name="trash" size={14} /></button>
                </div></td>
              </tr>;
            })}
            {displayedEvents.length === 0 && <tr><td colSpan={8}><div className={styles.empty}>{showCancelled ? "No cancelled events yet." : showPast ? "No past events yet." : "No upcoming events."}</div></td></tr>}
          </tbody>
        </table>
      </div>}
    </section>

    {drawerOpen && <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) resetForm(); }}>
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="event-form-title">
        <div className={styles.drawerHeader}>
          <div><h2 id="event-form-title" className={styles.cardTitle}>{editingId ? "Edit event" : "Create event"}</h2><p className={styles.cardHint}>{editingId ? "Update event details and slot capacities." : "Start with a programme template or create a custom event."}</p></div>
          <button type="button" className={styles.closeButton} onClick={resetForm} aria-label="Close"><Icon name="close" size={17} /></button>
        </div>
        {error && <div className={styles.error} role="alert">{error}</div>}
        <form onSubmit={submit} className={styles.formGrid}>
          {!editingId && <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.fieldLabel} htmlFor="event-template">Event template</label>
            <select className={styles.select} id="event-template" value={templateId} onChange={(event) => applyTemplate(event.target.value)}><option value="custom">Custom event</option>{EVENT_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</select>
            <p className={styles.helper}>The selected template sets the event category for reporting.</p>
          </div>}
          <div className={styles.field}><label className={styles.fieldLabel} htmlFor="event-date">Date</label><input className={styles.input} id="event-date" required type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} /></div>
          <div className={`${styles.field} ${styles.fieldFull}`}><label className={styles.fieldLabel} htmlFor="event-title">Title</label><input className={styles.input} id="event-title" required value={title} onChange={(event) => setTitle(event.target.value)} /></div>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.fieldLabel} htmlFor="event-description">Volunteer description <span className={styles.optionalLabel}>(optional)</span></label>
            <textarea className={styles.textarea} id="event-description" maxLength={700} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain what volunteers will do at this event." />
            <p className={styles.helper}>This is shown to volunteers before they book.</p>
          </div>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.fieldLabel} htmlFor="event-location">Location</label>
            {!locationIsLocked && <div className={styles.locationSearch}>
              <input className={styles.input} value={locationSearchQuery} onChange={(event) => setLocationSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchLocations(); } }} placeholder="Search an address or place in South Africa" aria-label="Search for an event location" />
              <button type="button" className={styles.secondaryButton} onClick={() => void searchLocations()} disabled={isSearchingLocations}>{isSearchingLocations ? "Searching…" : "Search address"}</button>
            </div>}
            {!locationIsLocked && <p className={styles.helper}>Choose a result to fill the address and Google Maps link automatically. Search data © OpenStreetMap contributors.</p>}
            {!locationIsLocked && locationSearchError && <p className={styles.locationSearchError} role="status">{locationSearchError}</p>}
            {!locationIsLocked && locationResults.length > 0 && <div className={styles.locationResults} role="listbox" aria-label="Location search results">{locationResults.map((result) => <button type="button" className={styles.locationResult} role="option" key={result.mapUrl} onClick={() => chooseLocation(result)}>{result.label}</button>)}</div>}
            <input className={styles.input} id="event-location" list={locationIsLocked ? undefined : "location-presets"} required disabled={locationIsLocked} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Choose a suggested location or type a new one" />
            <datalist id="location-presets">{LOCATION_PRESETS.map((preset) => <option key={preset} value={preset} />)}</datalist>
            {locationIsLocked && <p className={`${styles.helper} ${styles.lockedHelper}`}><Icon name="lock" size={13} /><span><strong>Location locked for this programme.</strong><br />{selectedTemplate?.locationDetail}</span></p>}
          </div>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.fieldLabel} htmlFor="event-location-url">Map link <span className={styles.optionalLabel}>(optional)</span></label>
            <input className={styles.input} id="event-location-url" type="url" disabled={locationIsLocked} value={locationUrl} onChange={(event) => setLocationUrl(event.target.value)} placeholder="https://maps.google.com/..." />
            {locationIsLocked ? <p className={`${styles.helper} ${styles.lockedHelper}`}><Icon name="lock" size={13} /> This programme uses its saved map location.</p> : <p className={styles.helper}>Paste a Google Maps or other public map link. Volunteers can open it from the event details.</p>}
          </div>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <span className={styles.fieldLabel}>Time ranges and capacity</span>
            <div className={styles.rangeBuilder}>
              <div className={styles.field}><label className={styles.cardHint} htmlFor="range-start">Start</label><select className={styles.select} id="range-start" value={start} onChange={(event) => setStart(event.target.value)}>{TIME_OPTIONS.map((time) => <option key={`start-${time}`}>{time}</option>)}</select></div>
              <div className={styles.field}><label className={styles.cardHint} htmlFor="range-end">End</label><select className={styles.select} id="range-end" value={end} onChange={(event) => setEnd(event.target.value)}>{TIME_OPTIONS.map((time) => <option key={`end-${time}`}>{time}</option>)}</select></div>
              <div className={styles.field}><label className={styles.cardHint} htmlFor="range-capacity">Capacity</label><input className={styles.input} id="range-capacity" type="number" min="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} /></div>
              <button type="button" className={styles.secondaryButton} onClick={addRange}><Icon name="plus" size={14} /> Add</button>
            </div>
            <div className={styles.rangeTags}>{ranges.map((range) => { const label = `${range.start_time}-${range.end_time} · ${range.capacity} spots`; return <span className={styles.rangeTag} key={label}>{label}<button type="button" className={styles.tagRemove} onClick={() => setRanges((current) => current.filter((item) => item !== range))} aria-label={`Remove ${label}`}>×</button></span>; })}</div>
            <p className={styles.helper}>Each range has its own capacity. Ranges cannot overlap.</p>
          </div>
          <div className={`${styles.field} ${styles.fieldFull}`}><div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={resetForm}>Cancel</button><button type="submit" className={styles.primaryButton}>{editingId ? "Save changes" : "Create event"}</button></div></div>
        </form>
      </aside>
    </div>}

    {confirm && <div className={styles.dialogBackdrop} role="presentation"><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title" className={styles.dialogTitle}>{confirm.title}</h2><p className={styles.dialogText}>{confirm.message}</p><div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={() => setConfirm(null)}>Back</button><button type="button" className={styles.primaryButton} onClick={confirm.action}>Confirm</button></div></section></div>}
    {eventToCancel && <div className={styles.dialogBackdrop} role="presentation"><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="cancel-event-title"><h2 id="cancel-event-title" className={styles.dialogTitle}>Cancel {eventToCancel.title}?</h2><p className={styles.dialogText}>This keeps existing bookings for your records, stops new bookings, and sends an in-app update to each booked volunteer.</p><label className={styles.fieldLabel} htmlFor="cancellation-message" style={{ display: "block", marginTop: 18 }}>Message for volunteers (optional)</label><textarea id="cancellation-message" className={styles.textarea} maxLength={500} value={cancellationMessage} onChange={(event) => setCancellationMessage(event.target.value)} placeholder="For example: This event has been postponed because of weather." /><div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={() => setEventToCancel(null)}>Back</button><button type="button" className={styles.dangerButton} onClick={() => void confirmCancellation()}>Cancel event</button></div></section></div>}
    {qrEvent && <AttendanceQrDialog event={qrEvent} checkpoints={attendanceCheckpoints} onClose={() => setQrEvent(null)} />}
    {notice && <div className={styles.dialogBackdrop} role="presentation"><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="notice-title"><h2 id="notice-title" className={styles.dialogTitle}>Event update</h2><p className={styles.dialogText}>{notice}</p><div className={styles.formActions}><button type="button" className={styles.primaryButton} onClick={() => setNotice(null)}>Got it</button></div></section></div>}
  </>;
}
