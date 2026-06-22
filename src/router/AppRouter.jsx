import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from './routes.js';
import AppLayout from '../layouts/AppLayout.jsx';
import StartScreenPage from '../pages/StartScreenPage.jsx';
import MockLoginPage from '../pages/MockLoginPage.jsx';
import LoadingPage from '../pages/LoadingPage.jsx';
import MainMenuPage from '../pages/MainMenuPage.jsx';
import ProfilePage from '../pages/ProfilePage.jsx';
import RoomSelectPage from '../pages/RoomSelectPage.jsx';
import CreateRoomPage from '../pages/CreateRoomPage.jsx';
import JoinRoomPage from '../pages/JoinRoomPage.jsx';
import MatchmakingPage from '../pages/MatchmakingPage.jsx';
import MahjongGamePage from '../pages/MahjongGamePage.jsx';
import ResultPage from '../pages/ResultPage.jsx';
import ShopPage from '../pages/ShopPage.jsx';
import LeaderboardPage from '../pages/LeaderboardPage.jsx';

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path={ROUTES.start} element={<StartScreenPage />} />
        <Route path={ROUTES.login} element={<MockLoginPage />} />
        <Route path={ROUTES.loading} element={<LoadingPage />} />
        <Route path={ROUTES.mainMenu} element={<MainMenuPage />} />
        <Route path={ROUTES.profile} element={<ProfilePage />} />
        <Route path={ROUTES.shop} element={<ShopPage />} />
        <Route path={ROUTES.leaderboard} element={<LeaderboardPage />} />
        <Route path={ROUTES.rooms} element={<RoomSelectPage />} />
        <Route path={ROUTES.createRoom} element={<CreateRoomPage />} />
        <Route path={ROUTES.joinRoom} element={<JoinRoomPage />} />
        <Route path={ROUTES.matchmaking} element={<MatchmakingPage />} />
        <Route path={ROUTES.game} element={<MahjongGamePage />} />
        <Route path={ROUTES.gameFallback} element={<Navigate to={ROUTES.matchmaking} replace />} />
        <Route path={ROUTES.result} element={<ResultPage />} />
      </Route>
      <Route path="*" element={<Navigate to={ROUTES.start} replace />} />
    </Routes>
  );
}
