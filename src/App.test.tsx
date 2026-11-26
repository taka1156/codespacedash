import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./pages/DashboardPage/DashboardPage', () => ({
  DashboardPage: () => <p>dashboard</p>,
}));

describe('App', () => {
  it('ダッシュボードを出す（ログイン画面はない）', () => {
    render(<App />);
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });
});
