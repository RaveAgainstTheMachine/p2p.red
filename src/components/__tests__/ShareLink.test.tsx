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

    render(<ShareLink shareLink="https://P2P File Share/#abc" />);

    const copyButtons = screen.getAllByRole('button', { name: /copy link/i });
    await user.click(copyButtons[0]);
    expect(writeText).toHaveBeenCalledWith('https://P2P File Share/#abc');
  });

  it('shows native share button when available', () => {
    Object.assign(navigator, { share: vi.fn() });

    render(<ShareLink shareLink="https://P2P File Share/#abc" />);

    expect(screen.getByTitle('Share via AirDrop, Nearby Share, etc.')).toBeInTheDocument();
  });
});
