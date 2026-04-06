export async function GET() {
  const today = new Date()
  const dateFrom = new Date(today)
  dateFrom.setDate(today.getDate() - 3)
  const dateTo = new Date(today)
  dateTo.setDate(today.getDate() + 1)

  const fmt = d => d.toISOString().slice(0, 10)
  const competitions = ['PL', 'FL1', 'BL1', 'PD', 'SA']
  const allMatches = []

  for (const comp of competitions) {
    try {
      const res = await fetch(
        `https://api.football-data.org/v4/competitions/${comp}/matches?dateFrom=${fmt(dateFrom)}&dateTo=${fmt(dateTo)}`,
        { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY } }
      )
      const data = await res.json()
      if (data.matches) {
        allMatches.push(...data.matches.map(m => ({
          id: String(m.id),
          teams: `${m.homeTeam.shortName} — ${m.awayTeam.shortName}`,
          score: m.score?.fullTime?.home !== null
            ? `${m.score.fullTime.home} - ${m.score.fullTime.away}`
            : 'À venir',
          league: data.competition?.name || comp,
          date: m.utcDate?.slice(0, 10) || ''
        })))
      }
    } catch (e) {}
  }

  allMatches.sort((a, b) => b.date.localeCompare(a.date))
  return Response.json(allMatches)
}