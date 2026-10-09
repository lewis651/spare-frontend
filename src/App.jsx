import './App.css'

function App() {
  const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
  const storefrontUrl = apiBase
    ? `/axlerate.html?apiBase=${encodeURIComponent(apiBase)}`
    : '/axlerate.html'

  return (
    <main className="storefront">
      <iframe
        className="storefront__frame"
        src={storefrontUrl}
        title="Axlerate car parts store"
      />
    </main>
  )
}

export default App
