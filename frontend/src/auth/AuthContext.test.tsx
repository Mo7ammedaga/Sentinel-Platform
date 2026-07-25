import { isSecurity, isWorkspace, isAdmin } from './AuthContext';

// These gate what a role can see (Security Dashboard vs Workspace vs Admin
// pages) -- getting one wrong would leak or hide a whole section of the app,
// so they're worth locking down as plain data-driven tests.
describe('role capability helpers', () => {
  it('isSecurity: only analyst and admin', () => {
    expect(isSecurity('analyst')).toBe(true);
    expect(isSecurity('admin')).toBe(true);
    expect(isSecurity('employee')).toBe(false);
    expect(isSecurity('manager')).toBe(false);
    expect(isSecurity(undefined)).toBe(false);
  });

  it('isWorkspace: employee, manager, and admin -- never analyst', () => {
    expect(isWorkspace('employee')).toBe(true);
    expect(isWorkspace('manager')).toBe(true);
    expect(isWorkspace('admin')).toBe(true);
    expect(isWorkspace('analyst')).toBe(false);
    expect(isWorkspace(undefined)).toBe(false);
  });

  it('isAdmin: only admin', () => {
    expect(isAdmin('admin')).toBe(true);
    expect(isAdmin('analyst')).toBe(false);
    expect(isAdmin('manager')).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});
