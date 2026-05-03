import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScreenLayoutV2 } from './ScreenLayoutV2';

describe('ScreenLayoutV2', () => {
  it('renders title in AppBar', () => {
    render(
      <MemoryRouter>
        <ScreenLayoutV2 title="Test Title">Content</ScreenLayoutV2>
      </MemoryRouter>
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders back button when showBack is true', () => {
    render(
      <MemoryRouter>
        <ScreenLayoutV2 title="Test" showBack>Content</ScreenLayoutV2>
      </MemoryRouter>
    );
    expect(screen.getByLabelText('Retour')).toBeInTheDocument();
  });

  it('does not render back button when showBack is false', () => {
    render(
      <MemoryRouter>
        <ScreenLayoutV2 title="Test">Content</ScreenLayoutV2>
      </MemoryRouter>
    );
    expect(screen.queryByLabelText('Retour')).not.toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <MemoryRouter>
        <ScreenLayoutV2>Child Content</ScreenLayoutV2>
      </MemoryRouter>
    );
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('renders footer when provided', () => {
    render(
      <MemoryRouter>
        <ScreenLayoutV2 footer={<button>Footer CTA</button>}>Content</ScreenLayoutV2>
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: 'Footer CTA' })).toBeInTheDocument();
  });
});
