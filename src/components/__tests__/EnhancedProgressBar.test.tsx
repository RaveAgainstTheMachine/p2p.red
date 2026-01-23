import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { EnhancedProgressBar } from '../EnhancedProgressBar';

const baseProgress = {
  bytesTransferred: 0,
  totalBytes: 1024,
  percentage: 0,
  speed: 0,
  timeRemaining: 0
};

describe('EnhancedProgressBar', () => {
  it('renders label and byte counts', () => {
    render(
      <EnhancedProgressBar
        progress={baseProgress}
        label="Receiving file"
      />
    );

    expect(screen.getByText('Receiving file')).toBeInTheDocument();
    expect(screen.getByText('0 B / 1.0 KB')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('toggles speed units', async () => {
    const user = userEvent.setup();
    render(
      <EnhancedProgressBar
        progress={{
          ...baseProgress,
          speed: 1_500_000,
          percentage: 50,
          bytesTransferred: 512,
          totalBytes: 1024
        }}
        label="Transferring file"
      />
    );

    const toggle = screen.getByRole('button', { name: 'Toggle speed units' });
    expect(toggle).toHaveTextContent('Mb/s');
    await user.click(toggle);
    expect(toggle).toHaveTextContent('MB/s');
  });
});
