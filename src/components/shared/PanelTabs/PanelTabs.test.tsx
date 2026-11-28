import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PanelTabs } from './PanelTabs';

const items = [
  { key: 'a', label: 'A' },
  { key: 'b', label: 'B', alert: true },
  { key: 'c', label: 'C', outage: true },
] as const;

const Tabs = ({ onChange }: { onChange?: (k: string) => void }) => {
  const [current, setCurrent] = useState<'a' | 'b' | 'c'>('a');
  return (
    <PanelTabs
      items={[...items]}
      current={current}
      onChange={(k) => {
        setCurrent(k);
        onChange?.(k);
      }}
      label="表示"
      className="extra"
    />
  );
};

describe('PanelTabs', () => {
  it('選択中のタブだけ aria-selected とフォーカス対象になる', () => {
    render(<Tabs />);
    const tabs = screen.getAllByRole('tab');
    expect(screen.getByRole('tablist', { name: '表示' })).toHaveClass('extra');
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
  });

  it('outage のタブには障害の印を出す', () => {
    render(<Tabs />);
    expect(screen.getAllByTitle('サービスで障害が発生中')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'C⚠' })).toContainElement(
      screen.getByTitle('サービスで障害が発生中'),
    );
  });

  it('alert のタブには要確認の点を出す', () => {
    render(<Tabs />);
    expect(screen.getAllByTitle('要確認')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'B' })).toContainElement(
      screen.getByTitle('要確認'),
    );
  });

  it('クリックで切り替える', () => {
    const onChange = vi.fn();
    render(<Tabs onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /^C/ }));
    expect(onChange).toHaveBeenCalledWith('c');
    expect(screen.getByRole('tab', { name: /^C/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('左右キーで隣のタブに移り、端では反対側に回る', () => {
    const onChange = vi.fn();
    render(<Tabs onChange={onChange} />);
    const tab = (n: string) =>
      screen.getByRole('tab', { name: new RegExp(`^${n}`) });

    fireEvent.keyDown(tab('A'), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('c');
    expect(tab('C')).toHaveFocus();

    fireEvent.keyDown(tab('C'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('a');
    expect(tab('A')).toHaveFocus();

    fireEvent.keyDown(tab('A'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('b');
  });

  it('左右以外のキーは無視する', () => {
    const onChange = vi.fn();
    render(<Tabs onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'A' }), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('移動先の要素が見つからなくても切り替えだけはする', () => {
    const onChange = vi.fn();
    render(
      <PanelTabs
        items={[{ key: 'x', label: 'X' }]}
        current="x"
        onChange={onChange}
        label="l"
      />,
    );
    const tab = screen.getByRole('tab');
    vi.spyOn(document, 'getElementById').mockReturnValue(null);
    fireEvent.keyDown(tab, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('x');
  });
});
