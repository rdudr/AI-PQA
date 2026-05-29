import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from '@/auth/AuthContext'
import { RequireAuth } from '@/auth/RequireAuth'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { MainLayout } from '@/layouts/MainLayout'
import { CompliancePage } from '@/pages/CompliancePage'
import { ConfigPage } from '@/pages/ConfigPage'
import { CostPage } from '@/pages/CostPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { EnergyPage } from '@/pages/EnergyPage'
import { EquipmentHealthPage } from '@/pages/EquipmentHealthPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { UploadPage } from '@/pages/UploadPage'

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            {/* Public — login screen */}
            <Route path="/login" element={<LoginPage />} />

            {/* All other routes require authentication */}
            <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
              {/* Available to every signed-in user */}
              <Route index element={<HomePage />} />
              <Route path="dashboard"          element={<DashboardPage />} />
              <Route path="history"            element={<HistoryPage />} />
              <Route path="compliance"         element={<CompliancePage />} />
              <Route path="cost"               element={<CostPage />} />
              <Route path="energy"             element={<EnergyPage />} />
              <Route path="health"             element={<EquipmentHealthPage />} />

              {/* Admin-only: upload + configure are gated. RequireAuth role="admin"
                  silently redirects non-admins to "/" if they type the URL. */}
              <Route
                path="upload"
                element={<RequireAuth role="admin"><UploadPage /></RequireAuth>}
              />
              <Route
                path="config/:modelName"
                element={<RequireAuth role="admin"><ConfigPage /></RequireAuth>}
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  )
}
