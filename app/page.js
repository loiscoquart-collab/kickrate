'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [tab, setTab] = useState('matches')
  const [matches, setMatches] = useState([])
  const [ratings, setRatings] = useState([])
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [modal, setModal] = useState(null)
  const [modalStars, setModalStars] = useState(0)
  const [modalComment, setModalComment] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [friendFeed, setFriendFeed] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })
    supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile()
    })
    fetchMatches()
    fetchAllRatings()

    const channel = supabase
      .channel('ratings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ratings' }, () => {
        fetchAllRatings()
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'ratings' }, () => {
        fetchAllRatings()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    if (user) {
      fetchProfile()
      fetchPendingRequests()
    }
  }, [user])

  useEffect(() => {
    if (profile) fetchFriendFeed()
  }, [profile, ratings])

  async function fetchMatches() {
    const res = await fetch('/api/matches')
    const data = await res.json()
    setMatches(data)
  }

  async function fetchAllRatings() {
    const { data } = await supabase
      .from('ratings')
      .select('*, profiles(username, avatar_initials)')
      .order('created_at', { ascending: false })
    setRatings(data || [])
  }

  async function fetchProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    setProfile(data)
  }

  async function fetchFriendFeed() {
    const { data: friends } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', user.id)
      .eq('status', 'accepted')
    const friendIds = (friends || []).map(f => f.friend_id)
    if (friendIds.length === 0) { setFriendFeed([]); return }
    const { data } = await supabase
      .from('ratings')
      .select('*, profiles(username, avatar_initials)')
      .in('user_id', friendIds)
      .order('created_at', { ascending: false })
    setFriendFeed(data || [])
  }

  async function fetchPendingRequests() {
    const { data } = await supabase
      .from('friendships')
      .select('*, profiles!friendships_user_id_fkey(username, avatar_initials)')
      .eq('friend_id', user.id)
      .eq('status', 'pending')
    setPendingRequests(data || [])
  }

  async function handleAuth() {
    setLoading(true)
    if (authMode === 'signup') {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single()
      if (existing) {
        alert('Ce nom d\'utilisateur est déjà pris, choisis-en un autre.')
        setLoading(false)
        return
      }
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (!error && data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          username,
          avatar_initials: username.slice(0, 2).toUpperCase()
        })
        if (profileError) {
          alert('Erreur création profil : ' + profileError.message)
          setLoading(false)
          return
        }
      }
      alert(error ? error.message : 'Compte créé ! Vérifie tes emails.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) alert(error.message)
    }
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null); setProfile(null)
  }

  async function submitRating() {
    if (!user) { alert('Connecte-toi pour noter !'); return }
    if (modalStars === 0) { alert('Choisis une note !'); return }
    const existing = ratings.find(r => r.match_id === modal.id && r.user_id === user.id)
    if (existing) { alert('Tu as déjà noté ce match !'); return }
    await supabase.from('ratings').insert({
      user_id: user.id,
      match_id: modal.id,
      match_teams: modal.teams,
      match_score: modal.score,
      match_league: modal.league,
      match_date: modal.date,
      stars: modalStars,
      comment: modalComment
    })
    setModal(null); setModalStars(0); setModalComment('')
    fetchAllRatings()
    fetchMatches()
  }

  async function deleteRating(ratingId) {
    if (!confirm('Supprimer cette note ?')) return
    await supabase.from('ratings').delete().eq('id', ratingId)
    fetchAllRatings()
  }

  async function sendFriendRequest(friendUsername) {
    if (!friendUsername) return
    const { data: friendProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', friendUsername)
      .single()
    if (!friendProfile) { alert('Utilisateur introuvable'); return }
    if (friendProfile.id === user.id) { alert('Tu ne peux pas t\'ajouter toi-même !'); return }
    const { error } = await supabase.from('friendships').insert({
      user_id: user.id,
      friend_id: friendProfile.id,
      status: 'pending'
    })
    if (error) { alert('Demande déjà envoyée ou erreur.'); return }
    alert('Demande d\'ami envoyée à @' + friendUsername + ' !')
  }

  async function acceptFriend(requestId, friendId) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', requestId)
    await supabase.from('friendships').insert({
      user_id: user.id,
      friend_id: friendId,
      status: 'accepted'
    })
    fetchPendingRequests()
    fetchFriendFeed()
  }

  async function declineFriend(requestId) {
    await supabase.from('friendships').delete().eq('id', requestId)
    fetchPendingRequests()
  }

  function getMatchRatings(matchId) {
    return ratings.filter(r => r.match_id === matchId)
  }

  function getMyRating(matchId) {
    return ratings.find(r => r.match_id === matchId && r.user_id === user?.id)
  }

  function timeAgo(dateStr) {
    const diff = (Date.now() - new Date(dateStr)) / 1000
    if (diff < 60) return "À l'instant"
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)}min`
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`
    return `Il y a ${Math.floor(diff / 86400)}j`
  }

  if (!user) return (
    <div style={{maxWidth:380,margin:'60px auto',padding:'0 1rem'}}>
      <h1 style={{fontSize:24,fontWeight:500,marginBottom:8}}>Kickrate</h1>
      <p style={{color:'#888',marginBottom:24,fontSize:14}}>Note les matchs, partage avec tes amis.</p>
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        <button onClick={()=>setAuthMode('login')} style={{flex:1,padding:'8px',background:authMode==='login'?'#000':'transparent',color:authMode==='login'?'#fff':'inherit',border:'0.5px solid #ccc',borderRadius:8,cursor:'pointer'}}>Connexion</button>
        <button onClick={()=>setAuthMode('signup')} style={{flex:1,padding:'8px',background:authMode==='signup'?'#000':'transparent',color:authMode==='signup'?'#fff':'inherit',border:'0.5px solid #ccc',borderRadius:8,cursor:'pointer'}}>Inscription</button>
      </div>
      {authMode==='signup' && <input placeholder="Nom d'utilisateur" value={username} onChange={e=>setUsername(e.target.value)} style={{width:'100%',padding:'8px 12px',marginBottom:8,border:'0.5px solid #ccc',borderRadius:8,background:'transparent',color:'inherit',fontFamily:'inherit'}} />}
      <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%',padding:'8px 12px',marginBottom:8,border:'0.5px solid #ccc',borderRadius:8,background:'transparent',color:'inherit',fontFamily:'inherit'}} />
      <input placeholder="Mot de passe" type="password" value={password} onChange={e=>setPassword(e.target.value)} style={{width:'100%',padding:'8px 12px',marginBottom:12,border:'0.5px solid #ccc',borderRadius:8,background:'transparent',color:'inherit',fontFamily:'inherit'}} />
      <button onClick={handleAuth} disabled={loading} style={{width:'100%',padding:'10px',background:'#000',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit'}}>
        {loading ? 'Chargement...' : authMode==='login' ? 'Se connecter' : 'Créer le compte'}
      </button>
    </div>
  )

  return (
    <div style={{maxWidth:440,margin:'0 auto',padding:'1rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <span style={{fontSize:20,fontWeight:500}}>Kickrate</span>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:13,color:'#888'}}>@{profile?.username}</span>
          <button onClick={handleLogout} style={{fontSize:12,color:'#888',background:'transparent',border:'0.5px solid #ccc',borderRadius:6,padding:'4px 8px',cursor:'pointer'}}>Déconnexion</button>
        </div>
      </div>

      <div style={{display:'flex',border:'0.5px solid #ddd',borderRadius:10,overflow:'hidden',marginBottom:20}}>
        {['matches','feed','profil'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'8px 0',fontSize:13,background:tab===t?'#f5f5f5':'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:tab===t?500:400,position:'relative'}}>
            {t==='matches'?'Matchs':t==='feed'?'Amis':'Profil'}
            {t==='feed' && pendingRequests.length > 0 && (
              <span style={{position:'absolute',top:4,right:8,background:'#E24B4A',color:'#fff',borderRadius:'50%',width:16,height:16,fontSize:10,display:'flex',alignItems:'center',justifyContent:'center'}}>{pendingRequests.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab==='matches' && (
        <div>
          <p style={{fontSize:12,color:'#aaa',marginBottom:12}}>Clique sur un match pour le noter</p>
          {matches.length===0 && <p style={{color:'#aaa',fontSize:14}}>Chargement des matchs...</p>}
          {matches.map(m=>{
            const mRatings = getMatchRatings(m.id)
            const myRating = getMyRating(m.id)
            const avg = mRatings.length ? (mRatings.reduce((a,r)=>a+r.stars,0)/mRatings.length).toFixed(1) : null
            return (
              <div key={m.id} onClick={()=>!myRating&&setModal(m)} style={{background:'var(--background)',border:'0.5px solid #ddd',borderRadius:12,padding:'1rem',marginBottom:10,cursor:myRating?'default':'pointer'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                  <span style={{fontSize:11,background:'#f5f5f5',padding:'2px 8px',borderRadius:20,color:'#666'}}>{m.league}</span>
                  <span style={{fontSize:11,color:'#aaa'}}>{m.date}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <span style={{fontSize:15,fontWeight:500}}>{m.teams}</span>
                  <span style={{fontSize:18,fontWeight:500,color:'#333'}}>{m.score}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderTop:'0.5px solid #eee',paddingTop:8}}>
                  <div>
                    {myRating ? <span style={{color:'#EF9F27',fontSize:14}}>{'★'.repeat(myRating.stars)}{'☆'.repeat(5-myRating.stars)}</span> : <span style={{fontSize:12,color:'#aaa'}}>Clique pour noter</span>}
                  </div>
                  <div style={{fontSize:12,color:'#aaa'}}>
                    {avg ? `⭐ ${avg} · ${mRatings.length} note${mRatings.length>1?'s':''}` : ''}
                  </div>
                </div>
                {mRatings.filter(r => r.comment).slice(0,2).map(r => (
                  <div key={r.id} style={{marginTop:8,paddingTop:8,borderTop:'0.5px solid #eee'}}>
                    <span style={{fontSize:12,fontWeight:500,color:'#555'}}>@{r.profiles?.username} </span>
                    <span style={{fontSize:12,color:'#888'}}>{r.comment}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {tab==='feed' && (
        <div>
          {pendingRequests.length > 0 && (
            <div style={{marginBottom:16}}>
              <p style={{fontSize:13,fontWeight:500,marginBottom:8}}>Demandes d'ami reçues</p>
              {pendingRequests.map(req => (
                <div key={req.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',border:'0.5px solid #ddd',borderRadius:10,marginBottom:8}}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:'#E6F1FB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500,color:'#185FA5'}}>{req.profiles?.avatar_initials}</div>
                  <span style={{flex:1,fontSize:13,fontWeight:500}}>@{req.profiles?.username}</span>
                  <button onClick={()=>acceptFriend(req.id, req.user_id)} style={{padding:'4px 10px',background:'#000',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>Accepter</button>
                  <button onClick={()=>declineFriend(req.id)} style={{padding:'4px 10px',background:'transparent',border:'0.5px solid #ddd',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>Refuser</button>
                </div>
              ))}
            </div>
          )}

          <div style={{display:'flex',gap:8,marginBottom:16}}>
            <input id="friend-input" placeholder="Nom d'utilisateur d'un ami" style={{flex:1,padding:'8px 12px',border:'0.5px solid #ddd',borderRadius:8,background:'transparent',color:'inherit',fontFamily:'inherit',fontSize:13}} />
            <button onClick={()=>sendFriendRequest(document.getElementById('friend-input').value)} style={{padding:'8px 12px',border:'0.5px solid #ddd',borderRadius:8,background:'transparent',cursor:'pointer',fontFamily:'inherit',fontSize:13}}>Ajouter</button>
          </div>

          {friendFeed.length===0 && <p style={{color:'#aaa',fontSize:14}}>Aucune note de tes amis pour l'instant.</p>}
          {friendFeed.map(r=>(
            <div key={r.id} style={{background:'var(--background)',border:'0.5px solid #ddd',borderRadius:12,padding:'1rem',marginBottom:10}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <div style={{width:32,height:32,borderRadius:'50%',background:'#E6F1FB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500,color:'#185FA5'}}>{r.profiles?.avatar_initials}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500}}>@{r.profiles?.username}</div>
                  <div style={{fontSize:11,color:'#aaa'}}>{timeAgo(r.created_at)}</div>
                </div>
                <span style={{color:'#EF9F27',fontSize:14}}>{'★'.repeat(r.stars)}{'☆'.repeat(5-r.stars)}</span>
              </div>
              <div style={{background:'#f9f9f9',borderRadius:8,padding:'8px 12px',marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontSize:13,fontWeight:500}}>{r.match_teams}</span>
                  <span style={{fontSize:13,color:'#888'}}>{r.match_score}</span>
                </div>
              </div>
              {r.comment && <p style={{fontSize:13,color:'#666',lineHeight:1.5}}>{r.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {tab==='profil' && (
        <div>
          <div style={{border:'0.5px solid #ddd',borderRadius:12,padding:'1rem',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:50,height:50,borderRadius:'50%',background:'#E6F1FB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:500,color:'#185FA5'}}>{profile?.avatar_initials}</div>
            <div>
              <div style={{fontWeight:500}}>@{profile?.username}</div>
              <div style={{fontSize:13,color:'#aaa'}}>{user?.email}</div>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:16}}>
            <div style={{background:'#f9f9f9',borderRadius:8,padding:'10px',textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:500}}>{ratings.filter(r=>r.user_id===user.id).length}</div>
              <div style={{fontSize:11,color:'#aaa'}}>Matchs notés</div>
            </div>
            <div style={{background:'#f9f9f9',borderRadius:8,padding:'10px',textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:500}}>
                {ratings.filter(r=>r.user_id===user.id).length ? (ratings.filter(r=>r.user_id===user.id).reduce((a,r)=>a+r.stars,0)/ratings.filter(r=>r.user_id===user.id).length).toFixed(1) : '-'}
              </div>
              <div style={{fontSize:11,color:'#aaa'}}>Note moyenne</div>
            </div>
          </div>
          <p style={{fontSize:12,color:'#aaa',marginBottom:10}}>Mes notes</p>
          {ratings.filter(r=>r.user_id===user.id).map(r=>(
            <div key={r.id} style={{border:'0.5px solid #ddd',borderRadius:10,padding:'10px 14px',marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <div>
                  <div style={{fontSize:14,fontWeight:500}}>{r.match_teams}</div>
                  <div style={{fontSize:11,color:'#aaa'}}>{r.match_league} · {r.match_date}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{color:'#EF9F27'}}>{'★'.repeat(r.stars)}</span>
                  <button onClick={()=>deleteRating(r.id)} style={{fontSize:11,color:'#E24B4A',background:'transparent',border:'0.5px solid #E24B4A',borderRadius:6,padding:'2px 8px',cursor:'pointer',fontFamily:'inherit'}}>Supprimer</button>
                </div>
              </div>
              {r.comment && <p style={{fontSize:12,color:'#888',marginTop:4}}>{r.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div onClick={e=>e.target===e.currentTarget&&setModal(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}>
          <div style={{background:'var(--background)',borderRadius:16,padding:'1.5rem',width:340,maxWidth:'90vw',border:'0.5px solid #ddd'}}>
            <div style={{fontSize:16,fontWeight:500,marginBottom:12}}>Noter ce match</div>
            <div style={{background:'#f9f9f9',borderRadius:10,padding:'12px',marginBottom:16,textAlign:'center'}}>
              <div style={{fontSize:17,fontWeight:500}}>{modal.teams}</div>
              <div style={{fontSize:13,color:'#888'}}>{modal.score} · {modal.league}</div>
            </div>
            <div style={{display:'flex',justifyContent:'center',gap:10,marginBottom:16}}>
              {[1,2,3,4,5].map(s=>(
                <span key={s} onClick={()=>setModalStars(s)} style={{fontSize:32,cursor:'pointer',color:s<=modalStars?'#EF9F27':'#ddd'}}>★</span>
              ))}
            </div>
            <textarea value={modalComment} onChange={e=>setModalComment(e.target.value)} placeholder="Ton avis... (optionnel)" style={{width:'100%',padding:'8px 12px',border:'0.5px solid #ddd',borderRadius:8,resize:'none',height:70,background:'transparent',color:'inherit',fontFamily:'inherit',fontSize:13}} />
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button onClick={()=>setModal(null)} style={{flex:1,padding:'9px',border:'0.5px solid #ddd',borderRadius:8,background:'transparent',cursor:'pointer',fontFamily:'inherit'}}>Annuler</button>
              <button onClick={submitRating} style={{flex:1,padding:'9px',border:'none',borderRadius:8,background:'#000',color:'#fff',cursor:'pointer',fontFamily:'inherit'}}>Publier</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}