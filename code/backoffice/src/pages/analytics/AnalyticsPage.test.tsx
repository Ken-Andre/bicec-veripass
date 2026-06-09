import '@testing-library/jest-dom/vitest'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AnalyticsPage, { baselinePayload, formFromBaseline } from './AnalyticsPage'

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiGetBlob: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}))

vi.mock('@/services/api-client', () => mocks)

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'agent-1', name: 'Sylvie', role: 'SYLVIE' },
  }),
}))

const businessCasePayload = {
  baseline_required: false,
  baseline: {
    id: 'baseline-1',
    period_start: '2026-06-01',
    period_end: '2026-06-30',
    monthly_kyc_volume: 100,
    current_incomplete_rate: 0.18,
    current_complement_rate: 0.14,
    current_abandonment_rate: 0.1,
    current_aml_sensitive_case_rate: 0.03,
  },
  network_quality: {
    first_time_right_rate: { display: '80.0%', raw: 0.8 },
    complement_request_rate: { display: '10.0%', raw: 0.1 },
    resubmission_rate: { display: '5.0%', raw: 0.05 },
    ocr_correction_rate: { display: '2.0%', raw: 0.02 },
    start_to_submit_delay: { display: '1.0h', raw: 3600 },
  },
  operations: {
    submit_to_decision_delay: { display: '20m', raw: 1200 },
    average_agent_review_duration: { display: '10m', raw: 600000 },
    sla_respected_rate: { display: '95.0%', raw: 0.95 },
  },
  finance: {
    current_cost_per_dossier: { display: '3 000 XAF', raw: 3000 },
    veripass_cost_per_dossier: { display: '1 500 XAF', raw: 1500 },
    roi_percent: { display: '74.0%', raw: 74 },
    compliance_gain_monthly: { display: '48 000 XAF', raw: 48000 },
  },
  direction: {
    pilot_abandonment_rate: { display: '5.0%', raw: 0.05 },
    start_to_approved_conversion_rate: { display: '70.0%', raw: 0.7 },
    estimated_commercial_value: { display: '100 000 XAF', raw: 100000 },
  },
  compliance: {
    aml_alert_rate: { display: '3.0%', raw: 0.03 },
    aml_alert_count: { display: '3', raw: 3 },
    risk_blocked_open_count: { display: '1', raw: 1 },
    audit_export_time_saved_hours: { display: '4.0h', raw: 4 },
  },
  roi_engine: {
    inputs: {
      monthly_kyc_volume: { display: '100', raw: 100 },
      current_minutes_per_file: { display: '30.0m', raw: 30 },
      target_minutes_per_file: { display: '10.0m', raw: 10 },
      hourly_rate: { display: '6 000 XAF', raw: 6000 },
    },
    outputs: {
      operational_gain_monthly: { display: '200 000 XAF', raw: 200000 },
      conversion_uplift_value: { display: '1 000 XAF', raw: 1000 },
      commercial_gain_monthly: { display: '100 000 XAF', raw: 100000 },
      compliance_audit_savings: { display: '48 000 XAF', raw: 48000 },
      total_monthly_gain: { display: '348 000 XAF', raw: 348000 },
    },
  },
  formulas: [],
}

describe('AnalyticsPage ROI helpers', () => {
  it('shows baseline rates as percentages and sends them as API ratios', () => {
    const form = formFromBaseline({
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      current_incomplete_rate: 0.18,
      current_complement_rate: 0.14,
      current_abandonment_rate: 0.1,
      current_aml_sensitive_case_rate: 0.03,
    })

    expect(form.current_incomplete_rate).toBe('18')
    expect(form.current_complement_rate).toBe('14')
    expect(form.current_abandonment_rate).toBe('10')
    expect(form.current_aml_sensitive_case_rate).toBe('3')

    const payload = baselinePayload({
      ...form,
      current_complement_rate: '14',
      monthly_kyc_volume: '100',
    })

    expect(payload.monthly_kyc_volume).toBe(100)
    expect(payload.current_incomplete_rate).toBeCloseTo(0.18)
    expect(payload.current_complement_rate).toBeCloseTo(0.14)
    expect(payload.current_abandonment_rate).toBeCloseTo(0.1)
    expect(payload.current_aml_sensitive_case_rate).toBeCloseTo(0.03)
  })
})

describe('AnalyticsPage ROI tab', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    mocks.apiGet.mockReset()
    mocks.apiGetBlob.mockReset()
    mocks.apiPost.mockReset()
    mocks.apiPut.mockReset()
    mocks.apiGet.mockImplementation((path: string) => {
      if (path.startsWith('/analytics/dashboard')) {
        return Promise.resolve({
          conversion_metrics: { conversion_rate: '70%', abandon_rate: '5%', total_onboardings: 100 },
          funnel: [],
          document_performance: {},
          fraud_gaps: {},
          compliance_kpis: {},
          marketing: { channels: [] },
          qa: {},
          sla: { avg_validation_time: '20m' },
        })
      }
      if (path.startsWith('/analytics/business-case')) return Promise.resolve(businessCasePayload)
      if (path.startsWith('/analytics/technical')) return Promise.resolve({ db: 'ok', redis: 'ok', qa: {} })
      return Promise.resolve({})
    })
    mocks.apiGetBlob.mockResolvedValue({
      blob: new Blob(['roi'], { type: 'application/json' }),
      filename: 'veripass-business-case.json',
      contentType: 'application/json',
    })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:roi'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  })

  it('renders ROI engine cards and exports JSON and HTML', async () => {
    render(<AnalyticsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Pilotage & ROI' }))

    expect(await screen.findByText('Operational Gain')).toBeInTheDocument()
    expect(screen.getByText('200 000 XAF')).toBeInTheDocument()
    expect(screen.getByText('Conversion Uplift / client')).toBeInTheDocument()
    expect(screen.getAllByText('100 000 XAF').length).toBeGreaterThan(0)
    expect(screen.getByText('Compliance/Audit Savings')).toBeInTheDocument()
    expect(screen.getAllByText('48 000 XAF').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /JSON/i }))
    await waitFor(() => expect(mocks.apiGetBlob).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: /HTML/i }))
    await waitFor(() => expect(mocks.apiGetBlob).toHaveBeenCalledTimes(2))
    expect(mocks.apiGetBlob).toHaveBeenNthCalledWith(1, '/analytics/business-case/export?format=json')
    expect(mocks.apiGetBlob).toHaveBeenNthCalledWith(2, '/analytics/business-case/export?format=html')
  })
})
