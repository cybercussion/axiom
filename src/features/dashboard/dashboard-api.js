export const fetchDashboardData = async () => {
  // Simulate network delay for realism
  await new Promise(resolve => setTimeout(resolve, 500));

  // Use standard fetch instead of experimental import assertions
  const response = await fetch(new URL('./data.json', import.meta.url));
  if (!response.ok) throw new Error(`Failed to load mock data: ${response.status}`);
  return await response.json();
};