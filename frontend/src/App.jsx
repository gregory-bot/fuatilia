import { Route, Routes } from 'react-router-dom'
import Layout, { AppPage } from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Register from './pages/Register.jsx'
import PatientProfile from './pages/PatientProfile.jsx'
import Worklist from './pages/Worklist.jsx'
import UssdSimulator from './pages/UssdSimulator.jsx'
import Pathology from './pages/Pathology.jsx'
import Impact from './pages/Impact.jsx'
import Journey from './pages/Journey.jsx'

const app = (el) => <AppPage>{el}</AppPage>

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={app(<Dashboard />)} />
        <Route path="/register" element={app(<Register />)} />
        <Route path="/patients/:id" element={app(<PatientProfile />)} />
        <Route path="/chp" element={app(<Worklist />)} />
        <Route path="/ussd" element={app(<UssdSimulator />)} />
        <Route path="/pathology" element={app(<Pathology />)} />
        <Route path="/impact" element={app(<Impact />)} />
        <Route path="/journey" element={app(<Journey />)} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Layout>
  )
}
