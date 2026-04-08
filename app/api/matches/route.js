export async function GET() {
  const today = new Date()
  const dateFrom = new Date(today)
  dateFrom.setDate(today.getDate() - 3)
  const dateTo = new Date(today)
  dateTo.setDate(today.getDate() + 1)

  const fmt = d => d.toISOString().slice(0, 10)
  const competitions = ['PL', 'FL1', 'BL1', 'PD', 'SA']
  const allMatches = []

  // ==================== FOOTBALL ====================
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
          teams: `${m.homeTeam.shortName || m.homeTeam.name} — ${m.awayTeam.shortName || m.awayTeam.name}`,
          score: m.score?.fullTime?.home !== null && m.score?.fullTime?.home !== undefined
            ? `${m.score.fullTime.home} - ${m.score.fullTime.away}`
            : 'À venir',
          league: data.competition?.name || comp,
          date: m.utcDate?.slice(0, 10) || '',
          sport: 'Football'
        })))
      }
    } catch (e) {}
  }

  // ==================== BASKET (NBA) ====================
  try {
    const basketRes = await fetch(
      `https://api.balldontlie.io/v1/games?start_date=${fmt(dateFrom)}&end_date=${fmt(dateTo)}`,
      { headers: { 'Authorization': process.env.BALLDONTLIE_API_KEY } }
    )
    const basketData = await basketRes.json()
    
    if (basketData.data && basketData.data.length > 0) {
      allMatches.push(...basketData.data.map(m => {
        const isPlayed = m.status === 'Final' || (m.home_team_score !== null && m.home_team_score > 0 && m.visitor_team_score !== null)
        return {
          id: 'basket-' + m.id,
          teams: `${m.home_team.full_name} — ${m.visitor_team.full_name}`,
          score: isPlayed ? `${m.home_team_score} - ${m.visitor_team_score}` : 'À venir',
          league: 'NBA',
          date: m.date?.slice(0,10),
          sport: 'Basket'
        }
      }))
    }
  } catch (e) {}

  // ==================== F1 (Passées) ====================
  try {
    const f1Res = await fetch('https://api.jolpi.ca/ergast/f1/current/results.json?limit=50')
    const f1Data = await f1Res.json()
    const races = f1Data.MRData?.RaceTable?.Races || []
    const todayStr = fmt(new Date())
    
    const pastRaces = races.filter(r => r.date < todayStr).slice(-2)
    
    pastRaces.forEach(race => {
      const winner = race.Results?.[0]
      const winnerName = winner ? `${winner.Driver.givenName} ${winner.Driver.familyName}` : 'Terminé'
      
      allMatches.push({
        id: 'f1-past-' + race.round,
        teams: race.raceName,
        score: `🏆 ${winnerName}`,
        league: 'Formula 1',
        date: race.date,
        sport: 'F1'
      })
    })
  } catch (e) {}

  // ==================== F1 (Futures) ====================
  try {
    const f1FutureRes = await fetch(
      `https://api.balldontlie.io/f1/v1/events`,
      { headers: { 'Authorization': process.env.BALLDONTLIE_API_KEY } }
    )
    const f1FutureData = await f1FutureRes.json()
    const todayStr = fmt(new Date())
    
    if (f1FutureData.data && f1FutureData.data.length > 0) {
      const futureEvents = f1FutureData.data
        .filter(e => e.start_date?.slice(0,10) >= todayStr)
        .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
        .slice(0, 2)
      
      futureEvents.forEach(e => {
        allMatches.push({
          id: 'f1-future-' + e.id,
          teams: e.name || 'Grand Prix',
          score: 'À venir',
          league: 'Formula 1',
          date: e.start_date?.slice(0,10) || '',
          sport: 'F1'
        })
      })
    }
  } catch (e) {}


      // ==================== TENNIS (ATP via ESPN) ====================
  try {
    const tennisRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard')
    const tennisData = await tennisRes.json()
    
    if (tennisData.events && tennisData.events.length > 0) {
      tennisData.events.forEach(event => {
        const tournamentName = event.name || event.shortName || 'ATP Tour'
        
        if (event.groupings && event.groupings.length > 0) {
          event.groupings.forEach(grouping => {
            const competitions = grouping.competitions || []
            
            competitions.forEach(competition => {
              const competitors = competition.competitors || []
              if (competitors.length >= 2) {
                let player1 = null
                let player2 = null
                
                if (competitors[0]?.athlete?.displayName) {
                  player1 = competitors[0].athlete.displayName
                } else if (competitors[0]?.roster?.shortDisplayName) {
                  player1 = competitors[0].roster.shortDisplayName
                }
                
                if (competitors[1]?.athlete?.displayName) {
                  player2 = competitors[1].athlete.displayName
                } else if (competitors[1]?.roster?.shortDisplayName) {
                  player2 = competitors[1].roster.shortDisplayName
                }
                
                if (!player1 || !player2) return
                if (player1.includes('TBD') || player2.includes('TBD')) return
                
                // Score en sets
                let score = 'À venir'
                const status = competition.status?.type?.name
                const isFinished = status === 'STATUS_FINAL'
                const isLive = status === 'STATUS_IN_PROGRESS'
                
                if (isFinished || isLive) {
                  let setsWon1 = 0, setsWon2 = 0
                  const linescores1 = competitors[0]?.linescores || []
                  const linescores2 = competitors[1]?.linescores || []
                  
                  for (let i = 0; i < Math.max(linescores1.length, linescores2.length); i++) {
                    const setScore1 = linescores1[i]?.value || linescores1[i]
                    const setScore2 = linescores2[i]?.value || linescores2[i]
                    if (setScore1 !== undefined && setScore2 !== undefined) {
                      if (setScore1 > setScore2) setsWon1++
                      else if (setScore2 > setScore1) setsWon2++
                    }
                  }
                  
                  if (setsWon1 > 0 || setsWon2 > 0) {
                    score = isFinished ? `${setsWon1} - ${setsWon2}` : `${setsWon1} - ${setsWon2} (en cours)`
                  }
                }
                
                allMatches.push({
                  id: `tennis-${competition.id || Math.random()}`,
                  teams: `${player1} — ${player2}`,
                  score: score,
                  league: tournamentName,
                  date: competition.startDate?.slice(0,10) || event.date?.slice(0,10) || fmt(new Date()),
                  sport: 'Tennis'
                })
              }
            })
          })
        }
      })
      console.log(`Tennis: ${allMatches.filter(m => m.sport === 'Tennis').length} matchs ajoutés`)
    }
  } catch (e) {
    console.error('Erreur Tennis:', e)
  }


  allMatches.sort((a, b) => b.date.localeCompare(a.date))
  return Response.json(allMatches)
}