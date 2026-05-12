import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ShareLink } from '../ShareLink';

describe('ShareLink', () => {
  it('copies the link to clipboard', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<ShareLink shareLink="https://p2p.red/#abc" />);

    const copyButtons = screen.getAllByRole('button', { name: /copy link/i });
    await user.click(copyButtons[0]);
    expect(writeText).toHaveBeenCalledWith('https://p2p.red/#abc');
  });

  it('shows native share button when available', () => {
    Object.defineProperty(navigator, 'share', {
      value: vi.fn(),
      configurable: true,
    });

    render(<ShareLink shareLink="https://p2p.red/#abc" />);

    expect(screen.getByTitle('Share via AirDrop, Nearby Share, etc.')).toBeInTheDocument();
  });
});
