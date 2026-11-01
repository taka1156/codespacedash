import { DashboardPage } from './pages/DashboardPage/DashboardPage';

// 認証は Cloudflare Access が前段で行うので、アプリ側にログイン画面はない
export default function App() {
  return <DashboardPage />;
}
