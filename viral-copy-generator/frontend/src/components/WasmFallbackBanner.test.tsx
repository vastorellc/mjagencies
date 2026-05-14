import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import WasmFallbackBanner from './WasmFallbackBanner'

afterEach(cleanup)

describe('WasmFallbackBanner', () => {
  it('renders the locked banner text and enlarged textarea (rows=5)', () => {
    render(<WasmFallbackBanner reason="missing wasm" description="" onDescriptionChange={() => {}} onGenerateCopy={() => {}} />)
    expect(screen.getByText("This browser can't run video analysis. You can still write copy from a description below.")).toBeInTheDocument()
    const ta = screen.getByTestId('wasm-fallback-textarea') as HTMLTextAreaElement
    expect(Number(ta.rows)).toBe(5)
  })

  it('Generate copy button disabled when description empty, enabled otherwise', () => {
    const onGen = vi.fn()
    const { rerender } = render(<WasmFallbackBanner reason="x" description="" onDescriptionChange={() => {}} onGenerateCopy={onGen} />)
    expect((screen.getByText('Generate copy') as HTMLButtonElement).disabled).toBe(true)
    rerender(<WasmFallbackBanner reason="x" description="hello" onDescriptionChange={() => {}} onGenerateCopy={onGen} />)
    expect((screen.getByText('Generate copy') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByText('Generate copy'))
    expect(onGen).toHaveBeenCalledOnce()
  })

  it('emits onDescriptionChange', () => {
    const spy = vi.fn()
    render(<WasmFallbackBanner reason="x" description="" onDescriptionChange={spy} onGenerateCopy={() => {}} />)
    fireEvent.change(screen.getByTestId('wasm-fallback-textarea'), { target: { value: 'travel' } })
    expect(spy).toHaveBeenCalledWith('travel')
  })
})
