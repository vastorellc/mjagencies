import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApiErrorDisplay from './ApiErrorDisplay'
import type { APIErrorPayload } from '../lib/errors'

describe('ApiErrorDisplay', () => {
  it('renders nothing when error is null', () => {
    const { container } = render(
      <ApiErrorDisplay error={null} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when error is empty string', () => {
    const { container } = render(
      <ApiErrorDisplay error="" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders string error message', () => {
    render(
      <ApiErrorDisplay error="Something went wrong" />
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('renders structured error message', () => {
    const payload: APIErrorPayload = {
      code: 'VALIDATION_ERROR',
      message: 'Username is required',
      retryable: false,
    }
    render(
      <ApiErrorDisplay error={payload} />
    )
    expect(screen.getByText('Username is required')).toBeInTheDocument()
  })

  it('displays field indicator for validation errors', () => {
    const payload: APIErrorPayload = {
      code: 'VALIDATION_ERROR',
      message: 'Invalid format',
      field: 'email',
      retryable: false,
    }
    render(
      <ApiErrorDisplay error={payload} />
    )
    expect(screen.getByText(/Field: email/)).toBeInTheDocument()
  })

  it('does not show retry button when not retryable', () => {
    const payload: APIErrorPayload = {
      code: 'VALIDATION_ERROR',
      message: 'Bad input',
      retryable: false,
    }
    const onRetry = vi.fn()
    render(
      <ApiErrorDisplay error={payload} onRetry={onRetry} />
    )
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument()
  })

  it('shows retry button when retryable and callback provided', () => {
    const payload: APIErrorPayload = {
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      retryable: true,
    }
    const onRetry = vi.fn()
    render(
      <ApiErrorDisplay error={payload} onRetry={onRetry} />
    )
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument()
  })

  it('hides retry button when retryable but no callback', () => {
    const payload: APIErrorPayload = {
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      retryable: true,
    }
    render(
      <ApiErrorDisplay error={payload} />
    )
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument()
  })

  it('calls onRetry when retry button clicked', async () => {
    const payload: APIErrorPayload = {
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      retryable: true,
    }
    const onRetry = vi.fn()
    render(
      <ApiErrorDisplay error={payload} onRetry={onRetry} />
    )

    await userEvent.click(screen.getByRole('button', { name: /Retry/ }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('shows dismiss button when callback provided', () => {
    const payload: APIErrorPayload = {
      code: 'VALIDATION_ERROR',
      message: 'Error',
      retryable: false,
    }
    const onDismiss = vi.fn()
    render(
      <ApiErrorDisplay error={payload} onDismiss={onDismiss} />
    )
    expect(screen.getByRole('button', { name: /Dismiss/ })).toBeInTheDocument()
  })

  it('calls onDismiss when dismiss button clicked', async () => {
    const onDismiss = vi.fn()
    render(
      <ApiErrorDisplay error="Error message" onDismiss={onDismiss} />
    )

    await userEvent.click(screen.getByRole('button', { name: /Dismiss/ }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('displays copyable request ID', () => {
    const payload: APIErrorPayload = {
      code: 'DATABASE_ERROR',
      message: 'Database failed',
      retryable: true,
      requestId: '12345678-abcd-1234-abcd-abcdefghijkl',
    }
    render(
      <ApiErrorDisplay error={payload} />
    )

    // Should show truncated ID
    expect(screen.getByText(/12345678…/)).toBeInTheDocument()
  })

  it('copies full request ID to clipboard', async () => {
    const payload: APIErrorPayload = {
      code: 'DATABASE_ERROR',
      message: 'Database failed',
      retryable: true,
      requestId: 'req_12345678-abcd-1234-abcd-abcdefghijkl',
    }

    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    }
    Object.assign(navigator, { clipboard: mockClipboard })

    render(
      <ApiErrorDisplay error={payload} />
    )

    await userEvent.click(screen.getByText(/req_1234…/))
    expect(mockClipboard.writeText).toHaveBeenCalledWith(payload.requestId)
  })

  it('does not show request ID when not present', () => {
    const payload: APIErrorPayload = {
      code: 'VALIDATION_ERROR',
      message: 'Error',
      retryable: false,
    }
    const { container } = render(
      <ApiErrorDisplay error={payload} />
    )

    // Should not have any button with request ID ellipsis
    expect(container.querySelector('[title*="request ID"]')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(
      <ApiErrorDisplay error="Error" className="custom-class" />
    )
    expect(screen.getByRole('alert')).toHaveClass('custom-class')
  })

  it('has aria-live polite for accessibility', () => {
    render(
      <ApiErrorDisplay error="Accessible error message" />
    )
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite')
  })

  it('shows all buttons together', async () => {
    const payload: APIErrorPayload = {
      code: 'RATE_LIMITED',
      message: 'Rate limited',
      retryable: true,
      requestId: 'req_test123',
    }
    const onRetry = vi.fn()
    const onDismiss = vi.fn()

    render(
      <ApiErrorDisplay error={payload} onRetry={onRetry} onDismiss={onDismiss} />
    )

    // Should have retry, dismiss, and request ID buttons
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dismiss/ })).toBeInTheDocument()
    expect(screen.getByText(/req_test…/)).toBeInTheDocument()
  })
})
