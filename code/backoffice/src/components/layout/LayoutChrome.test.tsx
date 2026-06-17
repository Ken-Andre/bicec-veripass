import '@testing-library/jest-dom/vitest'

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import Header from './Header'
import Sidebar from './Sidebar'

const authMock = vi.hoisted(() => ({
  state: {
    user: { id: 'agent-1', email: 'agent@example.test', name: 'Thomas', role: 'THOMAS' },
    logout: vi.fn(),
  },
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authMock.state,
}))

function renderWithRouter(ui: React.ReactElement, initialPath = '/') {
  return render(<MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>)
}

describe('layout chrome', () => {
  afterEach(() => {
    vi.clearAllMocks()
    authMock.state.user = { id: 'agent-1', email: 'agent@example.test', name: 'Thomas', role: 'THOMAS' }
  })

  it('shows only navigation entries allowed for the current role', () => {
    renderWithRouter(<Sidebar />, '/analytics')

    expect(screen.getByRole('link', { name: /Conformité AML/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Listes AML/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Tableaux de bord/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Validation KYC/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Administration/i })).not.toBeInTheDocument()
  })

  it('wires the sidebar user block and logout action', () => {
    renderWithRouter(<Sidebar />)

    expect(screen.getByText('Thomas')).toBeInTheDocument()
    expect(screen.getByText('THOMAS')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Déconnexion/i }))

    expect(authMock.state.logout).toHaveBeenCalledTimes(1)
  })

  it('closes the mobile drawer after choosing a link', () => {
    authMock.state.user = { id: 'agent-2', email: 'jean@example.test', name: 'Jean', role: 'JEAN' }
    renderWithRouter(<Sidebar />)

    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le menu/i }))
    expect(screen.getByRole('button', { name: /Fermer le menu/i })).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('link', { name: /Validation KYC/i })[0])

    expect(screen.queryByRole('button', { name: /Fermer le menu/i })).not.toBeInTheDocument()
  })

  it('closes the mobile drawer from the labelled close button', () => {
    renderWithRouter(<Sidebar />)

    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le menu/i }))
    fireEvent.click(screen.getByRole('button', { name: /Fermer le menu/i }))

    expect(screen.queryByRole('button', { name: /Fermer le menu/i })).not.toBeInTheDocument()
  })

  it('renders disabled notifications and links the user profile', () => {
    authMock.state.user = { id: 'agent-3', email: 'sylvie@example.test', name: 'Sylvie', role: 'SYLVIE' }
    renderWithRouter(<Header />)

    expect(screen.getByRole('button', { name: /Notifications/i })).toBeDisabled()
    expect(screen.getByRole('link', { name: /Profil/i })).toHaveAttribute('href', '/profile')
    expect(screen.getByText('Sylvie')).toBeInTheDocument()
  })
})
