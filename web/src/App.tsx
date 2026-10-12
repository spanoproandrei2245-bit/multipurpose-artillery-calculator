
import { Header } from './components/Header'

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="text-2xl font-bold">
          Dashboard
        </h2>

        <p className="mt-2 text-slate-400">
          Welcome to Multipurpose Artillery Calculator.
        </p>

        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-semibold">
            Game Models
          </h3>

          <p className="mt-2 text-sm text-slate-400">
            Your game model library will appear here.
          </p>
        </section>
      </main>
    </div>
  )
}

export default App
