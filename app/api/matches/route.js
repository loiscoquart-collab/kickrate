export async function GET() {
  const today = new Date()
  const dateFrom = new Date(today)
  dateFrom.setDate(today.getDate() - 3)
  const dateTo = new Date(today)
  dateTo.setDate(today.getDate() + 1)

  const fmt = d => d.toISOString().slice(0, 10)
  const competitions = ['PL', 'FL1', 'BL1', 'PD', 'SA']
  const allMatches = []

  // Récupération des matchs de football
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

  // Récupération des matchs de basket NBA
  try {
    const basketRes = await fetch(
      `https://api.balldontlie.io/v1/games?start_date=${fmt(dateFrom)}&end_date=${fmt(dateTo)}`,
      { headers: { 'Authorization': process.env.BALLDONTLIE_API_KEY } }
    )
    const basketData = await basketRes.json()
    if (basketData.data) {
      allMatches.push(...basketData.data.slice(0,5).map(m => ({
        id: 'basket-' + m.id,
        teams: `${m.home_team.full_name} — ${m.visitor_team.full_name}`,
        score: `${m.home_team_score} - ${m.visitor_team_score}`,
        league: 'NBA',
        date: m.date?.slice(0,10),
        sport: 'Basket'
      })))
    }
  } catch (e) {}

  allMatches.sort((a, b) => b.date.localeCompare(a.date))
  return Response.json(allMatches)
}