import type { Insets } from './types'

export type UIState = {
  panelWidth: number
  panelHeight: number
  insets: Insets
  pixelSnap: boolean
  showDebug: boolean
  tileCenter: boolean
}

const toNumber = (value: string): number => Number.parseInt(value, 10)

const bindRange = (
  input: HTMLInputElement,
  valueEl: HTMLElement,
  onChange: (value: number) => void
): void => {
  const update = () => {
    const value = toNumber(input.value)
    valueEl.textContent = `${value}px`
    onChange(value)
  }
  input.addEventListener('input', update)
  update()
}

const bindCheckbox = (
  input: HTMLInputElement,
  onChange: (value: boolean) => void
): void => {
  const update = () => onChange(input.checked)
  input.addEventListener('change', update)
  update()
}

export const createUI = (state: UIState, onChange: (state: UIState) => void): void => {

  const panelWidth = document.querySelector<HTMLInputElement>('#panelWidth')
  const panelHeight = document.querySelector<HTMLInputElement>('#panelHeight')
  const insetL = document.querySelector<HTMLInputElement>('#insetL')
  const insetR = document.querySelector<HTMLInputElement>('#insetR')
  const insetT = document.querySelector<HTMLInputElement>('#insetT')
  const insetB = document.querySelector<HTMLInputElement>('#insetB')
  const pixelSnap = document.querySelector<HTMLInputElement>('#pixelSnap')
  const showDebug = document.querySelector<HTMLInputElement>('#showDebug')
  const tileCenter = document.querySelector<HTMLInputElement>('#tileCenter')

  const panelWidthValue = document.querySelector<HTMLElement>('#panelWidthValue')
  const panelHeightValue = document.querySelector<HTMLElement>('#panelHeightValue')
  const insetLValue = document.querySelector<HTMLElement>('#insetLValue')
  const insetRValue = document.querySelector<HTMLElement>('#insetRValue')
  const insetTValue = document.querySelector<HTMLElement>('#insetTValue')
  const insetBValue = document.querySelector<HTMLElement>('#insetBValue')

  if (
    !panelWidth ||
    !panelHeight ||
    !insetL ||
    !insetR ||
    !insetT ||
    !insetB ||
    !pixelSnap ||
    !showDebug ||
    !tileCenter ||
    !panelWidthValue ||
    !panelHeightValue ||
    !insetLValue ||
    !insetRValue ||
    !insetTValue ||
    !insetBValue
  ) {
    throw new Error('UI elements missing')
  }

  panelWidth.value = `${state.panelWidth}`
  panelHeight.value = `${state.panelHeight}`
  insetL.value = `${state.insets.left}`
  insetR.value = `${state.insets.right}`
  insetT.value = `${state.insets.top}`
  insetB.value = `${state.insets.bottom}`
  pixelSnap.checked = state.pixelSnap
  showDebug.checked = state.showDebug
  tileCenter.checked = state.tileCenter

  bindRange(panelWidth, panelWidthValue, (value) => {
    state.panelWidth = value
    onChange(state)
  })

  bindRange(panelHeight, panelHeightValue, (value) => {
    state.panelHeight = value
    onChange(state)
  })

  bindRange(insetL, insetLValue, (value) => {
    state.insets.left = value
    onChange(state)
  })

  bindRange(insetR, insetRValue, (value) => {
    state.insets.right = value
    onChange(state)
  })

  bindRange(insetT, insetTValue, (value) => {
    state.insets.top = value
    onChange(state)
  })

  bindRange(insetB, insetBValue, (value) => {
    state.insets.bottom = value
    onChange(state)
  })

  bindCheckbox(pixelSnap, (value) => {
    state.pixelSnap = value
    onChange(state)
  })

  bindCheckbox(showDebug, (value) => {
    state.showDebug = value
    onChange(state)
  })

  bindCheckbox(tileCenter, (value) => {
    state.tileCenter = value
    onChange(state)
  })

  return
}
