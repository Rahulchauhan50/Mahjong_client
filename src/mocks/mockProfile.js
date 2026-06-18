export const mockPlayerProfile = {
  id: 'player_stevie',
  username: 'Stevie',
  name: 'Stevie',
  level: 1,
  trophies: 500,
  title: 'Master',
  avatar: 'ICO.png',
  rank: {
    title: 'Master',
    progressText: '18,450 / 23,400',
    currentXP: 18450,
    requiredXP: 23400,
    badge: 'PAD.png',
    xpBar: 'XP.png',
  },
  wallet: {
    coins: '125,600',
    gems: '2,450',
  },
  stats: [
    { label: 'Total Games', value: '1,245' },
    { label: 'Win Rate', value: '68.5%' },
    { label: 'MVP', value: '320' },
  ],
};

export const mockProfileStats = [
  { label: 'Total Games', value: '1,245' },
  { label: 'Win Rate', value: '68.5%' },
  { label: 'MVP', value: '320' },
];

export const mockAchievements = [
  {
    title: 'Winning Streak',
    description: 'Win 10 games in a row',
    progress: '6/10',
    currentXP: 6,
    requiredXP: 10,
    card: 'C1.png',
    complete: false,
  },
  {
    title: 'Dragon Hunter',
    description: 'Win with Dragon Pungs',
    progress: 'Completed',
    currentXP: 1,
    requiredXP: 1,
    card: 'C2.png',
    complete: true,
  },
  {
    title: 'All Pungs Master',
    description: 'Win with All Pungs',
    progress: 'Completed',
    currentXP: 1,
    requiredXP: 1,
    card: 'C3.png',
    complete: true,
  },
  {
    title: 'Self Draw Expert',
    description: 'win 50 games by Self Draw',
    progress: '32/50',
    currentXP: 32,
    requiredXP: 50,
    card: 'C4.png',
    complete: false,
  },
];
