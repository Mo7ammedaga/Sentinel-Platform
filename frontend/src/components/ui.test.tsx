import { render, screen, fireEvent } from '@testing-library/react';
import { Badge, StatCard, Avatar, EmptyState, ErrorNote } from './ui';

describe('Badge', () => {
  it('renders the status text with underscores replaced by spaces', () => {
    render(<Badge status="false_positive" />);
    expect(screen.getByText('false positive')).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('renders as static (non-interactive) when no onClick is given', () => {
    render(<StatCard label="Normal" value={42} tone="normal" />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('becomes clickable and fires onClick when provided', () => {
    const onClick = jest.fn();
    render(<StatCard label="Critical" value={3} tone="critical" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Avatar', () => {
  it('shows the initials of a two-word name', () => {
    render(<Avatar name="Mohammed Alagha" />);
    expect(screen.getByText('MA')).toBeInTheDocument();
  });

  it('falls back to "?" for an empty name', () => {
    render(<Avatar name="" />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});

describe('EmptyState and ErrorNote', () => {
  it('render their message', () => {
    render(<EmptyState message="Nothing here yet." />);
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();

    render(<ErrorNote message="Something broke." />);
    expect(screen.getByText('Something broke.')).toBeInTheDocument();
  });
});
