import { ROUTES } from '../router/routes.js';


export const mockRoomTiers = [
  { tierId: 'sakura_garden_3p', name: 'Sakura Garden', entryFee: { amount: 100 }, maxPlayers: 3, status: 'Available' },
  { tierId: 'moonlit_parlor_3p', name: 'Moonlit Parlor', entryFee: { amount: 500 }, maxPlayers: 3, status: 'Available' },
  { tierId: 'lucky_bamboo_3p', name: 'Lucky Bamboo', entryFee: { amount: 1000 }, maxPlayers: 3, status: 'Available' },
  { tierId: 'dragon_pavilion_3p', name: 'Dragon Pavilion', entryFee: { amount: 5000 }, maxPlayers: 3, status: 'Available' },
];

export const mockFeaturedRooms = [
  {
    id: 'sakura_garden',
    title: 'SAKURA GARDEN',
    name: 'Sakura Garden',
    level: 'Beginner',
    bg: 'room-card-green.png',
    character: 'panda.png',
    players: '4,326',
    fee: '500',
    prize: '2,000',
    button: 'button-green.png',
    route: ROUTES.matchmaking,
    status: 'Available',
  },
  {
    id: 'blossom_table',
    title: 'BLOSSOM TABLE',
    name: 'Blossom Table',
    level: 'Intermediate',
    bg: 'room-card-blue.png',
    character: 'fox.png',
    players: '1,842',
    fee: '1,000',
    prize: '5,000',
    button: 'button-blue.png',
    route: ROUTES.matchmaking,
    status: 'Available',
  },
  {
    id: 'lucky_bamboo',
    title: 'LUCKY BAMBOO',
    name: 'Lucky Bamboo',
    level: 'Advanced',
    bg: 'room-card-purple.png',
    character: 'bunny.png',
    players: '812',
    fee: '5,000',
    prize: '20,000',
    button: 'button-violet.png',
    route: ROUTES.matchmaking,
    status: 'Available',
  },
  {
    id: 'dragon_pavilion',
    title: 'DRAGON PAVILION',
    name: 'Dragon Pavilion',
    level: 'Master',
    bg: 'room-card-gold.png',
    character: 'bird.png',
    players: '320',
    fee: '50,000',
    prize: '200,000',
    button: 'button-gold.png',
    route: ROUTES.matchmaking,
    status: 'Available',
  },
];

export const mockRoomList = [
  { id: 'beginner_room', name: 'Beginner Room', bet: '100 coins', status: 'Available', maxPlayers: 3 },
  { id: 'classic_room', name: 'Classic Room', bet: '500 coins', status: 'Available', maxPlayers: 3 },
  { id: 'expert_room', name: 'Expert Room', bet: '1,000 coins', status: 'Locked placeholder', maxPlayers: 3 },
];
