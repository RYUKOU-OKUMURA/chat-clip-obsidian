import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatModeSelector from '../ChatModeSelector';
import { clampRecentCount, isValidRecentCount } from '../recentCount';

describe('ChatModeSelector', () => {
  test('labels single mode as latest message and syncs prop changes', async () => {
    const onModeChange = jest.fn();
    const { rerender } = render(
      <ChatModeSelector
        defaultMode="single"
        defaultCount={30}
        onModeChange={onModeChange}
      />
    );

    expect(screen.getByRole('radio', { name: /最新メッセージ/ })).toHaveAttribute('aria-checked', 'true');

    rerender(
      <ChatModeSelector
        defaultMode="recent"
        defaultCount={12}
        onModeChange={onModeChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /最新N件/ })).toHaveAttribute('aria-checked', 'true');
    });
    expect(screen.getByLabelText('保存するメッセージ数')).toHaveValue(12);
  });

  test('reports invalid recent counts without emitting a count change', async () => {
    const user = userEvent.setup();
    const onCountChange = jest.fn();
    const onCountValidityChange = jest.fn();

    render(
      <ChatModeSelector
        defaultMode="recent"
        defaultCount={5}
        onCountChange={onCountChange}
        onCountValidityChange={onCountValidityChange}
      />
    );

    const input = screen.getByLabelText('保存するメッセージ数');
    await user.clear(input);
    await user.type(input, '101');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('1から100の範囲');
    await waitFor(() => {
      expect(onCountValidityChange).toHaveBeenLastCalledWith(false);
    });
    expect(onCountChange).not.toHaveBeenLastCalledWith(101);
  });

  test('clamps and validates recent count boundaries', () => {
    expect(clampRecentCount(0)).toBe(1);
    expect(clampRecentCount(101)).toBe(100);
    expect(clampRecentCount('abc')).toBe(30);
    expect(isValidRecentCount(1)).toBe(true);
    expect(isValidRecentCount(100)).toBe(true);
    expect(isValidRecentCount(101)).toBe(false);
  });
});
