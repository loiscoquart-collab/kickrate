export const leagueFlags = {
  'Premier League': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Ligue 1': '🇫🇷',
  'Bundesliga': '🇩🇪',
  'Primera Division': '🇪🇸',
  'Serie A': '🇮🇹',
  'UEFA Champions League': '🇪🇺',
  'Europa League': '🇪🇺',
  'NBA': '🇺🇸',
  'Formula 1': '🌍',
  'ATP Tour': '🌍',
  'WTA Tour': '🌍'
}

export const getFlag = (leagueName) => {
  if (!leagueName) return '🏆'
  for (const [key, flag] of Object.entries(leagueFlags)) {
    if (leagueName.includes(key)) return flag
  }
  return '🏆'
}