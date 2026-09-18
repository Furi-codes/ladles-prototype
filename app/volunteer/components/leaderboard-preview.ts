export type LeaderboardEntry = {
  id: string;
  name: string;
  total_hours: number;
  rank: number;
};

// Fictional, pre-ranked fixtures stand in for the future SQL window-function result.
// No production rank is calculated from a displayed row's array index.
const SAMPLE_VOLUNTEERS: LeaderboardEntry[] = [
  { id: "preview-1", name: "Lerato Mokoena", total_hours: 128.5, rank: 1 },
  { id: "preview-2", name: "James Williams", total_hours: 116, rank: 2 },
  { id: "preview-3", name: "Nomsa Dlamini", total_hours: 104.5, rank: 3 },
  { id: "preview-4", name: "Michael Adams", total_hours: 96, rank: 4 },
  { id: "preview-5", name: "Ayesha Khan", total_hours: 88, rank: 5 },
  { id: "preview-6", name: "Daniel Petersen", total_hours: 88, rank: 6 },
  { id: "preview-7", name: "Zanele Nkosi", total_hours: 79.5, rank: 7 },
  { id: "preview-8", name: "Grace Jacobs", total_hours: 72, rank: 8 },
  { id: "preview-9", name: "Thabo Molefe", total_hours: 64.5, rank: 9 },
  { id: "preview-10", name: "Sophie Brown", total_hours: 56, rank: 10 },
  { id: "preview-11", name: "Adam Smith", total_hours: 48, rank: 11 },
  { id: "preview-12", name: "Emily Naidoo", total_hours: 36, rank: 12 },
  { id: "preview-13", name: "Sam Daniels", total_hours: 30, rank: 13 },
];

export function getLeaderboardPreview(userId?: string, name?: string): LeaderboardEntry[] {
  return userId ? [...SAMPLE_VOLUNTEERS, {
    id: userId, name: name?.trim() || "You", total_hours: 24, rank: 14,
  }] : [...SAMPLE_VOLUNTEERS];
}
