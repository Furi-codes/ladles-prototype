import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://lkczfrnuksjxsimbcxkz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrY3pmcm51a3NqeHNpbWJjeGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODc2ODIsImV4cCI6MjA5NDE2MzY4Mn0.xN3DDINaA9nn0d4do4MrJ9XFlkNKBZuRPQBi3qIUU2w"; 

const supabase = createClient(supabaseUrl, supabaseKey);

// READ
export async function getEvents() {
  return await supabase.from("events").select("*").order("id", { ascending: false });
}

export async function getBookings() {
  return await supabase.from("bookings").select("*").order("id", { ascending: false });
}

// CREATE / UPDATE
export async function upsertEvent(data: any, id: number | null) {
  if (id) {
    return await supabase.from("events").update(data).eq("id", id);
  }
  return await supabase.from("events").insert([data]);
}

// DELETE
export async function deleteEvent(id: number) {
  return await supabase.from("events").delete().eq("id", id);
}

export async function deleteBooking(id: number) {
  return await supabase.from("bookings").delete().eq("id", id);
}

export async function getVolunteers() {
  return await supabase.from("profiles").select("*").order("full_name", { ascending: true });
}