// lib/betPresets.js
// Preset FIFA bet question templates the admin can one-click add.
// Options have no fixed odds — parimutuel computes them live.

export const MATCH_PRESETS = [
  {
    key: 'match_result',
    text: 'Who wins the match?',
    minStake: 50,
    // {home}/{away} are replaced with the actual team names when added
    options: ['{home}', 'Draw', '{away}'],
  },
  {
    key: 'total_goals',
    text: 'Total goals in the match?',
    minStake: 30,
    options: ['0–1 goals', '2–3 goals', '4+ goals'],
  },
  {
    key: 'both_teams_score',
    text: 'Will both teams score?',
    minStake: 30,
    options: ['Yes', 'No'],
  },
  {
    key: 'first_half_lead',
    text: 'Who leads at half-time?',
    minStake: 30,
    options: ['{home}', 'Level', '{away}'],
  },
  {
    key: 'winning_margin',
    text: 'Winning margin?',
    minStake: 30,
    options: ['1 goal', '2 goals', '3+ goals', 'Draw'],
  },
  {
    key: 'first_goal_time',
    text: 'When is the first goal scored?',
    minStake: 20,
    options: ['Before 15 min', '15–30 min', '30–45 min', '2nd half', 'No goals'],
  },
  {
    key: 'red_card',
    text: 'Will there be a red card?',
    minStake: 20,
    options: ['Yes', 'No'],
  },
  {
    key: 'penalty_awarded',
    text: 'Will a penalty be awarded?',
    minStake: 20,
    options: ['Yes', 'No'],
  },
  {
    key: 'clean_sheet',
    text: 'Will any team keep a clean sheet?',
    minStake: 20,
    options: ['{home} clean sheet', '{away} clean sheet', 'Both teams score'],
  },
  {
    key: 'corners',
    text: 'Total corners in the match?',
    minStake: 20,
    options: ['Under 8', '8–11', '12+'],
  },
];

export const TOURNAMENT_PRESETS = [
  {
    key: 'tournament_winner',
    text: '🏆 Who will win the tournament?',
    minStake: 100,
    // admin fills in the team list
    options: [],
    needsTeams: true,
  },
  {
    key: 'top_scorer',
    text: '⚽ Golden Boot — who scores the most goals?',
    minStake: 100,
    options: [],
    needsPlayers: true,
  },
  {
    key: 'finalist_1',
    text: 'Which team reaches the final (Side A)?',
    minStake: 50,
    options: [],
    needsTeams: true,
  },
  {
    key: 'golden_glove',
    text: '🧤 Golden Glove — best goalkeeper?',
    minStake: 50,
    options: [],
    needsPlayers: true,
  },
  {
    key: 'best_player',
    text: '⭐ Player of the Tournament?',
    minStake: 50,
    options: [],
    needsPlayers: true,
  },
  {
    key: 'highest_scoring_team',
    text: 'Which team scores the most goals overall?',
    minStake: 50,
    options: [],
    needsTeams: true,
  },
];

export function applyTeamNames(preset, home, away) {
  return {
    ...preset,
    options: preset.options.map(o =>
      o.replace('{home}', home).replace('{away}', away)
    ),
  };
}
