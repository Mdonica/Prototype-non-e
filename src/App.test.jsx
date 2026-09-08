import { expect, test } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

test('renders the non-emergency queue dispatch header', () => {
  render(<App />);
  const heading = screen.getByText(/NON-EMERGENCY QUEUE/i);
  expect(heading).toBeDefined();
});

test('renders an on-deck person from the roster after logging in', () => {
  localStorage.removeItem('nonEmergencyQueue.myId');
  render(<App />);
  const select = screen.getByLabelText(/Your name/i);
  const option = select.querySelector('option[value]:not([value=""])');
  fireEvent.change(select, { target: { value: option.value } });
  fireEvent.click(screen.getByRole('button', { name: /Log In/i }));

  const onDeck = screen.getAllByText(/ON DECK/i);
  expect(onDeck.length).toBeGreaterThan(0);
});
