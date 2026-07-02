import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Trash2, Settings, CheckCircle, AlertCircle, Cpu } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNotifications } from '@/contexts/NotificationContext'
import { fetchModels, addModel, deleteModel } from '@/services/configApi'
import { Loading3D } from '@/components/Loading3D'
import type { PQModel } from '@/types/config'

export function SettingsPage() {
  const navigate = useNavigate()
  const { push } = useNotifications()

  const [models, setModels] = useState<PQModel[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const loadModels = () => {
    setLoading(true)
    fetchModels()
      .then((data) => {
        setModels(data)
      })
      .catch((err) => {
        push('error', 'Failed to load models', String(err))
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadModels()
  }, [])

  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return

    setAdding(true)
    try {
      const created = await addModel(name)
      setModels((prev) => [...prev, created])
      setNewName('')
      push('success', 'PQ model added', `"${name}" has been registered successfully.`)
    } catch (err) {
      push('error', 'Failed to add model', String(err))
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteModel = async (name: string) => {
    if (!window.confirm(`Are you sure you want to delete the PQ model "${name}" and its configuration?`)) {
      return
    }

    try {
      await deleteModel(name)
      setModels((prev) => prev.filter((m) => m.name !== name))
      push('info', 'PQ model removed', `"${name}" has been deleted.`)
    } catch (err) {
      push('error', 'Failed to remove model', String(err))
    }
  }

  if (loading) {
    return <Loading3D fullScreen message="Loading settings..." />
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs uppercase tracking-[0.28em] text-[#10375c]/55">Administration</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#10375c]">PQ Analyzer Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#10375c]/70">
          Create, edit, and configure custom PQ analyzer models. Standard models come pre-calibrated, while custom ones require mapping file headers to normalized telemetry names.
        </p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left card: Register model */}
        <Card className="border border-white/70 md:col-span-1 shadow-md bg-white/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Add PQ Model</CardTitle>
            <CardDescription>Register a new instrument name to start parsing custom exports.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddModel} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="model-name">Model / Vendor Name</Label>
                <Input
                  id="model-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Circutor MYeBOX"
                  required
                  disabled={adding}
                  className="bg-white/80 border-[#10375c]/15 text-[#10375c] focus-visible:ring-[#10375c]/30"
                />
              </div>
              <Button type="submit" disabled={adding} className="w-full bg-[#10375c] hover:bg-[#10375c]/90 text-white transition-colors cursor-pointer">
                {adding ? 'Adding...' : 'Register Model'}
                <Plus className="ml-2 size-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right card: Models list */}
        <Card className="border border-white/70 md:col-span-2 shadow-md bg-white/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Registered PQ Models</CardTitle>
            <CardDescription>Available analyzers and their configuration status.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[#10375c]/08 rounded-2xl border border-[#10375c]/10 bg-white/50 overflow-hidden shadow-sm">
              {models.map((m) => (
                <div key={m.name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-[#f4f6ff]/40 transition">
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 place-items-center rounded-xl bg-[#10375c]/08 text-[#10375c]">
                      <Cpu className="size-4.5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#10375c]">{m.name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {m.has_config ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle className="size-3" />
                            Configured
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <AlertCircle className="size-3" />
                            Not Mapped
                          </span>
                        )}
                        {m.is_builtin && (
                          <span className="inline-flex items-center text-[10px] uppercase font-bold tracking-wider text-[#10375c]/50 border border-[#10375c]/15 px-1.5 py-0.2 rounded">
                            Built-in
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/config/${encodeURIComponent(m.name)}`)}
                      className="text-xs h-8 border-[#10375c]/15 hover:bg-[#10375c]/08 hover:text-[#10375c] bg-white cursor-pointer"
                    >
                      <Settings className="mr-1.5 size-3.5" />
                      Configure
                    </Button>

                    {!m.is_builtin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteModel(m.name)}
                        className="text-xs h-8 text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                        title="Delete custom model"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
