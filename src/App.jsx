import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { collection, getDocs, getDoc, doc } from 'firebase/firestore'
import { db } from './firebase'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

function makeIcon(type) {
  const cls = type === 'europe-hors-erasmus' ? 'pin-europe-hors-erasmus'
    : type === 'hors-europe' ? 'pin-hors-europe'
    : 'pin-europe-erasmus'
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="pin-wrap ${cls}"><div class="pin-shape"></div></div>`,
    iconSize: [26, 32],
    iconAnchor: [13, 32],
    popupAnchor: [0, -32]
  })
}

function MapController({ flyTo }) {
  const map = useMap()
  useEffect(() => {
    if (flyTo) map.flyTo(flyTo.coords, flyTo.zoom, { duration: flyTo.duration || 1.4 })
  }, [flyTo])
  return null
}

function badgeClass(type) {
  if (type === 'europe-hors-erasmus') return 'badge-hors-erasmus'
  if (type === 'hors-europe') return 'badge-monde'
  return 'badge-erasmus'
}
function badgeLabel(type) {
  if (type === 'europe-hors-erasmus') return 'Europe – Hors Erasmus'
  if (type === 'hors-europe') return 'Hors Europe'
  return 'Europe – Erasmus'
}
function val(v) {
  if (!v) return <span className="info-card-value empty">Non renseigné</span>
  return <span className="info-card-value" dangerouslySetInnerHTML={{ __html: v }} />
}
function normalize(s) {
  return s.toLowerCase()
    .replace(/–/g, '-')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

const INITIAL_VIEW = { coords: [30, 10], zoom: 3 }

function TooltipMarker({ uni, onClick }) {
  const markerRef = useRef(null)

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.bindTooltip(uni.nom, {
        direction: 'top',
        offset: [0, -30],
        className: 'leaflet-tooltip-custom',
        permanent: false,
        sticky: false
      })
      markerRef.current.on('click', () => {
        markerRef.current.closeTooltip()
      })
    }
  }, [uni.nom])

  return (
    <Marker
      ref={markerRef}
      position={[uni.lat, uni.lng]}
      icon={makeIcon(uni.type)}
      eventHandlers={{ 
        click: () => onClick(uni),
        mouseover: (e) => e.target.openTooltip(),
        mouseout: (e) => e.target.closeTooltip()
      }}
    />
  )
}

export default function App() {
  const [universites, setUniversites] = useState([])
  const [formations, setFormations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUni, setSelectedUni] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [activeFormation, setActiveFormation] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [flyTo, setFlyTo] = useState(null)
  const searchRef = useRef(null)
  const [noticeAccepted, setNoticeAccepted] = useState(
    sessionStorage.getItem('noticeAccepted') === 'true'
  )
  const [noticeChecked, setNoticeChecked] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const snapshot = await getDocs(collection(db, 'universites'))
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      setUniversites(data)

      const formSnap = await getDoc(doc(db, 'config', 'formations'))
if (formSnap.exists()) {
  setFormations(formSnap.data().liste || [])
}

      setLoading(false)
    }
    fetchData()
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const visibleUnis = universites.filter(uni => {
    const typeOk = activeFilter === 'all' || uni.type === activeFilter
    const formationOk = activeFormation === '' || (uni.parcours && uni.parcours.includes(activeFormation))
    return typeOk && formationOk
  })

  const unisFiltreesParFormation = universites.filter(uni =>
  activeFormation === '' || (uni.parcours && uni.parcours.includes(activeFormation))
)
const counts = {
  total: unisFiltreesParFormation.length,
  erasmus: unisFiltreesParFormation.filter(u => u.type === 'europe-erasmus').length,
  hors: unisFiltreesParFormation.filter(u => u.type === 'europe-hors-erasmus').length,
  monde: unisFiltreesParFormation.filter(u => u.type === 'hors-europe').length,
}

  function handleSearch(q) {
    setSearchQuery(q)
    if (q.length < 2) { setShowSearchResults(false); return }
    const nq = normalize(q)
    const matches = universites.filter(u =>
      normalize(u.nom || '').includes(nq) || normalize(u.pays || '').includes(nq)
    ).slice(0, 15)
    setSearchResults(matches)
    setShowSearchResults(matches.length > 0)
  }

  function selectResult(uni) {
    setSearchQuery(uni.nom)
    setShowSearchResults(false)
    setFlyTo({ coords: [uni.lat, uni.lng], zoom: 13, duration: 1.4 })
    setSelectedUni(uni)
    setPanelOpen(true)
    if (activeFilter !== 'all' && uni.type !== activeFilter) setActiveFilter('all')
  }

  function handleMarkerClick(uni) {
    setFlyTo({ coords: [uni.lat, uni.lng], zoom: 13, duration: 1.4 })
    setSelectedUni(uni)
    setPanelOpen(true)
  }

  function closePanel() {
    setPanelOpen(false)
    setTimeout(() => setSelectedUni(null), 450)
    setFlyTo({ coords: INITIAL_VIEW.coords, zoom: INITIAL_VIEW.zoom, duration: 1.2 })
  }

  function handleFilterClick(type) {
    setActiveFilter(type)
    closePanel()
  }

  function handleFormationChange(formation) {
    setActiveFormation(formation)
    closePanel()
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'DM Sans, sans-serif', color: '#6B7280' }}>
      Chargement de la carte...
    </div>
  )

  return (
    <>
      <MapContainer center={INITIAL_VIEW.coords} zoom={INITIAL_VIEW.zoom} style={{ position: 'fixed', inset: 0, zIndex: 1 }} zoomControl={false}>
        <TileLayer 
        url="https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.png"
        attribution="© Stadia Maps"
        />
        <MapController flyTo={flyTo} />
        {visibleUnis.map(uni => (
          <TooltipMarker key={uni.id} uni={uni} onClick={handleMarkerClick} />
        ))}
      </MapContainer>

      <div id="toolbar">
        <a href="/admin" style={{
          width: '36px', height: '36px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '50%',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          fontSize: '15px',
          color: 'var(--text-2)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          transition: 'all .2s',
          flexShrink: 0,
        }}>⚙️</a>

        <div id="search-wrap" ref={searchRef}>
          <span id="search-icon">🔍</span>
          <input
            id="search-input"
            type="text"
            placeholder="Rechercher une université ou un pays…"
            autoComplete="off"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
          />
          {showSearchResults && (
            <div id="search-results" style={{ display: 'block' }}>
              {searchResults.map(u => (
                <div key={u.id} className="search-item" onClick={() => selectResult(u)}>
                  <div>{u.nom}</div>
                  <div className="search-item-pays">{u.pays}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div id="filters">
          <button className={`filter-btn all${activeFilter === 'all' ? ' active' : ''}`} onClick={() => handleFilterClick('all')}>
            Tout ({counts.total})
          </button>
          <button className={`filter-btn erasmus${activeFilter === 'europe-erasmus' ? ' active' : ''}`} onClick={() => handleFilterClick('europe-erasmus')}>
            Europe – Erasmus ({counts.erasmus})
          </button>
          <button className={`filter-btn hors-era${activeFilter === 'europe-hors-erasmus' ? ' active' : ''}`} onClick={() => handleFilterClick('europe-hors-erasmus')}>
            Europe – Hors Erasmus ({counts.hors})
          </button>
          <button className={`filter-btn monde${activeFilter === 'hors-europe' ? ' active' : ''}`} onClick={() => handleFilterClick('hors-europe')}>
            Hors Europe ({counts.monde})
          </button>
        </div>

        <div id="formation-wrap">
          <select id="formation-select" value={activeFormation} onChange={e => handleFormationChange(e.target.value)}>
            <option value="">Toutes les formations</option>
            {formations.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <span id="formation-arrow">▼</span>
        </div>
      </div>

      <div id="formation-warning" style={{ display: activeFormation === 'Prépa 3 Gestion' ? 'block' : 'none' }}>
        ⚠️ Rappel : départ au S1 uniquement pour les Prépa 3 Gestion
      </div>

      <div id="panel" className={panelOpen ? 'open' : ''}>
        <div id="panel-inner">
          {selectedUni && <UniPanel uni={selectedUni} onClose={closePanel} />}
        </div>
      </div>

      {!noticeAccepted && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'white', borderRadius: '24px',
            padding: '40px', maxWidth: '520px', width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            textAlign: 'center',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <p style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '16px', fontFamily: 'DM Sans, sans-serif' }}>
            ↓ Faites défiler pour lire toutes les informations avant d'accéder à la carte
            </p>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', color: '#111827', marginBottom: '16px' }}>
              Bienvenue sur la Cartographie RI FGES
            </h2>
            <p style={{ fontSize: '13.5px', color: '#6B7280', lineHeight: '1.7', marginBottom: '20px', fontFamily: 'DM Sans, sans-serif' }}>
              Cette carte interactive recense l'ensemble des destinations partenaires de la FGES. 
              Combinez les filtres en haut pour affiner votre recherche par catégorie (Erasmus, Hors Erasmus, Hors Europe) et par formation.
            </p>
            <p style={{ fontSize: '13.5px', color: '#6B7280', lineHeight: '1.7', marginBottom: '20px', fontFamily: 'DM Sans, sans-serif' }}>
              Cliquez sur un pin pour accéder à la fiche détaillée d'une université. Dans chaque fiche, vous trouverez deux rubriques :
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div style={{ background: '#EFF6FF', borderRadius: '12px', padding: '14px 16px', borderLeft: '4px solid #2563EB' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '4px', fontFamily: 'DM Sans, sans-serif' }}>Critères d'admission</p>
                <p style={{ fontSize: '13px', color: '#1e40af', fontFamily: 'DM Sans, sans-serif', lineHeight: '1.5' }}>Issues des contrats de partenariat officiels — nombre de semestres disponibles par année, formations compatibles, langue(s) d'enseignement et conditions de langue.</p>
              </div>
              <div style={{ background: '#EFF6FF', borderRadius: '12px', padding: '14px 16px', borderLeft: '4px solid #2563EB' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '4px', fontFamily: 'DM Sans, sans-serif' }}>Retours des étudiants</p>
                <p style={{ fontSize: '13px', color: '#1e40af', fontFamily: 'DM Sans, sans-serif', lineHeight: '1.5' }}>Issues des questionnaires de retour d'expérience des 3 dernières années. Ces informations sont des témoignages personnels des étudiants partis en échange dans ces universités les années précédentes et ne constituent pas des données officielles.</p>
              </div>
              <p style={{ fontSize: '13.5px', color: '#6B7280', lineHeight: '1.7', marginBottom: '12px', fontFamily: 'DM Sans, sans-serif' }}>
              Concernant les types d'accords, il en existe trois types :
              </p>
              <div style={{ background: '#EFF6FF', borderRadius: '12px', padding: '14px 16px', borderLeft: '4px solid #2563EB' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '4px', fontFamily: 'DM Sans, sans-serif' }}>Types d'accord</p>
                <p style={{ fontSize: '13px', color: '#1e40af', fontFamily: 'DM Sans, sans-serif', lineHeight: '1.5' }}>
                Les accords <strong>Bilatéraux</strong> sont propres à la FGES — le nombre de semestres disponibles par année est fixe. 
                Les accords <strong>Globaux</strong> et <strong>ICL</strong> appartiennent à l'Université Catholique de Lille — 
                le nombre de semestres est attribué chaque année par la Catho à chaque faculté. Cette information sera mise à jour sur la carte courant janvier, une fois l'attribution confirmée.
                </p>
              </div>
            </div>
            <p style={{ fontSize: '13.5px', color: '#6B7280', lineHeight: '1.7', marginBottom: '20px', fontFamily: 'DM Sans, sans-serif' }}>
              Pour toute question, n'hésitez pas à contacter directement le Service des Relations Internationales à l'adresse <a href="mailto:mobilitesortante.fges@univ-catholille.fr" style={{ color: '#2563EB', textDecoration: 'underline' }}>mobilitesortante.fges@univ-catholille.fr</a> ou en vous rendant au bureau situé en MF 3102.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', marginBottom: '20px' }}>
              <input
                type="checkbox"
                checked={noticeChecked}
                onChange={e => setNoticeChecked(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563EB' }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: 'DM Sans, sans-serif' }}>
                J'ai lu et bien compris
              </span>
            </label>
            <button
              onClick={() => { 
                if (noticeChecked) {
                  sessionStorage.setItem('noticeAccepted', 'true')
                  setNoticeAccepted(true)
                }
              }}
              style={{
                width: '100%', padding: '12px',
                background: noticeChecked ? '#2563EB' : '#93C5FD',
                color: 'white', border: 'none', borderRadius: '12px',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '14px', fontWeight: 600,
                cursor: noticeChecked ? 'pointer' : 'not-allowed',
                transition: 'all .2s',
              }}
            >
              Accéder à la carte →
            </button>
          </div>
        </div>
      )}
      <img
        src="/FGES_logo_transparent2.png"
        alt="FGES"
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          height: '50px',
          zIndex: 900,
          opacity: 0.85,
          pointerEvents: 'none'
        }}
      />
    </>
  )
}

function UniPanel({ uni, onClose }) {
  const [activeTab, setActiveTab] = useState('formalites')

  const typeColor = uni.type === 'europe-hors-erasmus' ? '#DC2626'
    : uni.type === 'hors-europe' ? '#16A34A'
    : '#2563EB'

  const typeBg = uni.type === 'europe-hors-erasmus' ? '#FEF2F2'
    : uni.type === 'hors-europe' ? '#F0FDF4'
    : '#F0F7FF'

  const typeBorder = uni.type === 'europe-hors-erasmus' ? '#FECACA'
    : uni.type === 'hors-europe' ? '#BBF7D0'
    : '#BFDBFE'

  const accordColor = uni.typeaccord === 'Bilatéral' ? '#2563EB'
    : uni.typeaccord === 'Global' ? '#D97706'
    : uni.typeaccord === 'ICL' ? '#16A34A'
    : null

  const tabStyle = (tab) => ({
    padding: '8px 16px',
    border: 'none',
    background: 'none',
    fontFamily: 'DM Sans, sans-serif',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    color: activeTab === tab ? typeColor : '#9CA3AF',
    borderBottom: activeTab === tab ? `2px solid ${typeColor}` : '2px solid transparent',
    marginBottom: '-2px',
    transition: 'all .2s'
  })

  const formaliteItem = (label, content) => (
    content ? (
      <div style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: '12px' }}>
        <div className="info-card-label" style={{ marginBottom: '6px', color: typeColor }}>{label}</div>
        <span className="info-card-value">{content}</span>
      </div>
    ) : null
  )

  return (
    <>
      <button id="close-btn" onClick={onClose}>← Fermer</button>
      <span className={`panel-badge ${badgeClass(uni.type)}`}>{badgeLabel(uni.type)}</span>
      <h2 className="panel-title">{uni.nom}</h2>

      <p className="panel-code">
        {uni.pays}
        {uni.code ? ` · ${uni.code}` : ''}
        {uni.typeaccord && accordColor ? <> · <span style={{ color: accordColor, fontWeight: 600 }}>{uni.typeaccord}</span></> : ''}
        {uni.siteWeb ? <> · <a href={uni.siteWeb} target="_blank" rel="noreferrer" style={{ color: typeColor, textDecoration: 'underline' }}>Site web</a></> : ''}
      </p>

      {/* ONGLETS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #F3F4F6' }}>
        <button onClick={() => setActiveTab('formalites')} style={tabStyle('formalites')}>📋 Critères d'admission</button>
        <button onClick={() => setActiveTab('retours')} style={tabStyle('retours')}>📝 Retours des étudiants</button>
      </div>

      {/* ONGLET FORMALITÉS */}
      {activeTab === 'formalites' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {formaliteItem('📅 Nombre de semestres disponibles par année', uni.semestres)}

          {uni.parcours && uni.parcours.length > 0 && (
            <div style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: '12px' }}>
              <div className="info-card-label" style={{ marginBottom: '6px', color: typeColor }}>🎓 Formations compatibles</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {uni.parcours.map(p => (
                  <span key={p} style={{ background: '#F9FAFB', color: '#374151', fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '99px', border: '1px solid #E5E7EB' }}>{p}</span>
                ))}
              </div>
            </div>
          )}

          {formaliteItem('🗓️ Durées d\'échange disponibles', uni.durees)}

          {formaliteItem('🌍 Langue(s) d\'enseignement', uni.langue)}

          {uni.conditionlangue && (
            <div style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: '12px' }}>
              <div className="info-card-label" style={{ marginBottom: '6px', color: typeColor }}>📋 Conditions de langue</div>
              <span className="info-card-value" dangerouslySetInnerHTML={{ __html: uni.conditionlangue }} />
            </div>
          )}

        </div>
      )}

      {/* ONGLET RETOURS */}
      {activeTab === 'retours' && (
        <div>
          <p style={{ fontSize: '11px', color: '#9CA3AF', fontStyle: 'italic', marginBottom: '16px', fontFamily: 'DM Sans, sans-serif' }}>
            <p style={{ fontSize: '11px', color: '#9CA3AF', fontStyle: 'italic', marginBottom: '16px', fontFamily: 'DM Sans, sans-serif', lineHeight: '1.6' }}>
            Témoignages personnels issus des questionnaires de retour d'expérience des 3 dernières années — informations non officielles. Pour aller plus loin, les questionnaires complets sont disponibles sur iCampus : les étudiants y ont renseigné leurs coordonnées et vous pouvez les contacter pour plus d'informations.
            </p>
          </p>

          {uni.statut === 'nouvel-accord' || uni.statut === 'pas-de-donnees' ? (
            <div className="info-card card-gray" style={{ textAlign: 'center' }}>
              <p className="info-card-value">
                {uni.statut === 'nouvel-accord'
                  ? '🤝 Nouveau partenariat — Soyez parmi les premiers à découvrir cette destination !'
                  : '⏳ Cette destination n\'a pas encore été évaluée récemment, des informations arrivent bientôt !'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { key: 'budget',      label: '💰 Budget' },
                { key: 'integration', label: '🤝 Intégration' },
                { key: 'cours',       label: '📚 Cours' },
                { key: 'examens',     label: '📝 Examens' },
                { key: 'logement',    label: '🏠 Logement' },
                { key: 'transport',   label: '🚌 Transports' },
                { key: 'tips',        label: '💡 Bon à savoir' },
              ].map(({ key, label }) => (
                <div key={key} style={{ borderBottom: '1px solid #F9FAFB', paddingBottom: '12px' }}>
                  <div className="info-card-label" style={{ marginBottom: '4px', color: typeColor }}>{label}</div>
                  {val(uni[key])}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
