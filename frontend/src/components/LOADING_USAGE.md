# 3D Loading Component Usage Guide

## Overview
The `Loading3D` component provides a beautiful 3D rotating cube loader that indicates backend processing to users.

## Component Location
`src/components/Loading3D.tsx`

## Basic Usage

### Full Screen Loading (Overlay)
```tsx
import { Loading3D } from '@/components/Loading3D'

export function MyPage() {
  const [loading, setLoading] = useState(false)

  if (loading) {
    return <Loading3D 
      fullScreen 
      message="Analyzing file structure..." 
    />
  }

  return <div>Your content here</div>
}
```

### Inline Loading (Within Content)
```tsx
import { Loading3D } from '@/components/Loading3D'

export function MyComponent() {
  const [loading, setLoading] = useState(false)

  if (loading) {
    return <Loading3D message="Processing data..." />
  }

  return <div>Your content here</div>
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | string | "Processing..." | Loading message displayed below the 3D cube |
| `fullScreen` | boolean | false | If true, displays as full-screen overlay with backdrop |

## Examples

### File Upload Processing
```tsx
const [inspecting, setInspecting] = useState(false)

const handleFile = async (file: File) => {
  setInspecting(true)
  try {
    const data = await inspectFile(file)
    // process data
  } finally {
    setInspecting(false)
  }
}

if (inspecting) {
  return <Loading3D fullScreen message="Analyzing file structure..." />
}
```

### API Data Fetching
```tsx
const [loadingModels, setLoadingModels] = useState(false)

useEffect(() => {
  setLoadingModels(true)
  fetchModels()
    .then(m => setModels(m))
    .finally(() => setLoadingModels(false))
}, [])

if (loadingModels) {
  return <Loading3D fullScreen message="Loading PQ models..." />
}
```

### Configuration Saving
```tsx
const [saving, setSaving] = useState(false)

const handleSave = async () => {
  setSaving(true)
  try {
    await saveMappings(data)
  } finally {
    setSaving(false)
  }
}

if (saving) {
  return <Loading3D fullScreen message="Saving configuration..." />
}
```

## Where It's Currently Used

1. **ConfigPage** (`src/pages/ConfigPage.tsx`)
   - File inspection loading
   - Configuration save loading

2. **UploadPage** (`src/pages/UploadPage.tsx`)
   - Models fetching loading

3. **DashboardPage** - Has existing loading states for events/summaries

## Styling

The component uses:
- **Color Scheme**: Dark blue gradient (`#10375c` primary)
- **Size**: 80px for full screen, 64px for inline
- **Animation**: 3D rotation animation (3-second loop)
- **Backdrop**: Semi-transparent white overlay (full screen only)

## Customization Tips

To modify colors, update the gradient classes in `Loading3D.tsx`:
- Change `from-[#10375c]` and `to-[#1a5a94]` to your brand colors
- Adjust opacity values (0.6 - 0.8) for face visibility
- Modify animation duration in the `@keyframes spin3d` (currently 3s)

## Animation Details

- **Transform Style**: preserve-3d
- **Rotation**: All three axes (X, Y, Z) rotate 360°
- **Duration**: 3 seconds
- **Timing**: Linear (consistent speed)
- **Perspective**: 1000px for depth effect
