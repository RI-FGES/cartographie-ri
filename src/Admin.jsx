import { useState } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import './Admin.css'

const EMPTY_UNI = {
  nom: '', pays: '', type: 'europe-erasmus', code: '',
  coords: '', langue: '', conditionlangue: '',
  siteWeb: '', statut: '', semestres: '', durees: '', parcours: [],
  typeaccord: '',
  budget: '', integration: '', cours: '', examens: '',
  logement: '', transport: '', tips: ''
}

function parseCoords(str) {
  if (!str) return { lat: null, lng: null }
  const cleaned = str.replace(/°/g, '').trim()
  const parts = cleaned.split(/[\s,;]+/).filter(Boolean)
  if (parts.length >= 2) {
    const lat = parseFloat(parts[0])
    const lng = parseFloat(parts[1])
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng }
  }
  return { lat: null, lng: null }
}

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [universites, setUniversites] = useState([])
  const [formations, setFormations] = useState([])
  const [typesAccord, setTypesAccord] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [editingUni, setEditingUni] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(EMPTY_UNI)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')
  const [showFormationsManager, setShowFormationsManager] = useState(false)
  const [newFormation, setNewFormation] = useState('')
  const [deleteFormationConfirm, setDeleteFormationConfirm] = useState(null)

  async function handleLogin() {
    if (passwordInput === 'RIFGES2026') {
      setAuthenticated(true)
      loadUniversites()
    } else {
      setPasswordError(true)
      setTimeout(() => setPasswordError(false), 2000)
    }
  }

  async function loadUniversites() {
    setLoading(true)
    const snapshot = await getDocs(collection(db, 'universites'))
    const data = snapshot.docs.map(d => {
      const d2 = { id: d.id, ...d.data() }
      if (d2.lat && d2.lng) {
        d2.coords = `${d2.lat}, ${d2.lng}`
      }
      return d2
    })
    const typeOrder = { 'europe-erasmus': 1, 'europe-hors-erasmus': 2, 'hors-europe': 3 }
    data.sort((a, b) => {
      const typeComp = (typeOrder[a.type] || 4) - (typeOrder[b.type] || 4)
      if (typeComp !== 0) return typeComp
      const paysComp = (a.pays || '').localeCompare(b.pays || '', 'fr')
      if (paysComp !== 0) return paysComp
      return (a.nom || '').localeCompare(b.nom || '', 'fr')
    })
    setUniversites(data)

    const formSnap = await getDoc(doc(db, 'config', 'formations'))
    if (formSnap.exists()) setFormations(formSnap.data().liste || [])

    const accordSnap = await getDoc(doc(db, 'config', 'typeaccord'))
    if (accordSnap.exists()) setTypesAccord(accordSnap.data().liste || [])

    setLoading(false)
  }

  async function addFormation() {
    if (!newFormation.trim()) return
    const updated = [...formations, newFormation.trim()]
    await setDoc(doc(db, 'config', 'formations'), { liste: updated })
    setFormations(updated)
    setNewFormation('')
    showSuccess('Formation ajoutée !')
  }

  async function removeFormation(f) {
  const updated = formations.filter(item => item !== f)
  await setDoc(doc(db, 'config', 'formations'), { liste: updated })
  setFormations(updated)

  const concerned = universites.filter(u => u.parcours && u.parcours.includes(f))
  for (const uni of concerned) {
    await updateDoc(doc(db, 'universites', uni.id), {
      parcours: uni.parcours.filter(p => p !== f)
    })
  }

  setDeleteFormationConfirm(null)
  showSuccess(`Formation supprimée${concerned.length > 0 ? ` (retirée de ${concerned.length} université(s))` : ''} !`)
  loadUniversites()
}

  function openAdd() {
    setFormData(EMPTY_UNI)
    setEditingUni(null)
    setShowForm(true)
  }

  function openEdit(uni) {
    setFormData({ ...EMPTY_UNI, ...uni })
    setEditingUni(uni.id)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingUni(null)
    setFormData(EMPTY_UNI)
  }

  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  function toggleFormation(f) {
    setFormData(prev => ({
      ...prev,
      parcours: prev.parcours.includes(f)
        ? prev.parcours.filter(p => p !== f)
        : [...prev.parcours, f]
    }))
  }

  async function handleSave() {
    if (!formData.nom || !formData.pays) {
      alert('Le nom et le pays sont obligatoires.')
      return
    }
    const { lat, lng } = parseCoords(formData.coords)
    if (lat === null || lng === null) {
      alert('Les coordonnées sont obligatoires. Copiez-les depuis Google Maps.')
      return
    }
    setSaving(true)
    const { coords, ...rest } = formData
    const data = { ...rest, lat, lng }
    try {
      if (editingUni) {
        await updateDoc(doc(db, 'universites', editingUni), data)
        showSuccess('Université modifiée !')
      } else {
        await addDoc(collection(db, 'universites'), data)
        showSuccess('Université ajoutée !')
      }
      closeForm()
      loadUniversites()
    } catch (e) {
      alert('Erreur lors de la sauvegarde.')
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    try {
      await deleteDoc(doc(db, 'universites', id))
      setDeleteConfirm(null)
      showSuccess('Université supprimée !')
      loadUniversites()
    } catch (e) {
      alert('Erreur lors de la suppression.')
    }
  }

  function showSuccess(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const filtered = universites.filter(u => {
    const matchSearch = u.nom?.toLowerCase().includes(search.toLowerCase()) ||
      u.pays?.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || u.type === filterType
    return matchSearch && matchType
  })

  function accordBadge(typeaccord) {
    if (!typeaccord) return null
    const color = typeaccord === 'Bilatéral' ? '#2563EB'
      : typeaccord === 'Global' ? '#D97706'
      : '#16A34A'
    return <span style={{ fontSize: '13px', fontWeight: 600, color }}>{typeaccord}</span>
  }

  const hasStudentData = !formData.statut || formData.statut === ''

  if (!authenticated) {
    return (
      <div className="admin-login">
        <div className="admin-login-box">
          <img src="/FGES_logo_transparent2.png" alt="FGES" style={{ height: '50px', marginBottom: '8px' }} />
          <h1>Espace Administrateur</h1>
          <p>Accès réservé au service des Relations Internationales</p>
          <div className="admin-login-field">
            <input
              type="password"
              placeholder="Mot de passe"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className={passwordError ? 'error' : ''}
              autoFocus
            />
            {passwordError && <span className="admin-login-error">Mot de passe incorrect</span>}
          </div>
          <button className="admin-login-btn" onClick={handleLogin}>Accéder →</button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">

      <div className="admin-header">
        <div className="admin-header-left">
          <img src="/FGES_logo_transparent2.png" alt="FGES" style={{ height: '32px' }} />
          <span className="admin-header-title">Espace Administrateur</span>
        </div>
        <div className="admin-header-right">
          {successMsg && <span className="admin-success">{successMsg}</span>}
          <button className="admin-view-btn" style={{ background: 'white', cursor: 'pointer' }} onClick={() => setShowFormationsManager(true)}>🎓 Gérer les formations</button>
          <a href="/" className="admin-view-btn">← Voir la carte</a>
          <button className="admin-add-btn" onClick={openAdd}>+ Ajouter une université</button>
        </div>
      </div>

      <div className="admin-filters">
        <input
          type="text"
          placeholder="🔍 Rechercher par nom ou pays..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="admin-search"
        />
        <div className="admin-type-filters">
          {['all','europe-erasmus','europe-hors-erasmus','hors-europe'].map(t => (
            <button
              key={t}
              className={`admin-type-btn${filterType === t ? ' active' : ''} type-${t}`}
              onClick={() => setFilterType(t)}
            >
              {t === 'all' ? `Tout (${universites.length})`
                : t === 'europe-erasmus' ? `Europe - Erasmus (${universites.filter(u => u.type === 'europe-erasmus').length})`
                : t === 'europe-hors-erasmus' ? `Europe - Hors Erasmus (${universites.filter(u => u.type === 'europe-hors-erasmus').length})`
                : `Hors Europe (${universites.filter(u => u.type === 'hors-europe').length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-table-wrap">
        {loading ? (
          <div className="admin-loading">Chargement...</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Pays</th>
                <th>Université</th>
                <th>Type</th>
                <th>Accord</th>
                <th>Code</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let lastType = null
                return filtered.map(uni => {
                  const showSeparator = uni.type !== lastType
                  lastType = uni.type
                  const typeLabel = uni.type === 'europe-erasmus' ? 'Europe – Erasmus'
                    : uni.type === 'europe-hors-erasmus' ? 'Europe – Hors Erasmus'
                    : 'Hors Europe'
                  return (
                    <>
                      {showSeparator && (
                        <tr key={`sep-${uni.type}`}>
                          <td colSpan={7} style={{
                            background: '#F3F4F6', padding: '8px 16px',
                            fontSize: '11px', fontWeight: 700,
                            letterSpacing: '.08em', textTransform: 'uppercase',
                            color: uni.type === 'europe-erasmus' ? '#2563EB'
                              : uni.type === 'europe-hors-erasmus' ? '#DC2626'
                              : '#16A34A'
                          }}>
                            {typeLabel}
                          </td>
                        </tr>
                      )}
                      <tr key={uni.id}>
                        <td>{uni.pays}</td>
                        <td className="admin-td-nom">{uni.nom}</td>
                        <td>
                          <span className={`admin-type-badge type-${uni.type}`}>
                            {uni.type === 'europe-erasmus' ? 'Erasmus'
                              : uni.type === 'europe-hors-erasmus' ? 'Hors Erasmus'
                              : 'Hors Europe'}
                          </span>
                        </td>
                        <td>{accordBadge(uni.typeaccord)}</td>
                        <td className="admin-td-code">{uni.code}</td>
                        <td>
                          {uni.statut === 'nouvel-accord' && <span className="admin-statut new">Nouvel accord</span>}
                          {uni.statut === 'pas-de-donnees' && <span className="admin-statut no-data">Pas de données</span>}
                          {!uni.statut && <span className="admin-statut ok">Données renseignées</span>}
                        </td>
                        <td className="admin-td-actions">
                          <button className="admin-edit-btn" onClick={() => openEdit(uni)}>✏️ Modifier</button>
                          <button className="admin-delete-btn" onClick={() => setDeleteConfirm(uni)}>🗑️ Supprimer</button>
                        </td>
                      </tr>
                    </>
                  )
                })
              })()}
            </tbody>
          </table>
        )}
      </div>

      {showFormationsManager && (
        <div className="admin-overlay" onClick={() => setShowFormationsManager(false)}>
          <div className="admin-confirm-box" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <h3>🎓 Gérer les formations</h3>
            <p style={{ marginBottom: '16px' }}>Ajoutez ou supprimez des formations. Les changements s'appliquent immédiatement sur la carte.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '300px', overflowY: 'auto' }}>
              {formations.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{f}</span>
                  <button onClick={() => setDeleteFormationConfirm(f)} style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
            {deleteFormationConfirm && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '12px 16px', marginBottom: '12px' }}>
                <p style={{ fontSize: '13px', color: '#DC2626', fontWeight: 600, marginBottom: '8px' }}>
                  Supprimer la formation "{deleteFormationConfirm}" ?
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="admin-cancel-btn" onClick={() => setDeleteFormationConfirm(null)}>Annuler</button>
                  <button className="admin-confirm-delete-btn" onClick={() => removeFormation(deleteFormationConfirm)}>Confirmer</button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                value={newFormation}
                onChange={e => setNewFormation(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFormation()}
                placeholder="Nom de la nouvelle formation"
                style={{ flex: 1, padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontFamily: 'DM Sans, sans-serif', fontSize: '13px', outline: 'none' }}
              />
              <button className="admin-save-btn" onClick={addFormation}>Ajouter</button>
            </div>
            <div className="admin-confirm-actions">
              <button className="admin-cancel-btn" onClick={() => setShowFormationsManager(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="admin-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="admin-confirm-box" onClick={e => e.stopPropagation()}>
            <h3>Supprimer cette université ?</h3>
            <p><strong>{deleteConfirm.nom}</strong> sera définitivement supprimée de la cartographie.</p>
            <div className="admin-confirm-actions">
              <button className="admin-cancel-btn" onClick={() => setDeleteConfirm(null)}>Annuler</button>
              <button className="admin-confirm-delete-btn" onClick={() => handleDelete(deleteConfirm.id)}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="admin-overlay" onClick={closeForm}>
          <div className="admin-form-box" onClick={e => e.stopPropagation()}>
            <div className="admin-form-header">
              <h2>{editingUni ? '✏️ Modifier une université' : '➕ Ajouter une université'}</h2>
              <button className="admin-form-close" onClick={closeForm}>✕</button>
            </div>

            <div className="admin-form-body">

              <div className="admin-form-section">
                <h3>Informations générales</h3>
                <div className="admin-form-grid">
                  <div className="admin-form-field full">
                    <label>Nom de l'université *</label>
                    <input value={formData.nom} onChange={e => handleChange('nom', e.target.value)} placeholder="Ex: Augsburg – Hochschule Augsburg" />
                  </div>
                  <div className="admin-form-field">
                    <label>Pays *</label>
                    <input value={formData.pays} onChange={e => handleChange('pays', e.target.value)} placeholder="Ex: Allemagne" />
                  </div>
                  <div className="admin-form-field">
                    <label>Code Erasmus</label>
                    <input value={formData.code} onChange={e => handleChange('code', e.target.value)} placeholder="Ex: D AUGSBUR02" />
                  </div>
                  <div className="admin-form-field">
                    <label>Type</label>
                    <select value={formData.type} onChange={e => handleChange('type', e.target.value)}>
                      <option value="europe-erasmus">Europe – Erasmus</option>
                      <option value="europe-hors-erasmus">Europe – Hors Erasmus</option>
                      <option value="hors-europe">Hors Europe</option>
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Statut</label>
                    <select value={formData.statut} onChange={e => handleChange('statut', e.target.value)}>
                      <option value="">Données renseignées</option>
                      <option value="nouvel-accord">Nouvel accord</option>
                      <option value="pas-de-donnees">Pas de données</option>
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Type d'accord</label>
                    <select value={formData.typeaccord} onChange={e => handleChange('typeaccord', e.target.value)}>
                      <option value="">Non précisé</option>
                      {typesAccord.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="admin-form-field full">
                    <label>Coordonnées GPS *</label>
                    <input
                      value={formData.coords}
                      onChange={e => handleChange('coords', e.target.value)}
                      placeholder="Ex: 48.3555, 10.9045"
                    />
                    <span style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px', display: 'block', fontFamily: 'DM Sans, sans-serif' }}>
                      💡 Cherchez l'université sur Google Maps, faites un clic droit sur son emplacement et copiez-collez les coordonnées affichées.
                    </span>
                  </div>
                  <div className="admin-form-field full">
                    <label>Site web officiel</label>
                    <input value={formData.siteWeb} onChange={e => handleChange('siteWeb', e.target.value)} placeholder="Ex: https://www.hs-augsburg.de" />
                  </div>
                  <div className="admin-form-field">
                    <label>Nombre de semestres disponibles</label>
                    <input value={formData.semestres} onChange={e => handleChange('semestres', e.target.value)} placeholder="Ex: 4" />
                  </div>
                </div>
              </div>

              <div className="admin-form-field">
              <label>Durées d'échange disponibles</label>
              <input value={formData.durees} onChange={e => handleChange('durees', e.target.value)} placeholder="Ex: S1, S2 ou Année" />
              </div>

              <div className="admin-form-section">
                <h3>Formations compatibles</h3>
                <div className="admin-formations-grid">
                  {formations.map(f => (
                    <label key={f} className={`admin-formation-check${formData.parcours.includes(f) ? ' checked' : ''}`}>
                      <input type="checkbox" checked={formData.parcours.includes(f)} onChange={() => toggleFormation(f)} />
                      {f}
                    </label>
                  ))}
                </div>
              </div>

              <div className="admin-form-section">
                <h3>Langues & Conditions</h3>
                <div className="admin-form-grid">
                  <div className="admin-form-field">
                    <label>Langue(s) d'enseignement</label>
                    <input value={formData.langue} onChange={e => handleChange('langue', e.target.value)} placeholder="Ex: Anglais / Allemand" />
                  </div>
                  <div className="admin-form-field full">
                    <label>Conditions de langue</label>
                    <textarea value={formData.conditionlangue} onChange={e => handleChange('conditionlangue', e.target.value)} placeholder="Ex: Niveau B1 en anglais et B1 en allemand" rows={2} />
                  </div>
                </div>
              </div>

              {hasStudentData && (
                <div className="admin-form-section">
                  <h3>Retours des étudiants</h3>
                  <div className="admin-form-grid">
                    {[
                      { key: 'budget', label: '💰 Budget' },
                      { key: 'integration', label: '🤝 Intégration' },
                      { key: 'cours', label: '📚 Cours' },
                      { key: 'examens', label: '📝 Examens' },
                      { key: 'logement', label: '🏠 Logement' },
                      { key: 'transport', label: '🚌 Transports' },
                      { key: 'tips', label: '💡 Bon à savoir' },
                    ].map(({ key, label }) => (
                      <div key={key} className="admin-form-field full">
                        <label>{label}</label>
                        <textarea value={formData[key]} onChange={e => handleChange(key, e.target.value)} rows={2} placeholder="Si aucune information disponible, indiquer : Pas d'information" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            <div className="admin-form-footer">
              <button className="admin-cancel-btn" onClick={closeForm}>Annuler</button>
              <button className="admin-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Enregistrement...' : '✓ Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}