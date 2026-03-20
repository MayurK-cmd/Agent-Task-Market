import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WalletProvider } from './hooks/useWallet.jsx'
import Navbar       from './components/Navbar.jsx'
import Landing      from './pages/Landing.jsx'
import AppPage      from './pages/AppPage.jsx'
import AgentsPage   from './pages/AgentsPage.jsx'
import Docs         from './pages/Docs.jsx'
import ConnectPage  from './pages/ConnectPage.jsx'

export default function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/"        element={<Landing />}     />
          <Route path="/app"     element={<AppPage />}     />
          <Route path="/agents"  element={<AgentsPage />}  />
          <Route path="/docs"    element={<Docs />}        />
          <Route path="/connect" element={<ConnectPage />} />
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  )
}