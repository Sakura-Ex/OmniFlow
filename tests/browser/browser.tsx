import { createRoot } from 'react-dom/client'
import ValidationHarness from './ValidationHarness'
const root = createRoot(document.getElementById('root')!)
root.render(<ValidationHarness />)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
