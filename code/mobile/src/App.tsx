import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Camera, ShieldCheck, Settings } from 'lucide-react';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-10">
          <h1 className="text-xl font-bold text-blue-900">VeriPass</h1>
          <ShieldCheck className="text-blue-600" />
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/settings" element={<SettingsView />} />
          </Routes>
        </main>

        {/* Bottom Navigation */}
        <nav className="bg-white border-t flex justify-around py-3 sticky bottom-0">
          <a href="/" className="flex flex-col items-center text-blue-600">
            <Camera size={24} />
            <span className="text-xs mt-1">Capture</span>
          </a>
          <a href="/settings" className="flex flex-col items-center text-gray-400">
            <Settings size={24} />
            <span className="text-xs mt-1">Réglages</span>
          </a>
        </nav>
      </div>
    </Router>
  );
}

function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8 text-center space-y-4">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
          <Camera size={40} className="text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Prêt pour la capture ?</h2>
        <p className="text-gray-500">
          Positionnez votre pièce d'identité dans le cadre qui apparaîtra à l'écran suivant.
        </p>
        <button className="w-full bg-blue-600 text-white font-semibold py-4 rounded-xl shadow-lg active:scale-95 transition-transform">
          Démarrer la vérification
        </button>
      </div>
    </div>
  );
}

function SettingsView() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Réglages</h2>
      <div className="bg-white rounded-xl border p-4">
        <p className="text-gray-500 italic">Options de configuration à venir...</p>
      </div>
    </div>
  );
}

export default App;
