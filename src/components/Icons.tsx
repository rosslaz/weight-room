// Small stroke icons, drawn to match the marker-on-whiteboard look.
const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const IconBoard = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="13" rx="1.5" />
    <path d="M7 9h6M7 12.5h9M9 21l3-4 3 4" />
  </svg>
)

export const IconHistory = () => (
  <svg {...base}>
    <path d="M4 19V5M4 19h16" />
    <path d="M7.5 15l3.5-4 3 2.5 5-6" />
  </svg>
)

export const IconWrench = () => (
  <svg {...base}>
    <path d="M14.5 5.5a4 4 0 0 0-5.3 5.1L4 15.8 6.2 18l5.2-5.2a4 4 0 0 0 5.1-5.3l-2.3 2.3-2-.5-.5-2z" />
  </svg>
)

export const IconAccount = () => (
  <svg {...base}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" />
  </svg>
)

export const IconCheck = () => (
  <svg {...base} strokeWidth={2.6}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

export const IconChevronLeft = () => (
  <svg {...base}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)

export const IconChevronRight = () => (
  <svg {...base}>
    <path d="M9 5l7 7-7 7" />
  </svg>
)

export const IconX = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const IconUp = () => (
  <svg {...base}>
    <path d="M6 15l6-6 6 6" />
  </svg>
)

export const IconDown = () => (
  <svg {...base}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)
