export interface Event {
  id: number;
  title: string;
  date: string;
  location: string;
  time_slots: string;
  total_slots: number;
}

export interface Volunteer {
  id: string; 
  full_name: string;
  email: string;
  role: string; 
  is_present?: boolean; 
}

export interface Booking {
  id: number;
  volunteer_name: string;
  event_id: number;
  selected_slot: string;
  status: string; 
}