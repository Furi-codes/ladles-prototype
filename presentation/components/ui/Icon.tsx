"use client";

/** Named, tree-shaken Lucide icons keep existing call sites and a consistent stroke weight. */
import { LayoutDashboard, CalendarDays, UsersRound, Building2, Download, Settings2, Plus, Pencil, Trash2, LogOut, Menu, X, Activity, LockKeyhole, HeartHandshake, ArrowUpRight, Check, Mail, Phone, Clock3, MapPin, Search, SlidersHorizontal, type LucideIcon } from 'lucide-react';

const icons = { dashboard: LayoutDashboard, calendar: CalendarDays, users: UsersRound, building: Building2, download: Download, settings: Settings2, plus: Plus, edit: Pencil, trash: Trash2, logout: LogOut, menu: Menu, close: X, activity: Activity, lock: LockKeyhole, heart: HeartHandshake, arrow: ArrowUpRight, check: Check, mail: Mail, phone: Phone, clock: Clock3, location: MapPin, search: Search, filter: SlidersHorizontal } satisfies Record<string, LucideIcon>;

export default function Icon({ name, size = 18 }: { name: keyof typeof icons; size?: number }) {
  const Symbol = icons[name];
  return <Symbol size={size} strokeWidth={1.75} aria-hidden="true" />;
}
