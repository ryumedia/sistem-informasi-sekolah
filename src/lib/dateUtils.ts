// d:\Private\Ryumedia\sistem-informasi-sekolah\src\lib\dateUtils.ts
export const formatDate = (timestamp: any) => {
  if (!timestamp) return "";
  // Handle Firestore Timestamp or standard Date
  const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
  return date.toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' });
};
